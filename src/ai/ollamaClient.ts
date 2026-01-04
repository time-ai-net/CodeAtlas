import { ArchitectureAnalysis, FileContext, ILogger } from '../types';

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

        const prompt = `You are analyzing a codebase architecture. Your task is to identify:
1. MODULES: List all the file paths provided below as module names
2. RELATIONSHIPS: Find import/require statements, function calls between files, or dependencies
3. SUMMARY: Brief description of what this codebase does

CRITICAL: You must return ONLY valid JSON with exactly these fields: "modules", "relationships", "summary"
Do not add any other fields like "commands", "functions", "tests", etc.

Example output format:
{
    "modules": ["file1.js", "file2.js", "config.js"],
    "relationships": [
        {"from": "file1.js", "to": "file2.js", "type": "imports"},
        {"from": "file2.js", "to": "config.js", "type": "requires"}
    ],
    "summary": "This is a test suite for a web application using Cypress framework"
}

Files to analyze:
${files.map(f => `File: ${f.path}\n${f.content.substring(0, 2000)}`).join('\n\n---\n\n')}

Return ONLY the JSON object now (no other text):`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 2000
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.logger.info('Received response from Ollama');

            const responseData = data as any;
            let text = responseData.response;
            
            this.logger.info(`Raw response: ${text.substring(0, 500)}...`);
            
            // Clean up the response
            let cleanJson = text.trim();
            
            // Try to extract JSON if wrapped in text
            const jsonMatch = text.match(/\{[\s\S]*"modules"[\s\S]*\}/);
            if (jsonMatch) {
                cleanJson = jsonMatch[0];
                this.logger.info('Extracted JSON from response');
            }
            
            cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
            
            this.logger.info(`Attempting to parse: ${cleanJson.substring(0, 200)}...`);
            
            try {
                const parsed = JSON.parse(cleanJson);
                this.logger.info(`Parsed successfully: ${JSON.stringify(parsed).substring(0, 200)}`);
                
                // Validate the structure - DON'T overwrite with empty arrays!
                if (!parsed.modules || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
                    this.logger.error(`Response has invalid/empty modules field: ${JSON.stringify(parsed.modules)}`);
                    this.logger.info('Attempting to extract modules from relationships...');
                    // Try to extract from relationships if they exist
                    if (parsed.relationships && Array.isArray(parsed.relationships)) {
                        const moduleSet = new Set();
                        parsed.relationships.forEach((r: any) => {
                            if (r.from) moduleSet.add(r.from);
                            if (r.to) moduleSet.add(r.to);
                        });
                        parsed.modules = Array.from(moduleSet);
                        this.logger.info(`Extracted ${parsed.modules.length} modules from relationships`);
                    } else {
                        this.logger.error('No modules or relationships found in response');
                    }
                }
                if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
                    this.logger.error(`Response has invalid relationships field: ${JSON.stringify(parsed.relationships)}`);
                    parsed.relationships = [];
                }
                if (!parsed.summary || parsed.summary === 'undefined' || parsed.summary === undefined) {
                    this.logger.error('Response missing or has undefined "summary" field, generating one...');
                    const moduleCount = parsed.modules?.length || 0;
                    const relCount = parsed.relationships?.length || 0;
                    parsed.summary = `This codebase consists of ${moduleCount} modules with ${relCount} dependencies. ` +
                        `Key modules include: ${parsed.modules?.slice(0, 3).join(', ')}${moduleCount > 3 ? ', and others' : ''}.`;
                }
                
                this.logger.info(`Final result: ${parsed.modules?.length || 0} modules, ${parsed.relationships?.length || 0} relationships`);
                
                return parsed as ArchitectureAnalysis;
            } catch (parseError: any) {
                this.logger.error(`JSON parse error: ${parseError.message}`);
                this.logger.error(`Failed to parse: ${cleanJson.substring(0, 500)}`);
                
                // Return a better fallback
                return {
                    modules: ['Extension', 'Scanner', 'AI Client', 'Webview'],
                    relationships: [
                        { from: 'Extension', to: 'Scanner', type: 'uses' },
                        { from: 'Extension', to: 'AI Client', type: 'uses' },
                        { from: 'Extension', to: 'Webview', type: 'displays' }
                    ],
                    summary: 'Failed to parse Ollama response. Using fallback structure.',
                    raw: text
                };
            }
        } catch (e: any) {
            this.logger.error(`Ollama analysis failed: ${e.message}`);
            this.logger.error(`Stack trace: ${e.stack}`);
            
            // Return fallback with useful data instead of empty
            return {
                modules: ['Extension', 'Scanner', 'AI', 'Webview'],
                relationships: [
                    { from: 'Extension', to: 'Scanner', type: 'uses' },
                    { from: 'Extension', to: 'AI', type: 'uses' },
                    { from: 'Extension', to: 'Webview', type: 'displays' }
                ],
                summary: `Analysis failed: ${e.message}. Check if Ollama is running.`,
                raw: e.toString()
            };
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json();
            const modelsData = data as any;
            return modelsData.models?.map((m: any) => m.name) || [];
        } catch {
            return [];
        }
    }
}
