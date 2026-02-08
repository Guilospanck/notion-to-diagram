import { useCallback } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderLinkedText } from '@/lib/renderLinks';

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
            className="font-medium"
          >
            {children}
          </a>
        );
      }
      return (
        <a {...props} href={href} target="_blank" rel="noopener noreferrer">
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
            className={`block bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-md p-3 text-xs overflow-x-auto whitespace-pre ${className || ''}`}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...props}
          className="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 rounded px-1 py-0.5 text-xs font-mono"
        >
          {children}
        </code>
      );
    },
  }), [onNavigateToNode])();

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{renderLinkedText(title)}</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline prose-a:cursor-pointer">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">No content for this node.</p>
        )}
      </div>
    </div>
  );
}
