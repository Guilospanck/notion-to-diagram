'use client';

import { useState } from 'react';

interface InputFormProps {
  onSubmit: (pageUrl: string, token: string) => void;
  isLoading: boolean;
  loadingStep: string;
}

export default function InputForm({ onSubmit, isLoading, loadingStep }: InputFormProps) {
  const [pageUrl, setPageUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pageUrl.trim() && token.trim()) {
      onSubmit(pageUrl.trim(), token.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4">
      <div>
        <label htmlFor="pageUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Notion Page URL
        </label>
        <input
          id="pageUrl"
          type="text"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="https://www.notion.so/Your-Page-abc123..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={isLoading}
        />
      </div>
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
          Integration Token
        </label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ntn_..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !pageUrl.trim() || !token.trim()}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? loadingStep : 'Generate Diagram'}
      </button>
    </form>
  );
}
