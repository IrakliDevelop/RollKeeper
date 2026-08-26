'use client';

import {
  Geometry2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLResizeInfo,
  TLShape,
  resizeBox,
} from 'tldraw';
import { useProtoNotesStore, type ProtoNote } from './notesStore';
import { FileText, Users, Package, Map, Pin } from 'lucide-react';

export const NOTE_CARD_SHAPE_TYPE = 'note-card';

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [NOTE_CARD_SHAPE_TYPE]: {
      w: number;
      h: number;
      noteId: string;
      title: string;
      excerpt: string;
      category: string;
      tags: string[];
      isPinned: boolean;
    };
  }
}

type INoteCardShape = TLShape<typeof NOTE_CARD_SHAPE_TYPE>;

const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  session: { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb' },
  npc: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a' },
  item: { bg: '#faf5ff', border: '#c4b5fd', icon: '#7c3aed' },
  plot: { bg: '#fff7ed', border: '#fdba74', icon: '#ea580c' },
};

function CategoryIcon({
  category,
  size = 14,
}: {
  category: string;
  size?: number;
}) {
  const color = CATEGORY_COLORS[category]?.icon ?? '#6b7280';
  switch (category) {
    case 'session':
      return <FileText size={size} style={{ color }} />;
    case 'npc':
      return <Users size={size} style={{ color }} />;
    case 'item':
      return <Package size={size} style={{ color }} />;
    case 'plot':
      return <Map size={size} style={{ color }} />;
    default:
      return <FileText size={size} style={{ color }} />;
  }
}

function NoteCardComponent({ shape }: { shape: INoteCardShape }) {
  const { title, excerpt, category, tags, isPinned } = shape.props;
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.session;

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          border: `2px solid ${colors.border}`,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CategoryIcon category={category} />
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: '#111827',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || 'Untitled Note'}
          </span>
          {isPinned && (
            <Pin size={12} style={{ color: '#ca8a04', flexShrink: 0 }} />
          )}
        </div>

        {/* Category badge */}
        <div>
          <span
            style={{
              display: 'inline-block',
              backgroundColor: colors.bg,
              color: colors.icon,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {category}
          </span>
        </div>

        {/* Excerpt */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: '#4b5563',
            flex: 1,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {excerpt || 'Empty note...'}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            {tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  padding: '2px 6px',
                  borderRadius: 8,
                }}
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span
                style={{
                  fontSize: 10,
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  padding: '2px 6px',
                  borderRadius: 8,
                }}
              >
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </HTMLContainer>
  );
}

export class NoteCardShapeUtil extends ShapeUtil<INoteCardShape> {
  static override type = NOTE_CARD_SHAPE_TYPE;
  static override props: RecordProps<INoteCardShape> = {
    w: T.number,
    h: T.number,
    noteId: T.string,
    title: T.string,
    excerpt: T.string,
    category: T.string,
    tags: T.arrayOf(T.string),
    isPinned: T.boolean,
  };

  getDefaultProps(): INoteCardShape['props'] {
    return {
      w: 280,
      h: 200,
      noteId: '',
      title: 'New Note',
      excerpt: '',
      category: 'session',
      tags: [],
      isPinned: false,
    };
  }

  override canEdit() {
    return false;
  }

  override canResize() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  getGeometry(shape: INoteCardShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: INoteCardShape, info: TLResizeInfo<INoteCardShape>) {
    return resizeBox(shape, info);
  }

  component(shape: INoteCardShape) {
    return <NoteCardComponent shape={shape} />;
  }

  indicator(shape: INoteCardShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
    );
  }
}
