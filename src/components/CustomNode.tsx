'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type CustomNodeData = {
  label: string;
  fullContent: string;
  nodeType: 'topic' | 'subtopic' | 'detail';
  hasChildren: boolean;
};

const typeStyles = {
  topic: 'bg-blue-600 text-white border-blue-700 text-base font-semibold min-w-[200px]',
  subtopic: 'bg-blue-100 text-blue-900 border-blue-300 text-sm font-medium min-w-[160px]',
  detail: 'bg-gray-50 text-gray-700 border-gray-300 text-xs min-w-[130px]',
};

function CustomNode({ data }: NodeProps) {
  const { label, nodeType } = data as unknown as CustomNodeData;
  const style = typeStyles[nodeType] || typeStyles.detail;

  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-sm cursor-pointer
        hover:shadow-md transition-shadow text-center ${style}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="truncate max-w-[200px]">{label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

export default memo(CustomNode);
