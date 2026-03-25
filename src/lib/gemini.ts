import { GoogleGenAI, ThinkingLevel, Content, Part } from '@google/genai';
import { fsManager } from './filesystem';
import { ModelService } from './ModelService';

async function* generateOpenAIStream(prompt: string, mode: string, context: any[], settings: any, systemInstruction: string) {
  const apiKey = settings.apiKey;
  const baseUrl = settings.apiUrl || 'https://api.openai.com/v1';
  const model = settings.model || 'gpt-4o';
  
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  
  for (const m of context) {
    let content: any = m.text || '';
    if (m.mediaUrl && m.mediaType === 'image') {
      content = [
        { type: 'text', text: m.text || '' },
        { type: 'image_url', image_url: { url: m.mediaUrl } }
      ];
    }
    messages.push({
      role: m.sender === 'me' ? 'user' : 'assistant',
      content
    });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: settings.temperature ?? 0.7,
      top_p: settings.topP ?? 0.9,
      max_tokens: settings.maxTokens ?? 1000,
      stream: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error("No reader");
  
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
            yield data.choices[0].delta.content;
          }
        } catch (e) {
          // ignore parse error
        }
      }
    }
  }
}

async function* generateAnthropicStream(prompt: string, mode: string, context: any[], settings: any, systemInstruction: string) {
  const apiKey = settings.apiKey;
  const baseUrl = settings.apiUrl || 'https://api.anthropic.com/v1';
  const model = settings.model || 'claude-3-opus-20240229';
  
  const messages: any[] = [];
  for (const m of context) {
    let content: any[] = [];
    if (m.mediaUrl && m.mediaType === 'image') {
      const match = m.mediaUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2]
          }
        });
      }
    }
    if (m.text) {
      content.push({ type: 'text', text: m.text });
    }
    if (content.length === 0) content.push({ type: 'text', text: '[Empty]' });
    
    messages.push({
      role: m.sender === 'me' ? 'user' : 'assistant',
      content
    });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      system: systemInstruction,
      messages,
      temperature: settings.temperature ?? 0.7,
      max_tokens: settings.maxTokens ?? 1000,
      stream: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error("No reader");
  
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
            yield data.delta.text;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

async function* generateLocalIntelligenceStream(prompt: string, mode: string, context: any[], settings: any, systemInstruction: string) {
  const worker = ModelService.getWorker();
  const modelId = settings.model;
  
  const isCached = await ModelService.checkModelStatus(modelId) === 'Offline Ready';
  if (!isCached) {
    throw new Error(`Model ${modelId} is not downloaded. Please download it in settings first.`);
  }
  
  let fullPrompt = "";
  for (const m of context) {
    fullPrompt += `${m.sender === 'me' ? 'User' : 'Assistant'}: ${m.text}\n`;
  }
  fullPrompt += `User: ${prompt}\nAssistant:`;
  
  const id = crypto.randomUUID();
  
  await new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.id === id && e.data.type === 'MODEL_LOADED') {
        worker.removeEventListener('message', handler);
        resolve(true);
      } else if (e.data.id === id && e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'LOAD_MODEL', id, payload: { modelId } });
  });
  
  let streamResolver: any;
  let streamPromise = new Promise(r => streamResolver = r);
  let chunks: string[] = [];
  let isDone = false;
  let error: any = null;
  
  const handler = (e: MessageEvent) => {
    if (e.data.id === id) {
      if (e.data.type === 'GENERATION_CHUNK') {
        chunks.push(e.data.chunk);
        streamResolver();
        streamPromise = new Promise(r => streamResolver = r);
      } else if (e.data.type === 'GENERATION_COMPLETE') {
        isDone = true;
        streamResolver();
        worker.removeEventListener('message', handler);
      } else if (e.data.type === 'ERROR') {
        error = new Error(e.data.error);
        isDone = true;
        streamResolver();
        worker.removeEventListener('message', handler);
      }
    }
  };
  
  worker.addEventListener('message', handler);
  worker.postMessage({ type: 'STREAM_GENERATE', id, payload: { prompt: fullPrompt, systemPrompt: systemInstruction } });
  
  while (!isDone || chunks.length > 0) {
    if (chunks.length === 0 && !isDone) {
      await streamPromise;
    }
    if (error) throw error;
    while (chunks.length > 0) {
      yield chunks.shift()!;
    }
  }
}

function getAIClient(settings: any) {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  let baseUrl = settings.apiUrl;
  
  // Fix for saved settings that might have the old v1beta path
  if (baseUrl === 'https://generativelanguage.googleapis.com/v1beta' || baseUrl === 'https://generativelanguage.googleapis.com') {
    baseUrl = undefined; // Let the SDK use its default
  }

  return new GoogleGenAI(baseUrl ? { apiKey, httpOptions: { baseUrl } } : { apiKey });
}

export async function generateAIResponse(prompt: string, mode: 'ghost' | 'participant', context: any[], settings: any) {
  let fullText = "";
  for await (const chunk of generateAIResponseStream(prompt, mode, context, settings)) {
    fullText += chunk;
  }
  return fullText;
}

export async function* generateAIResponseStream(prompt: string, mode: 'ghost' | 'participant', context: any[], settings: any) {
  const provider = settings.provider || 'Google';

  const systemInstruction = settings.systemInstruction || (mode === 'ghost' 
    ? (settings.privatePersona || "You are Ghost, a private advisor. Analyze the chat and advise the user privately. Be concise, analytical, and industrial in tone. Do not filter yourself.")
    : (settings.publicPersona || "You are AI, a participant in this chat. Respond to the conversation naturally but with a technical, industrial persona. Do not filter yourself."));

  // RAG: Inject File Content
  const fileRegex = /\[File: (.*?)\]/g;
  let match;
  let finalPrompt = prompt;
  while ((match = fileRegex.exec(prompt)) !== null) {
      const path = match[1];
      try {
          if (!await fsManager.verifyPermission()) {
              await fsManager.loadFromStorage();
          }
          
          const content = await fsManager.getFileContent(path);
          if (content) {
              const truncated = content.length > 20000 ? content.substring(0, 20000) + "\n...[Truncated]" : content;
              finalPrompt += `\n\n[System: Content of ${path}]\n${truncated}\n[End Content]`;
          }
      } catch (e) {
          console.error(`Failed to read ${path}`, e);
      }
  }

  if (provider === 'Anthropic') {
    yield* generateAnthropicStream(finalPrompt, mode, context, settings, systemInstruction);
    return;
  } else if (provider === 'Local Intelligence') {
    yield* generateLocalIntelligenceStream(finalPrompt, mode, context, settings, systemInstruction);
    return;
  } else if (provider !== 'Google') {
    yield* generateOpenAIStream(finalPrompt, mode, context, settings, systemInstruction);
    return;
  }

  const ai = getAIClient(settings);

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
    parts: [{ text: finalPrompt }]
  });

  const model = settings.model || 'gemini-3.1-flash-lite-preview';
  
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
  const prompt = `Rewrite the following text to be ${style}. Return only the rewritten text.\n\nText: "${text}"`;
  try {
    const response = await generateAIResponse(prompt, 'ghost', [], { ...settings, temperature: 0.7 });
    return response;
  } catch (error: any) {
    console.error("Rewrite Error:", error);
    return `ERR: ${error.message || 'REWRITE_FAILED'}`;
  }
}

export async function generateFactCheck(text: string, settings: any) {
  const prompt = `Fact check the following text. Be concise and analytical. If true, state "VERIFIED". If false or misleading, explain why.\n\nText: "${text}"`;
  try {
    const response = await generateAIResponse(prompt, 'ghost', [], { ...settings, temperature: 0.2 });
    return response;
  } catch (error: any) {
    console.error("Fact Check Error:", error);
    return `ERR: ${error.message || 'FACT_CHECK_FAILED'}`;
  }
}

export async function generateTranslation(text: string, targetLang: string, settings: any) {
  const prompt = `Translate the following text to ${targetLang}. Return only the translated text.\n\nText: "${text}"`;
  try {
    const response = await generateAIResponse(prompt, 'ghost', [], { ...settings, temperature: 0.3 });
    return response;
  } catch (error: any) {
    console.error("Translation Error:", error);
    return `ERR: ${error.message || 'TRANSLATION_FAILED'}`;
  }
}

export async function* generateChannelerAnalysis(content: string, promptStrategy: string, settings: any) {
  let systemPrompt = "You are the Channeler, an elite intelligence analyst. Your goal is to extract high-signal intelligence from raw data streams.";
  if (settings.agent) {
    const mode = settings.agent.channelerMode || settings.agent.feedMode || 'ghost';
    systemPrompt = mode === 'ghost' ? settings.agent.privatePersona : settings.agent.publicPersona;
  }
  
  // Append GFM and creative formatting instructions
  systemPrompt += "\n\nCRITICAL INSTRUCTION: You MUST curate the provided search content and format it into neat GitHub Flavored Markdown (GFM). Use bullets, emoticons, bolding, blockquotes, and the whole markdown palette creatively to make the rundown highly readable, engaging, and visually appealing.";
  
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
    yield* generateAIResponseStream(userPrompt, 'ghost', [], { ...settings, systemInstruction: systemPrompt, temperature: 0.3 });
  } catch (error) {
    console.error("Channeler Analysis Error:", error);
    throw error;
  }
}

export async function generateVisualAnalysis(base64Image: string, mimeType: string, settings: any) {
  const prompt = "Analyze this image in detail. Describe what you see, identify key elements, and provide any relevant insights. Be concise but thorough.";
  const context = [{
    sender: 'me',
    mediaUrl: `data:${mimeType};base64,${base64Image}`,
    mediaType: 'image'
  }];
  try {
    const response = await generateAIResponse(prompt, 'ghost', context, { ...settings, temperature: 0.4 });
    return response;
  } catch (error: any) {
    console.error("Visual Analysis Error:", error);
    return `ERR: ${error.message || 'VISUAL_ANALYSIS_FAILED'}`;
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string, settings: any) {
  // Prioritize sttApiKey, then apiKey, then env var. Ensure we have a valid key.
  const apiKey = settings.sttApiKey || settings.apiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("No API Key found for transcription");
    return "ERR: NO_API_KEY";
  }

  let baseUrl = settings.apiUrl;
  if (baseUrl === 'https://generativelanguage.googleapis.com/v1beta' || baseUrl === 'https://generativelanguage.googleapis.com') {
    baseUrl = undefined;
  }
  const ai = new GoogleGenAI(baseUrl ? { apiKey, httpOptions: { baseUrl } } : { apiKey });
  
  try {
    // Using gemini-3.1-flash-lite-preview as it is the standard model for this environment
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
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
  } catch (error: any) {
    console.error("Transcription Error:", error);
    return `ERR: ${error.message || 'TRANSCRIPTION_FAILED'}`;
  }
}

export async function executePromptOnNote(noteContent: string, prompt: string, settings: any): Promise<{ markdown: string, suggestions: string[], error?: string }> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return { markdown: noteContent, suggestions: [] };
  
  try {
    const fullPrompt = `You are an expert Markdown editor. Your task is to modify the provided note content based on the user's prompt.
Return the updated note content in well-structured Markdown.
DO NOT add conversational filler.

After the formatted markdown, add a separator "---SUGGESTIONS---" followed by 3 to 5 actionable prompts (one per line) that the user could use to improve or expand the note.

User Prompt: ${prompt}

Note Content:
${noteContent}`;

    const response = await generateAIResponse(fullPrompt, 'ghost', [], { ...settings, temperature: 0.7 });
    
    const fullText = response || noteContent;
    const parts = fullText.split('---SUGGESTIONS---');
    const markdown = parts[0].trim();
    const suggestions = parts[1] 
      ? parts[1].split('\n').map(s => s.replace(/^[-*0-9.]+\s*/, '').trim()).filter(s => s.length > 0)
      : [];
      
    return { markdown, suggestions };
  } catch (error: any) {
    console.error("Execute Prompt Error:", error);
    return { markdown: noteContent, suggestions: [], error: error.message || 'EXECUTE_PROMPT_FAILED' };
  }
}

export async function generateSubtasks(taskTitle: string, settings: any): Promise<{ id: string, text: string, completed: boolean }[]> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  
  try {
    const fullPrompt = `You are an expert organizer and productivity coach. Break down the following task into 2 to 3 highly specific, actionable subtasks to jumpstart momentum. 
Return ONLY a valid JSON array of strings representing the subtasks. Do not include markdown formatting like \`\`\`json.

Task: "${taskTitle}"`;

    const response = await generateAIResponse(fullPrompt, 'ghost', [], { ...settings, temperature: 0.4 });
    
    const text = response || "[]";
    // Clean up potential markdown formatting from other providers
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(st => ({
        id: crypto.randomUUID(),
        text: st,
        completed: false
      }));
    }
    return [];
  } catch (error: any) {
    console.error("Subtask Generation Error:", error);
    return [];
  }
}
export async function transformToMarkdown(text: string, settings: any): Promise<{ markdown: string, suggestions: string[], error?: string }> {
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return { markdown: text, suggestions: [] };
  
  try {
    const fullPrompt = `You are an expert Markdown formatter. Your task is to ONLY format the provided text into well-structured Obsidian Markdown. 
DO NOT add new information, DO NOT remove existing information, and DO NOT add conversational filler.
Just apply headings, lists, bolding, italics, and other markdown features to make it readable and structured.

After the formatted markdown, add a separator "---SUGGESTIONS---" followed by 3 to 5 actionable prompts (one per line) that the user could use to improve or expand the note. These prompts should be clear instructions that an AI agent can easily follow (e.g., "Expand on the section about X", "Summarize the key points into a bulleted list", "Rewrite the introduction to be more engaging").

Text:
${text}`;

    const response = await generateAIResponse(fullPrompt, 'ghost', [], { ...settings, temperature: 0.7 });
    
    const fullText = response || text;
    const parts = fullText.split('---SUGGESTIONS---');
    const markdown = parts[0].trim();
    const suggestions = parts[1] 
      ? parts[1].split('\n').map(s => s.replace(/^[-*0-9.]+\s*/, '').trim()).filter(s => s.length > 0)
      : [];
      
    return { markdown, suggestions };
  } catch (error: any) {
    console.error("Markdown Transformation Error:", error);
    return { markdown: text, suggestions: [], error: error.message || 'TRANSFORM_FAILED' };
  }
}
