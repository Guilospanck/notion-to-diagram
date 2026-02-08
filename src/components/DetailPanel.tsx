'use client';

import ReactMarkdown from 'react-markdown';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
}

export default function DetailPanel({ title, content, onClose }: DetailPanelProps) {
  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none">
        <ReactMarkdown>{content || '*No content available*'}</ReactMarkdown>
      </div>
    </div>
  );
}
