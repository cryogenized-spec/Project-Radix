import React from 'react';

interface RichTextProps {
  text: string;
  className?: string;
}

export default function RichText({ text, className = '' }: RichTextProps) {
  if (!text) return null;

  // Match [[type:value]]
  const regex = /\[\[(note|task|cal):([^\]]+)\]\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    const type = match[1];
    const value = match[2];
    
    let icon = '';
    let color = '';
    if (type === 'note') { icon = '📝'; color = 'text-blue-400'; }
    else if (type === 'task') { icon = '✅'; color = 'text-emerald-400'; }
    else if (type === 'cal') { icon = '📅'; color = 'text-purple-400'; }

    parts.push(
      <span 
        key={`link-${match.index}`} 
        className={`inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-[var(--panel-bg)] border border-[var(--border)] text-xs font-bold cursor-pointer hover:bg-[var(--accent)] hover:text-black transition-colors ${color}`}
        onClick={(e) => {
          e.stopPropagation();
          // Dispatch custom event to open the linked item
          window.dispatchEvent(new CustomEvent('radix:open-link', { detail: { type, value } }));
        }}
      >
        <span className="mr-1">{icon}</span>
        {value}
      </span>
    );
    
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return <div className={className}>{parts.length > 0 ? parts : text}</div>;
}
