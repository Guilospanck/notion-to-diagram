import { useState, useEffect, useCallback } from 'react';
import DiagramCanvas from '@/components/DiagramCanvas';
import ThemeToggle from '@/components/ThemeToggle';
import type { DiagramData } from '@/types';

const STORAGE_KEY = 'notion-to-diagram:saved';

interface SavedDiagram {
  id: string;
  title: string;
  createdAt: string;
  data: DiagramData;
}

function loadSavedDiagrams(): SavedDiagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedDiagram[];
  } catch {
    return [];
  }
}

function persistDiagrams(diagrams: SavedDiagram[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams));
}

export default function App() {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSavedDiagrams(loadSavedDiagrams());
  }, []);

  // Fetch pre-baked diagram data on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}diagram-data.json`)
      .then((res) => {
        if (!res.ok) throw new Error('No diagram data found');
        return res.json();
      })
      .then((data: DiagramData) => {
        setDiagramData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError('No pre-built diagram data found. Run the build with NOTION_TOKEN and NOTION_PAGE_ID to generate it.');
      });
  }, []);

  const deleteDiagram = useCallback((id: string) => {
    const updated = loadSavedDiagrams().filter((d) => d.id !== id);
    persistDiagrams(updated);
    setSavedDiagrams(updated);
  }, []);

  if (diagramData) {
    return (
      <div className="w-screen h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notion to Diagram</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setDiagramData(null)}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Back
            </button>
          </div>
        </div>
        <div className="flex-1">
          <DiagramCanvas diagramData={diagramData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Notion to Diagram</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
          Transform your Notion pages into interactive diagrams.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading diagram...</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm max-w-lg">
          {error}
        </div>
      )}

      {savedDiagrams.length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Saved Diagrams</h2>
          <ul className="space-y-2">
            {savedDiagrams.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <button
                  onClick={() => setDiagramData(d.data)}
                  className="flex-1 text-left min-w-0"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
                    {d.title}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
                <button
                  onClick={() => deleteDiagram(d.id)}
                  className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
