'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Node,
  useNodesState,
  useEdgesState,
  Connection,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  NodeProps,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProtoNotesStore, type ProtoNote } from './notesStore';
import NoteModal from './NoteModal';
import { 
  Pin, 
  Edit3, 
  Trash2,
  FileText,
  Users,
  Package,
  Map,
  Plus
} from 'lucide-react';

// Helper function for connection colors
const getConnectionColor = (type: string) => {
  switch (type) {
    case 'reference': return '#3b82f6'; // blue
    case 'related': return '#10b981'; // green
    case 'conflict': return '#ef4444'; // red
    case 'child': return '#8b5cf6'; // purple
    case 'parent': return '#f59e0b'; // amber
    default: return '#6b7280'; // gray
  }
};

// Custom Note Node Component
function NoteNode({ data, selected }: NodeProps<ProtoNote & { onEditNote?: (id: string) => void }>) {
  const { updateNote, deleteNote } = useProtoNotesStore();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'session': return <FileText size={14} className="text-blue-600" />;
      case 'npc': return <Users size={14} className="text-green-600" />;
      case 'item': return <Package size={14} className="text-purple-600" />;
      case 'plot': return <Map size={14} className="text-orange-600" />;
      default: return <FileText size={14} className="text-gray-600" />;
    }
  };

  const handleEdit = () => {
    if (data.onEditNote) {
      data.onEditNote(data.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this note?')) {
      deleteNote(data.id);
    }
  };

  const handleTogglePin = () => {
    updateNote(data.id, { isPinned: !data.isPinned });
  };

  return (
    <div className={`
      bg-white rounded-lg shadow-lg border-2 p-4 min-w-64 max-w-80 group
      ${selected ? 'border-blue-500' : data.isPinned ? 'border-yellow-400' : 'border-gray-200'}
      hover:shadow-xl transition-shadow
    `}>
      {/* Connection Handles */}
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />
      
      {/* Note Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getCategoryIcon(data.category)}
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {data.title}
          </h3>
          {data.isPinned && (
            <Pin size={12} className="text-yellow-600 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleTogglePin}
            className="p-1 text-gray-400 hover:text-yellow-600 rounded"
            title={data.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={12} />
          </button>
          <button
            onClick={handleEdit}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="Edit"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Note Content */}
      <div className="text-xs text-gray-600 mb-3 line-clamp-4 leading-relaxed">
        {data.excerpt}
      </div>

      {/* Note Tags */}
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {data.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{data.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Note Metadata */}
      <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
        {new Date(data.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// Custom node types
const nodeTypes = {
  noteCard: NoteNode,
};

export default function NotesCanvas() {
  const { 
    notes, 
    connections, 
    createNote, 
    updateNotePosition, 
    createConnection,
    deleteConnection 
  } = useProtoNotesStore();
  
  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    noteId: string | null;
    isNewNote: boolean;
  }>({
    isOpen: false,
    noteId: null,
    isNewNote: false,
  });

  // Modal handlers
  const openNoteModal = useCallback((noteId: string, isNewNote = false) => {
    setModalState({
      isOpen: true,
      noteId,
      isNewNote,
    });
  }, []);

  const closeNoteModal = useCallback(() => {
    setModalState({
      isOpen: false,
      noteId: null,
      isNewNote: false,
    });
  }, []);
  
  // Auto-position notes that don't have canvas positions
  React.useEffect(() => {
    const notesNeedingPosition = notes.filter(note => !note.position);
    
    notesNeedingPosition.forEach((note, index) => {
      const col = index % 4; // 4 columns
      const row = Math.floor(index / 4);
      const position = {
        x: 100 + (col * 300), // 300px spacing between columns
        y: 100 + (row * 200), // 200px spacing between rows
      };
      updateNotePosition(note.id, position);
    });
  }, [notes, updateNotePosition]);

  // Convert notes to React Flow nodes
  const initialNodes: Node[] = useMemo(() => 
    notes.map(note => ({
      id: note.id,
      type: 'noteCard',
      position: note.position || { x: 0, y: 0 }, // Fallback position
      data: { ...note, onEditNote: openNoteModal },
    }))
  , [notes, openNoteModal]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  
  // Convert connections to React Flow edges
  const initialEdges = useMemo(() => 
    connections.map(conn => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      type: 'smoothstep',
      animated: true,
      label: conn.label,
      style: { 
        stroke: getConnectionColor(conn.type),
        strokeWidth: 2 
      },
      data: { connection: conn },
    }))
  , [connections]);
  
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle node position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    
    // Update positions in store
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        updateNotePosition(change.id, change.position);
      }
    });
  }, [onNodesChange, updateNotePosition]);

  // Handle new connections between notes
  const onConnect = useCallback((params: Connection) => {
    if (params.source && params.target) {
      // Create connection in store
      createConnection(params.source, params.target, 'related');
      
      // The connection will be automatically added to edges via initialEdges effect
    }
  }, [createConnection]);

  // Add new note to canvas
  const handleAddNote = useCallback(() => {
    const id = createNote({
      title: '',
      content: '',
      category: 'session',
      tags: [],
      isPinned: false,
    });

    // Position new note in a good spot (will be auto-positioned by the effect)
    // No need to manually position since the useEffect will handle it
    
    // Open modal for the new note
    openNoteModal(id, true);
  }, [createNote, openNoteModal]);

  // Update nodes when notes change
  React.useEffect(() => {
    const newNodes = notes.map(note => ({
      id: note.id,
      type: 'noteCard',
      position: note.position || { x: 0, y: 0 }, // Fallback position
      data: { ...note, onEditNote: openNoteModal },
    }));
    setNodes(newNodes);
  }, [notes, setNodes, openNoteModal]);

  // Update edges when connections change
  React.useEffect(() => {
    const newEdges = connections.map(conn => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      type: 'smoothstep',
      animated: true,
      label: conn.label,
      style: { 
        stroke: getConnectionColor(conn.type),
        strokeWidth: 2 
      },
      data: { connection: conn },
    }));
    setEdges(newEdges);
  }, [connections, setEdges]);

  return (
    <div className="h-screen w-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={(edgesToDelete) => {
          edgesToDelete.forEach(edge => {
            if (edge.data?.connection?.id) {
              deleteConnection(edge.data.connection.id);
            }
          });
        }}
        nodeTypes={nodeTypes}
        fitView
        className="react-flow-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const note = node.data as ProtoNote;
            switch (note.category) {
              case 'session': return '#3b82f6';
              case 'npc': return '#10b981';
              case 'item': return '#8b5cf6';
              case 'plot': return '#f59e0b';
              default: return '#6b7280';
            }
          }}
          nodeStrokeWidth={3}
          nodeBorderRadius={8}
        />
        
        {/* Floating Add Button */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleAddNote}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Note
          </button>
        </div>
        
        {/* Canvas Info */}
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 text-sm text-gray-600">
          <div className="font-medium mb-1">Canvas Notes: {nodes.length}</div>
          <div className="font-medium mb-1">Connections: {connections.length}</div>
          <div className="text-xs">
            Drag notes • Connect with handles • Select & delete edges
          </div>
        </div>
      </ReactFlow>
      
      {/* Note Modal */}
      <NoteModal
        isOpen={modalState.isOpen}
        noteId={modalState.noteId}
        onClose={closeNoteModal}
        isNewNote={modalState.isNewNote}
      />
    </div>
  );
}
