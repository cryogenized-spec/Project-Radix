import React, { useState } from 'react';
import { X, Search, Database, Loader2, Send } from 'lucide-react';
import { LibrarianAPI } from '../lib/LibrarianAPI';
import { generateAIResponse } from '../lib/gemini';
import { getSetting } from '../lib/db';

interface AgenticRetrievalModalProps {
  onClose: () => void;
  onResult: (text: string) => void;
}

export default function AgenticRetrievalModal({ onClose, onResult }: AgenticRetrievalModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRetrieve = async () => {
    if (!prompt.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // 1. Architect LLM parses prompt to generate search query
      setStatus('Architect is analyzing request...');
      const aiSettings = await getSetting('ai_settings') || {};
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;

      const queryInstruction = `You are the Architect LLM. The user wants to query their local knowledge base.
User prompt: "${prompt}"
Generate a concise search query (just the keywords) to find the most relevant information in their notes. Return ONLY the search query string.`;

      const searchQuery = await generateAIResponse(
        queryInstruction,
        'participant',
        [],
        { ...aiSettings, apiKey, systemInstruction: '' }
      );

      // 2. Librarian embeds the query and searches IndexedDB
      setStatus(`Librarian is searching for: "${searchQuery.trim()}"...`);
      await LibrarianAPI.initializeModels();
      const queryEmbedding = await LibrarianAPI.embedText(searchQuery.trim(), 'search_query');
      const searchResults = await LibrarianAPI.search(queryEmbedding, 5);

      if (searchResults.length === 0) {
        setStatus('No relevant documents found.');
        // Still let the Architect answer, but without context
      }

      // 3. Architect generates final response based on retrieved context
      setStatus('Architect is formulating response...');
      const contextText = searchResults.map(r => `[Source: ${r.node.metadata.filename || r.node.id}]\n${r.node.content}`).join('\n\n---\n\n');
      
      const finalInstruction = `You are the Architect LLM. Answer the user's prompt based on the provided context from their local knowledge base.
If the context doesn't contain the answer, you can use your general knowledge but mention that it wasn't found in their notes.

Context:
${contextText}

User prompt: "${prompt}"`;

      const finalResponse = await generateAIResponse(
        finalInstruction,
        'participant',
        [],
        { ...aiSettings, apiKey, systemInstruction: '' }
      );

      onResult(finalResponse);
      onClose();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during retrieval.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
            <Database size={18} className="text-[var(--accent)]" />
            Agentic Retrieval (RAG)
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[var(--panel-bg)] rounded-full text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Ask a question, and the Architect will consult the Librarian to search your local AI Vault for answers.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What do you want to know from your notes?"
            className="w-full h-32 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] resize-none mb-4"
            disabled={isProcessing}
          />

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs">
              {error}
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 text-xs text-[var(--accent)] bg-[var(--accent)]/10 p-3 rounded-xl border border-[var(--accent)]/20">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span className="font-medium">{status}</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleRetrieve}
            disabled={!prompt.trim() || isProcessing}
            className="px-4 py-2 bg-[var(--accent)] text-black rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-opacity"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isProcessing ? 'Processing...' : 'Ask Architect'}
          </button>
        </div>
      </div>
    </div>
  );
}
