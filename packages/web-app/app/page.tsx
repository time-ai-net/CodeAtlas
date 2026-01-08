'use client';

import { useState } from 'react';
import AnalysisForm from '@/components/AnalysisForm';
import DiagramView from '@/components/DiagramView';
import ResultsPanel from '@/components/ResultsPanel';
import { ArchitectureAnalysis } from '@codeatlas/core';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<(ArchitectureAnalysis & { diagram?: string; repoInfo?: any }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (repoUrl: string, provider: string) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl, provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze repository');
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-medium text-gray-900 mb-2">CodeAtlas</h1>
          <p className="text-gray-600">Analyze GitHub repository architecture</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-1">
            <AnalysisForm onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="mb-6 p-12 text-center border border-gray-200 rounded">
                <div className="inline-block w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-gray-600">Analyzing repository...</p>
              </div>
            )}

            {results && !isLoading && (
              <>
                <DiagramView diagram={results.diagram || ''} className="mb-6" />
                <ResultsPanel analysis={results} />
              </>
            )}

            {!results && !error && !isLoading && (
              <div className="p-12 text-center border border-gray-200 rounded">
                <p className="text-gray-500">Enter a repository URL to begin analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
