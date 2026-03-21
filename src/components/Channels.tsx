import React, { useState, useEffect } from 'react';
import { 
  Folder, Plus, Search, Settings as SettingsIcon, Radio, 
  Hash, ExternalLink, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  MoreVertical, Trash2, Edit3, RefreshCw, Globe, 
  Rss, FileText, Download, Bot, Zap, Terminal,
  Compass, MessageCircle, Github, BookOpen, Share2
} from 'lucide-react';
import { 
  addFolder, getFolders, deleteFolder, updateFolder,
  addChannel, getChannels, deleteChannel, updateChannel,
  addFeed, getFeeds, deleteFeed,
  addChannelerPrompt, getChannelerPrompts, deleteChannelerPrompt,
  getSetting, getAgents
} from '../lib/db';
import { generateChannelerAnalysis } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TurndownService from 'turndown';

// --- Types ---
export interface Folder {
  id: string;
  name: string;
}

export interface Channel {
  id: string;
  name: string;
  folderId: string;
  type: 'telegram' | 'rss' | 'substack' | 'gopher' | 'discovery';
  sourceUrl: string;
}

import { Tweet } from 'react-tweet';
import { Icon } from '@iconify/react';

const DISCOVERY_ENGINES = [
  { id: 'telegram', name: 'Telegram', icon: 'logos:telegram', domain: 't.me' },
  { id: 'substack', name: 'Substack', icon: 'simple-icons:substack', domain: 'substack.com' },
  { id: 'x', name: 'X (Twitter)', icon: 'ri:twitter-x-fill', domain: 'x.com' },
  { id: 'reddit', name: 'Reddit', icon: 'logos:reddit-icon', domain: 'reddit.com' },
  { id: 'arxiv', name: 'arXiv', icon: 'simple-icons:arxiv', domain: 'arxiv.org' },
  { id: 'github', name: 'GitHub', icon: 'mdi:github', domain: 'github.com' },
  { id: 'fediverse', name: 'Mastodon/BlueSky', icon: 'simple-icons:mastodon', domain: 'mastodon.social' },
];

// --- ChannelList Component ---
export function ChannelList({ onSelectChannel, activeChannelId }: { onSelectChannel: (channel: Channel) => void, activeChannelId?: string }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showDiscoveryMenu, setShowDiscoveryMenu] = useState(false);

  useEffect(() => {
    const handler = registerBackHandler(() => {
      if (showDiscoveryMenu) {
        setShowDiscoveryMenu(false);
        return true;
      }
      if (searchQuery) {
        setSearchQuery('');
        return true;
      }
      return false;
    });
    return handler;
  }, [showDiscoveryMenu, searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const f = await getFolders();
    const c = await getChannels();
    setFolders(f);
    setChannels(c);
  };

  const handleCreateFolder = async () => {
    const name = prompt('Folder Name:');
    if (!name) return;
    await addFolder({ id: crypto.randomUUID(), name });
    loadData();
  };

  const handleRenameFolder = async (folder: Folder) => {
    const newName = prompt('Rename Folder:', folder.name);
    if (!newName || newName === folder.name) return;
    await updateFolder(folder.id, { name: newName });
    loadData();
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (confirm(`Are you sure you want to delete the folder "${folder.name}"? All channels inside will be moved to the root.`)) {
      const channelsInFolder = channels.filter(c => c.folderId === folder.id);
      for (const channel of channelsInFolder) {
        await updateChannel(channel.id, { folderId: 'root' });
      }
      await deleteFolder(folder.id);
      loadData();
    }
  };

  const handleMoveChannel = async (channel: Channel, newFolderId: string) => {
    await updateChannel(channel.id, { folderId: newFolderId });
    loadData();
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (confirm(`Are you sure you want to delete the feed "${channel.name}"?`)) {
      await deleteChannel(channel.id);
      loadData();
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddDiscovery = async (engine: typeof DISCOVERY_ENGINES[0]) => {
    const tempChannel: Channel = {
      id: `discovery-${engine.id}`,
      name: `${engine.name} Discovery`,
      folderId: 'root',
      type: 'discovery',
      sourceUrl: engine.domain
    };
    onSelectChannel(tempChannel);
    setShowDiscoveryMenu(false);
  };

  // --- Universal Input Engine ---
  const detectInputType = (input: string): { type: Channel['type'] | 'search', url?: string } => {
    if (input.startsWith('http') || input.startsWith('https')) {
      if (input.includes('t.me')) return { type: 'telegram', url: input };
      if (input.includes('substack.com')) return { type: 'substack', url: input };
      if (input.includes('x.com') || input.includes('twitter.com')) {
        const match = input.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
        if (match && match[1]) {
          return { type: 'rss', url: `https://nitter.net/${match[1]}/rss` };
        }
      }
      return { type: 'rss', url: input };
    }
    if (input.startsWith('gopher://')) return { type: 'gopher', url: input };
    if (input.startsWith('@')) {
      return { type: 'rss', url: `https://nitter.net/${input.substring(1)}/rss` };
    }
    if (input.startsWith('t.me/')) return { type: 'telegram', url: `https://${input}` };
    return { type: 'search' };
  };

  const handleInputSubmit = async () => {
    if (!searchQuery.trim()) return;
    const detection = detectInputType(searchQuery);

    if (detection.type === 'search') {
      const name = `Deep Web Search: ${searchQuery}`;
      await addChannel({
        id: crypto.randomUUID(),
        name,
        folderId: 'root',
        type: 'discovery',
        sourceUrl: '', // Empty domain means search all
      });
      setSearchQuery('');
      return;
    }

    if (detection.url) {
      const name = prompt('Channel Name:', searchQuery) || searchQuery;
      await addChannel({
        id: crypto.randomUUID(),
        name,
        folderId: 'root',
        type: detection.type as Channel['type'],
        sourceUrl: detection.url
      });
      setSearchQuery('');
      loadData();
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Universal Input */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input 
            type="text" 
            placeholder="Add channel or search..."
            className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInputSubmit();
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex justify-between items-center p-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Feeds</span>
          <button 
            onClick={handleCreateFolder}
            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center text-xs"
            title="Create Folder"
          >
            <Folder size={14} className="mr-1" /> New
          </button>
        </div>

        {folders.length === 0 && channels.length === 0 && (
          <div className="p-4 text-center space-y-4">
            <button 
              onClick={handleCreateFolder}
              className="w-full p-3 border border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs"
            >
              <Folder size={16} className="mx-auto mb-2" />
              Create Folder
            </button>
          </div>
        )}

        {folders.map(folder => (
          <div key={folder.id}>
            <div 
              className="flex items-center justify-between p-2 hover:bg-[var(--bg-color)] rounded-lg cursor-pointer group"
              onClick={() => toggleFolder(folder.id)}
            >
              <div className="flex items-center space-x-2 text-sm font-medium">
                {expandedFolders[folder.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className="text-[var(--text-muted)]" />
                <span>{folder.name}</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
                  className="text-[var(--text-muted)] hover:text-[var(--accent)] p-1"
                  title="Rename Folder"
                >
                  <Edit3 size={12} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                  className="text-[var(--text-muted)] hover:text-red-500 p-1"
                  title="Delete Folder"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            
            {expandedFolders[folder.id] && (
              <div className="ml-6 space-y-1 border-l border-[var(--border)] pl-2 mt-1">
                {channels.filter(c => c.folderId === folder.id).map(channel => (
                  <div 
                    key={channel.id}
                    onClick={() => onSelectChannel(channel)}
                    className={`p-2 rounded-lg cursor-pointer text-sm flex items-center justify-between group ${activeChannelId === channel.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg-color)]'}`}
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      {channel.type === 'telegram' && <Icon icon="logos:telegram" width="12" height="12" className="flex-shrink-0" />}
                      {channel.type === 'rss' && ((channel.sourceUrl.includes('nitter') || channel.sourceUrl.includes('x.com') || channel.sourceUrl.includes('twitter.com')) ? <Icon icon="ri:twitter-x-fill" width="12" height="12" className="flex-shrink-0" /> : <Rss size={12} className="flex-shrink-0" />)}
                      {channel.type === 'substack' && <Icon icon="simple-icons:substack" width="12" height="12" className="text-[#FF6719] flex-shrink-0" />}
                      {channel.type === 'gopher' && <Terminal size={12} className="flex-shrink-0" />}
                      {channel.type === 'discovery' && (channel.name.toLowerCase().includes('x') || channel.name.toLowerCase().includes('twitter') ? <Icon icon="ri:twitter-x-fill" width="12" height="12" className="text-[var(--accent)] flex-shrink-0" /> : <Compass size={12} className="text-[var(--accent)] flex-shrink-0" />)}
                      <span className="truncate">{channel.name}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 flex-shrink-0">
                      <select 
                        className="bg-transparent text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1 py-0.5 outline-none"
                        title="Move to folder"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.value) {
                            handleMoveChannel(channel, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        value=""
                      >
                        <option value="" disabled>Move...</option>
                        <option value="root">Root</option>
                        {folders.filter(f => f.id !== folder.id).map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel); }}
                        className="text-[var(--text-muted)] hover:text-red-500 p-1"
                        title="Delete Feed"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {channels.filter(c => c.folderId === 'root' && c.type !== 'discovery').map(channel => (
          <div 
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`p-2 rounded-lg cursor-pointer text-sm flex items-center justify-between group ${activeChannelId === channel.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg-color)]'}`}
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              {channel.type === 'telegram' && <Icon icon="logos:telegram" width="12" height="12" className="flex-shrink-0" />}
              {channel.type === 'rss' && ((channel.sourceUrl.includes('nitter') || channel.sourceUrl.includes('x.com') || channel.sourceUrl.includes('twitter.com')) ? <Icon icon="ri:twitter-x-fill" width="12" height="12" className="flex-shrink-0" /> : <Rss size={12} className="flex-shrink-0" />)}
              {channel.type === 'substack' && <Icon icon="simple-icons:substack" width="12" height="12" className="text-[#FF6719] flex-shrink-0" />}
              {channel.type === 'gopher' && <Terminal size={12} className="flex-shrink-0" />}
              {channel.type === 'discovery' && (channel.name.toLowerCase().includes('x') || channel.name.toLowerCase().includes('twitter') ? <Icon icon="ri:twitter-x-fill" width="12" height="12" className="text-[var(--accent)] flex-shrink-0" /> : <Compass size={12} className="text-[var(--accent)] flex-shrink-0" />)}
              <span className="truncate">{channel.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 flex-shrink-0">
              <select 
                className="bg-transparent text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1 py-0.5 outline-none"
                title="Move to folder"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.value) {
                    handleMoveChannel(channel, e.target.value);
                    e.target.value = '';
                  }
                }}
                value=""
              >
                <option value="" disabled>Move...</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel); }}
                className="text-[var(--text-muted)] hover:text-red-500 p-1"
                title="Delete Feed"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Discovery FAB */}
      <div className="absolute bottom-6 right-6 z-50">
        {showDiscoveryMenu && (
          <div className="absolute bottom-16 right-0 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 w-56 animate-in slide-in-from-bottom-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] p-2 mb-1 border-b border-[var(--border)]">
              Discovery Engines
            </div>
            {DISCOVERY_ENGINES.map(engine => (
              <button
                key={engine.id}
                onClick={() => handleAddDiscovery(engine)}
                className="w-full text-left p-2 hover:bg-[var(--bg-color)] rounded-xl flex items-center space-x-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                  <Icon icon={engine.icon} width="14" height="14" />
                </div>
                <div>
                  <div className="text-xs font-bold">{engine.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">RSS Bridge</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowDiscoveryMenu(!showDiscoveryMenu)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
            showDiscoveryMenu 
              ? 'bg-[var(--bg-color)] text-[var(--text-main)] border border-[var(--border)] rotate-45' 
              : 'bg-[var(--accent)] text-black hover:scale-105'
          }`}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
}

import { searchExa, findSimilarExa, ExaResult } from '../lib/exa';
import { motion, AnimatePresence } from 'motion/react';
import { useAvifEncoder } from '../hooks/useAvifEncoder';
import { saveMedia } from '../lib/db';
import { registerBackHandler } from '../lib/backButton';

// --- Telegram Post Preview Component ---
function TelegramPostPreview({ text, url, channelName }: { text: string, url: string, channelName?: string }) {
  const { encodeImage } = useAvifEncoder();
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Clean and parse the text
  const cleanTelegramText = (rawText: string, cName?: string) => {
    let t = rawText;
    
    // If it's HTML, convert to markdown first
    if (t.includes('<') && t.includes('>')) {
      try {
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          hr: '---',
          bulletListMarker: '-',
          codeBlockStyle: 'fenced'
        });
        t = turndownService.turndown(t);
      } catch (e) {
        console.error('Turndown error:', e);
      }
    }
    
    // 1. Remove <web_link> and <image_link> tags
    t = t.replace(/<web_link>/g, '');
    t = t.replace(/\*!\[\]<image_link>\*/g, '');
    t = t.replace(/\*!\[\]\*/g, '');
    t = t.replace(/!\[\]\(<image_link>\)/g, '');
    t = t.replace(/!\[\]\([^)]+\)/g, ''); // Remove images
    
    // 2. Remove UI links and metadata
    t = t.replace(/\[@[^\]]+\]/g, ''); 
    t = t.replace(/\d+(?:\.\d+)?K?\s*(?:subscribers|photos|videos|files|links)/gi, '');
    t = t.replace(/\[(?:Download Telegram|About|Blog|Apps|Platform|Join)\]/gi, '');
    t = t.replace(/#####/g, '');
    t = t.replace(/\[\]/g, '');
    t = t.replace(/\[\s*\]/g, '');
    
    // 3. Clean up reacts (e.g. ***👍***6***❤***3 -> 👍 6 ❤ 3)
    t = t.replace(/\*\*\*([^\*]+)\*\*\*/g, ' $1 ');
    
    // 4. Clean up stray asterisks and checkmarks
    t = t.replace(/\*✔\*/g, '');
    t = t.replace(/\*\*\*\*\*/g, '');
    
    // 5. Format dashes as bullets
    t = t.replace(/^- /gm, '• ');
    
    // 6. Extract the latest post
    // Telegram web preview usually separates posts with timestamps or view counts
    // e.g. "1.2K views [14:30]" or just "[14:30]"
    const postRegex = /(?:\d+(?:\.\d+)?K?\s*views\s*)?\[\d{2}:\d{2}\]/gi;
    let posts = t.split(postRegex);
    
    let latestPost = t;
    if (posts.length > 1) {
      // The last element might be empty or just whitespace if the timestamp was at the very end
      latestPost = posts[posts.length - 1].trim() ? posts[posts.length - 1] : posts[posts.length - 2];
    } else {
      latestPost = posts[0];
    }
    
    // 7. Remove channel name repetitions
    if (cName) {
      const safeName = cName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      latestPost = latestPost.replace(new RegExp(`\\[${safeName}\\]`, 'gi'), '');
      latestPost = latestPost.replace(new RegExp(`^${safeName}\\s*`, 'gmi'), '');
    }
    
    // 8. Fix URLs in brackets or parentheses: [https://...] or (https://...)) -> https://...
    latestPost = latestPost.replace(/[\[\(]+(https?:\/\/[^\s\]\)]+)[\]\)]+/g, '$1');
    
    // 9. Ensure social media links are clickable (if they aren't already markdown links)
    // This regex looks for URLs that aren't inside markdown link syntax []()
    const urlRegex = /(?<!\]\()((?:https?:\/\/)(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    latestPost = latestPost.replace(urlRegex, '[$1]($1)');
    
    // 10. Clean up underscores around single emojis at start of lines
    latestPost = latestPost.replace(/^_((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}))_/gmu, '$1 ');

    // 11. Format react lines
    const reactLineRegex = /^[_]*((?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})[\s_]*[\d\.KM]+[\s_]*){2,})$/gmu;
    latestPost = latestPost.replace(reactLineRegex, (match, reactContent) => {
      let cleaned = reactContent.replace(/_/g, ' ');
      // Add spaces around numbers
      cleaned = cleaned.replace(/([\d\.KM]+)/g, ' $1 ');
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      return `\n\n${cleaned}\n\n---\n\n`;
    });
    
    // 12. Remove multiple blank lines
    latestPost = latestPost.replace(/\n\s*\n/g, '\n\n');
    
    // If we still have multiple posts, let's try to split by reaction counts or dates
    // A common pattern is a bunch of emojis followed by numbers, then a new post.
    if (latestPost.length > 1000) {
      // Split by common Telegram post separators if timestamp wasn't found
      const dateRegex = /\n\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*\n/gi;
      const datePosts = latestPost.split(dateRegex);
      if (datePosts.length > 1) {
        latestPost = datePosts[datePosts.length - 1];
      }
    }
    
    return latestPost.trim();
  };

  const parsedText = cleanTelegramText(text, channelName);

  const isTelegram = url.includes('t.me/');
  // Only embed if it's a specific post URL (contains a number at the end)
  const isTelegramPost = isTelegram && /\/[a-zA-Z0-9_]+\/\d+/.test(url);
  
  const isTwitter = url.includes('x.com/') || url.includes('twitter.com/');
  const tweetIdMatch = url.match(/(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/);
  const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

  const handleArchive = async () => {
    setIsArchiving(true);
    setArchiveError('');
    setArchiveSuccess(false);

    try {
      // Fetch the raw image buffer from the proxy
      const response = await fetch(`/api/telegram-media?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Convert to File object for the encoder
      const file = new File([blob], 'telegram_media.jpg', { type: blob.type });

      // Pipe the buffer directly into the existing Squoosh WebAssembly utility
      // Crucial Compression Parameters: Convert to AVIF, set effort: 8, and quality: 65
      const avifBlob = await encodeImage(file, 65, 8, 'original');

      // Commit the optimized AVIF blob directly into the local IndexedDB media store
      await saveMedia(avifBlob, 'image');
      
      setArchiveSuccess(true);
    } catch (error: any) {
      console.error('Archiving failed:', error);
      setArchiveError(error.message || 'Failed to archive media');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 mt-2">
      <div className={`text-xs sm:text-sm text-[var(--text-muted)] prose prose-invert prose-sm max-w-none prose-p:leading-relaxed ${!isExpanded ? 'line-clamp-[8]' : ''}`}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({node, ...props}) => (
              <a 
                {...props} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 underline hover:text-blue-300 break-all"
                onClick={(e) => e.stopPropagation()}
              />
            )
          }}
        >
          {parsedText}
        </ReactMarkdown>
      </div>
      {parsedText.length > 400 && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="text-[var(--accent)] text-xs font-bold uppercase mt-1 flex items-center hover:opacity-80 transition-opacity"
        >
          {isExpanded ? (
            <><ChevronUp size={14} className="mr-1"/> Show Less</>
          ) : (
            <><ChevronDown size={14} className="mr-1"/> Read More</>
          )}
        </button>
      )}

      {isTelegramPost && (
        <div className="mt-2 border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-color)]">
          <iframe 
            src={`${url}?embed=1&dark=1`} 
            frameBorder="0" 
            scrolling="no" 
            className="w-full min-h-[400px]"
            title="Telegram Preview"
          ></iframe>
        </div>
      )}

      {isTwitter && tweetId && (
        <div className="mt-2 rounded-xl overflow-hidden" data-theme="dark">
          <Tweet id={tweetId} />
        </div>
      )}

      {isTelegramPost && (
        <div className="flex items-center justify-end mt-2 space-x-2">
          {archiveError && <span className="text-red-500 text-xs">{archiveError}</span>}
          {archiveSuccess && <span className="text-green-500 text-xs">Archived!</span>}
          <button
            onClick={handleArchive}
            disabled={isArchiving || archiveSuccess}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 flex items-center"
          >
            {isArchiving ? (
              <RefreshCw size={14} className="animate-spin mr-1" />
            ) : (
              <Download size={14} className="mr-1" />
            )}
            Archive to Local Intel
          </button>
        </div>
      )}
    </div>
  );
}

// --- Discovery Search Window Component ---
function DiscoverySearchWindow({ channel, onBack }: { channel: Channel, onBack?: () => void }) {
  const [query, setQuery] = useState(channel.name.startsWith('Deep Web Search: ') ? channel.name.replace('Deep Web Search: ', '') : '');
  const [results, setResults] = useState<ExaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [addedUrls, setAddedUrls] = useState<Record<string, boolean>>({});
  const [showChanneler, setShowChanneler] = useState(false);
  const [promptStrategy, setPromptStrategy] = useState('Objective Summary (Default)');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [searchMode, setSearchMode] = useState<'search' | 'similar'>('search');
  const [similarUrl, setSimilarUrl] = useState('');

  useEffect(() => {
    const handler = registerBackHandler(() => {
      if (showChanneler) {
        setShowChanneler(false);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return handler;
  }, [showChanneler, onBack]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError('');
    setResults([]);
    setNextPageToken(undefined);
    setSearchMode('search');

    try {
      let domain = channel.sourceUrl;
      if (!domain) {
        const engine = DISCOVERY_ENGINES.find(e => channel.name.includes(e.name) || channel.name.includes(e.id));
        if (engine) domain = engine.domain;
      }
      const data = await searchExa(query, domain);
      setResults(data.results);
      setNextPageToken(data.nextPage);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFindSimilar = async (url: string) => {
    setIsSearching(true);
    setError('');
    setQuery(''); // Clear query since we are finding similar
    setNextPageToken(undefined);
    setSearchMode('similar');
    setSimilarUrl(url);
    
    try {
      let domain = channel.sourceUrl;
      if (!domain) {
        const engine = DISCOVERY_ENGINES.find(e => channel.name.includes(e.name) || channel.name.includes(e.id));
        if (engine) domain = engine.domain;
      }
      const data = await findSimilarExa(url, domain);
      setResults(data.results);
      setNextPageToken(data.nextPage);
    } catch (err: any) {
      setError(err.message || 'Find similar failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setIsSearching(true);
    try {
      if (searchMode === 'search') {
        let domain = channel.sourceUrl;
        if (!domain) {
          const engine = DISCOVERY_ENGINES.find(e => channel.name.includes(e.name) || channel.name.includes(e.id));
          if (engine) domain = engine.domain;
        }
        const data = await searchExa(query, domain, nextPageToken);
        setResults(prev => [...prev, ...data.results]);
        setNextPageToken(data.nextPage);
      } else {
        let domain = channel.sourceUrl;
        if (!domain) {
          const engine = DISCOVERY_ENGINES.find(e => channel.name.includes(e.name) || channel.name.includes(e.id));
          if (engine) domain = engine.domain;
        }
        const data = await findSimilarExa(similarUrl, domain, nextPageToken);
        setResults(prev => [...prev, ...data.results]);
        setNextPageToken(data.nextPage);
      }
    } catch (err: any) {
      setError(err.message || 'Load more failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (result: ExaResult) => {
    let finalUrl = result.url;
    let type: Channel['type'] = 'rss';

    if (channel.sourceUrl === 't.me') {
      type = 'telegram';
      // extract id from t.me/id or t.me/s/id
      const match = result.url.match(/t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        finalUrl = `https://rsshub.app/telegram/channel/${match[1]}`;
      }
    } else if (channel.sourceUrl === 'substack.com') {
      type = 'substack';
      // ensure it ends with /feed
      if (!finalUrl.endsWith('/feed')) {
        finalUrl = finalUrl.replace(/\/$/, '') + '/feed';
      }
    } else if (channel.sourceUrl === 'x.com') {
      type = 'rss';
      const match = result.url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        finalUrl = `https://nitter.net/${match[1]}/rss`;
      }
    } else if (channel.sourceUrl === 'reddit.com') {
      type = 'rss';
      if (!finalUrl.endsWith('.rss')) {
        finalUrl = finalUrl.replace(/\/$/, '') + '/.rss';
      }
    } else if (channel.sourceUrl === 'github.com') {
      type = 'rss';
      const parts = finalUrl.split('/');
      if (!finalUrl.endsWith('.atom') && parts.length >= 5) {
        // Assume github.com/user/repo -> github.com/user/repo/releases.atom
        finalUrl = `https://github.com/${parts[3]}/${parts[4]}/releases.atom`;
      }
    } else if (channel.sourceUrl === 'arxiv.org') {
      type = 'rss';
      const match = finalUrl.match(/arxiv\.org\/(?:abs|pdf|list)\/([a-z\-]+(?:\.[a-zA-Z]{2})?)/);
      if (match && match[1]) {
        finalUrl = `http://export.arxiv.org/rss/${match[1]}`;
      } else if (finalUrl.includes('search_query=')) {
        // Leave as is or handle search query RSS if arXiv supports it, 
        // but typically arXiv RSS is by category.
      }
    }

    await addChannel({
      id: crypto.randomUUID(),
      name: result.title || 'New Feed',
      folderId: 'root',
      type,
      sourceUrl: finalUrl
    });

    setAddedUrls(prev => ({ ...prev, [result.url]: true }));
  };

  const getSourceTypeBadge = (url: string) => {
    if (url.includes('t.me/s/')) return <><Icon icon="logos:telegram" className="inline mr-1" /> Public Channel</>;
    if (url.includes('t.me/')) return <><Icon icon="logos:telegram" className="inline mr-1" /> Group / Private</>;
    if (url.includes('substack.com')) return <><Icon icon="simple-icons:substack" className="inline mr-1 text-[#FF6719]" /> Newsletter</>;
    if (url.includes('x.com') || url.includes('twitter.com')) return <><Icon icon="ri:twitter-x-fill" className="inline mr-1" /> X Profile</>;
    if (url.includes('reddit.com/r/')) return <><Icon icon="logos:reddit-icon" className="inline mr-1" /> Subreddit</>;
    if (url.includes('github.com')) return <><Icon icon="mdi:github" className="inline mr-1" /> Repository</>;
    return <><Globe size={12} className="inline mr-1" /> Web Page</>;
  };

  const runChannelerAnalysis = async () => {
    if (results.length === 0) return;
    
    setIsAnalyzing(true);
    setAnalysisResult('');
    
    try {
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      const agents = await getAgents();
      const feedAgent = agents.find(a => a.isFeed);
      
      const contentToAnalyze = results.map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.text || r.highlights?.[0] || ''}`).join('\n\n');
      const stream = await generateChannelerAnalysis(contentToAnalyze, promptStrategy, { apiKey, agent: feedAgent });
      
      for await (const chunk of stream) {
        if (chunk.text) {
            setAnalysisResult(prev => prev + chunk.text);
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisResult('**Error:** Analysis failed. Please check your API key and connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pushToObsidian = () => {
    if (!analysisResult) return;
    
    const blob = new Blob([analysisResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RADIX_Discovery_${channel.name}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-color)] relative overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header & Search Bar */}
        <div className="p-4 sm:p-6 border-b border-[var(--border)] bg-[var(--panel-bg)] flex flex-col space-y-4">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button onClick={onBack} className="sm:hidden text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <ChevronRight size={20} className="rotate-180" />
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold flex items-center tracking-tight">
            {(channel.name.toLowerCase().includes('x') || channel.name.toLowerCase().includes('twitter')) ? (
              <Icon icon="ri:twitter-x-fill" className="mr-2 text-[var(--accent)]" width="24" height="24" />
            ) : (
              <Compass className="mr-2 text-[var(--accent)]" size={24} />
            )}
            {channel.name}
          </h1>
        </div>

        <form onSubmit={handleSearch} className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input 
              type="text" 
              placeholder={`Search ${channel.sourceUrl}...`}
              className="w-full bg-[var(--bg-color)] border-2 border-[var(--border)] rounded-2xl py-3 pl-12 pr-4 text-sm sm:text-base focus:outline-none focus:border-[var(--accent)] transition-colors font-medium shadow-inner"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className="p-3 sm:px-6 sm:py-3 rounded-2xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center"
          >
            {isSearching ? <RefreshCw size={20} className="animate-spin" /> : <span className="hidden sm:inline">Search</span>}
            {!isSearching && <Search size={20} className="sm:hidden" />}
          </button>
          <button 
            type="button"
            onClick={() => setShowChanneler(!showChanneler)}
            className={`p-3 sm:px-4 sm:py-3 rounded-2xl font-bold uppercase tracking-wider transition-all flex items-center justify-center ${showChanneler ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-[var(--panel-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-main)]'}`}
            title="Ask Agent"
          >
            <Bot size={20} className="sm:mr-2" />
            <span className="hidden sm:inline">Ask Agent</span>
          </button>
        </form>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-24">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl text-sm">
            {error}
          </div>
        )}

        {!isSearching && results.length === 0 && !error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] opacity-50"
          >
            <Compass size={48} className="mb-4" />
            <p className="text-sm font-medium uppercase tracking-widest">Enter keywords to discover feeds</p>
          </motion.div>
        )}

        <AnimatePresence>
          {results.map((result, idx) => (
            <motion.div 
              key={result.url}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="p-4 sm:p-5 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl hover:border-[var(--text-muted)] transition-colors flex flex-col space-y-3 shadow-sm"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)]">
                      {getSourceTypeBadge(result.url)}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] leading-tight mb-1">
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] hover:underline">
                      {result.title || result.url}
                    </a>
                  </h3>
                  <TelegramPostPreview 
                    text={result.text || result.highlights?.[0] || 'No description available.'} 
                    url={result.url} 
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--border)]">
                <button 
                  onClick={() => handleFindSimilar(result.url)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  Find Similar
                </button>
                <button 
                  onClick={() => handleAdd(result)}
                  disabled={addedUrls[result.url]}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1 ${
                    addedUrls[result.url] 
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30' 
                      : 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)]/20'
                  }`}
                >
                  {addedUrls[result.url] ? (
                    <><span>Added</span></>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {nextPageToken && (
          <div className="flex justify-center pt-4 pb-8">
            <button
              onClick={handleLoadMore}
              disabled={isSearching}
              className="px-6 py-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors font-bold uppercase tracking-wider text-sm flex items-center disabled:opacity-50 shadow-sm"
            >
              {isSearching ? (
                <RefreshCw size={18} className="animate-spin mr-2" />
              ) : (
                <Compass size={18} className="mr-2" />
              )}
              Load More Results
            </button>
          </div>
        )}
      </div>
    </div>

      {/* Channeler Panel */}
      {showChanneler && (
        <div className="w-80 sm:w-96 border-l border-[var(--border)] bg-[var(--panel-bg)] flex flex-col absolute right-0 top-0 bottom-0 z-20 shadow-xl animate-in slide-in-from-right">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-green-900/10">
            <h2 className="font-bold text-green-500 uppercase tracking-widest flex items-center text-sm">
              <Bot size={16} className="mr-2" />
              Channeler AI
            </h2>
            <button onClick={() => setShowChanneler(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="p-4 border-b border-[var(--border)] space-y-3">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Analysis Strategy</label>
            <select 
              value={promptStrategy}
              onChange={(e) => setPromptStrategy(e.target.value)}
              className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-2 text-sm focus:outline-none focus:border-green-500"
            >
              <option>Objective Summary (Default)</option>
              <option>Identify Bias & Rhetoric</option>
              <option>Extract Key Entities & Links</option>
              <option>Sentiment Analysis</option>
              <option>Fact-Check Claims</option>
            </select>
            <button 
              onClick={runChannelerAnalysis}
              disabled={isAnalyzing || results.length === 0}
              className="w-full p-2 rounded-xl bg-green-500 text-black font-bold uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
            >
              {isAnalyzing ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Zap size={14} className="mr-2" />}
              {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-color)]">
            {analysisResult ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-[var(--panel-bg)] prose-pre:border prose-pre:border-[var(--border)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisResult}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50 text-center px-4">
                <Bot size={48} className="mb-4" />
                <p className="text-sm">Select a strategy and run analysis on the current search results.</p>
              </div>
            )}
          </div>

          {analysisResult && (
            <div className="p-4 border-t border-[var(--border)] bg-[var(--panel-bg)]">
              <button 
                onClick={pushToObsidian}
                className="w-full p-2 rounded-xl bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center text-xs font-bold uppercase tracking-wider"
              >
                <Download size={14} className="mr-2" />
                Push to Obsidian
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- ChannelView Component ---
export function ChannelView({ channel, onBack }: { channel: Channel, onBack?: () => void }) {
  const [feedContent, setFeedContent] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);
  const [showChanneler, setShowChanneler] = useState(false);
  const [promptStrategy, setPromptStrategy] = useState('Objective Summary (Default)');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentGopherUrl, setCurrentGopherUrl] = useState<string | null>(null);
  const [gopherHistory, setGopherHistory] = useState<string[]>([]);
  const [textSize, setTextSize] = useState(14);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handler = registerBackHandler(() => {
      if (showChanneler) {
        setShowChanneler(false);
        return true;
      }
      if (gopherHistory.length > 1) {
        const newHistory = [...gopherHistory];
        newHistory.pop(); // Remove current
        const prevUrl = newHistory[newHistory.length - 1];
        setGopherHistory(newHistory);
        setCurrentGopherUrl(prevUrl);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return handler;
  }, [showChanneler, onBack, gopherHistory]);

  useEffect(() => {
    if (channel && channel.type !== 'discovery') {
      const initialUrl = channel.type === 'gopher' ? channel.sourceUrl : null;
      setCurrentGopherUrl(initialUrl);
      if (initialUrl) {
          setGopherHistory([initialUrl]);
      } else {
          setGopherHistory([]);
      }
      fetchChannelContent(channel, initialUrl || undefined);
      setAnalysisResult('');
    }
  }, [channel]);

  useEffect(() => {
    if (currentGopherUrl && currentGopherUrl !== channel.sourceUrl && (!gopherHistory.length || gopherHistory[gopherHistory.length - 1] !== currentGopherUrl)) {
      setGopherHistory(prev => [...prev, currentGopherUrl]);
      fetchChannelContent(channel, currentGopherUrl);
    } else if (currentGopherUrl && gopherHistory[gopherHistory.length - 1] === currentGopherUrl) {
      // Navigating back
      fetchChannelContent(channel, currentGopherUrl);
    }
  }, [currentGopherUrl]);

  if (channel.type === 'discovery') {
    return <DiscoverySearchWindow channel={channel} onBack={onBack} />;
  }

  const fetchChannelContent = async (c: Channel, overrideUrl?: string) => {
    setIsFetching(true);
    setFeedContent('');
    
    try {
      if (c.type === 'telegram' || c.type === 'rss' || c.type === 'substack') {
        const response = await fetch(`/api/rss?url=${encodeURIComponent(c.sourceUrl)}`);
        if (!response.ok) {
          let errorMsg = response.statusText;
          try {
            const errData = await response.json();
            if (errData.message) errorMsg = errData.message;
          } catch (e) {}
          throw new Error(`Failed to fetch feed: ${errorMsg || response.status}`);
        }
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        let items = Array.from(xmlDoc.querySelectorAll('item'));
        if (items.length === 0) {
          items = Array.from(xmlDoc.querySelectorAll('entry'));
        }
        items = items.slice(0, 10);
        
        let content = `> **${c.name}**\n\n`;
        
        if (items.length === 0) {
          content += "No recent posts found or invalid feed format.";
        } else {
          items.forEach((item, index) => {
            const title = item.querySelector('title')?.textContent || 'Untitled';
            
            // Atom uses <link href="...">, RSS uses <link>...</link>
            let link = '';
            const linkEl = item.querySelector('link');
            if (linkEl) {
              link = linkEl.getAttribute('href') || linkEl.textContent || '';
            }
            
            const pubDate = item.querySelector('pubDate')?.textContent || item.querySelector('published')?.textContent || item.querySelector('updated')?.textContent || '';
            const description = item.querySelector('description')?.textContent || item.querySelector('content')?.textContent || item.querySelector('summary')?.textContent || '';
            
            // Clean up HTML tags from description safely
            let cleanDesc = '';
            try {
              const doc = new DOMParser().parseFromString(description, 'text/html');
              cleanDesc = (doc.body.textContent || '').substring(0, 300);
            } catch (e) {
              cleanDesc = description.substring(0, 300);
            }
            
            content += `### [${title}](${link})\n`;
            if (pubDate) {
              try {
                const date = new Date(pubDate);
                if (!isNaN(date.getTime())) {
                  content += `*Published: ${date.toLocaleString()}*\n\n`;
                }
              } catch (e) {}
            }
            content += `${cleanDesc}${cleanDesc.length >= 300 ? '...' : ''}\n\n---\n\n`;
          });
        }
        
        setFeedContent(content);
      } else if (c.type === 'gopher') {
        const targetUrl = overrideUrl || c.sourceUrl;
        const response = await fetch(`/api/gopher?url=${encodeURIComponent(targetUrl)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch gopher: ${response.statusText}`);
        }
        const data = await response.json();
        
        let content = `> **Gopher Hole: ${targetUrl}**\n\n`;
        
        if (data.type === '1' || data.type === '7') {
          // Directory listing
          const lines = data.content.split('\n');
          for (const line of lines) {
            if (!line || line === '.') continue;
            const type = line.charAt(0);
            const parts = line.substring(1).split('\t');
            if (parts.length >= 4) {
              const display = parts[0];
              const selector = parts[1];
              const host = parts[2];
              const port = parts[3];
              
              if (type === 'i') {
                content += `${display}\n`;
              } else {
                const link = `gopher://${host}:${port}/${type}${selector}`;
                content += `* [${display}](${link})\n`;
              }
            }
          }
        } else if (data.type === '0') {
          // Text file
          content += "```text\n" + data.content + "\n```";
        } else {
          content += "Unsupported gopher type or binary file.";
        }
        
        setFeedContent(content);
      } else {
        setFeedContent(`Unsupported channel type: ${c.type}`);
      }
    } catch (error: any) {
      console.error('Failed to fetch channel content:', error);
      setFeedContent(`**Error:** Failed to load content.\n\n${error.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  const runChannelerAnalysis = async () => {
    if (!feedContent) return;
    
    setIsAnalyzing(true);
    setAnalysisResult('');
    
    try {
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      const agents = await getAgents();
      const feedAgent = agents.find(a => a.isFeed);
      
      const stream = await generateChannelerAnalysis(feedContent, promptStrategy, { apiKey, agent: feedAgent });
      
      for await (const chunk of stream) {
        if (chunk.text) {
            setAnalysisResult(prev => prev + chunk.text);
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisResult('**Error:** Analysis failed. Please check your API key and connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pushToObsidian = () => {
    if (!analysisResult) return;
    
    const blob = new Blob([analysisResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RADIX_Analysis_${channel.name}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full w-full bg-[var(--bg-color)] relative overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--panel-bg)]">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button onClick={onBack} className="sm:hidden text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <ChevronRight size={20} className="rotate-180" />
              </button>
            )}
            {gopherHistory.length > 1 && (
              <button 
                onClick={() => {
                  const newHistory = [...gopherHistory];
                  newHistory.pop();
                  const prevUrl = newHistory[newHistory.length - 1];
                  setGopherHistory(newHistory);
                  setCurrentGopherUrl(prevUrl);
                }}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors border border-transparent hover:border-[var(--border)]"
                title="Back in Gopher Space"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold flex items-center">
                {channel.type === 'telegram' && <Icon icon="logos:telegram" width="18" height="18" className="mr-2" />}
                {channel.type === 'rss' && ((channel.sourceUrl.includes('nitter') || channel.sourceUrl.includes('x.com') || channel.sourceUrl.includes('twitter.com')) ? <Icon icon="ri:twitter-x-fill" width="18" height="18" className="mr-2 text-[var(--text-muted)]" /> : <Rss size={18} className="mr-2 text-[var(--text-muted)]" />)}
                {channel.type === 'substack' && <Icon icon="simple-icons:substack" width="18" height="18" className="mr-2 text-[#FF6719]" />}
                {channel.type === 'gopher' && <Terminal size={18} className="mr-2 text-[var(--text-muted)]" />}
                {channel.name}
              </h1>
              <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)]">
                <span className="uppercase tracking-wider">{channel.type}</span>
                <span>•</span>
                <a href={channel.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] flex items-center">
                  <ExternalLink size={10} className="mr-1" /> Source
                </a>
                <span>•</span>
                <button onClick={() => fetchChannelContent(channel)} className="hover:text-[var(--text-main)] flex items-center" title="Refresh Feed">
                  <RefreshCw size={10} className={`mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[var(--bg-color)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              title="Feed Settings"
            >
              <SettingsIcon size={20} />
            </button>
            
            {showSettings && (
              <div className="absolute right-12 top-0 mt-10 w-64 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center">
                  <SettingsIcon size={14} className="mr-2" /> Feed Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-muted)]">Text Size</span>
                      <span className="font-mono">{textSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="8" 
                      max="20" 
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setShowChanneler(!showChanneler)}
              className={`p-2 rounded-lg transition-colors ${showChanneler ? 'bg-green-500/20 text-green-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              title="Toggle Channeler AI"
            >
              <Bot size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isFetching ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
              <RefreshCw size={32} className="mb-4 animate-spin opacity-50" />
              <p>Connecting to stream...</p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none" style={{ fontSize: `${textSize}px` }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({node, href, ...props}) => {
                    if (href?.startsWith('gopher://')) {
                      return (
                        <a 
                          {...props} 
                          href="#"
                          className="text-[var(--accent)] underline hover:opacity-80 break-all"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentGopherUrl(href);
                          }}
                        />
                      );
                    }
                    return (
                      <a 
                        {...props} 
                        href={href}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[var(--accent)] no-underline hover:underline break-all"
                      />
                    );
                  }
                }}
              >
                {feedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Channeler Panel */}
      {showChanneler && (
        <div className="w-80 sm:w-96 border-l border-[var(--border)] bg-[var(--panel-bg)] flex flex-col absolute right-0 top-0 bottom-0 z-20 shadow-xl animate-in slide-in-from-right">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-green-900/10">
            <h3 className="font-bold text-green-500 flex items-center">
              <Bot size={16} className="mr-2" /> Channeler
            </h3>
            <button onClick={() => setShowChanneler(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Prompt Strategy</label>
              <select 
                value={promptStrategy}
                onChange={(e) => setPromptStrategy(e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg p-2 text-sm focus:border-green-500 outline-none"
              >
                <option>Objective Summary (Default)</option>
                <option>Fact Check & Cross-Reference</option>
                <option>Sentiment Analysis</option>
                <option>Custom Prompt 1</option>
              </select>
              <button 
                onClick={runChannelerAnalysis}
                disabled={isAnalyzing || !feedContent}
                className="w-full py-2 bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-600/50 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={12} className="mr-2 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={12} className="mr-2" /> Run Analysis
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 border border-[var(--border)] rounded-xl bg-[var(--bg-color)] p-4 min-h-[300px] overflow-y-auto">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisResult || `> **Channeler Analysis**\n\nWaiting for input stream...`}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[var(--border)]">
            <button 
              onClick={pushToObsidian}
              disabled={!analysisResult}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} className="mr-2" /> Push to Obsidian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
