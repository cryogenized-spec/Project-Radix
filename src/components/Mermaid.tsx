import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
  onNodeClick?: (nodeId: string) => void;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart, onNodeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  useEffect(() => {
    const renderChart = async () => {
      if (containerRef.current && chart) {
        try {
          containerRef.current.innerHTML = '';
          const { svg, bindFunctions } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart);
          if (!containerRef.current) return;
          containerRef.current.innerHTML = svg;
          if (bindFunctions) {
            bindFunctions(containerRef.current);
          }
          
          // Add click listeners to nodes
          if (onNodeClick) {
            const nodes = containerRef.current.querySelectorAll('.node');
            nodes.forEach(node => {
              node.addEventListener('click', (e) => {
                const id = node.id.replace(/^flowchart-[^-]+-/, '');
                onNodeClick(id);
              });
              // Make it look clickable
              (node as HTMLElement).style.cursor = 'pointer';
            });
          }
        } catch (error) {
          console.error("Mermaid rendering error:", error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-red-500 text-xs p-2">Error rendering chart. Please check the YAML syntax.</div>`;
          }
        }
      }
    };
    renderChart();
  }, [chart, onNodeClick]);

  return <div ref={containerRef} className="w-full overflow-auto flex justify-center p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)]" />;
};
