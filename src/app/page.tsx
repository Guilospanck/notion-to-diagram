'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import InputForm from '@/components/InputForm';
import type { DiagramData } from '@/types';

const DiagramCanvas = dynamic(() => import('@/components/DiagramCanvas'), {
  ssr: false,
});

export default function Home() {
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');

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
            New Diagram
          </button>
        </div>
        <div className="flex-1">
          <DiagramCanvas diagramData={diagramData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
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
    </div>
  );
}
