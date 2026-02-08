'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import InputForm from '@/components/InputForm';
import type { DiagramData } from '@/types';

const DiagramCanvas = dynamic(() => import('@/components/DiagramCanvas'), {
  ssr: false,
});

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

export default function Home() {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);

  useEffect(() => {
    setSavedDiagrams(loadSavedDiagrams());
  }, []);

  const saveDiagram = useCallback((data: DiagramData) => {
    const title = data.nodes[0]?.label || 'Untitled';
    const entry: SavedDiagram = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      data,
    };
    const updated = [entry, ...loadSavedDiagrams()];
    persistDiagrams(updated);
    setSavedDiagrams(updated);
  }, []);

  const deleteDiagram = useCallback((id: string) => {
    const updated = loadSavedDiagrams().filter((d) => d.id !== id);
    persistDiagrams(updated);
    setSavedDiagrams(updated);
  }, []);

  const handleSubmit = async (pageUrl: string, token: string) => {
    setIsLoading(true);
    setError('');
    setDiagramData(null);

    try {
      setLoadingStep('Fetching Notion pages...');
      const notionRes = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, token }),
      });

      if (!notionRes.ok) {
        const err = await notionRes.json();
        throw new Error(err.error || 'Failed to fetch Notion pages');
      }

      const tree = await notionRes.json();

      setLoadingStep('Generating diagram...');
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree }),
      });

      if (!generateRes.ok) {
        const err = await generateRes.json();
        throw new Error(err.error || 'Failed to generate diagram');
      }

      const data: DiagramData = await generateRes.json();
      saveDiagram(data);
      setDiagramData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  if (diagramData) {
    return (
      <div className="w-screen h-screen flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <h1 className="text-sm font-semibold text-gray-700">Notion to Diagram</h1>
          <button
            onClick={() => setDiagramData(null)}
            className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            Back
          </button>
        </div>
        <div className="flex-1">
          <DiagramCanvas diagramData={diagramData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notion to Diagram</h1>
        <p className="text-gray-500 text-sm max-w-md">
          Transform your Notion pages into interactive diagrams. Paste a page URL and your integration token to get started.
        </p>
      </div>
      <InputForm onSubmit={handleSubmit} isLoading={isLoading} loadingStep={loadingStep} />
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-lg">
          {error}
        </div>
      )}

      {savedDiagrams.length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Saved Diagrams</h2>
          <ul className="space-y-2">
            {savedDiagrams.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <button
                  onClick={() => setDiagramData(d.data)}
                  className="flex-1 text-left min-w-0"
                >
                  <span className="text-sm font-medium text-gray-900 truncate block">
                    {d.title}
                  </span>
                  <span className="text-xs text-gray-400">
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
                  className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
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
