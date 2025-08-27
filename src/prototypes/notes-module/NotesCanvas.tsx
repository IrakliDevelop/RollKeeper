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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  useProtoNotesStore,
  type ProtoNote,
  type NoteConnection,
} from './notesStore';
import NoteModal from './NoteModal';
import {
  Pin,
  Edit3,
  Trash2,
  FileText,
  Users,
  Package,
  Map,
  Plus,
  X,
} from 'lucide-react';

// Helper function for connection colors
const getConnectionColor = (type: string) => {
  switch (type) {
    case 'reference':
      return '#3b82f6'; // blue
    case 'related':
      return '#10b981'; // green
    case 'conflict':
      return '#ef4444'; // red
    case 'child':
      return '#8b5cf6'; // purple
    case 'parent':
      return '#f59e0b'; // amber
    default:
      return '#6b7280'; // gray
  }
};

// Custom Edge Component with Delete Button
interface CustomEdgeData {
  connection: NoteConnection;
  onDelete: (id: string) => void;
}

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}: EdgeProps<CustomEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const [longPressTimer, setLongPressTimer] =
    React.useState<NodeJS.Timeout | null>(null);
  const [showDeleteButton, setShowDeleteButton] = React.useState(false);

  const handleDelete = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  const handleLongPressStart = (event: React.TouchEvent | React.MouseEvent) => {
    event.preventDefault();
    const timer = setTimeout(() => {
      // Show confirmation for long press
      if (window.confirm('Delete this connection?')) {
        handleDelete(event);
      }
    }, 800); // 800ms long press
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleEdgeClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDeleteButton(!showDeleteButton);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          cursor: 'pointer',
        }}
      />

      {/* Invisible click area over the edge for long press */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {/* Invisible large click area for edge interaction */}
          <div
            style={{
              position: 'absolute',
              top: '-20px',
              left: '-40px',
              width: '80px',
              height: '40px',
              cursor: 'pointer',
              zIndex: 999,
            }}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onTouchCancel={handleLongPressEnd}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onClick={handleEdgeClick}
          />

          {/* Always visible delete button for touch devices */}
          <button
            onClick={handleDelete}
            className="relative flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-red-600"
            title="Delete connection"
            style={{
              opacity: 1, // Always visible
              zIndex: 1000,
            }}
          >
            <X size={14} />
          </button>

          {/* Long press instruction tooltip */}
          <div
            className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 transform rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white transition-opacity duration-200"
            style={{
              opacity: showDeleteButton ? 1 : 0,
            }}
          >
            Long press edge to delete
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// Custom Note Node Component
function NoteNode({
  data,
  selected,
}: NodeProps<ProtoNote & { onEditNote?: (id: string) => void }>) {
  const { updateNote, deleteNote } = useProtoNotesStore();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'session':
        return <FileText size={14} className="text-blue-600" />;
      case 'npc':
        return <Users size={14} className="text-green-600" />;
      case 'item':
        return <Package size={14} className="text-purple-600" />;
      case 'plot':
        return <Map size={14} className="text-orange-600" />;
      default:
        return <FileText size={14} className="text-gray-600" />;
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
    <div
      className={`group max-w-80 min-w-64 rounded-lg border-2 bg-white p-4 shadow-lg ${selected ? 'border-blue-500' : data.isPinned ? 'border-yellow-400' : 'border-gray-200'} transition-shadow hover:shadow-xl`}
    >
      {/* Connection Handles - Larger for touch devices */}
      <Handle
        type="target"
        position={Position.Left}
        className="h-6 w-6 !border-2 !border-white !bg-blue-500 transition-all duration-200 hover:scale-110 hover:!bg-blue-600 sm:h-5 sm:w-5 md:h-4 md:w-4 lg:h-3 lg:w-3"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="h-6 w-6 !border-2 !border-white !bg-blue-500 transition-all duration-200 hover:scale-110 hover:!bg-blue-600 sm:h-5 sm:w-5 md:h-4 md:w-4 lg:h-3 lg:w-3"
      />

      {/* Note Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {getCategoryIcon(data.category)}
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {data.title}
          </h3>
          {data.isPinned && (
            <Pin size={12} className="flex-shrink-0 text-yellow-600" />
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            onClick={handleTogglePin}
            className="rounded p-1 text-gray-400 hover:text-yellow-600"
            title={data.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={12} />
          </button>
          <button
            onClick={handleEdit}
            className="rounded p-1 text-gray-400 hover:text-blue-600"
            title="Edit"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="rounded p-1 text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Note Content */}
      <div className="mb-3 line-clamp-4 text-xs leading-relaxed text-gray-600">
        {data.excerpt}
      </div>

      {/* Note Tags */}
      {data.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {data.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
            >
              {tag}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              +{data.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Note Metadata */}
      <div className="border-t border-gray-100 pt-2 text-xs text-gray-500">
        {new Date(data.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

const nodeTypes = {
  noteCard: NoteNode,
};

const edgeTypes = {
  deletableEdge: CustomEdge,
};

export default function NotesCanvas() {
  const {
    notes,
    connections,
    createNote,
    updateNotePosition,
    createConnection,
    deleteConnection,
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
        x: 100 + col * 300, // 300px spacing between columns
        y: 100 + row * 200, // 200px spacing between rows
      };
      updateNotePosition(note.id, position);
    });
  }, [notes, updateNotePosition]);

  // Convert notes to React Flow nodes
  const initialNodes: Node[] = useMemo(
    () =>
      notes.map(note => ({
        id: note.id,
        type: 'noteCard',
        position: note.position || { x: 0, y: 0 }, // Fallback position
        data: { ...note, onEditNote: openNoteModal },
      })),
    [notes, openNoteModal]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // Convert connections to React Flow edges
  const initialEdges = useMemo(
    () =>
      connections.map(conn => ({
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        type: 'deletableEdge',
        animated: true,
        label: conn.label,
        style: {
          stroke: getConnectionColor(conn.type),
          strokeWidth: 3,
        },
        labelStyle: {
          fill: getConnectionColor(conn.type),
          fontWeight: 600,
          fontSize: 12,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.9,
        },
        markerEnd: 'arrowclosed',
        data: {
          connection: conn,
          onDelete: deleteConnection,
        },
      })),
    [connections, deleteConnection]
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle node position changes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Update positions in store
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          updateNotePosition(change.id, change.position);
        }
      });
    },
    [onNodesChange, updateNotePosition]
  );

  // Handle new connections between notes
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        // Create connection in store
        createConnection(params.source, params.target, 'related');

        // The connection will be automatically added to edges via initialEdges effect
      }
    },
    [createConnection]
  );

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
      type: 'deletableEdge',
      animated: true,
      label: conn.label,
      style: {
        stroke: getConnectionColor(conn.type),
        strokeWidth: 3,
      },
      labelStyle: {
        fill: getConnectionColor(conn.type),
        fontWeight: 600,
        fontSize: 12,
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.9,
      },
      markerEnd: 'arrowclosed',
      data: {
        connection: conn,
        onDelete: deleteConnection,
      },
    }));
    setEdges(newEdges);
  }, [connections, setEdges, deleteConnection]);

  return (
    <div className="h-screen w-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={edgesToDelete => {
          edgesToDelete.forEach(edge => {
            if (edge.data?.connection?.id) {
              deleteConnection(edge.data.connection.id);
            }
          });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="react-flow-canvas touch-flow"
        deleteKeyCode={['Backspace', 'Delete', 'del']}
        multiSelectionKeyCode={['Meta', 'Ctrl']}
        selectNodesOnDrag={false}
        connectOnClick={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={node => {
            const note = node.data as ProtoNote;
            switch (note.category) {
              case 'session':
                return '#3b82f6';
              case 'npc':
                return '#10b981';
              case 'item':
                return '#8b5cf6';
              case 'plot':
                return '#f59e0b';
              default:
                return '#6b7280';
            }
          }}
          nodeStrokeWidth={3}
          nodeBorderRadius={8}
        />

        {/* Floating Add Button */}
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleAddNote}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Note
          </button>
        </div>

        {/* Canvas Info */}
        <div className="absolute bottom-4 left-4 z-10 max-w-64 rounded-lg bg-white p-3 text-sm text-gray-600 shadow-lg">
          <div className="mb-1 font-medium">Canvas Notes: {nodes.length}</div>
          <div className="mb-1 font-medium">
            Connections: {connections.length}
          </div>
          <div className="space-y-1 text-xs">
            <div>• Drag notes to reposition</div>
            <div>• Drag between large blue handles to connect</div>
            <div>• Or tap two handles in sequence</div>
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
