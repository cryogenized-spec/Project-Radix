import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Bot, Save, Trash2, RefreshCw, Layers, Search, Folder, ChevronRight, ChevronDown, Cpu, Maximize, Minimize, MapPin, FileText } from 'lucide-react';
import WorkbenchField from './WorkbenchField';
import WorkbenchField2D from './WorkbenchField2D';
import { CircuitGraph, ComponentManifest, CircuitEdge, SYSTEM_PROMPT_SPATIAL_AGENT } from '../lib/workbenchSchema';
import { COMPONENT_LIBRARY, ComponentCategory, ComponentDef } from '../lib/componentLibrary';
import { GoogleGenAI } from '@google/genai';

export default function RadixWorkbench() {
  const [graph, setGraph] = useState<CircuitGraph>({ nodes: [], edges: [] });
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [roomName, setRoomName] = useState('radix-workbench-demo');
  const [activeTab, setActiveTab] = useState<'agent' | 'library' | 'manifest'>('agent');
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ 'passive': true, 'active': true, 'ics': true, 'electromechanical': true });
  
  // Layout state
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [aiFeedback, setAiFeedback] = useState<string>('System ready. Awaiting instructions.');
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const nodesMapRef = useRef<Y.Map<any> | null>(null);
  const edgesMapRef = useRef<Y.Map<any> | null>(null);

  useEffect(() => {
    // Initialize Yjs Document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Connect to WebRTC signaling server (public for demo, should be self-hosted)
    const provider = new WebrtcProvider(roomName, ydoc, { signaling: ['wss://signaling.yjs.dev'] });
    providerRef.current = provider;

    // Get shared maps
    const nodesMap = ydoc.getMap('nodes');
    const edgesMap = ydoc.getMap('edges');
    nodesMapRef.current = nodesMap;
    edgesMapRef.current = edgesMap;

    // Observe changes
    const updateState = () => {
      const newNodes: ComponentManifest[] = [];
      nodesMap.forEach((val) => newNodes.push(val as ComponentManifest));
      
      const newEdges: CircuitEdge[] = [];
      edgesMap.forEach((val) => newEdges.push(val as CircuitEdge));
      
      setGraph({ nodes: newNodes, edges: newEdges });
    };

    nodesMap.observe(updateState);
    edgesMap.observe(updateState);

    // Initial load
    updateState();

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomName]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setAiFeedback('Analyzing request and calculating spatial routing...');
    
    try {
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const { getSetting } = await import('../lib/db');
      const keys = await getSetting('api_keys') || {};
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_SPATIAL_AGENT,
          responseMimeType: "application/json",
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        
        if (parsed.feedback) {
          setAiFeedback(parsed.feedback);
        }

        if (parsed.graph && parsed.graph.nodes && parsed.graph.edges) {
          ydocRef.current!.transact(() => {
            const nodes = nodesMapRef.current!;
            const edges = edgesMapRef.current!;
            
            parsed.graph.nodes.forEach((n: any) => nodes.set(n.id, n));
            parsed.graph.edges.forEach((e: any) => edges.set(e.id, e));
          });
        }
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiFeedback("Error generating circuit. Please try again or check your API key.");
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const handleAcceptChanges = () => {
    if (!nodesMapRef.current || !edgesMapRef.current) return;
    
    ydocRef.current!.transact(() => {
      const nodes = nodesMapRef.current!;
      const edges = edgesMapRef.current!;
      
      nodes.forEach((val, key) => {
        if (val.state === 'proposed') {
          nodes.set(key, { ...val, state: 'committed' });
        }
      });
      
      edges.forEach((val, key) => {
        if (val.state === 'proposed') {
          edges.set(key, { ...val, state: 'committed' });
        }
      });
    });
    setAiFeedback('Changes committed to the manifest.');
  };

  const handleRejectChanges = () => {
    if (!nodesMapRef.current || !edgesMapRef.current) return;
    
    ydocRef.current!.transact(() => {
      const nodes = nodesMapRef.current!;
      const edges = edgesMapRef.current!;
      
      nodes.forEach((val, key) => {
        if (val.state === 'proposed') {
          nodes.delete(key);
        }
      });
      
      edges.forEach((val, key) => {
        if (val.state === 'proposed') {
          edges.delete(key);
        }
      });
    });
    setAiFeedback('Changes rejected. Rolled back to previous state.');
  };

  const handleClear = () => {
    if (!nodesMapRef.current || !edgesMapRef.current) return;
    
    ydocRef.current!.transact(() => {
      nodesMapRef.current!.clear();
      edgesMapRef.current!.clear();
    });
    setAiFeedback('Canvas cleared.');
  };

  const handleRotateNode = (id: string) => {
    if (!nodesMapRef.current) return;
    
    ydocRef.current!.transact(() => {
      const nodes = nodesMapRef.current!;
      const node = nodes.get(id);
      if (node) {
        const currentRot = node.rotation.y || 0;
        const newRot = (currentRot + 90) % 360;
        nodes.set(id, { ...node, rotation: { ...node.rotation, y: newRot } });
      }
    });
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTab = (tab: 'agent' | 'library' | 'manifest') => {
    if (activeTab === tab) {
      setIsDrawerOpen(!isDrawerOpen);
    } else {
      setActiveTab(tab);
      setIsDrawerOpen(true);
    }
  };

  const renderLibrary = () => {
    const filteredLibrary = COMPONENT_LIBRARY.map(category => {
      const filteredSubcategories = category.subcategories?.map(sub => {
        const filteredItems = sub.items?.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return { ...sub, items: filteredItems };
      }).filter(sub => sub.items && sub.items.length > 0);
      
      return { ...category, subcategories: filteredSubcategories };
    }).filter(category => category.subcategories && category.subcategories.length > 0);

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search components..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredLibrary.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)] italic">No components found.</div>
          ) : (
            filteredLibrary.map(category => (
              <div key={category.id} className="space-y-1">
                <button 
                  onClick={() => toggleFolder(category.id)}
                  className="w-full flex items-center p-2 hover:bg-[var(--bg-color)] rounded-lg text-xs font-bold text-[var(--text-main)] transition-colors"
                >
                  {expandedFolders[category.id] ? <ChevronDown size={14} className="mr-2 text-[var(--text-muted)]" /> : <ChevronRight size={14} className="mr-2 text-[var(--text-muted)]" />}
                  <Folder size={14} className="mr-2 text-[var(--accent)]" />
                  {category.name}
                </button>
                
                {expandedFolders[category.id] && category.subcategories?.map(sub => (
                  <div key={sub.id} className="ml-4 space-y-1 border-l border-[var(--border)] pl-2">
                    <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{sub.name}</div>
                    {sub.items?.map(item => (
                      <div key={item.id} className="p-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">{item.name}</div>
                          <Cpu size={12} className="text-[var(--text-muted)]" />
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{item.description}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-color)] overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[var(--border)] flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <Layers className="text-[var(--accent)]" size={28} />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">RADIX Workbench</h1>
            <p className="text-xs text-[var(--text-muted)]">Sovereign 3D Electronic Circuit Designer (AI-CAD)</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg overflow-hidden">
            <button 
              onClick={() => setViewMode('2d')} 
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === '2d' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
            >
              2D
            </button>
            <button 
              onClick={() => setViewMode('3d')} 
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === '3d' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-white'}`}
            >
              3D
            </button>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[var(--panel-bg)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] flex items-center hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            P2P Sync Active
          </div>
          <button onClick={handleClear} className="p-2 rounded-lg bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear Canvas">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        
        {/* Canvas Area */}
        <div className={`bg-black/20 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : 'relative flex-1 h-[50vh] sm:h-full'}`}>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-4 right-4 z-10 p-2 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors shadow-lg"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          
          {viewMode === '3d' ? (
            <WorkbenchField 
              graph={graph} 
              onAcceptChanges={handleAcceptChanges} 
              onRejectChanges={handleRejectChanges} 
            />
          ) : (
            <div className="w-full h-full relative">
              <WorkbenchField2D graph={graph} onRotateNode={handleRotateNode} />
              
              {/* Overlay Accept/Reject buttons for 2D mode if there are proposed changes */}
              {graph.nodes.some(n => n.state === 'proposed') && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-4 bg-[var(--panel-bg)] p-3 rounded-xl border border-[var(--border)] shadow-2xl z-20">
                  <div className="flex flex-col items-center justify-center pr-4 border-r border-[var(--border)]">
                    <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Proposed Changes</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Review AI generation</span>
                  </div>
                  <button onClick={handleRejectChanges} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold uppercase tracking-wider transition-colors">
                    Reject
                  </button>
                  <button onClick={handleAcceptChanges} className="px-4 py-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 text-xs font-bold uppercase tracking-wider transition-colors">
                    Accept
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar (Activity Bar + Drawer) */}
        {!isFullscreen && (
          <div className="flex flex-col sm:flex-row h-auto sm:h-full shrink-0 z-10">
            {/* Drawer */}
            {isDrawerOpen && (
              <div className="w-full sm:w-80 h-auto sm:h-full bg-[var(--panel-bg)] border-l border-[var(--border)] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {activeTab === 'agent' ? 'AI Agent' : activeTab === 'library' ? 'Component Library' : 'Manifest Log'}
                  </h2>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'agent' && (
                    <div className="h-full flex flex-col p-4 overflow-y-auto">
                      <div className="bg-black/40 border border-[var(--border)] rounded-xl p-4 mb-4 text-sm text-[var(--text-main)] flex flex-col space-y-2 shrink-0">
                        <div className="flex items-center text-purple-400 font-bold mb-1">
                          <MapPin size={16} className="mr-2 text-purple-500" />
                          RADIX Agent
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed text-xs">
                          {aiFeedback}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed shrink-0">
                        Describe the circuit you want to build. The AI will parse your request, map the XYZ coordinates, and lay out the components in 3D space.
                      </p>
                      
                      <form onSubmit={handleGenerate} className="space-y-4 mt-auto shrink-0">
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="e.g., Create a 9v powered beam detection system on the wall..."
                          className="w-full h-32 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] resize-none"
                          disabled={isGenerating}
                        />
                        <button
                          type="submit"
                          disabled={isGenerating || !prompt.trim()}
                          className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center shadow-md"
                        >
                          {isGenerating ? (
                            <><RefreshCw size={16} className="mr-2 animate-spin" /> Generating...</>
                          ) : (
                            <><Layers size={16} className="mr-2" /> Generate Layout</>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {activeTab === 'library' && renderLibrary()}

                  {activeTab === 'manifest' && (
                    <div className="h-full p-4 overflow-y-auto">
                      <div className="space-y-2">
                        {graph.nodes.length === 0 ? (
                          <div className="text-xs text-[var(--text-muted)] italic">No components in manifest.</div>
                        ) : (
                          graph.nodes.map(node => (
                            <div key={node.id} className={`p-2 rounded-lg border text-xs flex justify-between items-center ${node.state === 'proposed' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-main)]'}`}>
                              <span className="font-mono truncate">{node.id}</span>
                              <span className="uppercase opacity-70">{node.type}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Activity Bar */}
            <div className="w-full sm:w-14 h-auto sm:h-full bg-[var(--bg-color)] border-l border-[var(--border)] flex flex-row sm:flex-col items-center py-4 space-x-4 sm:space-x-0 sm:space-y-4 shrink-0">
              <button 
                onClick={() => toggleTab('agent')} 
                className={`p-2 rounded-xl transition-colors ${activeTab === 'agent' && isDrawerOpen ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                title="AI Agent"
              >
                <Bot size={20} />
              </button>
              <button 
                onClick={() => toggleTab('library')} 
                className={`p-2 rounded-xl transition-colors ${activeTab === 'library' && isDrawerOpen ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                title="Component Library"
              >
                <Folder size={20} />
              </button>
              <button 
                onClick={() => toggleTab('manifest')} 
                className={`p-2 rounded-xl transition-colors ${activeTab === 'manifest' && isDrawerOpen ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                title="Manifest Log"
              >
                <FileText size={20} />
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
