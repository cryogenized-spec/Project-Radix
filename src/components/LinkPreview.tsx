import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { Icon } from '@iconify/react';

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [domain, setDomain] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    try {
      const parsedUrl = new URL(url);
      setDomain(parsedUrl.hostname.replace('www.', ''));
      
      // Basic title extraction from URL
      let extractedTitle = parsedUrl.pathname.split('/').pop() || parsedUrl.hostname;
      extractedTitle = extractedTitle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      setTitle(extractedTitle);
    } catch (e) {
      setDomain(url);
      setTitle('External Link');
    }
  }, [url]);

  const getIcon = () => {
    if (domain.includes('github.com')) return <Icon icon="mdi:github" width="20" height="20" className="text-[var(--text-main)]" />;
    if (domain.includes('twitter.com') || domain.includes('x.com')) return <Icon icon="ri:twitter-x-fill" width="20" height="20" className="text-[var(--text-main)]" />;
    if (domain.includes('linkedin.com')) return <Icon icon="mdi:linkedin" width="20" height="20" className="text-[#0A66C2]" />;
    if (domain.includes('t.me')) return <Icon icon="logos:telegram" width="20" height="20" />;
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) return <Icon icon="logos:youtube-icon" width="20" height="20" />;
    return <Globe size={20} className="text-[var(--accent)]" />;
  };

  if (!url) return null;

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] hover:border-[var(--accent)] transition-all group"
    >
      <div className="w-10 h-10 rounded-full bg-[var(--bg-color)] flex items-center justify-center shrink-0 mr-3 sm:mr-4 group-hover:scale-110 transition-transform">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate mb-0.5">
          {title}
        </div>
        <div className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate font-mono">
          {domain}
        </div>
      </div>
      <ExternalLink size={16} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0 ml-2" />
    </a>
  );
}
