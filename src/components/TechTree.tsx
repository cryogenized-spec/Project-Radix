import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Proficiency {
  id: string;
  field: string;
  level: 'Novice' | 'Intermediate' | 'Advanced' | 'Expert';
  details?: string;
  connections?: string[];
}

interface TechTreeProps {
  proficiencies: Proficiency[];
}

export default function TechTree({ proficiencies }: TechTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 350 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setDimensions({ width: entries[0].contentRect.width, height: 350 });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nodes = proficiencies.map(p => ({
      id: p.id,
      name: p.field,
      level: p.level,
      val: p.level === 'Expert' ? 20 : p.level === 'Advanced' ? 15 : p.level === 'Intermediate' ? 10 : 5
    }));
    
    const links = proficiencies.flatMap(p =>
      (p.connections || [])
        .filter(c => proficiencies.some(prof => prof.id === c))
        .map(c => ({
          source: p.id,
          target: c
        }))
    );
    
    return { nodes, links };
  }, [proficiencies]);

  if (proficiencies.length === 0) {
    return (
      <div className="w-full h-[350px] bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-sm italic">
        Add proficiencies to generate your Tech Tree.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[350px] bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] overflow-hidden relative">
      <div className="absolute top-2 left-2 z-10 bg-[var(--bg-color)]/80 backdrop-blur-sm border border-[var(--border)] rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] pointer-events-none">
        Interactive Tech Tree
      </div>
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeRelSize={1}
        nodeColor={(node: any) => {
          switch(node.level) {
            case 'Expert': return '#f59e0b'; // amber
            case 'Advanced': return '#10b981'; // emerald
            case 'Intermediate': return '#3b82f6'; // blue
            default: return '#64748b'; // slate
          }
        }}
        linkColor={() => 'rgba(150, 150, 150, 0.3)'}
        backgroundColor="transparent"
        linkWidth={1.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
      />
    </div>
  );
}
