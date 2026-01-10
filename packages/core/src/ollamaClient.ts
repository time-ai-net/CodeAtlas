import { ArchitectureAnalysis, FileContext, ILogger, Module, Relationship } from './types';
import { FileSelector } from './fileSelector';
import * as https from 'https';
import * as http from 'http';

// Helper function to make HTTP requests with timeout
async function fetchJson(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        // Set timeout (default 5 minutes for analysis, 10 seconds for health checks)
        const timeout = options.timeout || 300000; // 5 minutes default
        
        const requestOptions = {
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: timeout,
        };
        
        const req = client.request(url, requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ ok: res.statusCode! >= 200 && res.statusCode! < 300, status: res.statusCode, json: async () => parsed });
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e}`));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
        
        req.setTimeout(timeout);
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

export class OllamaClient {
    private baseUrl: string;
    private model: string;

    constructor(
        private logger: ILogger,
        model: string = 'qwen2.5-coder:3b',
        baseUrl: string = 'http://localhost:11434'
    ) {
        this.model = model;
        this.baseUrl = baseUrl;
    }

    async analyze(files: FileContext[]): Promise<ArchitectureAnalysis> {
        this.logger.info(`Sending request to Ollama (${this.model})...`);

        // Use RAG-based file selection to reduce processing time
        // Select only the most important files for analysis
        FileSelector.setLogger(this.logger);
        const maxFiles = Math.min(10, Math.max(5, Math.floor(files.length * 0.10))); // Limit to 10% of files, min 5, max 10 (optimized for speed)
        const selectedFiles = files.length > maxFiles 
            ? FileSelector.selectImportantFiles(files, maxFiles)
            : files;
        
        this.logger.info(`Selected ${selectedFiles.length} files from ${files.length} total files for analysis`);
        this.logger.info(`Selected files: ${selectedFiles.map(f => f.path).join(', ')}`);

        // Detect if this is primarily a test suite
        const testFileCount = selectedFiles.filter(f => 
            f.path.includes('test') || f.path.includes('spec') || 
            f.path.includes('.cy.') || f.path.includes('cypress')
        ).length;
        const isTestSuite = testFileCount > selectedFiles.length / 2;

        // Split files into chunks for parallel processing
        const chunkSize = 5; // Process 5 files per chunk (increased for faster processing, fewer chunks = less overhead)
        const chunks: FileContext[][] = [];
        for (let i = 0; i < selectedFiles.length; i += chunkSize) {
            chunks.push(selectedFiles.slice(i, i + chunkSize));
        }
        
        this.logger.info(`Processing ${selectedFiles.length} files in ${chunks.length} parallel chunks (${chunkSize} files per chunk)`);
        
        // Process chunks in parallel
        const chunkPromises = chunks.map((chunk, idx) => 
            this.analyzeChunk(chunk, files, isTestSuite, idx + 1, chunks.length)
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        
        // Merge results from all chunks
        return this.mergeChunkResults(chunkResults, files, selectedFiles);
    }
    
    /**
     * Analyzes a chunk of files in parallel
     */
    private async analyzeChunk(
        chunkFiles: FileContext[], 
        allFiles: FileContext[], 
        isTestSuite: boolean,
        chunkIndex: number,
        totalChunks: number
    ): Promise<ArchitectureAnalysis> {
        this.logger.info(`[Chunk ${chunkIndex}/${totalChunks}] Analyzing ${chunkFiles.length} files: ${chunkFiles.map(f => f.path).join(', ')}`);
        
        const prompt = this.buildPrompt(chunkFiles, allFiles, isTestSuite, chunkIndex, totalChunks);
        
        try {
            const startTime = Date.now();
            let response: any;
            let useChatAPI = true;
            
            try {
                response = await fetchJson(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000, // 1 minute per chunk (optimized for speed)
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a JSON-only response generator. You MUST respond with ONLY valid JSON. Never use markdown code blocks, never add explanations before or after. Your response must start with { and end with }. You MUST include all required fields: modules (array), relationships (array), summary (string), pattern (object), and layers (array). Return complete JSON, not partial.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        stream: false,
                        format: 'json',
                        options: {
                            temperature: 0.0,
                            num_predict: 2000, // Reduced for faster generation
                            top_p: 0.9,
                            top_k: 40,
                            stop: ['```', '```json']
                        }
                    })
                });
            } catch (chatError: any) {
                // Fallback to generate API
                useChatAPI = false;
                this.logger.info(`[Chunk ${chunkIndex}] Chat API failed: ${chatError.message || chatError}`);
                this.logger.info(`[Chunk ${chunkIndex}] Falling back to generate API`);
                response = await fetchJson(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000, // 1 minute per chunk
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.',
                        stream: false,
                        format: 'json',
                        options: {
                            temperature: 0.0,
                            num_predict: 2000, // Reduced for faster generation
                            top_p: 0.9,
                            top_k: 40,
                            stop: ['```', '```json']
                        }
                    })
                });
            }
            
            const duration = Date.now() - startTime;
            this.logger.info(`[Chunk ${chunkIndex}/${totalChunks}] Completed in ${Math.round(duration / 1000)}s`);
            
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Extract response text based on API type
            let fullResponse = '';
            if (useChatAPI) {
                fullResponse = data.message?.content || '';
                if (!fullResponse && data.messages && data.messages.length > 0) {
                    const lastMessage = data.messages[data.messages.length - 1];
                    fullResponse = lastMessage?.content || '';
                }
                if (!fullResponse) {
                    fullResponse = data.response || '';
                }
            } else {
                fullResponse = data.response || '';
            }
            
            if (!fullResponse || fullResponse.trim().length === 0) {
                this.logger.error(`[Chunk ${chunkIndex}/${totalChunks}] Empty response from Ollama`);
                this.logger.error(`[Chunk] Response data: ${JSON.stringify(data).substring(0, 500)}`);
                return this.createFallbackAnalysis(chunkFiles);
            }
            
            // Reduced logging for speed - only log if response is suspiciously short
            if (fullResponse.length < 100) {
                this.logger.info(`[Chunk ${chunkIndex}/${totalChunks}] Short response: ${fullResponse.length} chars`);
            }
            
            // Parse the response using comprehensive parsing logic
            return this.parseOllamaResponse(fullResponse, chunkFiles);
            
        } catch (error: any) {
            this.logger.error(`[Chunk ${chunkIndex}/${totalChunks}] Failed: ${error.message}`);
            // Return fallback for this chunk
            return this.createFallbackAnalysis(chunkFiles);
        }
    }
    
    /**
     * Builds the prompt for a chunk of files
     */
    private buildPrompt(chunkFiles: FileContext[], allFiles: FileContext[], isTestSuite: boolean, chunkIndex: number = 1, totalChunks: number = 1): string {
        const basePrompt = isTestSuite ? `You are analyzing a TEST SUITE codebase. Your task is to identify:
1. MODULES: List each test file and support file
2. RELATIONSHIPS: Show how test files use support files, commands, or utilities
3. SUMMARY: Describe what this test suite tests and its structure

For TEST SUITES, modules should represent:
- Test spec files (the actual tests)
- Support files (commands, utilities)
- Configuration files
- Fixtures or helpers

CRITICAL: You MUST return ONLY valid JSON. No markdown, no code blocks, no explanations before or after. Start directly with { and end with }.

Return ONLY valid JSON with these exact fields:
{
    "modules": [
        {
            "name": "Landing Tests",
            "path": "cypress/e2e/01-landing.cy.js",
            "type": "test",
            "layer": "presentation",
            "description": "Tests for landing page functionality"
        }
    ],
    "relationships": [
        {
            "from": "cypress/e2e/01-landing.cy.js",
            "to": "cypress/support/commands.js",
            "type": "uses",
            "strength": "medium",
            "description": "Uses custom Cypress commands"
        }
    ],
    "pattern": {
        "name": "Layered",
        "confidence": 0.8,
        "description": "Test suite organized by feature areas"
    },
    "layers": [
        {
            "name": "E2E Tests",
            "modules": ["cypress/e2e/01-landing.cy.js"]
        },
        {
            "name": "Support",
            "modules": ["cypress/support/commands.js"]
        }
    ],
    "entryPoints": ["cypress.config.js"],
    "coreComponents": ["cypress/support/commands.js"],
    "summary": "A comprehensive E2E test suite using Cypress for testing [application name]"
}

Files to analyze (${chunkFiles.length} of ${allFiles.length} files):
${chunkFiles.map((f, idx) => {
    const maxLength = idx < 2 ? 1000 : 500; // Reduced for faster processing
    const content = f.content.substring(0, maxLength);
    const truncated = f.content.length > maxLength;
    return `=== File: ${f.path} ===
${content}${truncated ? '\n... (truncated)' : ''}
`;
}).join('\n\n')}

Note: This is chunk ${chunkIndex} of ${totalChunks}. The full codebase has ${allFiles.length} files total.

Return ONLY the JSON object (no markdown, no extra text):
` : `You are an expert software architect analyzing a codebase. Perform a comprehensive architectural analysis.

TASK: Analyze the code structure and identify:
1. MODULES: Each file/class with its architectural role
2. RELATIONSHIPS: Dependencies and interactions between modules
3. ARCHITECTURAL PATTERN: The overall architecture (MVC, Layered, Microservices, etc.)
4. LAYERS: Logical layers (presentation, business, data, infrastructure)
5. SUMMARY: Comprehensive description of the architecture

For each MODULE, determine:
- name: The file or class name
- path: The file path
- type: 'component' | 'service' | 'utility' | 'model' | 'controller' | 'view' | 'config' | 'test' | 'other'
- layer: 'presentation' | 'business' | 'data' | 'infrastructure' | 'other'
- description: Brief purpose description
- exports: List of exported functions/classes (if identifiable)
- imports: List of imports from other files (if identifiable)

For each RELATIONSHIP, determine:
- from: Source module path
- to: Target module path
- type: 'imports' | 'extends' | 'implements' | 'uses' | 'calls' | 'depends'
- strength: 'weak' | 'medium' | 'strong' (based on coupling)
- description: Brief description of the relationship

ARCHITECTURAL PATTERN should include:
- name: One of 'MVC' | 'Layered' | 'Microservices' | 'Event-Driven' | 'Client-Server' | 'Monolithic' | 'Unknown'
- confidence: 0.0 to 1.0
- description: Why this pattern was identified

LAYERS should group modules by architectural layer:
- name: Layer name (e.g., "Presentation", "Business Logic", "Data Access")
- modules: Array of module paths in this layer

CRITICAL: You MUST return ONLY valid JSON. No markdown, no code blocks, no explanations before or after. Start directly with { and end with }.

Return ONLY valid JSON in this EXACT format:
{
    "modules": [
        {
            "name": "ExampleClass",
            "path": "src/example.ts",
            "type": "service",
            "layer": "business",
            "description": "Handles business logic",
            "exports": ["ExampleClass", "helperFunction"],
            "imports": ["./utils", "./models"]
        }
    ],
    "relationships": [
        {
            "from": "src/example.ts",
            "to": "src/utils.ts",
            "type": "imports",
            "strength": "medium",
            "description": "Uses utility functions"
        }
    ],
    "pattern": {
        "name": "Layered",
        "confidence": 0.85,
        "description": "Clear separation between layers"
    },
    "layers": [
        {
            "name": "Business Logic",
            "modules": ["src/example.ts"]
        }
    ],
    "entryPoints": ["src/main.ts", "src/index.ts"],
    "coreComponents": ["src/example.ts"],
    "summary": "A detailed architectural summary..."
}

Files to analyze (${chunkFiles.length} of ${allFiles.length} files):
${chunkFiles.map((f, idx) => {
    const maxLength = idx < 2 ? 1000 : 500; // Reduced for faster processing
    const content = f.content.substring(0, maxLength);
    const truncated = f.content.length > maxLength;
    return `=== File: ${f.path} ===
${content}${truncated ? '\n... (truncated)' : ''}
`;
}).join('\n\n')}

Note: This is chunk ${chunkIndex} of ${totalChunks}. The full codebase has ${allFiles.length} files total.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Start with { and end with }
3. Include ALL required fields: modules, relationships, summary, pattern, layers
4. Make sure the JSON is complete and valid
5. Do not stop mid-response - return the full JSON object

Return the complete JSON now:
`;
        
        return basePrompt;
    }
    
    /**
     * Merges results from multiple chunks into a single analysis
     */
    private mergeChunkResults(
        chunkResults: ArchitectureAnalysis[], 
        allFiles: FileContext[],
        selectedFiles: FileContext[]
    ): ArchitectureAnalysis {
        this.logger.info(`Merging ${chunkResults.length} chunk results...`);
        
        // Combine all modules (deduplicate by path)
        const moduleMap = new Map<string, Module>();
        chunkResults.forEach(chunk => {
            chunk.modules?.forEach(module => {
                if (!moduleMap.has(module.path)) {
                    moduleMap.set(module.path, module);
                }
            });
        });
        
        // Combine all relationships (deduplicate)
        const relationshipSet = new Set<string>();
        const relationships: Relationship[] = [];
        chunkResults.forEach(chunk => {
            chunk.relationships?.forEach(rel => {
                const key = `${rel.from}->${rel.to}`;
                if (!relationshipSet.has(key)) {
                    relationshipSet.add(key);
                    relationships.push(rel);
                }
            });
        });
        
        // Merge layers
        const layerMap = new Map<string, Set<string>>();
        chunkResults.forEach(chunk => {
            chunk.layers?.forEach(layer => {
                if (!layerMap.has(layer.name)) {
                    layerMap.set(layer.name, new Set());
                }
                layer.modules?.forEach(modPath => {
                    layerMap.get(layer.name)!.add(modPath);
                });
            });
        });
        
        const layers = Array.from(layerMap.entries()).map(([name, mods]) => ({
            name,
            modules: Array.from(mods)
        }));
        
        // Combine summaries
        const summaries = chunkResults.map(c => c.summary).filter(s => s);
        const combinedSummary = summaries.length > 0 
            ? summaries.join(' ') 
            : `Analyzed ${allFiles.length} files across ${chunkResults.length} chunks`;
        
        // Determine pattern (use highest confidence)
        const patterns = chunkResults.map(c => c.pattern).filter(p => p && p.name !== 'Unknown');
        const bestPattern = patterns.length > 0
            ? patterns.reduce((best, current) => 
                (current?.confidence || 0) > (best?.confidence || 0) ? current : best
              )
            : { name: 'Unknown' as const, confidence: 0, description: 'Could not determine pattern' };
        
        // Merge entry points and core components
        const entryPointsSet = new Set<string>();
        const coreComponentsSet = new Set<string>();
        chunkResults.forEach(chunk => {
            chunk.entryPoints?.forEach(ep => entryPointsSet.add(ep));
            chunk.coreComponents?.forEach(cc => coreComponentsSet.add(cc));
        });
        
        // Merge with ALL files (not just selected)
        const allModules = this.mergeWithAllFiles(Array.from(moduleMap.values()), allFiles, selectedFiles);
        const allRelationships = this.inferAllRelationships(allModules, allFiles, relationships);
        
        this.logger.info(`Merged result: ${allModules.length} modules, ${allRelationships.length} relationships`);
        
        return {
            modules: allModules,
            relationships: allRelationships,
            summary: combinedSummary,
            pattern: bestPattern,
            layers: this.groupByLayers(allModules),
            entryPoints: Array.from(entryPointsSet),
            coreComponents: Array.from(coreComponentsSet)
        };
    }
    
    /**
     * Creates a fallback analysis for a chunk that failed
     */
    private createFallbackAnalysis(chunkFiles: FileContext[]): ArchitectureAnalysis {
        return {
            modules: chunkFiles.map(f => ({
                name: f.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || f.path,
                path: f.path,
                type: this.inferModuleType(f.path),
                layer: this.inferLayer(f.path),
                description: this.inferDescription(f.path, f.content)
            })),
            relationships: [],
            summary: `Fallback analysis for ${chunkFiles.length} files`,
            pattern: { name: 'Unknown', confidence: 0, description: 'Chunk analysis failed' },
            layers: [],
            entryPoints: [],
            coreComponents: []
        };
    }
    
    /**
     * Parses Ollama response with comprehensive JSON parsing and recovery
     */
    private parseOllamaResponse(fullResponse: string, files: FileContext[]): ArchitectureAnalysis {
        if (!fullResponse || fullResponse.trim().length === 0) {
            this.logger.info(`Empty response from Ollama, using fallback`);
            return this.createFallbackAnalysis(files);
        }
        
        // Clean up the response - remove markdown code blocks first
        let cleanJson = fullResponse.trim();
        
        // Remove markdown code blocks (multiple patterns)
        cleanJson = cleanJson.replace(/^```json\s*/gim, '');
        cleanJson = cleanJson.replace(/^```\s*/gim, '');
        cleanJson = cleanJson.replace(/```$/gim, '');
        cleanJson = cleanJson.replace(/```json$/gim, '');
        
        // Remove any leading/trailing whitespace and newlines
        cleanJson = cleanJson.trim();
        
        // Remove any text before first { or after last }
        const firstBraceIdx = cleanJson.indexOf('{');
        const lastBraceIdx = cleanJson.lastIndexOf('}');
        if (firstBraceIdx > 0) {
            cleanJson = cleanJson.substring(firstBraceIdx);
        }
        if (lastBraceIdx >= 0 && lastBraceIdx < cleanJson.length - 1) {
            cleanJson = cleanJson.substring(0, lastBraceIdx + 1);
        }
        
        cleanJson = cleanJson.trim();
        
        // Try multiple JSON extraction methods
        let jsonString = cleanJson;
        
        // Method 1: Try to find balanced JSON object starting from first {
        const firstBrace = cleanJson.indexOf('{');
        if (firstBrace !== -1) {
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let lastBrace = -1;
            
            for (let i = firstBrace; i < cleanJson.length; i++) {
                const char = cleanJson[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            lastBrace = i;
                            break;
                        }
                    }
                }
            }
            
            if (lastBrace !== -1 && lastBrace > firstBrace) {
                jsonString = cleanJson.substring(firstBrace, lastBrace + 1);
                this.logger.info(`[Chunk] Extracted JSON using balanced brace matching`);
            }
        }
        
        // Method 2: If that failed, try finding between first { and last }
        if (!jsonString.trim().startsWith('{') || jsonString.trim().length < 10) {
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonString = cleanJson.substring(firstBrace, lastBrace + 1);
                this.logger.info(`[Chunk] Extracted JSON using first/last braces`);
            }
        }
        
        // Fix common JSON issues
        // Fix trailing commas before closing brackets/braces
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix missing quotes around keys
        jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        // Remove comments
        jsonString = jsonString.replace(/\/\/.*$/gm, '');
        jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Try to parse
        try {
            const parsed = JSON.parse(jsonString);
            this.logger.info(`[Chunk] ✅ Parsed successfully!`);
            
            // Normalize modules
            if (parsed.modules && Array.isArray(parsed.modules)) {
                parsed.modules = parsed.modules.map((m: any) => {
                    if (typeof m === 'string') {
                        return {
                            name: m.split('/').pop()?.replace(/\.[^/.]+$/, '') || m,
                            path: m,
                            type: this.inferModuleType(m),
                            layer: 'other' as const,
                            description: ''
                        };
                    }
                    const modulePath = m.path || files.find(f => f.path.includes(m.name || ''))?.path || m.name || '';
                    return {
                        name: m.name || modulePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown',
                        path: modulePath,
                        type: m.type || this.inferModuleType(modulePath),
                        layer: m.layer || 'other',
                        description: m.description || ''
                    };
                });
            }
            
            // Normalize relationships
            if (parsed.relationships && Array.isArray(parsed.relationships)) {
                parsed.relationships = parsed.relationships.map((r: any) => {
                    let from = r.from || r.parentModule || r.source || r.parent || '';
                    let to = r.to || r.childModule || r.target || r.child || '';
                    
                    if (r.childModules && Array.isArray(r.childModules)) {
                        return r.childModules.map((child: string) => ({
                            from: from,
                            to: child,
                            type: r.type || 'uses',
                            strength: r.strength || 'medium',
                            description: r.description || ''
                        }));
                    }
                    
                    return {
                        from: from,
                        to: to,
                        type: r.type || 'depends',
                        strength: r.strength || 'medium',
                        description: r.description || ''
                    };
                }).flat().filter((r: any) => r.from && r.to && r.from.length > 0 && r.to.length > 0);
            }
            
            // Normalize pattern
            if (!parsed.pattern) {
                parsed.pattern = this.inferArchitecturalPattern(parsed);
            } else if (typeof parsed.pattern === 'string') {
                const patternName = parsed.pattern as string;
                const patternMatch = patternName.match(/(MVC|Layered|Microservices|Event-Driven|Client-Server|Monolithic|Modular|Component-Based)/i)?.[0];
                parsed.pattern = {
                    name: (patternMatch || 'Unknown') as any,
                    confidence: patternMatch ? 0.8 : 0.5,
                    description: patternName
                };
            } else if (parsed.pattern && typeof parsed.pattern === 'object') {
                let patternName = parsed.pattern.name || 'Unknown';
                if (typeof patternName === 'string') {
                    const normalized = patternName.toLowerCase();
                    if (normalized.includes('mvc') || normalized.includes('model-view-controller')) {
                        patternName = 'MVC';
                    } else if (normalized.includes('layered') || normalized.includes('tier')) {
                        patternName = 'Layered';
                    } else if (normalized.includes('microservice')) {
                        patternName = 'Microservices';
                    } else if (normalized.includes('monolithic')) {
                        patternName = 'Monolithic';
                    } else if (normalized.includes('event')) {
                        patternName = 'Event-Driven';
                    } else if (normalized.includes('client-server')) {
                        patternName = 'Client-Server';
                    } else if (normalized.includes('modular') || normalized.includes('component')) {
                        patternName = 'Layered';
                    }
                }
                parsed.pattern = {
                    name: patternName as any,
                    confidence: parsed.pattern.confidence || (patternName !== 'Unknown' ? 0.7 : 0.3),
                    description: parsed.pattern.description || `Architecture pattern: ${patternName}`
                };
            }
            
            // Normalize layers
            if (!parsed.layers || parsed.layers.length === 0) {
                parsed.layers = this.groupByLayers(parsed.modules || []);
            } else {
                parsed.layers = this.normalizeLayers(parsed.layers, parsed.modules || []);
            }
            
            // Validate and provide defaults
            if (!parsed.modules || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
                parsed.modules = files.map(f => ({
                    name: f.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || f.path,
                    path: f.path,
                    type: this.inferModuleType(f.path),
                    layer: 'other' as const,
                    description: ''
                }));
            }
            
            if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
                parsed.relationships = [];
            }
            
            if (!parsed.summary) {
                parsed.summary = `Chunk analysis: ${parsed.modules.length} modules, ${parsed.relationships.length} relationships`;
            }
            
            if (!parsed.entryPoints) {
                parsed.entryPoints = [];
            }
            
            if (!parsed.coreComponents) {
                parsed.coreComponents = [];
            }
            
            return {
                modules: parsed.modules || [],
                relationships: parsed.relationships || [],
                summary: parsed.summary || 'Chunk analysis completed',
                pattern: parsed.pattern || { name: 'Unknown', confidence: 0, description: '' },
                layers: parsed.layers || [],
                entryPoints: parsed.entryPoints || [],
                coreComponents: parsed.coreComponents || []
            };
        } catch (parseError: any) {
            this.logger.info(`[Chunk] JSON parse error: ${parseError.message}`);
            this.logger.info(`[Chunk] Response length: ${fullResponse.length} chars`);
            this.logger.info(`[Chunk] Response preview: ${fullResponse.substring(0, 200)}...`);
            
            // Try recovery: extract modules using regex
            try {
                const modulesMatch = jsonString.match(/"modules"\s*:\s*\[([\s\S]*?)\](?=\s*[,}])/);
                const relationshipsMatch = jsonString.match(/"relationships"\s*:\s*\[([\s\S]*?)\](?=\s*[,}])/);
                const summaryMatch = jsonString.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                
                if (modulesMatch) {
                    try {
                        const modules = JSON.parse(`[${modulesMatch[1]}]`);
                        this.logger.info(`[Chunk] ✓ Recovered ${modules.length} modules using regex extraction`);
                        return {
                            modules: modules.map((m: any) => ({
                                name: m.name || m.path?.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown',
                                path: m.path || m.name || '',
                                type: m.type || this.inferModuleType(m.path || m.name || ''),
                                layer: m.layer || 'other',
                                description: m.description || ''
                            })),
                            relationships: relationshipsMatch ? (() => {
                                try {
                                    return JSON.parse(`[${relationshipsMatch[1]}]`);
                                } catch {
                                    return [];
                                }
                            })() : [],
                            summary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : 'Chunk analysis completed',
                            pattern: { name: 'Unknown', confidence: 0.3, description: 'Partial recovery' },
                            layers: [],
                            entryPoints: [],
                            coreComponents: []
                        };
                    } catch (e) {
                        this.logger.info(`[Chunk] Recovery failed: ${e}`);
                    }
                }
            } catch (recoveryError) {
                this.logger.info(`[Chunk] Recovery attempt failed`);
            }
        }
        
        // Final fallback
        this.logger.info(`[Chunk] Using fallback analysis for ${files.length} files`);
        return this.createFallbackAnalysis(files);
    }

    private inferModuleType(path: string): Module['type'] {
        const lower = path.toLowerCase();
        if (lower.includes('test')) {return 'test';}
        if (lower.includes('controller')) {return 'controller';}
        if (lower.includes('service')) {return 'service';}
        if (lower.includes('model')) {return 'model';}
        if (lower.includes('view') || lower.includes('component')) {return 'view';}
        if (lower.includes('util')) {return 'utility';}
        if (lower.includes('config')) {return 'config';}
        if (lower.includes('component')) {return 'component';}
        return 'other';
    }
    
    private inferLayer(path: string): Module['layer'] {
        const lower = path.toLowerCase();
        if (lower.includes('view') || lower.includes('component') || lower.includes('page') || lower.includes('ui')) {
            return 'presentation';
        }
        if (lower.includes('service') || lower.includes('business') || lower.includes('logic')) {
            return 'business';
        }
        if (lower.includes('model') || lower.includes('data') || lower.includes('db') || lower.includes('database')) {
            return 'data';
        }
        if (lower.includes('config') || lower.includes('infrastructure') || lower.includes('infra')) {
            return 'infrastructure';
        }
        return 'other';
    }
    
    private inferDescription(path: string, content: string): string {
        // Try to extract a brief description from file content
        const lines = content.split('\n').slice(0, 10); // First 10 lines
        const commentMatch = lines.join('\n').match(/(?:\/\/|#|<!--)\s*(.+?)(?:\n|$)/);
        if (commentMatch) {
            return commentMatch[1].trim().substring(0, 100);
        }
        return '';
    }

    private inferArchitecturalPattern(analysis: any): ArchitectureAnalysis['pattern'] {
        const modules = analysis.modules || [];
        const relationships = analysis.relationships || [];
        const layers = analysis.layers || [];
        
        let hasControllers = false;
        let hasViews = false;
        let hasModels = false;
        let hasServices = false;
        let hasLayers = false;
        let hasComponents = false;
        let hasRoutes = false;
        let hasFlask = false;
        let hasReact = false;
        let hasNext = false;
        
        modules.forEach((m: Module) => {
            const path = (m.path || '').toLowerCase();
            const name = (m.name || '').toLowerCase();
            const type = m.type || '';
            
            if (type === 'controller' || path.includes('controller') || name.includes('controller')) {
                hasControllers = true;
            }
            if (type === 'view' || path.includes('view') || name.includes('view') || path.includes('component')) {
                hasViews = true;
            }
            if (type === 'model' || path.includes('model') || name.includes('model')) {
                hasModels = true;
            }
            if (type === 'service' || path.includes('service') || name.includes('service')) {
                hasServices = true;
            }
            if (type === 'component' || path.includes('component')) {
                hasComponents = true;
            }
            if (path.includes('route') || path.includes('api/')) {
                hasRoutes = true;
            }
            if (m.layer && m.layer !== 'other') {
                hasLayers = true;
            }
            if (path.includes('flask') || path.includes('app.py') || path.includes('main.py')) {
                hasFlask = true;
            }
            if (path.includes('react') || path.includes('.jsx') || path.includes('.tsx')) {
                hasReact = true;
            }
            if (path.includes('next') || path.includes('pages') || path.includes('app/')) {
                hasNext = true;
            }
        });
        
        // Check for MVC pattern
        if (hasControllers && hasViews && hasModels) {
            return {
                name: 'MVC',
                confidence: 0.85,
                description: 'Detected Model-View-Controller pattern with clear separation of concerns'
            };
        }
        
        // Check for Layered architecture
        if (hasLayers || (hasServices && hasModels && hasViews)) {
            return {
                name: 'Layered',
                confidence: 0.75,
                description: 'Detected layered architecture with separation of concerns across multiple layers'
            };
        }
        
        // Check for Component-Based (React/Next.js)
        if (hasNext || (hasReact && hasComponents)) {
            return {
                name: 'Layered',
                confidence: 0.7,
                description: 'Detected component-based architecture typical of React/Next.js applications'
            };
        }
        
        // Check for Flask/Python web app
        if (hasFlask && hasRoutes) {
            return {
                name: 'Layered',
                confidence: 0.7,
                description: 'Detected Flask-based web application with layered structure'
            };
        }
        
        // Check for Microservices (multiple independent services)
        if (hasServices && modules.length > 5 && relationships.length > modules.length * 0.5) {
            return {
                name: 'Microservices',
                confidence: 0.6,
                description: 'Detected potential microservices architecture with multiple service modules'
            };
        }
        
        // Default to Layered if we have some structure
        if (modules.length > 3 && (hasServices || hasModels || hasViews)) {
            return {
                name: 'Layered',
                confidence: 0.6,
                description: 'Detected layered architecture based on module types and structure'
            };
        }
        
        return {
            name: 'Unknown',
            confidence: 0.3,
            description: 'Could not confidently determine architectural pattern from available information'
        };
    }

    private groupByLayers(modules: Module[]): ArchitectureAnalysis['layers'] {
        const layerMap = new Map<string, string[]>();
        
        modules.forEach(m => {
            const layer = m.layer || 'other';
            if (!layerMap.has(layer)) {
                layerMap.set(layer, []);
            }
            layerMap.get(layer)!.push(m.path);
        });
        
        return Array.from(layerMap.entries()).map(([name, mods]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            modules: mods
        }));
    }
    
    private normalizeLayers(layers: any[], modules: Module[]): ArchitectureAnalysis['layers'] {
        // If layers already have modules mapped, return as-is
        const layersWithModules = layers.filter(l => l.modules && Array.isArray(l.modules) && l.modules.length > 0);
        if (layersWithModules.length === layers.length) {
            return layers.map(l => ({
                name: l.name || 'Unknown',
                modules: l.modules || []
            }));
        }
        
        // Try to map modules to layers based on layer property and module names/paths
        const layerMap = new Map<string, string[]>();
        modules.forEach(m => {
            const layer = m.layer || 'other';
            if (!layerMap.has(layer)) {
                layerMap.set(layer, []);
            }
            layerMap.get(layer)!.push(m.path);
        });
        
        // Also create a map by module name/path keywords
        const keywordMap = new Map<string, string[]>();
        modules.forEach(m => {
            const path = (m.path || '').toLowerCase();
            const name = (m.name || '').toLowerCase();
            
            // Map by keywords
            if (path.includes('data') || path.includes('model') || path.includes('db') || name.includes('data') || name.includes('database')) {
                if (!keywordMap.has('data')) keywordMap.set('data', []);
                keywordMap.get('data')!.push(m.path);
            }
            if (path.includes('cache') || name.includes('cache')) {
                if (!keywordMap.has('cache')) keywordMap.set('cache', []);
                keywordMap.get('cache')!.push(m.path);
            }
            if (path.includes('monitor') || name.includes('monitor')) {
                if (!keywordMap.has('monitoring')) keywordMap.set('monitoring', []);
                keywordMap.get('monitoring')!.push(m.path);
            }
            if (path.includes('communication') || path.includes('mattermost') || name.includes('communication')) {
                if (!keywordMap.has('communication')) keywordMap.set('communication', []);
                keywordMap.get('communication')!.push(m.path);
            }
            if (path.includes('service') || name.includes('service')) {
                if (!keywordMap.has('service')) keywordMap.set('service', []);
                keywordMap.get('service')!.push(m.path);
            }
            if (path.includes('view') || path.includes('component') || name.includes('view') || name.includes('component')) {
                if (!keywordMap.has('presentation')) keywordMap.set('presentation', []);
                keywordMap.get('presentation')!.push(m.path);
            }
        });
        
        // Match layer names from response to our maps
        return layers.map(l => {
            const layerName = (l.name || '').toLowerCase();
            let matchedModules: string[] = [];
            
            // Try exact match first
            if (layerMap.has(layerName)) {
                matchedModules = layerMap.get(layerName)!;
            } else {
                // Try keyword matching
                for (const [key, mods] of keywordMap.entries()) {
                    if (layerName.includes(key) || key.includes(layerName)) {
                        matchedModules = mods;
                        break;
                    }
                }
                
                // Try partial match with layer map
                if (matchedModules.length === 0) {
                    for (const [key, mods] of layerMap.entries()) {
                        if (layerName.includes(key) || key.includes(layerName)) {
                            matchedModules = mods;
                            break;
                        }
                    }
                }
            }
            
            // If still no match, use modules from layer.modules if provided
            if (matchedModules.length === 0 && l.modules && Array.isArray(l.modules)) {
                matchedModules = l.modules;
            }
            
            return {
                name: l.name || 'Unknown',
                modules: matchedModules
            };
        });
    }
    
    /**
     * Merges LLM-analyzed modules with all files in the codebase
     * Creates modules for files that weren't analyzed by LLM
     */
    private mergeWithAllFiles(analyzedModules: Module[], allFiles: FileContext[], selectedFiles: FileContext[]): Module[] {
        const analyzedPaths = new Set(analyzedModules.map(m => m.path));
        
        // Start with analyzed modules
        const allModules = [...analyzedModules];
        
        // Add modules for files that weren't analyzed
        allFiles.forEach(file => {
            if (!analyzedPaths.has(file.path)) {
                // Infer module info from file path and content
                const module: Module = {
                    name: file.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || file.path,
                    path: file.path,
                    type: this.inferModuleType(file.path),
                    layer: this.inferLayer(file.path),
                    description: this.inferDescription(file.path, file.content)
                };
                allModules.push(module);
            }
        });
        
        this.logger.info(`Merged ${analyzedModules.length} analyzed modules with ${allFiles.length - analyzedModules.length} inferred modules = ${allModules.length} total`);
        
        return allModules;
    }
    
    /**
     * Infers relationships for ALL modules based on import/export analysis
     */
    private inferAllRelationships(allModules: Module[], allFiles: FileContext[], existingRelationships: Relationship[]): Relationship[] {
        const relationships: Relationship[] = [...existingRelationships]; // Start with LLM-analyzed relationships
        const modulePaths = new Set(allModules.map(m => m.path));
        const existingRelKeys = new Set(existingRelationships.map(r => `${r.from}->${r.to}`));
        
        // Try to infer relationships from file imports/exports for ALL files
        allFiles.forEach(file => {
            const content = file.content.substring(0, 10000); // Check first 10KB
            const imports = content.match(/(?:import|from|require)\s+['"]([^'"]+)['"]/g) || [];
            
            imports.forEach(imp => {
                const match = imp.match(/['"]([^'"]+)['"]/);
                if (match) {
                    const importPath = match[1];
                    // Try to resolve to actual module path
                    const resolvedPath = this.resolveImportPath(importPath, file.path, allFiles);
                    if (resolvedPath && modulePaths.has(resolvedPath) && resolvedPath !== file.path) {
                        const relKey = `${file.path}->${resolvedPath}`;
                        if (!existingRelKeys.has(relKey)) {
                            relationships.push({
                                from: file.path,
                                to: resolvedPath,
                                type: 'imports',
                                strength: 'medium',
                                description: `Imports from ${resolvedPath}`
                            });
                            existingRelKeys.add(relKey);
                        }
                    }
                }
            });
        });
        
        return relationships;
    }
    
    private inferRelationships(modules: Module[], files: FileContext[]): Relationship[] {
        const relationships: Relationship[] = [];
        const modulePaths = new Set(modules.map(m => m.path));
        
        // Try to infer relationships from file imports/exports
        files.forEach(file => {
            const content = file.content.substring(0, 5000); // Check first 5KB
            const imports = content.match(/(?:import|from|require)\s+['"]([^'"]+)['"]/g) || [];
            
            imports.forEach(imp => {
                const match = imp.match(/['"]([^'"]+)['"]/);
                if (match) {
                    const importPath = match[1];
                    // Try to resolve to actual module path
                    const resolvedPath = this.resolveImportPath(importPath, file.path, files);
                    if (resolvedPath && modulePaths.has(resolvedPath) && resolvedPath !== file.path) {
                        relationships.push({
                            from: file.path,
                            to: resolvedPath,
                            type: 'imports',
                            strength: 'medium',
                            description: `Imports from ${resolvedPath}`
                        });
                    }
                }
            });
        });
        
        return relationships;
    }
    
    private resolveImportPath(importPath: string, fromPath: string, files: FileContext[]): string | null {
        // Simple resolution - try to find matching file
        const pathParts = fromPath.split('/');
        pathParts.pop(); // Remove filename
        
        // Try relative path resolution
        const relativePath = importPath.startsWith('./') || importPath.startsWith('../') 
            ? this.resolveRelativePath(importPath, pathParts.join('/'))
            : importPath;
        
        // Try to find matching file
        const matchingFile = files.find(f => 
            f.path === relativePath || 
            f.path.endsWith(relativePath) ||
            f.path.includes(relativePath.replace(/\.(js|ts|tsx|jsx|py)$/, ''))
        );
        
        return matchingFile?.path || null;
    }
    
    private resolveRelativePath(relativePath: string, baseDir: string): string {
        // Simple relative path resolution
        if (relativePath.startsWith('./')) {
            return `${baseDir}/${relativePath.substring(2)}`;
        }
        if (relativePath.startsWith('../')) {
            const parts = baseDir.split('/');
            parts.pop();
            return `${parts.join('/')}/${relativePath.substring(3)}`;
        }
        return relativePath;
    }

    private findEntryPoints(modules: Module[]): string[] {
        return modules
            .filter(m => {
                const name = m.name.toLowerCase();
                const path = m.path.toLowerCase();
                return name === 'main' || name === 'index' || name === 'app' ||
                       path.includes('/main.') || path.includes('/index.') || 
                       path.includes('/app.') || name === 'extension';
            })
            .map(m => m.path);
    }

    async checkHealth(): Promise<boolean> {
        try {
            this.logger.info(`Checking Ollama health at ${this.baseUrl}/api/tags`);
            const response = await fetchJson(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000 // 10 seconds for health check
            });
            this.logger.info(`Health check response: ${response.ok} (status: ${response.status})`);
            return response.ok;
        } catch (error: any) {
            this.logger.error(`Health check failed: ${error.message}`);
            this.logger.error(`Error code: ${error.code || 'unknown'}`);
            if (error.message.includes('timeout')) {
                this.logger.error('Health check timed out - Ollama may not be responding');
            }
            this.logger.error(`Is Ollama running? Try: ollama serve`);
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            this.logger.info(`Fetching models list from ${this.baseUrl}/api/tags`);
            const response = await fetchJson(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                this.logger.error(`Failed to fetch models: ${response.status}`);
                return [];
            }
            
            this.logger.info('Parsing response JSON...');
            const data: any = await response.json();
            this.logger.info(`Response data type: ${typeof data}`);
            this.logger.info(`Response data keys: ${Object.keys(data || {}).join(', ')}`);
            
            if (!data || !data.models) {
                this.logger.error('Response missing models field');
                return [];
            }
            
            const models = data.models.map((m: any) => m.name || m);
            this.logger.info(`Found ${models.length} models: ${models.join(', ')}`);
            return models;
        } catch (error: any) {
            this.logger.error(`List models failed: ${error.message}`);
            this.logger.error(`Error stack: ${error.stack}`);
            return [];
        }
    }
}
