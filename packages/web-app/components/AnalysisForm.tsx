'use client';

import { useState } from 'react';

interface AnalysisFormProps {
  onAnalyze: (repoUrl: string, provider: string) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onAnalyze, isLoading }: AnalysisFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [provider, setProvider] = useState('ollama');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (repoUrl.trim() && !isLoading) {
      onAnalyze(repoUrl.trim(), provider);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (repoUrl.trim() && !isLoading) {
      onAnalyze(repoUrl.trim(), provider);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
          Repository URL
        </label>
        <input
          id="repoUrl"
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/username/repo"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-2">
          AI Provider
        </label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
          disabled={isLoading}
        >
          <option value="ollama">Ollama</option>
          <option value="gemini">Gemini</option>
        </select>
      </div>

      <button
        type="submit"
        onClick={handleButtonClick}
        disabled={isLoading || !repoUrl.trim()}
        className={`w-full px-4 py-2 rounded transition-colors ${
          isLoading || !repoUrl.trim()
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
            : 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer'
        }`}
      >
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </button>
    </form>
  );
}
