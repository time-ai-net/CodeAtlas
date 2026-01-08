'use client';

import { ArchitectureAnalysis } from '@codeatlas/core';

interface ResultsPanelProps {
  analysis: ArchitectureAnalysis & { 
    diagram?: string; 
    repoInfo?: any; 
    rawResponse?: string;
    parsingWarnings?: string[];
  };
}

export default function ResultsPanel({ analysis }: ResultsPanelProps) {
  const { modules = [], relationships = [], summary = '', pattern, layers = [], repoInfo } = analysis;

  return (
    <div className="space-y-6">
      {/* Repository Info */}
      {repoInfo && (
        <div className="border border-gray-200 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {repoInfo.owner}/{repoInfo.repo}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {repoInfo.branch} • {repoInfo.fileCount} files
              </p>
            </div>
            <a
              href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              View →
            </a>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {analysis.parsingWarnings && analysis.parsingWarnings.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded p-4">
          <h3 className="text-sm font-medium text-yellow-900 mb-2">⚠️ Parsing Warning</h3>
          <p className="text-xs text-yellow-800 mb-2">
            {analysis.parsingWarnings[0]}
          </p>
          {analysis.rawResponse && (
            <details className="mt-2">
              <summary className="text-xs text-yellow-700 cursor-pointer">View Raw Response</summary>
              <pre className="mt-2 text-xs bg-white p-2 rounded border border-yellow-200 overflow-auto max-h-40">
                {analysis.rawResponse}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="border border-gray-200 rounded p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Summary</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Pattern */}
      {pattern && (
        <div className="border border-gray-200 rounded p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Pattern</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">{pattern.name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-xs">
              <div
                className="bg-gray-900 h-2 rounded-full"
                style={{ width: `${Math.min(100, pattern.confidence * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round(pattern.confidence * 100)}%</span>
          </div>
          {pattern.description && (
            <p className="text-xs text-gray-600 mt-2">{pattern.description}</p>
          )}
        </div>
      )}

      {/* Layers */}
      {layers && layers.length > 0 && (
        <div className="border border-gray-200 rounded p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Layers</h3>
          <div className="space-y-3">
            {layers.map((layer, idx) => (
              <div key={idx}>
                <h4 className="text-xs font-medium text-gray-700 mb-2">{layer.name}</h4>
                <div className="flex flex-wrap gap-2">
                  {layer.modules && layer.modules.map((modulePath: string, mIdx: number) => {
                    const module = modules.find(m => m.path === modulePath);
                    return (
                      <span
                        key={mIdx}
                        className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700"
                      >
                        {module?.name || modulePath.split('/').pop()}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      {modules && modules.length > 0 && (
        <div className="border border-gray-200 rounded p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Modules ({modules.length})
          </h3>
          <div className="space-y-2">
            {modules.map((module, idx) => (
              <div
                key={idx}
                className="p-3 border border-gray-100 rounded"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{module.name || 'Unknown'}</span>
                  <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-50 rounded">
                    {module.type || 'other'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono mb-1">{module.path}</p>
                {module.description && (
                  <p className="text-xs text-gray-600">{module.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {relationships && relationships.length > 0 && (
        <div className="border border-gray-200 rounded p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Relationships ({relationships.length})
          </h3>
          <div className="space-y-2">
            {relationships.map((rel, idx) => (
              <div
                key={idx}
                className="p-3 border border-gray-100 rounded"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-900">{rel.from?.split('/').pop() || rel.from}</span>
                  <span className="text-xs text-gray-400">→</span>
                  <span className="text-xs text-gray-900">{rel.to?.split('/').pop() || rel.to}</span>
                  <span className="ml-auto text-xs text-gray-500 px-2 py-0.5 bg-gray-50 rounded">
                    {rel.type || 'depends'}
                  </span>
                </div>
                {rel.description && (
                  <p className="text-xs text-gray-600">{rel.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!modules || modules.length === 0) && (!relationships || relationships.length === 0) && (
        <div className="border border-gray-200 rounded p-8 text-center">
          <p className="text-sm text-gray-500">No analysis data available</p>
        </div>
      )}
    </div>
  );
}
