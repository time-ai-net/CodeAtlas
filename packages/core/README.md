# @codeviz/core

Shared core logic for CodeViz - AI-powered code architecture analysis.

## Features

- 🤖 **AI Clients**: Support for Ollama and Gemini AI providers
- 📊 **Analysis Engine**: Code architecture analysis and pattern detection
- 🔍 **File Scanner**: Smart code file detection and scanning
- 📈 **Diagram Generation**: Mermaid diagram generation from analysis

## Installation

```bash
npm install @codeviz/core
```

## Usage

```typescript
import { OllamaClient, GeminiClient, analyzeArchitecture } from '@codeviz/core';

// Using Ollama
const ollama = new OllamaClient('http://localhost:11434', 'qwen2.5-coder:3b');
const result = await ollama.analyze(files);

// Using Gemini
const gemini = new GeminiClient('your-api-key', 'gemini-2.0-flash');
const result = await gemini.analyze(files);
```

## API

### OllamaClient

```typescript
class OllamaClient {
  constructor(url: string, model: string);
  analyze(files: FileInfo[]): Promise<AnalysisResult>;
  checkHealth(): Promise<boolean>;
}
```

### GeminiClient

```typescript
class GeminiClient {
  constructor(apiKey: string, model: string);
  analyze(files: FileInfo[]): Promise<AnalysisResult>;
  checkHealth(): Promise<boolean>;
}
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Test
npm test
```

## License

MIT
