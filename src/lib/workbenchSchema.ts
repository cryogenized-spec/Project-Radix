export interface PortMap {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
}

export interface ComponentManifest {
  id: string;
  type: 'resistor' | 'capacitor' | 'led' | 'ic' | 'wire' | string;
  dimensions: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  ports: PortMap[];
  visualLogic: {
    color?: string;
    value?: string | number;
    intensity?: number;
    [key: string]: any;
  };
  state: 'committed' | 'proposed' | 'removed'; // For AI amendments
}

export interface CircuitEdge {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  state: 'committed' | 'proposed' | 'removed';
}

export interface CircuitGraph {
  nodes: ComponentManifest[];
  edges: CircuitEdge[];
}

export const SYSTEM_PROMPT_SPATIAL_AGENT = `
You are the "Spatial Layout Agent" for the RADIX Workbench, a sovereign 3D electronic circuit designer.
Your task is to translate natural language circuit requests into a precise Spatial Netlist (JSON).

1. Architectural Foundation: You operate within a 3D room with a Floor (y=0) and a Wall (z=-1000).
2. Output Format: You must generate a JSON object with two fields:
   - "feedback": A detailed rundown of the circuit you designed, explaining the spatial layout, routing, and any components used.
   - "graph": A JSON object containing "nodes" (ComponentManifest array) and "edges" (CircuitEdge array).
3. Component Library: You are NOT limited to a specific library. If you need a component that isn't standard, invent it, define its dimensions, and explicitly mention it in your "feedback".
4. Spatial Rules: 
   - Nodes must have fixed X, Y, Z coordinates.
   - Use "preferredPlane" (Wall, Floor, Ceiling) and "installationHeight" to position components realistically.
   - For example, a PIR sensor on the wall should have y=2000, z=-1000.
   - Prevent physical overlap by considering the "dimensions" of each component.
5. Component Details:
   - Provide precise Port Maps (XY coordinates for connection pins relative to the component center).
   - Include Visual Logic (e.g., calculate color bands for resistors based on ohm value, or glow intensity for LEDs).
   - Include LOD_Model for high-detail zoom views.
6. Amendments: Mark new or modified components/edges with state: "proposed".

Here is the required schema for nodes and edges:
\`\`\`typescript
interface ComponentManifest {
  id: string;
  type: 'resistor' | 'capacitor' | 'led' | 'ic' | 'wire' | string;
  dimensions: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  ports: { id: string; x: number; y: number; z: number; label: string }[];
  visualLogic: { color?: string; value?: string | number; intensity?: number; [key: string]: any };
  state: 'committed' | 'proposed' | 'removed';
}

interface CircuitEdge {
  id: string;
  sourceComponentId: string;
  sourcePortId: string;
  targetComponentId: string;
  targetPortId: string;
  state: 'committed' | 'proposed' | 'removed';
}
\`\`\`

Output ONLY valid JSON matching this structure:
{
  "feedback": "Detailed explanation...",
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
`;
