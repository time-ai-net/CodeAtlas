export * from './types';
export { OllamaClient } from './ollamaClient';
export { GeminiClient } from './geminiClient';
export { DiagramGenerator } from './diagramGenerator';
export { Logger } from './logger';

// Note: scanWorkspace is not exported here because it requires vscode module
// VS Code extension has its own implementation in packages/vscode-extension/src/scanner/fileScanner.ts
