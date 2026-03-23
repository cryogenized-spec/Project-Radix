import { GoogleGenAI } from '@google/genai';
import { getSetting, incrementExaApiUsage, addAgentTelemetryLog } from './db';
import yaml from 'js-yaml';

// Define tools
const tools = {
  'internal.get_chat_list': async () => {
    // Mock implementation for now, should connect to local DB
    return "You have 2 unread messages from Buddy X.";
  },
  'internal.get_calendar': async () => {
    return "No upcoming events today.";
  },
  'external.exa_search': async (query: string) => {
    const exaKey = await getSetting('exaApiKey');
    if (!exaKey) return "Error: Exa API key not configured.";
    
    try {
      await incrementExaApiUsage();
      const response = await fetch('/api/exa/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': exaKey
        },
        body: JSON.stringify({
          query,
          numResults: 3,
          useAutoprompt: true
        })
      });
      const data = await response.json();
      return JSON.stringify(data.results);
    } catch (e: any) {
      return `Error searching Exa: ${e.message}`;
    }
  },
  'system.trigger_push_notification': async (message: string) => {
    try {
      const { getSavedPushSubscription } = await import('./pushNotifications');
      const sub = await getSavedPushSubscription();
      if (!sub) return "Error: Push notifications not subscribed.";
      
      await fetch('/api/dispatch-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          payload: { title: 'Agent Alert', body: message }
        })
      });
      return "Push notification sent.";
    } catch (e: any) {
      return `Error sending push: ${e.message}`;
    }
  },
  'none': async () => {
    return "No action taken.";
  }
};

export const executeAgentWorkflow = async (yamlLogic: string, apiKey: string, agentId?: string) => {
  try {
    const parsed = yaml.load(yamlLogic) as any;
    if (!parsed || !parsed.nodes) throw new Error("Invalid YAML");

    const nodes = parsed.nodes;
    let currentNodeId = 'start';
    let context = "Agent Workflow Execution Log:\\n";

    const ai = new GoogleGenAI({ apiKey });

    while (currentNodeId && currentNodeId !== 'end') {
      const node = nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      context += `\nExecuting Node: ${node.id} (${node.description})\n`;
      
      if (agentId) {
        await addAgentTelemetryLog({
          agentId,
          type: 'node_execution',
          nodeId: node.id,
          description: node.description,
          tool: node.tool
        });
      }
      
      let toolResult = "";
      if (node.tool && tools[node.tool as keyof typeof tools]) {
        // For external search or notifications, we might need the AI to generate the parameters
        let param = "";
        if (node.tool === 'external.exa_search' || node.tool === 'system.trigger_push_notification') {
           const paramPrompt = `Based on the context, generate the string parameter for the tool ${node.tool}.\nContext: ${context}\nNode Description: ${node.description}\nOutput ONLY the raw string parameter.`;
           const paramRes = await ai.models.generateContent({
             model: 'gemini-3.1-flash-lite-preview',
             contents: paramPrompt
           });
           param = paramRes.text || "";
        }
        
        toolResult = await (tools[node.tool as keyof typeof tools] as any)(param);
        context += `Tool Result: ${toolResult}\n`;
        
        if (agentId) {
          await addAgentTelemetryLog({
            agentId,
            type: 'tool_result',
            nodeId: node.id,
            tool: node.tool,
            result: toolResult
          });
        }
      } else if (node.tool && node.tool !== 'none') {
        context += `Tool ${node.tool} not found.\n`;
      }

      if (node.type === 'condition') {
        const prompt = `
You are evaluating a condition in an agent workflow.
Context:
${context}

Condition to evaluate: ${node.description}

Based on the context and the tool result, is the condition met?
Output ONLY "YES" or "NO".
`;
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt
        });
        
        const answer = response.text?.trim().toUpperCase() || "NO";
        context += `Condition Evaluated: ${answer}\n`;
        
        if (agentId) {
          await addAgentTelemetryLog({
            agentId,
            type: 'condition_evaluated',
            nodeId: node.id,
            condition: node.description,
            answer
          });
        }
        
        if (answer.includes("YES")) {
          currentNodeId = node.if_yes;
        } else {
          currentNodeId = node.if_no;
        }
      } else {
        currentNodeId = node.next;
      }
    }
    
    context += "\\nWorkflow Completed.";
    console.log(context);
    return context;
  } catch (error) {
    console.error("Workflow Execution Error:", error);
    throw error;
  }
};
