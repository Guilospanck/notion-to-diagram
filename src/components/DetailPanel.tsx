'use client';

import { useCallback } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DetailPanelProps {
  title: string;
  content: string;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

export default function DetailPanel({ title, content, onClose, onNavigateToNode }: DetailPanelProps) {
  const components: Components = useCallback(() => ({
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => {
      if (href?.startsWith('#node:')) {
        const nodeId = href.slice(6);
        return (
          <a
            {...props}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigateToNode(nodeId);
            }}
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
          >
            {children}
          </a>
        );
      }
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {children}
        </a>
      );
    },
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
      const isBlock = className?.startsWith('language-') || String(children).includes('\n');
      if (isBlock) {
        return (
          <code
            {...props}
            className={`block bg-gray-900 text-gray-100 rounded-md p-3 text-xs overflow-x-auto whitespace-pre ${className || ''}`}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...props}
          className="bg-gray-100 text-pink-600 rounded px-1 py-0.5 text-xs font-mono"
        >
          {children}
        </code>
      );
    },
  }), [onNavigateToNode])();

  return (
    <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
        ) : (
          <p className="text-gray-400 italic">No content for this node.</p>
        )}
      </div>
    </div>
  );
}
