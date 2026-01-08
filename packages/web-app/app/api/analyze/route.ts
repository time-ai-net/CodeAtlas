import { NextRequest, NextResponse } from 'next/server';
import { OllamaClient, GeminiClient, DiagramGenerator, FileContext, ArchitectureAnalysis } from '@codeatlas/core';
import { parseGitHubUrl, fetchRepoTree, getDefaultBranch } from '@/lib/github';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, provider = 'ollama' } = body;

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL' },
        { status: 400 }
      );
    }

    // Get default branch
    const branch = await getDefaultBranch(repoInfo.owner, repoInfo.repo);
    
    // Fetch repository files
    logger.info(`Fetching files from ${repoInfo.owner}/${repoInfo.repo} (${branch})`);
    const files = await fetchRepoTree(repoInfo.owner, repoInfo.repo, branch);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No code files found in repository' },
        { status: 404 }
      );
    }

    logger.info(`Analyzing ${files.length} files with ${provider}`);

    // Initialize AI client
    let analysis: ArchitectureAnalysis;
    
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY not configured' },
          { status: 500 }
        );
      }
      
      const gemini = new GeminiClient(
        logger,
        apiKey,
        process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      );
      
      analysis = await gemini.analyze(files);
    } else {
      const ollama = new OllamaClient(
        logger,
        process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
        process.env.OLLAMA_URL || 'http://localhost:11434'
      );
      
      // Check health first
      const isHealthy = await ollama.checkHealth();
      if (!isHealthy) {
        return NextResponse.json(
          { error: 'Ollama server is not accessible. Make sure Ollama is running.' },
          { status: 503 }
        );
      }
      
      analysis = await ollama.analyze(files);
      
      // Check if analysis failed and provide better error message
      if (analysis.summary?.includes('Failed to parse') || analysis.pattern?.name === 'Unknown' && analysis.pattern?.confidence === 0) {
        logger.error('Ollama returned fallback analysis - JSON parsing likely failed');
        // Still continue but log the issue
      }
    }

    // Generate diagram
    const diagram = DiagramGenerator.generateComponentDiagram(analysis);

    // Ensure all required fields are present
    const response: any = {
      modules: analysis.modules || [],
      relationships: analysis.relationships || [],
      summary: analysis.summary || 'Analysis completed',
      pattern: analysis.pattern || {
        name: 'Unknown' as const,
        confidence: 0,
        description: 'Could not determine architectural pattern'
      },
      layers: analysis.layers || [],
      entryPoints: analysis.entryPoints || [],
      coreComponents: analysis.coreComponents || [],
      diagram,
      repoInfo: {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch,
        fileCount: files.length,
      },
    };
    
    // Include raw response and debug info in development
    if (process.env.NODE_ENV === 'development') {
      if (analysis.raw) {
        response.rawResponse = analysis.raw.substring(0, 2000); // First 2000 chars
      }
      response.parsingWarnings = analysis.summary?.includes('Failed to parse') 
        ? ['JSON parsing had issues. Showing partial results.'] 
        : [];
    }
    
    return NextResponse.json(response);
  } catch (error: any) {
    logger.error(error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to analyze repository',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

