import { ArchitectureAnalysis, FileContext, ILogger } from './types';
import * as https from 'https';

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

export class GeminiClient {
    private apiKey: string;
    private model: string;
    private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(
        private logger: ILogger,
        apiKey: string,
        model: string = 'gemini-2.0-flash'
    ) {
        this.apiKey = apiKey;
        this.model = model;
        
        if (!this.apiKey) {
            throw new Error('Gemini API key is required. Set GEMINI_API_KEY in environment or configuration.');
        }
    }

    /**
     * Check if Gemini API is accessible
     */
    async checkHealth(): Promise<boolean> {
        try {
            this.logger.info('Checking Gemini API connection...');
            const url = `${this.baseUrl}/models?key=${this.apiKey}`;
            
            const response = await this.fetchJson(url);
            
            if (!response.ok) {
                this.logger.error(`Gemini API returned status: ${response.status}`);
                return false;
            }

            const data = await response.json();
            const availableModels = data.models?.map((m: any) => m.name) || [];
            
            this.logger.info(`✓ Gemini API connected. Available models: ${availableModels.length}`);
            
            // Check if requested model is available
            const modelPath = `models/${this.model}`;
            const modelAvailable = availableModels.some((m: string) => m === modelPath);
            
            if (!modelAvailable) {
                this.logger.error(`Requested model '${this.model}' not found. Available: ${availableModels.slice(0, 5).join(', ')}`);
                return false;
            }
            
            this.logger.info(`✓ Model '${this.model}' is available`);
            return true;
        } catch (error: any) {
            this.logger.error(`Gemini health check failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Analyze codebase using Gemini
     */
    async analyze(files: FileContext[]): Promise<ArchitectureAnalysis> {
        this.logger.info(`Analyzing with Gemini (${this.model})...`);
        this.logger.info(`Processing ${files.length} files`);

        // Detect if this is primarily a test suite
        const testFileCount = files.filter(f => 
            f.path.includes('test') || f.path.includes('spec') || 
            f.path.includes('.cy.') || f.path.includes('cypress')
        ).length;
        const isTestSuite = testFileCount > files.length / 2;

        const prompt = this.buildPrompt(files, isTestSuite);

        try {
            const response = await this.callGemini(prompt);
            this.logger.info('✓ Received response from Gemini');
            
            // Parse and validate the response
            const analysis = this.parseResponse(response);
            return analysis;
        } catch (error: any) {
            this.logger.error(`Gemini analysis failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build the analysis prompt
     */
    private buildPrompt(files: FileContext[], isTestSuite: boolean): string {
        if (isTestSuite) {
            return this.buildTestSuitePrompt(files);
        } else {
            return this.buildCodebasePrompt(files);
        }
    }

    private buildTestSuitePrompt(files: FileContext[]): string {
        const filesList = files.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n---\n\n');

        return `You are analyzing a TEST SUITE codebase. Your task is to identify:
1. MODULES: List each test file and support file
2. RELATIONSHIPS: Show how test files use support files, commands, or utilities
3. SUMMARY: Describe what this test suite tests and its structure

For TEST SUITES, modules should represent:
- Test spec files (the actual tests)
- Support files (commands, utilities)
- Configuration files
- Fixtures or helpers

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
            "name": "Tests",
            "modules": ["cypress/e2e/01-landing.cy.js"],
            "level": 1
        },
        {
            "name": "Support",
            "modules": ["cypress/support/commands.js"],
            "level": 2
        }
    ],
    "summary": "Cypress E2E test suite covering various features"
}

Files to analyze:

${filesList}`;
    }

    private buildCodebasePrompt(files: FileContext[]): string {
        const filesList = files.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n---\n\n');

        return `Analyze this codebase and identify its architecture.

Return ONLY valid JSON in this exact format:
{
    "modules": [
        {
            "name": "UserService",
            "path": "src/services/userService.ts",
            "type": "service",
            "layer": "business",
            "description": "Handles user-related operations"
        }
    ],
    "relationships": [
        {
            "from": "src/controllers/userController.ts",
            "to": "src/services/userService.ts",
            "type": "depends-on",
            "strength": "strong",
            "description": "Controller uses service for business logic"
        }
    ],
    "pattern": {
        "name": "Layered Architecture",
        "confidence": 0.9,
        "description": "Clear separation between controllers, services, and data layers"
    },
    "layers": [
        {
            "name": "Presentation",
            "modules": ["src/controllers/userController.ts"],
            "level": 1
        },
        {
            "name": "Business Logic",
            "modules": ["src/services/userService.ts"],
            "level": 2
        }
    ],
    "summary": "Application follows layered architecture with clear separation of concerns"
}

Files to analyze:

${filesList}`;
    }

    /**
     * Call Gemini API
     */
    private async callGemini(prompt: string): Promise<string> {
        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            }
        };

        this.logger.info(`Sending request to Gemini API (model: ${this.model})...`);
        
        const response = await this.fetchJson(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        const data: GeminiResponse = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response from Gemini API');
        }

        const text = data.candidates[0].content.parts[0].text;
        return text;
    }

    /**
     * Parse Gemini response into ArchitectureAnalysis
     */
    private parseResponse(responseText: string): ArchitectureAnalysis {
        this.logger.info('Parsing Gemini response...');
        
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = responseText.trim();
        
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
        }

        try {
            const parsed = JSON.parse(jsonStr);
            
            // Validate required fields
            if (!parsed.modules || !Array.isArray(parsed.modules)) {
                throw new Error('Invalid response: missing or invalid modules array');
            }
            
            if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
                throw new Error('Invalid response: missing or invalid relationships array');
            }

            // Ensure all required fields exist
            const analysis: ArchitectureAnalysis = {
                modules: parsed.modules,
                relationships: parsed.relationships,
                pattern: parsed.pattern || {
                    name: 'Unknown',
                    confidence: 0.5,
                    description: 'Architecture pattern could not be determined'
                },
                layers: parsed.layers || [],
                summary: parsed.summary || 'Architecture analysis completed'
            };

            this.logger.info(`✓ Parsed ${analysis.modules.length} modules and ${analysis.relationships.length} relationships`);
            return analysis;
        } catch (error: any) {
            this.logger.error(`Failed to parse Gemini response: ${error.message}`);
            this.logger.error(`Response text: ${responseText.substring(0, 500)}...`);
            throw new Error(`Failed to parse Gemini response: ${error.message}`);
        }
    }

    /**
     * Helper function to make HTTPS requests
     */
    private fetchJson(url: string, options: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            
            const requestOptions = {
                method: options.method || 'GET',
                headers: options.headers || {},
            };
            
            const req = https.request(url, requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ 
                            ok: res.statusCode! >= 200 && res.statusCode! < 300, 
                            status: res.statusCode, 
                            json: async () => parsed 
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e}`));
                    }
                });
            });
            
            req.on('error', reject);
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }
}
