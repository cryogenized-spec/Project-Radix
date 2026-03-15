import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Note } from '../../lib/organizerDb';

interface NotesGraphViewProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
}

export default function NotesGraphView({ notes, onSelectNote }: NotesGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Parse backlinks and tags
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const tagsMap = new Map<string, number>();

    // 1. Create nodes for all notes
    notes.forEach(note => {
      if (note.isFolder) return;
      
      const lines = note.content.split('\n').filter(l => l.trim() !== '');
      const title = note.title || (lines[0] ? lines[0].replace(/#/g, '').trim() : 'Untitled');
      
      nodes.push({
        id: note.id,
        name: title,
        val: 2, // Node size
        type: 'note',
        note: note
      });

      // Extract #tags
      const tags: string[] = note.content.match(/#(\w+)/g) || [];
      tags.forEach(tag => {
        const tagName = tag.toLowerCase();
        if (!tagsMap.has(tagName)) {
          tagsMap.set(tagName, 1);
          nodes.push({
            id: tagName,
            name: tagName,
            val: 1.5,
            type: 'tag'
          });
        }
        
        links.push({
          source: note.id,
          target: tagName,
          type: 'tag-link'
        });
      });

      // Extract [[Backlinks]]
      const backlinks: string[] = note.content.match(/\[\[(.*?)\]\]/g) || [];
      backlinks.forEach(link => {
        const targetTitle = link.replace(/\[\[|\]\]/g, '').trim();
        // Find if target note exists
        const targetNote = notes.find(n => {
          const nLines = n.content.split('\n').filter(l => l.trim() !== '');
          const nTitle = n.title || (nLines[0] ? nLines[0].replace(/#/g, '').trim() : '');
          return nTitle.toLowerCase() === targetTitle.toLowerCase();
        });

        if (targetNote) {
          links.push({
            source: note.id,
            target: targetNote.id,
            type: 'backlink'
          });
        } else {
          // Create ghost node for uncreated links
          const ghostId = `ghost-${targetTitle}`;
          if (!nodes.find(n => n.id === ghostId)) {
            nodes.push({
              id: ghostId,
              name: targetTitle,
              val: 1,
              type: 'ghost'
            });
          }
          links.push({
            source: note.id,
            target: ghostId,
            type: 'backlink'
          });
        }
      });
    });

    return { nodes, links };
  }, [notes]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    if (node.type === 'note') {
      onSelectNote(node.note);
    }
  }, [onSelectNote]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[var(--bg-color)] relative overflow-hidden rounded-xl border border-[var(--border)] shadow-inner">
      <div className="absolute top-4 left-4 z-10 bg-[var(--panel-bg)]/80 backdrop-blur border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-muted)] flex items-center gap-4 shadow-lg">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--accent)]"></div> Notes</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Tags</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-500"></div> Uncreated</div>
      </div>
      
      {dimensions.width > 0 && (
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={(node: any) => {
            if (node.type === 'note') return 'var(--accent)';
            if (node.type === 'tag') return '#a855f7'; // purple-500
            return '#6b7280'; // gray-500
          }}
          linkColor={(link: any) => {
            return isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          }}
          nodeRelSize={6}
          onNodeClick={handleNodeClick}
          backgroundColor="transparent"
          d3VelocityDecay={0.3}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.name;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Inter, sans-serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

            ctx.fillStyle = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (node.type === 'note') ctx.fillStyle = isDark ? '#fff' : '#000';
            else if (node.type === 'tag') ctx.fillStyle = '#a855f7';
            else ctx.fillStyle = '#6b7280';
            
            ctx.fillText(label, node.x, node.y);

            node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
          }}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
          }}
        />
      )}
    </div>
  );
}
