import React, { useMemo } from 'react';
import { CircuitGraph, ComponentManifest, CircuitEdge } from '../lib/workbenchSchema';

interface WorkbenchField2DProps {
  graph: CircuitGraph;
  onRotateNode?: (id: string) => void;
}

function rotatePoint(x: number, z: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos
  };
}

export default function WorkbenchField2D({ graph, onRotateNode }: WorkbenchField2DProps) {
  const { minX, maxX, minZ, maxZ } = useMemo(() => {
    if (graph.nodes.length === 0) return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    graph.nodes.forEach(n => {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.x > maxX) maxX = n.position.x;
      if (n.position.z < minZ) minZ = n.position.z;
      if (n.position.z > maxZ) maxZ = n.position.z;
    });
    
    // Add padding and ensure minimum size
    const pad = 80;
    const width = Math.max(maxX - minX, 300);
    const height = Math.max(maxZ - minZ, 300);
    
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    
    return { 
      minX: cx - width/2 - pad, 
      maxX: cx + width/2 + pad, 
      minZ: cz - height/2 - pad, 
      maxZ: cz + height/2 + pad 
    };
  }, [graph]);

  const width = maxX - minX;
  const height = maxZ - minZ;

  const nodeMap = useMemo(() => {
    const map = new Map<string, ComponentManifest>();
    graph.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [graph.nodes]);

  const getPortAbsolutePosition = (node: ComponentManifest, portId: string) => {
    const port = node.ports.find(p => p.id === portId);
    if (!port) return { x: node.position.x, z: node.position.z };
    
    const rotated = rotatePoint(port.x, port.z, node.rotation.y || 0);
    return {
      x: node.position.x + rotated.x,
      z: node.position.z + rotated.z
    };
  };

  const renderComponentShape = (node: ComponentManifest, dimX: number, dimZ: number, color: string, fill: string) => {
    const type = node.type.toLowerCase();
    
    if (type === 'battery' || type === 'power') {
      return (
        <g>
          <rect x={-dimX/2} y={-dimZ/2} width={dimX} height={dimZ} fill={fill} stroke={color} strokeWidth={1.5} rx={2} />
          <line x1={-dimX/4} y1={-dimZ/4} x2={dimX/4} y2={-dimZ/4} stroke={color} strokeWidth={2} />
          <line x1={0} y1={-dimZ/4 - dimX/4} x2={0} y2={-dimZ/4 + dimX/4} stroke={color} strokeWidth={2} />
          <line x1={-dimX/4} y1={dimZ/4} x2={dimX/4} y2={dimZ/4} stroke={color} strokeWidth={2} />
        </g>
      );
    }
    if (type === 'resistor') {
      return (
        <g>
          <rect x={-dimX/2} y={-dimZ/2} width={dimX} height={dimZ} fill={node.visualLogic?.color || fill} stroke={color} strokeWidth={1.5} rx={1} />
          {/* Zigzag pattern */}
          <path d={`M ${-dimX/2} 0 L ${-dimX/4} ${-dimZ/3} L 0 ${dimZ/3} L ${dimX/4} ${-dimZ/3} L ${dimX/2} 0`} fill="none" stroke={color} strokeWidth={1.5} />
        </g>
      );
    }
    if (type === 'led' || type === 'diode') {
      return (
        <g>
          <circle cx={0} cy={0} r={Math.min(dimX, dimZ)/2} fill={node.visualLogic?.color || fill} stroke={color} strokeWidth={1.5} />
          <path d={`M ${-dimX/4} ${-dimZ/4} L ${dimX/4} 0 L ${-dimX/4} ${dimZ/4} Z`} fill={color} />
          <line x1={dimX/4} y1={-dimZ/4} x2={dimX/4} y2={dimZ/4} stroke={color} strokeWidth={1.5} />
        </g>
      );
    }
    if (type === 'switch') {
      return (
        <g>
          <rect x={-dimX/2} y={-dimZ/2} width={dimX} height={dimZ} fill={fill} stroke={color} strokeWidth={1.5} rx={2} />
          <circle cx={-dimX/4} cy={0} r={2} fill={color} />
          <circle cx={dimX/4} cy={0} r={2} fill={color} />
          <line x1={-dimX/4} y1={-2} x2={dimX/4} y2={-dimZ/3} stroke={color} strokeWidth={1.5} />
        </g>
      );
    }
    if (type === 'ic' || type === 'mcu') {
      return (
        <g>
          <rect x={-dimX/2} y={-dimZ/2} width={dimX} height={dimZ} fill="#222" stroke={color} strokeWidth={1.5} rx={1} />
          <circle cx={-dimX/2 + 4} cy={-dimZ/2 + 4} r={1.5} fill={color} />
        </g>
      );
    }
    
    // Default rectangular shape
    return (
      <rect x={-dimX/2} y={-dimZ/2} width={dimX} height={dimZ} fill={fill} stroke={color} strokeWidth={1.5} rx={2} />
    );
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] overflow-hidden relative flex items-center justify-center">
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
          backgroundSize: '20px 20px',
          backgroundPosition: 'center center'
        }} 
      />
      
      <svg 
        viewBox={`${minX} ${minZ} ${width} ${height}`} 
        className="w-full h-full relative z-10"
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          {/* Edges */}
          {graph.edges.map(edge => {
            const source = nodeMap.get(edge.sourceComponentId);
            const target = nodeMap.get(edge.targetComponentId);
            if (!source || !target) return null;
            
            const p1 = getPortAbsolutePosition(source, edge.sourcePortId);
            const p2 = getPortAbsolutePosition(target, edge.targetPortId);
            
            const isProposed = edge.state === 'proposed';
            const color = isProposed ? '#00ff00' : '#ff5500';
            
            return (
              <g key={edge.id}>
                <line 
                  x1={p1.x}
                  y1={p1.z}
                  x2={p2.x}
                  y2={p2.z}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={isProposed ? "4,4" : "none"}
                />
                <circle cx={p1.x} cy={p1.z} r={2} fill={color} />
                <circle cx={p2.x} cy={p2.z} r={2} fill={color} />
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map(node => {
            const isProposed = node.state === 'proposed';
            const color = isProposed ? '#00ff00' : '#ffffff';
            const fill = isProposed ? 'rgba(0, 255, 0, 0.1)' : '#1a1a1a';
            
            // Map 3D dimensions to 2D (x and z)
            const dimX = Math.max(node.dimensions.x, 15);
            const dimZ = Math.max(node.dimensions.z, 15);
            
            return (
              <g 
                key={node.id} 
                transform={`translate(${node.position.x}, ${node.position.z}) rotate(${node.rotation.y || 0})`}
                onClick={() => onRotateNode && onRotateNode(node.id)}
                className={onRotateNode ? "cursor-pointer" : ""}
              >
                {renderComponentShape(node, dimX, dimZ, color, fill)}
                
                {/* Ports */}
                {node.ports.map(port => (
                  <circle 
                    key={port.id}
                    cx={port.x}
                    cy={port.z}
                    r={1.5}
                    fill="#ff00ff"
                  />
                ))}

                {/* Label (un-rotated so it's always readable) */}
                <g transform={`rotate(${-(node.rotation.y || 0)})`}>
                  <text 
                    x={0} 
                    y={Math.max(dimX, dimZ) / 2 + 12} 
                    fill={color} 
                    fontSize={8} 
                    textAnchor="middle"
                    className="font-mono"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {node.visualLogic.value ? `${node.type} (${node.visualLogic.value})` : node.type}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 pointer-events-none">
        Click a component to rotate 90°
      </div>
    </div>
  );
}
