import React, { useState } from 'react';
import { useEmail } from '../lib/RadixEmailProvider';
import { Mail, Send, Inbox, Clock, Paperclip, X, ChevronLeft, FileText, AlertOctagon } from 'lucide-react';
import { format } from 'date-fns';

export default function EmailDispatch() {
  const { messages, sendDispatch } = useEmail();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'drafts' | 'spam'>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filteredMessages = messages.filter(m => {
    if (activeTab === 'inbox') return m.status === 'Received';
    if (activeTab === 'sent') return m.status === 'Sent';
    if (activeTab === 'drafts') return m.status === 'Draft';
    return false; // Spam not implemented yet
  });

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    setIsSending(true);
    try {
      await sendDispatch(composeTo, composeSubject, composeBody);
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (e: any) {
      alert("Error sending email: " + e.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full bg-[var(--bg-color)] text-[var(--text-main)] overflow-hidden text-sm">
      {/* Thread List Pane */}
      <div className={`${selectedMessage || isComposing ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 border-r border-[var(--border)] flex-col`}>
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-bold uppercase tracking-widest text-[var(--accent)] flex items-center text-xs">
            <Mail size={14} className="mr-2" /> Dispatch
          </h2>
          <button 
            onClick={() => { setIsComposing(true); setSelectedMessage(null); }}
            className="p-1.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-md hover:bg-[var(--accent)]/20 transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
        
        <div className="flex flex-wrap border-b border-[var(--border)] bg-[var(--panel-bg)]">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 min-w-[50%] p-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center ${activeTab === 'inbox' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border)]/50'}`}
          >
            <Inbox size={12} className="mr-1.5" /> Inbox
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex-1 min-w-[50%] p-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center ${activeTab === 'sent' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border)]/50'}`}
          >
            <Send size={12} className="mr-1.5" /> Sent
          </button>
          <button 
            onClick={() => setActiveTab('drafts')}
            className={`flex-1 min-w-[50%] p-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center ${activeTab === 'drafts' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border)]/50'}`}
          >
            <FileText size={12} className="mr-1.5" /> Drafts
          </button>
          <button 
            onClick={() => setActiveTab('spam')}
            className={`flex-1 min-w-[50%] p-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center ${activeTab === 'spam' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent)]/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border)]/50'}`}
          >
            <AlertOctagon size={12} className="mr-1.5" /> Spam
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-xs uppercase tracking-wider">
              No dispatches found
            </div>
          ) : (
            filteredMessages.map(msg => (
              <button 
                key={msg.id}
                onClick={() => { setSelectedMessage(msg); setIsComposing(false); }}
                className={`w-full text-left p-3 border-b border-[var(--border)] hover:bg-[var(--panel-bg)] transition-colors ${selectedMessage?.id === msg.id ? 'bg-[var(--panel-bg)] border-l-2 border-l-[var(--accent)]' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-xs truncate pr-2 text-[var(--text-main)]">{msg.subject || '(No Subject)'}</span>
                  <span className="text-[9px] text-[var(--text-muted)] whitespace-nowrap flex items-center mt-0.5">
                    <Clock size={8} className="mr-1" />
                    {format(msg.timestamp, 'MMM d, HH:mm')}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                  {msg.status === 'Sent' ? `To: ${msg.metadata?.to}` : msg.status === 'Draft' ? `Draft to: ${msg.metadata?.to || 'Unknown'}` : `From: ${msg.metadata?.from || 'Unknown'}`}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Viewport Pane */}
      <div className={`${!selectedMessage && !isComposing ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[var(--panel-bg)] relative`}>
        {isComposing ? (
          <div className="flex-1 flex flex-col p-4 md:p-6 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <button onClick={() => setIsComposing(false)} className="md:hidden mr-3 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <ChevronLeft size={18} />
                </button>
                <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-widest">New Dispatch</h3>
              </div>
              <button onClick={() => setIsComposing(false)} className="hidden md:block text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4 flex-1 flex flex-col">
              <input 
                type="email" 
                placeholder="To:" 
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-md p-2.5 text-xs focus:border-[var(--accent)] outline-none text-[var(--text-main)]"
              />
              <input 
                type="text" 
                placeholder="Subject:" 
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-md p-2.5 text-xs focus:border-[var(--accent)] outline-none text-[var(--text-main)]"
              />
              <textarea 
                placeholder="Message body (HTML supported)..." 
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                className="w-full flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-md p-3 text-xs focus:border-[var(--accent)] outline-none resize-none font-mono text-[var(--text-main)]"
              />
              <div className="flex justify-between items-center pt-2">
                <button className="text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center text-[10px] uppercase tracking-wider">
                  <Paperclip size={12} className="mr-1" /> Attach
                </button>
                <button 
                  onClick={handleSend}
                  disabled={isSending || !composeTo || !composeSubject || !composeBody}
                  className="px-4 py-1.5 bg-[var(--accent)] text-black font-bold rounded-md hover:opacity-90 disabled:opacity-50 flex items-center uppercase tracking-wider text-[10px]"
                >
                  {isSending ? 'Sending...' : <><Send size={12} className="mr-1.5" /> Dispatch</>}
                </button>
              </div>
            </div>
          </div>
        ) : selectedMessage ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 md:p-6 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center mb-3 md:hidden">
                <button onClick={() => setSelectedMessage(null)} className="text-[var(--accent)] flex items-center text-[10px] uppercase tracking-wider bg-[var(--accent)]/10 px-2 py-1 rounded">
                  <ChevronLeft size={12} className="mr-1" /> Back to List
                </button>
              </div>
              <h1 className="text-lg md:text-xl font-bold mb-3 leading-tight break-words text-[var(--text-main)]">{selectedMessage.subject || '(No Subject)'}</h1>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] text-[var(--text-muted)] gap-2">
                <div className="truncate">
                  {selectedMessage.status === 'Sent' ? `To: ${selectedMessage.metadata?.to}` : selectedMessage.status === 'Draft' ? `Draft to: ${selectedMessage.metadata?.to || 'Unknown'}` : `From: ${selectedMessage.metadata?.from || 'Unknown'}`}
                </div>
                <div className="flex items-center whitespace-nowrap">
                  <Clock size={10} className="mr-1" />
                  {format(selectedMessage.timestamp, 'MMM d, yyyy HH:mm')}
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 flex-1 overflow-y-auto">
              <div 
                className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-[var(--text-main)]"
                dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center">
              <Mail size={32} className="mx-auto mb-3 opacity-50" />
              <p className="uppercase tracking-widest text-[10px]">Select a dispatch to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
