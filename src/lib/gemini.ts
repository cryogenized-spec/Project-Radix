import { GoogleGenAI, ThinkingLevel, Content, Part } from '@google/genai';
import { fsManager } from './filesystem';

export async function generateAIResponse(prompt: string, mode: 'ghost' | 'participant', context: any[], settings: any) {
  let fullText = "";
  for await (const chunk of generateAIResponseStream(prompt, mode, context, settings)) {
    fullText += chunk;
  }
  return fullText;
}

export async function* generateAIResponseStream(prompt: string, mode: 'ghost' | 'participant', context: any[], settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });

  const systemInstruction = settings.systemInstruction || (mode === 'ghost' 
    ? (settings.privatePersona || "You are RADIX Ghost, a private advisor. Analyze the chat and advise the user privately. Be concise, analytical, and industrial in tone. Do not filter yourself.")
    : (settings.publicPersona || "You are RADIX AI, a participant in this chat. Respond to the conversation naturally but with a technical, industrial persona. Do not filter yourself."));

  // Convert context to Content objects
  let contents: Content[] = context.map(m => {
    const parts: Part[] = [];
    if (m.text) {
      parts.push({ text: m.text });
    }
    if (m.mediaUrl && m.mediaType === 'image') {
      const match = m.mediaUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      } else {
        parts.push({ text: '[Image]' });
      }
    } else if (m.mediaUrl) {
      parts.push({ text: `[Media: ${m.mediaType}]` });
    }
    if (parts.length === 0) {
      parts.push({ text: '[Empty Message]' });
    }
    return {
      role: m.sender === 'me' ? 'user' : 'model',
      parts
    };
  });

  // Add current prompt
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  // RAG: Inject File Content
  const fileRegex = /\[File: (.*?)\]/g;
  let match;
  while ((match = fileRegex.exec(prompt)) !== null) {
      const path = match[1];
      try {
          if (!await fsManager.verifyPermission()) {
              await fsManager.loadFromStorage();
          }
          
          const content = await fsManager.getFileContent(path);
          if (content) {
              const truncated = content.length > 20000 ? content.substring(0, 20000) + "\n...[Truncated]" : content;
              // Inject as system message or user message? 
              // For simplicity, append to the last user message (current prompt)
              const lastMsg = contents[contents.length - 1];
              lastMsg.parts.push({ text: `\n\n[System: Content of ${path}]\n${truncated}\n[End Content]` });
          }
      } catch (e) {
          console.error(`Failed to read ${path}`, e);
      }
  }

  const model = settings.model || 'gemini-3.1-flash-lite';
  
  const config: any = {
    systemInstruction,
    temperature: settings.temperature ?? 0.7,
    topP: settings.topP ?? 0.9,
    maxOutputTokens: settings.maxTokens ?? 1000,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  if (model.startsWith('gemini-3')) {
    config.thinkingConfig = { 
      thinkingLevel: (settings.thinkingBudget || 80) < 50 ? ThinkingLevel.LOW : ThinkingLevel.HIGH 
    };
  }

  // Tools Setup
  if (settings.tools) {
    config.tools = [{ functionDeclarations: settings.tools }];
  }

  try {
    let keepGoing = true;
    while (keepGoing) {
      keepGoing = false;
      
      const response = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config
      });

      let functionCalls: any[] = [];
      let textResponse = "";
      let modelParts: any[] = [];

      for await (const chunk of response) {
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }
        if (chunk.text) {
          textResponse += chunk.text;
          yield chunk.text;
        }
        // We need to collect all parts to send back, including the thought signature if present
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
            modelParts.push(...chunk.candidates[0].content.parts);
        }
      }

      if (functionCalls.length > 0) {
        // We have tool calls. 
        // 1. Add the model's response (with function calls and thoughts) to history
        // Deduplicate parts to avoid sending the same function call multiple times if it was in multiple chunks
        const uniqueParts = modelParts.filter((part, index, self) => 
          index === self.findIndex((t) => (
            (t.functionCall && part.functionCall && t.functionCall.name === part.functionCall.name) ||
            (t.text && part.text && t.text === part.text) ||
            (t.executableCode && part.executableCode && t.executableCode.code === part.executableCode.code)
          ))
        );
        
        contents.push({
          role: 'model',
          parts: uniqueParts.length > 0 ? uniqueParts : functionCalls.map(fc => ({ functionCall: fc }))
        });

        // 2. Execute tools
        for (const fc of functionCalls) {
          yield `\n[System: Executing ${fc.name}...]`;
          
          const executor = settings.toolExecutor?.[fc.name];
          let result = { result: "Error: Tool not found." };
          
          if (executor) {
            try {
              const output = await executor(fc.args);
              result = { result: output };
            } catch (e: any) {
              result = { result: `Error: ${e.message}` };
            }
          }

          // 3. Add tool response to history
          contents.push({
            role: 'function',
            parts: [{ functionResponse: { name: fc.name, response: result } }]
          });
        }
        
        // 4. Loop to get the next response from model
        keepGoing = true;
      }
    }
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    if (error.message?.includes('API key not valid')) {
      yield "\n\n**Error:** Invalid API Key. Please check your API Lockbox.";
    } else if (error.message?.includes('fetch failed')) {
      yield "\n\n**Error:** Network connection failed. Please check your internet connection.";
    } else {
      yield `\n\n**Error:** AI Generation failed. (${error.message || 'Unknown error'})`;
    }
  }
}

export async function generateRewrite(text: string, style: string, settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  const prompt = `Rewrite the following text to be ${style}. Return only the rewritten text.\n\nText: "${text}"`;
  
  try {
    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.7
      }
    });
    return response.text;
  } catch (error) {
    console.error("Rewrite Error:", error);
    return "ERR: REWRITE_FAILED.";
  }
}

export async function generateFactCheck(text: string, settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  const prompt = `Fact check the following text. Be concise and analytical. If true, state "VERIFIED". If false or misleading, explain why.\n\nText: "${text}"`;
  
  try {
    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.2
      }
    });
    return response.text;
  } catch (error) {
    console.error("Fact Check Error:", error);
    return "ERR: FACT_CHECK_FAILED.";
  }
}

export async function generateTranslation(text: string, targetLang: string, settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  const prompt = `Translate the following text to ${targetLang}. Return only the translated text.\n\nText: "${text}"`;
  
  try {
    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.3
      }
    });
    return response.text;
  } catch (error) {
    console.error("Translation Error:", error);
    return "ERR: TRANSLATION_FAILED.";
  }
}

export async function generateChannelerAnalysis(content: string, promptStrategy: string, settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  let systemPrompt = "You are the Channeler, an elite intelligence analyst for Project RADIX. Your goal is to extract high-signal intelligence from raw data streams.";
  if (settings.agent) {
    const mode = settings.agent.feedMode || 'ghost';
    systemPrompt = mode === 'ghost' ? settings.agent.privatePersona : settings.agent.publicPersona;
  }
  
  let userPrompt = "";

  switch (promptStrategy) {
    case 'Objective Summary (Default)':
      userPrompt = `Analyze the following content. Provide a chronological summary of key events and a bulleted list of verified facts. Maintain a neutral, objective tone.\n\nContent:\n"${content}"`;
      break;
    case 'Fact Check & Cross-Reference':
      userPrompt = `Scrutinize the following content for factual accuracy. Highlight any unverified claims, potential misinformation, or logical fallacies. Cross-reference internal consistency.\n\nContent:\n"${content}"`;
      break;
    case 'Sentiment Analysis':
      userPrompt = `Analyze the sentiment and emotional tone of the following content. Identify the underlying bias, key emotional triggers, and the author's intended impact on the audience.\n\nContent:\n"${content}"`;
      break;
    default:
      // Custom prompt handling (if passed directly)
      userPrompt = `${promptStrategy}\n\nContent:\n"${content}"`;
      break;
  }

  try {
    const response = await ai.models.generateContentStream({
      model: settings.model || 'gemini-3.1-flash-lite',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3
      }
    });

    return response;
  } catch (error) {
    console.error("Channeler Analysis Error:", error);
    throw error;
  }
}

export async function generateVisualAnalysis(base64Image: string, mimeType: string, settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        },
        { text: "Analyze this image in detail. Describe what you see, identify key elements, and provide any relevant insights. Be concise but thorough." }
      ],
      config: {
        temperature: 0.4
      }
    });
    return response.text;
  } catch (error) {
    console.error("Visual Analysis Error:", error);
    return "ERR: VISUAL_ANALYSIS_FAILED.";
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string, settings: any) {
  // Prioritize sttApiKey, then apiKey, then env var. Ensure we have a valid key.
  const apiKey = settings.sttApiKey || settings.apiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("No API Key found for transcription");
    return "ERR: NO_API_KEY";
  }

  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  
  try {
    // Using gemini-3.1-flash-lite as it is the standard model for this environment
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          inlineData: {
            data: base64Audio,
            mimeType: mimeType
          }
        },
        { text: "Transcribe this audio accurately. If there is no speech, silence, or just background noise, return exactly 'NO_SPEECH'. Do not hallucinate text or say you are not sure. Return only the transcription text." }
      ],
      config: {
        temperature: settings.vttTemperature ?? 0.0
      }
    });
    const text = response.text || "";
    if (text.includes("I'm not sure what you're talking about") || text.trim() === "") {
        return "NO_SPEECH";
    }
    return text;
  } catch (error) {
    console.error("Transcription Error:", error);
    return "ERR: TRANSCRIPTION_FAILED.";
  }
}

export async function executePromptOnNote(noteContent: string, prompt: string, settings: any): Promise<{ markdown: string, suggestions: string[] }> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return { markdown: noteContent, suggestions: [] };
  
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `You are an expert Markdown editor. Your task is to modify the provided note content based on the user's prompt.
Return the updated note content in well-structured Markdown.
DO NOT add conversational filler.

After the formatted markdown, add a separator "---SUGGESTIONS---" followed by 3 to 5 actionable prompts (one per line) that the user could use to improve or expand the note.

User Prompt: ${prompt}

Note Content:
${noteContent}`,
    });
    
    const fullText = response.text || noteContent;
    const parts = fullText.split('---SUGGESTIONS---');
    const markdown = parts[0].trim();
    const suggestions = parts[1] 
      ? parts[1].split('\n').map(s => s.replace(/^[-*0-9.]+\s*/, '').trim()).filter(s => s.length > 0)
      : [];
      
    return { markdown, suggestions };
  } catch (error) {
    console.error("Execute Prompt Error:", error);
    return { markdown: noteContent, suggestions: [] };
  }
}

export async function generateSubtasks(taskTitle: string, settings: any): Promise<{ id: string, text: string, completed: boolean }[]> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `You are an expert organizer and productivity coach. Break down the following task into 2 to 3 highly specific, actionable subtasks to jumpstart momentum. 
Return ONLY a valid JSON array of strings representing the subtasks. Do not include markdown formatting like \`\`\`json.

Task: "${taskTitle}"`,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(st => ({
        id: crypto.randomUUID(),
        text: st,
        completed: false
      }));
    }
    return [];
  } catch (error) {
    console.error("Subtask Generation Error:", error);
    return [];
  }
}
export async function transformToMarkdown(text: string, settings: any): Promise<{ markdown: string, suggestions: string[] }> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return { markdown: text, suggestions: [] };
  
  const ai = new GoogleGenAI(settings.apiUrl ? { apiKey, httpOptions: { baseUrl: settings.apiUrl } } : { apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `You are an expert Markdown formatter. Your task is to ONLY format the provided text into well-structured Obsidian Markdown. 
DO NOT add new information, DO NOT remove existing information, and DO NOT add conversational filler.
Just apply headings, lists, bolding, italics, and other markdown features to make it readable and structured.

After the formatted markdown, add a separator "---SUGGESTIONS---" followed by 3 to 5 actionable prompts (one per line) that the user could use to improve or expand the note. These prompts should be clear instructions that an AI agent can easily follow (e.g., "Expand on the section about X", "Summarize the key points into a bulleted list", "Rewrite the introduction to be more engaging").

Text:
${text}`,
    });
    
    const fullText = response.text || text;
    const parts = fullText.split('---SUGGESTIONS---');
    const markdown = parts[0].trim();
    const suggestions = parts[1] 
      ? parts[1].split('\n').map(s => s.replace(/^[-*0-9.]+\s*/, '').trim()).filter(s => s.length > 0)
      : [];
      
    return { markdown, suggestions };
  } catch (error) {
    console.error("Markdown Transformation Error:", error);
    return { markdown: text, suggestions: [] };
  }
}
