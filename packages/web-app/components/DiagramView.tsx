'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface DiagramViewProps {
  diagram: string;
  className?: string;
}

export default function DiagramView({ diagram, className = '' }: DiagramViewProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagramKey, setDiagramKey] = useState(0);

  useEffect(() => {
    if (!diagram || !diagramRef.current) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 25,
        nodeSpacing: 60,
        rankSpacing: 100,
        diagramPadding: 20,
      },
      themeVariables: {
        primaryColor: '#3B82F6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#1E40AF',
        lineColor: '#6B7280',
        secondaryColor: '#F3F4F6',
        tertiaryColor: '#E5E7EB',
        background: '#FFFFFF',
        mainBkg: '#FFFFFF',
        textColor: '#111827',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        edgeLabelBackground: '#F9FAFB',
        clusterBkg: '#F3F4F6',
        clusterBorder: '#D1D5DB',
        defaultLinkColor: '#6B7280',
        titleColor: '#111827',
      },
    });

    const renderDiagram = async () => {
      try {
        if (!diagramRef.current) return;
        
        diagramRef.current.innerHTML = '';
        
        const trimmedDiagram = diagram.trim();
        if (!trimmedDiagram || trimmedDiagram.length < 10) {
          throw new Error('Invalid diagram');
        }

        const validStarts = ['graph', 'flowchart', 'classDiagram', 'sequenceDiagram', 'stateDiagram', 'erDiagram'];
        const isValidStart = validStarts.some(start => trimmedDiagram.toLowerCase().startsWith(start.toLowerCase()));
        
        if (!isValidStart) {
          throw new Error('Invalid diagram format');
        }

        const id = `mermaid-${Date.now()}-${diagramKey}`;
        await mermaid.parse(trimmedDiagram);
        const { svg } = await mermaid.render(id, trimmedDiagram);
        
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg;
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to render diagram');
        setIsLoading(false);
        
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `
            <div class="p-4 text-sm text-gray-600 border border-gray-200 rounded">
              <p class="mb-2">Diagram error: ${err.message || 'Unknown error'}</p>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [diagram, diagramKey]);

  if (!diagram) {
    return (
      <div className={`border border-gray-200 rounded p-8 ${className}`}>
        <p className="text-sm text-gray-500 text-center">No diagram available</p>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded ${className}`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Architecture Diagram</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setDiagramKey(prev => prev + 1)}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              const blob = new Blob([diagram], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'diagram.mmd';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1"
          >
            Download
          </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="p-12 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-gray-500">Rendering...</p>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="p-4 text-sm text-gray-600">
          {error}
        </div>
      )}
      
      <div 
        ref={diagramRef} 
        className={`p-8 overflow-auto bg-white ${isLoading ? 'hidden' : ''} ${error ? 'hidden' : ''}`}
        style={{ 
          maxHeight: '700px', 
          minHeight: '500px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      />
    </div>
  );
}
