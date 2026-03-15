import React, { useCallback, useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, NodeProps, Handle, Position, applyNodeChanges, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Note } from '../../lib/organizerDb';
import { parseMarkdown, stringifyMarkdown } from '../../lib/markdownUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Custom Node Component for Notes
const NoteNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-xl w-64 max-h-96 overflow-hidden flex flex-col hover:border-[var(--accent)] transition-colors cursor-grab active:cursor-grabbing">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-[var(--accent)] border-none" />
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-color)]/50 font-bold text-sm truncate text-[var(--text-main)]">
        {data.title as string}
      </div>
      <div className="p-3 text-xs text-[var(--text-muted)] overflow-y-auto prose prose-invert prose-sm max-w-none pointer-events-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {(data.preview as string) || ''}
        </ReactMarkdown>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-[var(--accent)] border-none" />
    </div>
  );
};

const nodeTypes = {
  noteNode: NoteNode,
};

interface NotesCanvasViewProps {
  notes: Note[];
  onUpdateNote: (note: Note) => void;
  onSelectNote: (note: Note) => void;
}

export default function NotesCanvasView({ notes, onUpdateNote, onSelectNote }: NotesCanvasViewProps) {
  
  const initialNodes: Node[] = useMemo(() => {
    return notes.filter(n => !n.isFolder).map((note, i) => {
      const parsed = parseMarkdown(note.content);
      const x = parsed.frontmatter['canvas-x'] !== undefined ? Number(parsed.frontmatter['canvas-x']) : (i % 5) * 300;
      const y = parsed.frontmatter['canvas-y'] !== undefined ? Number(parsed.frontmatter['canvas-y']) : Math.floor(i / 5) * 300;
      
      const lines = parsed.content.split('\n').filter(l => l.trim() !== '');
      const title = note.title || (lines[0] ? lines[0].replace(/#/g, '').trim() : 'Untitled');
      const preview = lines.slice(1, 5).join('\n');

      return {
        id: note.id!.toString(),
        type: 'noteNode',
        position: { x, y },
        data: { title, preview, note },
      };
    });
  }, [notes]);

  const [nodes, setNodes] = React.useState<Node[]>(initialNodes);

  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      
      // Persist position changes back to markdown frontmatter
      changes.forEach(change => {
        if (change.type === 'position' && change.position && !change.dragging) {
          const node = nodes.find(n => n.id === change.id);
          if (node && node.data.note) {
            const originalNote = node.data.note as Note;
            const parsed = parseMarkdown(originalNote.content);
            parsed.frontmatter['canvas-x'] = Math.round(change.position.x);
            parsed.frontmatter['canvas-y'] = Math.round(change.position.y);
            
            const newContent = stringifyMarkdown(parsed);
            onUpdateNote({ ...originalNote, content: newContent, updatedAt: Date.now() });
          }
        }
      });
    },
    [nodes, onUpdateNote]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.data.note) {
      onSelectNote(node.data.note as Note);
    }
  }, [onSelectNote]);

  return (
    <div className="w-full h-full bg-[var(--bg-color)] rounded-xl overflow-hidden border border-[var(--border)] shadow-inner relative">
      <div className="absolute top-4 left-4 z-10 bg-[var(--panel-bg)]/80 backdrop-blur border border-[var(--border)] px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--accent)] shadow-lg uppercase tracking-wider">
        Spatial Canvas
      </div>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        minZoom={0.1}
        maxZoom={4}
      >
        <Background color="var(--border)" gap={20} size={2} />
        <Controls className="bg-[var(--panel-bg)] border border-[var(--border)] fill-[var(--text-main)] shadow-lg rounded-lg overflow-hidden" />
      </ReactFlow>
    </div>
  );
}
