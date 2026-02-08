import { useState, useEffect } from 'react';
import DiagramCanvas from '@/components/DiagramCanvas';
import ThemeToggle from '@/components/ThemeToggle';
import type { DiagramData } from '@/types';

export default function App() {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}diagram-data.json`)
      .then((res) => {
        if (!res.ok) throw new Error('No diagram data found');
        return res.json();
      })
      .then((data: DiagramData) => setDiagramData(data))
      .catch(() => setError('No pre-built diagram data found. Run the build with NOTION_TOKEN and NOTION_PAGE_ID to generate it.'));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm max-w-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!diagramData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notion to Diagram</h1>
        <ThemeToggle />
      </div>
      <div className="flex-1">
        <DiagramCanvas diagramData={diagramData} />
      </div>
    </div>
  );
}
