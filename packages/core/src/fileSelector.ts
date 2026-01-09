import { FileContext, Module } from './types';

/**
 * Smart file selection for RAG-based analysis
 * Selects the most important files to send to the LLM
 */
export class FileSelector {
    /**
     * Selects the most important files for analysis
     * Uses heuristics to identify entry points, core modules, and high-connectivity files
     */
    static selectImportantFiles(files: FileContext[], maxFiles: number = 15): FileContext[] {
        if (files.length <= maxFiles) {
            return files;
        }

        this.logger?.info(`Selecting ${maxFiles} most important files from ${files.length} total files`);

        // Phase 1: Identify entry points and core files
        const entryPoints = this.findEntryPoints(files);
        const coreFiles = this.findCoreFiles(files);
        
        // Phase 2: Build import/export graph
        const importGraph = this.buildImportGraph(files);
        
        // Phase 3: Score files by importance
        const fileScores = new Map<string, number>();
        
        files.forEach(file => {
            let score = 0;
            
            // Entry points get high score
            if (entryPoints.has(file.path)) {
                score += 100;
            }
            
            // Core files get high score
            if (coreFiles.has(file.path)) {
                score += 80;
            }
            
            // Files with many imports get higher score (high centrality)
            const importCount = importGraph.get(file.path)?.importedBy?.size || 0;
            score += importCount * 5;
            
            // Files that import many others get higher score (high connectivity)
            const exportCount = importGraph.get(file.path)?.imports?.size || 0;
            score += exportCount * 3;
            
            // Config files are important
            if (this.isConfigFile(file.path)) {
                score += 50;
            }
            
            // Service/utility files are important
            if (this.isServiceFile(file.path)) {
                score += 30;
            }
            
            // Avoid test files unless they're the only files
            if (this.isTestFile(file.path)) {
                score -= 20;
            }
            
            // Prefer files from src/ or lib/ directories
            if (file.path.includes('/src/') || file.path.includes('/lib/')) {
                score += 10;
            }
            
            fileScores.set(file.path, score);
        });
        
        // Phase 4: Select top files
        const sortedFiles = Array.from(files).sort((a, b) => {
            const scoreA = fileScores.get(a.path) || 0;
            const scoreB = fileScores.get(b.path) || 0;
            return scoreB - scoreA;
        });
        
        const selected = sortedFiles.slice(0, maxFiles);
        
        // Always ensure entry points are included
        const selectedPaths = new Set(selected.map(f => f.path));
        entryPoints.forEach(path => {
            if (!selectedPaths.has(path)) {
                const file = files.find(f => f.path === path);
                if (file) {
                    selected.push(file);
                    selectedPaths.add(path);
                }
            }
        });
        
        // Limit to maxFiles
        const finalSelection = selected.slice(0, maxFiles);
        
        this.logger?.info(`Selected files: ${finalSelection.map(f => f.path).join(', ')}`);
        
        return finalSelection;
    }
    
    /**
     * Finds entry point files (main, index, app, etc.)
     */
    private static findEntryPoints(files: FileContext[]): Set<string> {
        const entryPointPatterns = [
            /^(src\/)?(index|main|app|server|entry)\.(ts|tsx|js|jsx)$/i,
            /^(src\/)?(index|main|app|server|entry)\.(ts|tsx|js|jsx)$/i,
            /package\.json$/,
            /^(src\/)?app\.(ts|tsx|js|jsx)$/i,
            /^(src\/)?server\.(ts|tsx|js|jsx)$/i,
        ];
        
        const entryPoints = new Set<string>();
        
        files.forEach(file => {
            const fileName = file.path.split('/').pop() || '';
            const path = file.path.toLowerCase();
            
            for (const pattern of entryPointPatterns) {
                if (pattern.test(fileName) || pattern.test(path)) {
                    entryPoints.add(file.path);
                    break;
                }
            }
        });
        
        return entryPoints;
    }
    
    /**
     * Finds core files (services, utilities, models)
     */
    private static findCoreFiles(files: FileContext[]): Set<string> {
        const corePatterns = [
            /\/services?\//i,
            /\/core\//i,
            /\/utils?\//i,
            /\/models?\//i,
            /\/lib\//i,
            /service\.(ts|tsx|js|jsx)$/i,
            /util\.(ts|tsx|js|jsx)$/i,
        ];
        
        const coreFiles = new Set<string>();
        
        files.forEach(file => {
            const path = file.path.toLowerCase();
            for (const pattern of corePatterns) {
                if (pattern.test(path)) {
                    coreFiles.add(file.path);
                    break;
                }
            }
        });
        
        return coreFiles;
    }
    
    /**
     * Builds an import/export graph from file contents
     */
    private static buildImportGraph(files: FileContext[]): Map<string, { imports: Set<string>, importedBy: Set<string> }> {
        const graph = new Map<string, { imports: Set<string>, importedBy: Set<string> }>();
        
        // Initialize graph
        files.forEach(file => {
            graph.set(file.path, { imports: new Set(), importedBy: new Set() });
        });
        
        // Extract imports from each file
        files.forEach(file => {
            const imports = this.extractImports(file.content, file.path);
            const node = graph.get(file.path);
            if (node) {
                imports.forEach(imp => {
                    node.imports.add(imp);
                    
                    // Find which file this import refers to
                    const targetFile = this.resolveImport(imp, file.path, files);
                    if (targetFile && targetFile !== file.path) {
                        const targetNode = graph.get(targetFile);
                        if (targetNode) {
                            targetNode.importedBy.add(file.path);
                        }
                    }
                });
            }
        });
        
        return graph;
    }
    
    /**
     * Extracts import statements from file content
     */
    private static extractImports(content: string, filePath: string): string[] {
        const imports: string[] = [];
        
        // Match ES6 imports: import ... from '...'
        const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        // Match CommonJS requires: require('...')
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        return imports;
    }
    
    /**
     * Resolves an import path to an actual file path
     */
    private static resolveImport(importPath: string, fromFile: string, files: FileContext[]): string | null {
        // Remove file extensions
        const cleanImport = importPath.replace(/\.(ts|tsx|js|jsx)$/, '');
        
        // Handle relative imports
        if (cleanImport.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const resolved = this.resolveRelativePath(cleanImport, fromDir);
            
            // Try to find matching file
            for (const file of files) {
                const filePathNoExt = file.path.replace(/\.(ts|tsx|js|jsx)$/, '');
                if (filePathNoExt === resolved || filePathNoExt.endsWith('/' + resolved)) {
                    return file.path;
                }
            }
        } else {
            // Handle absolute imports (node_modules, etc.)
            // For now, just try to match by name
            const importName = cleanImport.split('/').pop() || '';
            for (const file of files) {
                const fileName = file.path.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || '';
                if (fileName === importName) {
                    return file.path;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Resolves a relative path
     */
    private static resolveRelativePath(importPath: string, fromDir: string): string {
        const parts = importPath.split('/');
        let currentDir = fromDir;
        
        for (const part of parts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                currentDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
            } else {
                currentDir = currentDir ? `${currentDir}/${part}` : part;
            }
        }
        
        return currentDir;
    }
    
    /**
     * Checks if a file is a config file
     */
    private static isConfigFile(path: string): boolean {
        const configPatterns = [
            /config\.(ts|tsx|js|jsx)$/i,
            /\.config\.(ts|tsx|js|jsx)$/i,
            /package\.json$/i,
            /tsconfig\.json$/i,
            /webpack\.config\.(ts|tsx|js|jsx)$/i,
        ];
        
        return configPatterns.some(pattern => pattern.test(path));
    }
    
    /**
     * Checks if a file is a service file
     */
    private static isServiceFile(path: string): boolean {
        return /service\.(ts|tsx|js|jsx)$/i.test(path) || 
               /\/services?\//i.test(path.toLowerCase());
    }
    
    /**
     * Checks if a file is a test file
     */
    private static isTestFile(path: string): boolean {
        return /test\.(ts|tsx|js|jsx)$/i.test(path) ||
               /spec\.(ts|tsx|js|jsx)$/i.test(path) ||
               /\.test\.(ts|tsx|js|jsx)$/i.test(path) ||
               /\.spec\.(ts|tsx|js|jsx)$/i.test(path) ||
               /\/test/i.test(path.toLowerCase()) ||
               /\/spec/i.test(path.toLowerCase());
    }
    
    private static logger: { info: (msg: string) => void } | null = null;
    
    static setLogger(logger: { info: (msg: string) => void }) {
        this.logger = logger;
    }
}

