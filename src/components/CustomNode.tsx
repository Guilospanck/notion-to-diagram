'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { renderLinkedText } from '@/lib/renderLinks';

type CustomNodeData = {
  label: string;
  fullContent: string;
  nodeType: 'topic' | 'subtopic' | 'detail';
  hasChildren: boolean;
  selected: boolean;
  sourcePos?: Position;
  targetPos?: Position;
};

const typeStyles = {
  topic: 'bg-blue-600 text-white border-blue-700 text-sm font-semibold',
  subtopic: 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700 text-xs font-medium',
  detail: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 text-xs',
};

function contentPreview(content: string): string {
  if (!content) return '';
  const plain = content
    .replace(/[*_~`#>\[\]()]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (plain.length <= 60) return plain;
  return plain.slice(0, 60) + '...';
}

function CustomNode({ data }: NodeProps) {
  const { label, fullContent, nodeType, selected, sourcePos, targetPos } = data as unknown as CustomNodeData;
  const style = typeStyles[nodeType] || typeStyles.detail;
  const preview = contentPreview(fullContent);

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 shadow-sm cursor-pointer
        hover:shadow-md transition-all ${style}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-950 shadow-lg scale-105' : ''}`}
      style={{ maxWidth: 260, minWidth: 120 }}
    >
      <Handle type="target" position={targetPos ?? Position.Top} className="!bg-gray-400" />
      <div className="leading-tight">{renderLinkedText(label, { stopPropagation: true, className: 'underline cursor-pointer' })}</div>
      {preview && nodeType !== 'topic' && (
        <div className="mt-1 opacity-60 text-[10px] leading-snug line-clamp-2">
          {preview}
        </div>
      )}
      <Handle type="source" position={sourcePos ?? Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

export default memo(CustomNode);
