import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Billboard, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { ComponentManifest, CircuitEdge, CircuitGraph } from '../lib/workbenchSchema';

// A single InstancedMesh wrapper for a specific geometry/material
const InstancedComponents = ({ 
  components, 
  geometry, 
  material, 
  colorFn,
  onClick
}: { 
  components: ComponentManifest[], 
  geometry: THREE.BufferGeometry, 
  material: THREE.Material,
  colorFn: (c: ComponentManifest) => THREE.Color,
  onClick?: (comp: ComponentManifest) => void
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const [hovered, setHovered] = useState<number | null>(null);

  useFrame(() => {
    if (meshRef.current) {
      components.forEach((comp, i) => {
        dummy.position.set(comp.position?.x || 0, comp.position?.y || 0, comp.position?.z || 0);
        dummy.rotation.set(comp.rotation?.x || 0, comp.rotation?.y || 0, comp.rotation?.z || 0);
        dummy.scale.set(comp.dimensions?.x || 1, comp.dimensions?.y || 1, comp.dimensions?.z || 1);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        
        const c = colorFn(comp);
        if (comp.state === 'proposed') {
          c.lerp(new THREE.Color('#00ff00'), 0.5);
        }
        if (hovered === i) {
          c.lerp(new THREE.Color('#ffffff'), 0.3);
        }
        meshRef.current!.setColorAt(i, c);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[geometry, material, Math.max(components.length, 1)]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(e.instanceId ?? null); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(null); document.body.style.cursor = 'auto'; }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && onClick) {
          onClick(components[e.instanceId]);
        }
      }}
    >
      {components.length === 0 && <boxGeometry args={[0,0,0]} />}
    </instancedMesh>
  );
};

// Edges rendered as 3D tubes with realistic routing
const CircuitEdges = ({ edges, nodes, dimOpacity }: { edges: CircuitEdge[], nodes: ComponentManifest[], dimOpacity: number }) => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, ComponentManifest>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <>
      {edges.map(edge => {
        const source = nodeMap.get(edge.sourceComponentId);
        const target = nodeMap.get(edge.targetComponentId);
        if (!source || !target) return null;
        
        const p1 = new THREE.Vector3(source.position?.x || 0, source.position?.y || 0, source.position?.z || 0);
        const p2 = new THREE.Vector3(target.position?.x || 0, target.position?.y || 0, target.position?.z || 0);
        
        // Realistic routing: drop to floor, move along X, move along Z, rise to target
        const points = [p1];
        if (p1.y > 0) points.push(new THREE.Vector3(p1.x, 0, p1.z));
        points.push(new THREE.Vector3(p2.x, 0, p1.z));
        points.push(new THREE.Vector3(p2.x, 0, p2.z));
        if (p2.y > 0) points.push(p2);
        
        // Remove duplicate consecutive points to avoid CatmullRomCurve3 errors
        const uniquePoints = points.filter((p, i, arr) => i === 0 || !p.equals(arr[i - 1]));
        
        // If we only have 1 point (source and target are same), add a dummy point
        if (uniquePoints.length < 2) {
          uniquePoints.push(new THREE.Vector3(p1.x, p1.y + 1, p1.z));
        }

        const curve = new THREE.CatmullRomCurve3(uniquePoints, false, 'catmullrom', 0.1);
        const color = edge.state === 'proposed' ? '#00ff00' : '#ff5500';

        return (
          <mesh key={edge.id}>
            <tubeGeometry args={[curve, 64, 1, 8, false]} />
            <meshStandardMaterial color={color} transparent opacity={dimOpacity} />
          </mesh>
        );
      })}
    </>
  );
};

// Billboards for labels
const Labels = ({ components }: { components: ComponentManifest[] }) => {
  return (
    <>
      {components.map(comp => (
        <Billboard
          key={comp.id}
          position={[comp.position.x, comp.position.y + comp.dimensions.y / 2 + 10, comp.position.z]}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
        >
          <Text fontSize={12} color={comp.state === 'proposed' ? '#00ff00' : 'white'} outlineWidth={1} outlineColor="black">
            {comp.visualLogic.value ? `${comp.type} (${comp.visualLogic.value})` : comp.type}
          </Text>
        </Billboard>
      ))}
    </>
  );
};

const CameraController = ({ focusedComponent, onUnfocus, resetCamera }: { focusedComponent: ComponentManifest | null, onUnfocus: () => void, resetCamera: React.MutableRefObject<() => void> }) => {
  const controlsRef = useRef<any>(null);
  
  resetCamera.current = () => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(200, 300, 500);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  useFrame((state) => {
    if (focusedComponent && controlsRef.current) {
      const targetPos = new THREE.Vector3(
        focusedComponent.position.x,
        focusedComponent.position.y,
        focusedComponent.position.z
      );
      
      const camTargetPos = new THREE.Vector3(
        focusedComponent.position.x + 150, // Angled
        focusedComponent.position.y + 150, // Zoom out
        focusedComponent.position.z + 200  // Zoom out
      );

      state.camera.position.lerp(camTargetPos, 0.05);
      controlsRef.current.target.lerp(targetPos, 0.05);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      makeDefault 
      minDistance={100}
      maxDistance={5000}
      onStart={() => {
        // If user manually moves camera, unfocus
        if (focusedComponent) onUnfocus();
      }}
    />
  );
};

export default function WorkbenchField({ 
  graph, 
  onAcceptChanges, 
  onRejectChanges 
}: { 
  graph: CircuitGraph,
  onAcceptChanges: () => void,
  onRejectChanges: () => void
}) {
  const [animatedNodes, setAnimatedNodes] = useState<ComponentManifest[]>([]);
  const [focusedComponentId, setFocusedComponentId] = useState<string | null>(null);
  const resetCamera = useRef<() => void>(() => {});
  
  const focusedComponent = useMemo(() => 
    animatedNodes.find(n => n.id === focusedComponentId) || null
  , [animatedNodes, focusedComponentId]);
  
  // Geometries and Materials
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cylGeo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 16), []);
  const sphGeo = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  
  const defaultMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8 }), []);

  // Spring Physics for layout relaxation
  useEffect(() => {
    if (!graph.nodes.length) {
      setAnimatedNodes([]);
      return;
    }

    // Simple direct assignment for now to prevent crashes
    setAnimatedNodes(graph.nodes);
    
    // Trigger camera reset if we have new proposed nodes
    if (graph.nodes.some(n => n.state === 'proposed')) {
      resetCamera.current();
    }

  }, [graph]);

  const resistors = animatedNodes.filter(n => n.type === 'resistor');
  const leds = animatedNodes.filter(n => n.type === 'led');
  const others = animatedNodes.filter(n => n.type !== 'resistor' && n.type !== 'led');

  const hasProposed = graph.nodes.some(n => n.state === 'proposed') || graph.edges.some(e => e.state === 'proposed');

  const handleComponentClick = (comp: ComponentManifest) => {
    setFocusedComponentId(comp.id);
  };

  const handleUnfocus = () => {
    setFocusedComponentId(null);
  };

  const dimOpacity = focusedComponentId ? 0.2 : 1;

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [200, 300, 500], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[100, 100, 100]} intensity={1} />
        <pointLight position={[-100, -100, -100]} intensity={0.5} />
        
        {/* Architectural Foundation */}
        <group>
          {/* Floor */}
          <mesh position={[0, -10, 0]} receiveShadow>
            <boxGeometry args={[2000, 20, 2000]} />
            <meshStandardMaterial color="#222222" transparent opacity={dimOpacity} />
          </mesh>
          {/* Wall */}
          <mesh position={[0, 500, -1010]} receiveShadow>
            <boxGeometry args={[2000, 1000, 20]} />
            <meshStandardMaterial color="#333333" transparent opacity={dimOpacity} />
          </mesh>
          {/* Ceiling */}
          <mesh position={[0, 1010, 0]} receiveShadow>
            <boxGeometry args={[2000, 20, 2000]} />
            <meshStandardMaterial color="#1a1a1a" transparent opacity={dimOpacity} />
          </mesh>
          <gridHelper args={[2000, 20, '#444444', '#222222']} position={[0, 0, 0]} material-transparent material-opacity={dimOpacity} />
        </group>
        
        <InstancedComponents 
          components={resistors} 
          geometry={cylGeo} 
          material={defaultMat} 
          colorFn={(c) => new THREE.Color(c.visualLogic.color || '#d2b48c')} 
          onClick={handleComponentClick}
        />
        <InstancedComponents 
          components={leds} 
          geometry={sphGeo} 
          material={defaultMat} 
          colorFn={(c) => new THREE.Color(c.visualLogic.color || '#ff0000')} 
          onClick={handleComponentClick}
        />
        <InstancedComponents 
          components={others} 
          geometry={boxGeo} 
          material={defaultMat} 
          colorFn={() => new THREE.Color('#333333')} 
          onClick={handleComponentClick}
        />

        <CircuitEdges edges={graph.edges} nodes={animatedNodes} dimOpacity={dimOpacity} />
        <Labels components={animatedNodes} />
        
        {focusedComponent && (
          <group position={[focusedComponent.position.x, focusedComponent.position.y + 20, focusedComponent.position.z]}>
            {/* LOD Model placeholder */}
            <mesh>
              <boxGeometry args={[focusedComponent.dimensions.x * 1.5, focusedComponent.dimensions.y * 1.5, focusedComponent.dimensions.z * 1.5]} />
              <meshStandardMaterial color="#00ff00" wireframe />
            </mesh>
            <Billboard position={[0, 20, 0]}>
              <Text fontSize={8} color="white" outlineWidth={1} outlineColor="black">
                {focusedComponent.type} - Detailed View
              </Text>
            </Billboard>
          </group>
        )}

        <CameraController focusedComponent={focusedComponent} onUnfocus={handleUnfocus} resetCamera={resetCamera} />
      </Canvas>

      {focusedComponentId && (
        <div className="absolute top-6 left-6 flex space-x-4 bg-black/80 p-4 rounded-2xl border border-[var(--border)] backdrop-blur-md">
          <button onClick={handleUnfocus} className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] hover:text-[var(--accent)]">
            ← Back to Room View
          </button>
        </div>
      )}

      {hasProposed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-4 bg-black/80 p-4 rounded-2xl border border-[var(--accent)] backdrop-blur-md">
          <div className="text-sm font-bold text-[var(--accent)] flex items-center mr-4">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse mr-2"></span>
            AI Proposed Changes
          </div>
          <button onClick={onRejectChanges} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/40 transition-colors text-xs font-bold uppercase tracking-wider">
            Rollback
          </button>
          <button onClick={onAcceptChanges} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black hover:opacity-90 transition-opacity text-xs font-bold uppercase tracking-wider">
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
