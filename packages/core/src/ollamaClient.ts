import { ArchitectureAnalysis, FileContext, ILogger, Module, Relationship } from './types';
import * as https from 'https';
import * as http from 'http';

// Helper function to make HTTP requests
async function fetchJson(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            method: options.method || 'GET',
            headers: options.headers || {},
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

        // Detect if this is primarily a test suite
        const testFileCount = files.filter(f => 
            f.path.includes('test') || f.path.includes('spec') || 
            f.path.includes('.cy.') || f.path.includes('cypress')
        ).length;
        const isTestSuite = testFileCount > files.length / 2;

        const prompt = isTestSuite ? `You are analyzing a TEST SUITE codebase. Your task is to identify:
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

Files to analyze:
${files.map(f => `=== File: ${f.path} ===
${f.content.substring(0, 3000)}
`).join('\n\n')}

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

Files to analyze:
${files.map(f => `=== File: ${f.path} ===
${f.content.substring(0, 3000)}
`).join('\n\n')}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Start with { and end with }
3. Include ALL required fields: modules, relationships, summary, pattern, layers
4. Make sure the JSON is complete and valid
5. Do not stop mid-response - return the full JSON object

Return the complete JSON now:
`;

        try {
            // Try chat API first (better for structured output)
            let response: any;
            let useChatAPI = true;
            
            try {
                this.logger.info(`Sending POST request to ${this.baseUrl}/api/chat`);
                response = await fetchJson(`${this.baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
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
                        format: 'json',  // Request JSON format if supported
                        options: {
                            temperature: 0.0,  // Zero temperature for maximum consistency
                            num_predict: 8000, // Much higher for complete responses
                            top_p: 0.9,
                            top_k: 40,
                            stop: ['```', '```json']  // Only stop at markdown, allow newlines
                        }
                    })
                });
            } catch (chatError: any) {
                // Fallback to generate API if chat API fails
                this.logger.info(`Chat API failed, falling back to generate API: ${chatError.message}`);
                useChatAPI = false;
                this.logger.info(`Sending POST request to ${this.baseUrl}/api/generate`);
                response = await fetchJson(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.',
                        stream: false,
                        format: 'json',  // Request JSON format if supported
                        options: {
                            temperature: 0.0,  // Zero temperature for maximum consistency
                            num_predict: 8000, // Much higher for complete responses
                            top_p: 0.9,
                            top_k: 40,
                            stop: ['```', '```json']  // Only stop at markdown
                        }
                    })
                });
            }

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const responseData = await response.json();
            this.logger.info('Received response from Ollama');
            // Chat API returns message.content, generate API returns response string
            let text = '';
            
            if (useChatAPI) {
                text = responseData.message?.content || '';
                if (!text && responseData.messages && responseData.messages.length > 0) {
                    const lastMessage = responseData.messages[responseData.messages.length - 1];
                    text = lastMessage?.content || '';
                }
            } else {
                text = responseData.response || '';
            }
            
            if (!text) {
                this.logger.error('No response text found in Ollama response');
                this.logger.error(`Response structure: ${JSON.stringify(responseData).substring(0, 1000)}`);
                throw new Error('Ollama returned empty response');
            }
            
            // Log full response for debugging
            this.logger.info(`Raw response length: ${text.length} chars`);
            this.logger.info(`Raw response (first 1000 chars): ${text.substring(0, 1000)}`);
            this.logger.info(`Raw response (last 500 chars): ${text.substring(Math.max(0, text.length - 500))}`);
            
            // Check if response is suspiciously short (likely incomplete)
            if (text.length < 500) {
                this.logger.info(`⚠️ Response is short (${text.length} chars) - may be incomplete`);
                this.logger.info(`Full response: ${text}`);
                // Don't throw - try to parse what we have
            }
            
            // Check if response looks incomplete (missing closing brace)
            const openBraces = (text.match(/\{/g) || []).length;
            const closeBraces = (text.match(/\}/g) || []).length;
            if (openBraces > closeBraces && text.length < 1000) {
                this.logger.info(`⚠️ Response appears incomplete: ${openBraces} open braces, ${closeBraces} close braces`);
                // Try to complete it
                const missingBraces = openBraces - closeBraces;
                text += '\n' + '}'.repeat(missingBraces);
                this.logger.info(`Attempted to complete JSON by adding ${missingBraces} closing braces`);
            }
            
            // Save full response for error reporting
            const fullResponse = text;
            
            // Clean up the response - remove markdown code blocks first
            let cleanJson = text.trim();
            
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
                    this.logger.info('Extracted JSON using balanced brace matching');
                }
            }
            
            // Method 2: If that failed, try finding between first { and last }
            if (!jsonString.trim().startsWith('{') || jsonString.trim().length < 10) {
                const firstBrace = cleanJson.indexOf('{');
                const lastBrace = cleanJson.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = cleanJson.substring(firstBrace, lastBrace + 1);
                    this.logger.info('Extracted JSON using first/last braces');
                }
            }
            
            // Method 3: Try to fix common JSON issues
            // CRITICAL: Fix literal \n sequences that break JSON structure
            // Replace literal \n (backslash-n) that appears outside string values with space
            // This handles cases where Ollama returns formatted JSON with literal \n
            
            // First, replace literal \n sequences with actual newlines for processing
            let processedJson = jsonString;
            
            // Remove literal \n that breaks JSON structure (between tokens)
            // Pattern: } or ] followed by \n, or { or [ preceded by \n
            processedJson = processedJson.replace(/([}\]])[\s]*\\n[\s]*([,}\]])/g, '$1$2');
            processedJson = processedJson.replace(/([{,])[\s]*\\n[\s]*/g, '$1 ');
            
            // Now handle actual newlines and fix unescaped quotes - replace them with spaces outside strings
            let inString = false;
            let escapeNext = false;
            let fixedJson = '';
            for (let i = 0; i < processedJson.length; i++) {
                const char = processedJson[i];
                const nextChar = processedJson[i + 1];
                
                if (escapeNext) {
                    fixedJson += char;
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    // Check if it's a literal \n (backslash followed by n) outside a string
                    if (nextChar === 'n' && !inString) {
                        fixedJson += ' '; // Replace with space
                        i++; // Skip the 'n'
                        continue;
                    }
                    escapeNext = true;
                    fixedJson += char;
                    continue;
                }
                
                if (char === '"') {
                    if (inString) {
                        // We're inside a string - check if this quote ends the string
                        // Look ahead to see what comes after this quote
                        let lookAhead = i + 1;
                        while (lookAhead < processedJson.length && /\s/.test(processedJson[lookAhead])) {
                            lookAhead++;
                        }
                        const nextNonWhitespace = processedJson[lookAhead];
                        
                        // If next char is : , } ] or end of string, this quote ends the string
                        if (!nextNonWhitespace || nextNonWhitespace === ':' || nextNonWhitespace === ',' || 
                            nextNonWhitespace === '}' || nextNonWhitespace === ']' || nextNonWhitespace === '\n') {
                            // This is the end of the string
                            inString = false;
                            fixedJson += char;
                            continue;
                        } else {
                            // This quote is inside a string value - escape it
                            fixedJson += '\\"';
                            continue;
                        }
                    } else {
                        // Starting a new string
                        inString = true;
                        fixedJson += char;
                        continue;
                    }
                }
                
                if (!inString && (char === '\n' || char === '\r')) {
                    fixedJson += ' '; // Replace newlines outside strings with space
                    continue;
                }
                
                fixedJson += char;
            }
            jsonString = fixedJson;
            
            // Second pass: Fix unescaped quotes in string values
            // Pattern: "text"letter - quote followed by letter/digit is likely unescaped
            // Use a state machine to track if we're in a key or value
            let inString2 = false;
            let escapeNext2 = false;
            let inValue = false; // Track if we're in a value (after :)
            let resultJson = '';
            
            for (let i = 0; i < jsonString.length; i++) {
                const char = jsonString[i];
                
                if (escapeNext2) {
                    resultJson += char;
                    escapeNext2 = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext2 = true;
                    resultJson += char;
                    continue;
                }
                
                if (char === ':') {
                    inValue = true;
                    resultJson += char;
                    continue;
                }
                
                if (char === ',' || char === '{' || char === '[') {
                    inValue = false;
                    resultJson += char;
                    continue;
                }
                
                if (char === '"') {
                    if (inString2) {
                        // We're inside a string - check if this quote should end it or be escaped
                        let j = i + 1;
                        while (j < jsonString.length && /\s/.test(jsonString[j])) {
                            j++;
                        }
                        const nextChar = jsonString[j];
                        
                        // If we're in a value and next char is a letter/digit, escape the quote
                        // This handles cases like "user"s" -> "user\"s"
                        if (inValue && nextChar && /[a-zA-Z0-9]/.test(nextChar)) {
                            resultJson += '\\"';
                            continue;
                        }
                        
                        // Otherwise, check if this ends the string
                        if (!nextChar || nextChar === ':' || nextChar === ',' || 
                            nextChar === '}' || nextChar === ']' || nextChar === '\n') {
                            inString2 = false;
                            resultJson += char;
                        } else {
                            // Safe to escape - likely unescaped quote
                            resultJson += '\\"';
                            continue;
                        }
                    } else {
                        inString2 = true;
                        resultJson += char;
                    }
                } else {
                    resultJson += char;
                }
            }
            jsonString = resultJson;
            
            // Fix trailing commas before closing brackets/braces
            jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
            
            // Don't replace single quotes - they might be apostrophes in text
            // Only replace single quotes that are clearly meant to be string delimiters
            // (surrounded by whitespace or at start/end of values)
            jsonString = jsonString.replace(/:\s*'([^']*)'/g, ': "$1"');
            jsonString = jsonString.replace(/'\s*:/g, '" :');
            
            // Remove comments (basic)
            jsonString = jsonString.replace(/\/\/.*$/gm, '');
            jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // Fix missing quotes around keys
            jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            
            // Fix missing quotes around string values (but not numbers/booleans)
            jsonString = jsonString.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, (_match: string, value: string, end: string) => {
                if (value !== 'true' && value !== 'false' && value !== 'null' && isNaN(Number(value))) {
                    return `: "${value}"${end}`;
                }
                return _match;
            });
            
            this.logger.info(`Cleaned JSON length: ${jsonString.length} chars`);
            this.logger.info(`JSON to parse: ${jsonString.substring(0, 300)}...`);
            
            try {
                const parsed = JSON.parse(jsonString);
                this.logger.info(`✅ Parsed successfully!`);
                this.logger.info(`Parsed keys: ${Object.keys(parsed).join(', ')}`);
                
                // Normalize modules to new format if they're simple strings
                if (parsed.modules && Array.isArray(parsed.modules)) {
                    this.logger.info(`Processing ${parsed.modules.length} modules...`);
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
                        // Ensure required fields exist - handle missing path field
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
                
                // Normalize relationships - handle different formats
                if (parsed.relationships && Array.isArray(parsed.relationships)) {
                    parsed.relationships = parsed.relationships.map((r: any) => {
                        // Handle different relationship formats
                        let from = r.from || r.parentModule || r.source || r.parent || '';
                        let to = r.to || r.childModule || r.target || r.child || '';
                        
                        // If it's an array format (childModules)
                        if (r.childModules && Array.isArray(r.childModules)) {
                            return r.childModules.map((child: string) => ({
                                from: from,
                                to: child,
                                type: r.type || 'uses',
                                strength: r.strength || 'medium',
                                description: r.description || ''
                            }));
                        }
                        
                        // If from/to are missing, try to infer from module names
                        if (!from || !to) {
                            // Try to match module names from the relationships
                            const allModulePaths = parsed.modules?.map((m: any) => m.path || m.name || '') || [];
                            const allModuleNames = parsed.modules?.map((m: any) => m.name || '') || [];
                            
                            // Try to find matching module paths/names
                            if (!from && r.parentModule) {
                                from = allModulePaths.find((p: string) => p.includes(r.parentModule) || p === r.parentModule) || 
                                       allModuleNames.find((n: string) => n === r.parentModule) || '';
                            }
                            if (!to && r.childModule) {
                                to = allModulePaths.find((p: string) => p.includes(r.childModule) || p === r.childModule) || 
                                     allModuleNames.find((n: string) => n === r.childModule) || '';
                            }
                        }
                        
                        return {
                            from: from,
                            to: to,
                            type: r.type || 'depends',
                            strength: r.strength || 'medium',
                            description: r.description || ''
                        };
                    }).flat().filter((r: any) => r.from && r.to && r.from.length > 0 && r.to.length > 0); // Filter out invalid relationships
                }
                
                // If relationships are missing or empty, try to infer from module structure
                if (!parsed.relationships || parsed.relationships.length === 0) {
                    parsed.relationships = this.inferRelationships(parsed.modules || [], files);
                }
                
                // Validate and provide defaults
                if (!parsed.modules || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
                    this.logger.error(`Response has invalid/empty modules field`);
                    parsed.modules = files.map(f => ({
                        name: f.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || f.path,
                        path: f.path,
                        type: this.inferModuleType(f.path),
                        layer: 'other' as const,
                        description: ''
                    }));
                }
                
                if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
                    this.logger.error(`Response has invalid relationships field`);
                    parsed.relationships = [];
                }
                
                if (!parsed.summary) {
                    const moduleCount = parsed.modules?.length || 0;
                    const relCount = parsed.relationships?.length || 0;
                    parsed.summary = `This codebase consists of ${moduleCount} modules with ${relCount} dependencies.`;
                }
                
                // Normalize pattern - handle string or object format
                if (!parsed.pattern) {
                    parsed.pattern = this.inferArchitecturalPattern(parsed);
                } else if (typeof parsed.pattern === 'string') {
                    // Convert string pattern to object format
                    const patternName = parsed.pattern as string;
                    const patternMatch = patternName.match(/(MVC|Layered|Microservices|Event-Driven|Client-Server|Monolithic|Modular|Component-Based)/i)?.[0];
                    parsed.pattern = {
                        name: (patternMatch || 'Unknown') as any,
                        confidence: patternMatch ? 0.8 : 0.5,
                        description: patternName
                    };
                } else if (parsed.pattern && typeof parsed.pattern === 'object') {
                    // Normalize pattern name - handle variations
                    let patternName = parsed.pattern.name || 'Unknown';
                    if (typeof patternName === 'string') {
                        // Normalize common variations
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
                            patternName = 'Layered'; // Treat modular/component-based as layered
                        }
                    }
                    
                    // Ensure pattern has required fields
                    parsed.pattern = {
                        name: patternName as any,
                        confidence: parsed.pattern.confidence || (patternName !== 'Unknown' ? 0.7 : 0.3),
                        description: parsed.pattern.description || `Architecture pattern: ${patternName}`
                    };
                    
                    // If still Unknown, try to infer from structure
                    if (patternName === 'Unknown' && parsed.pattern.confidence < 0.5) {
                        const inferred = this.inferArchitecturalPattern(parsed);
                        if (inferred && inferred.name !== 'Unknown') {
                            parsed.pattern = inferred;
                        }
                    }
                }
                
                // Normalize layers - ensure modules are mapped to layers
                if (!parsed.layers || parsed.layers.length === 0) {
                    parsed.layers = this.groupByLayers(parsed.modules);
                } else {
                    // If layers exist but modules aren't mapped, try to map them
                    parsed.layers = this.normalizeLayers(parsed.layers, parsed.modules);
                }
                
                if (!parsed.entryPoints) {
                    parsed.entryPoints = this.findEntryPoints(parsed.modules);
                }
                
                this.logger.info(`Final result: ${parsed.modules?.length || 0} modules, ${parsed.relationships?.length || 0} relationships`);
                
                return parsed as ArchitectureAnalysis;
            } catch (parseError: any) {
                this.logger.error(`❌ JSON parse error: ${parseError.message}`);
                const errorPos = parseError.message.match(/position (\d+)/)?.[1] || 'unknown';
                this.logger.error(`Parse error at position: ${errorPos}`);
                this.logger.error(`Failed JSON (first 1000 chars): ${jsonString.substring(0, 1000)}`);
                this.logger.error(`Failed JSON (last 500 chars): ${jsonString.substring(Math.max(0, jsonString.length - 500))}`);
                if (errorPos !== 'unknown') {
                    const pos = parseInt(errorPos);
                    const start = Math.max(0, pos - 100);
                    const end = Math.min(jsonString.length, pos + 100);
                    this.logger.error(`Failed JSON (around error position ${pos}): ${jsonString.substring(start, end)}`);
                }
                this.logger.error(`Full raw response saved for debugging`);
                
                // Try additional recovery methods
                let recovered = false;
                let parsed: any = null;
                
                // Method 1: Try to extract JSON fields using regex
                try {
                    const modulesMatch = jsonString.match(/"modules"\s*:\s*\[([\s\S]*?)\](?=\s*[,}])/);
                    const relationshipsMatch = jsonString.match(/"relationships"\s*:\s*\[([\s\S]*?)\](?=\s*[,}])/);
                    const summaryMatch = jsonString.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                    const patternMatch = jsonString.match(/"pattern"\s*:\s*\{([\s\S]*?)\}(?=\s*[,}])/);
                    
                    if (modulesMatch) {
                        try {
                            const modules = JSON.parse(`[${modulesMatch[1]}]`);
                            parsed = {
                                modules: modules,
                                relationships: relationshipsMatch ? (() => {
                                    try {
                                        return JSON.parse(`[${relationshipsMatch[1]}]`);
                                    } catch {
                                        return [];
                                    }
                                })() : [],
                                summary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : 'Analysis completed',
                                pattern: patternMatch ? (() => {
                                    try {
                                        return JSON.parse(`{${patternMatch[1]}}`);
                                    } catch {
                                        return { name: 'Unknown', confidence: 0.5, description: '' };
                                    }
                                })() : { name: 'Unknown', confidence: 0.5, description: '' },
                            };
                            recovered = true;
                            this.logger.info('✓ Recovered JSON using regex field extraction');
                        } catch (e) {
                            this.logger.error('Failed to parse extracted modules');
                        }
                    }
                } catch (recoveryError) {
                    this.logger.error('Recovery method 1 failed');
                }
                
                // Method 2: Try fixing common JSON issues and re-parsing
                if (!recovered) {
                    try {
                        let fixedJson = jsonString;
                        // Fix trailing commas
                        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
                        // Fix unclosed strings at end of lines
                        fixedJson = fixedJson.replace(/"([^"]*)\n/g, '"$1\\n');
                        // Try to balance braces
                        const openBraces = (fixedJson.match(/\{/g) || []).length;
                        const closeBraces = (fixedJson.match(/\}/g) || []).length;
                        if (openBraces > closeBraces) {
                            fixedJson += '}'.repeat(openBraces - closeBraces);
                        }
                        
                        parsed = JSON.parse(fixedJson);
                        recovered = true;
                        this.logger.info('✓ Recovered JSON after fixing common issues');
                    } catch (recoveryError) {
                        this.logger.error('Recovery method 2 failed');
                    }
                }
                
                // Method 3: Try to build minimal valid JSON from fragments
                if (!recovered) {
                    try {
                        // Extract modules as array of strings if objects fail
                        const modulePaths: string[] = [];
                        const moduleMatches = jsonString.matchAll(/"path"\s*:\s*"([^"]+)"/g);
                        for (const match of moduleMatches) {
                            modulePaths.push(match[1]);
                        }
                        
                        // Also try extracting from name fields if path extraction failed
                        if (modulePaths.length === 0) {
                            const nameMatches = jsonString.matchAll(/"name"\s*:\s*"([^"]+)"/g);
                            const names: string[] = [];
                            for (const match of nameMatches) {
                                names.push(match[1]);
                            }
                            // Use file paths as fallback
                            if (names.length > 0) {
                                modulePaths.push(...files.slice(0, names.length).map(f => f.path));
                            }
                        }
                        
                        if (modulePaths.length > 0) {
                            parsed = {
                                modules: modulePaths.map(path => ({
                                    name: path.split('/').pop()?.replace(/\.[^/.]+$/, '') || path,
                                    path: path,
                                    type: this.inferModuleType(path),
                                    layer: 'other' as const,
                                    description: ''
                                })),
                                relationships: [],
                                summary: `Found ${modulePaths.length} modules in codebase`,
                                pattern: { name: 'Unknown', confidence: 0.3, description: 'Partial analysis due to parsing issues' }
                            };
                            recovered = true;
                            this.logger.info(`✓ Recovered ${modulePaths.length} modules from path extraction`);
                        }
                    } catch (recoveryError) {
                        this.logger.error('Recovery method 3 failed');
                    }
                }
                
                // Method 4: Last resort - try to extract ANY JSON-like structure and fix it aggressively
                if (!recovered) {
                    try {
                        // Look for any JSON-like structure
                        let attemptJson = jsonString;
                        
                        // Remove everything before first { and after last }
                        const firstBrace = attemptJson.indexOf('{');
                        const lastBrace = attemptJson.lastIndexOf('}');
                        if (firstBrace >= 0 && lastBrace > firstBrace) {
                            attemptJson = attemptJson.substring(firstBrace, lastBrace + 1);
                        }
                        
                        // Aggressive fixes
                        attemptJson = attemptJson.replace(/,(\s*[}\]])/g, '$1'); // Trailing commas
                        attemptJson = attemptJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // Unquoted keys
                        attemptJson = attemptJson.replace(/:\s*([^",\[\]{}]+?)(\s*[,}\]])/g, (_match: string, value: string, end: string) => {
                            const trimmed = value.trim();
                            if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null' || !isNaN(Number(trimmed)) || trimmed === '') {
                                return _match;
                            }
                            return `: "${trimmed}"${end}`;
                        });
                        
                        // Balance braces
                        const openCount = (attemptJson.match(/\{/g) || []).length;
                        const closeCount = (attemptJson.match(/\}/g) || []).length;
                        if (openCount > closeCount) {
                            attemptJson += '}'.repeat(openCount - closeCount);
                        }
                        
                        parsed = JSON.parse(attemptJson);
                        recovered = true;
                        this.logger.info('✓ Recovered JSON using aggressive fixing');
                    } catch (e) {
                        this.logger.error('Recovery method 4 failed');
                    }
                }
                
                // If recovery succeeded, validate and return
                if (recovered && parsed) {
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
                        parsed.summary = `This codebase consists of ${parsed.modules.length} modules with ${parsed.relationships.length} dependencies.`;
                    }
                    
                    if (!parsed.pattern) {
                        parsed.pattern = this.inferArchitecturalPattern(parsed);
                    }
                    
                    if (!parsed.layers) {
                        parsed.layers = this.groupByLayers(parsed.modules);
                    }
                    
                    this.logger.info(`✓ Using recovered JSON: ${parsed.modules.length} modules`);
                    return parsed as ArchitectureAnalysis;
                }
                
                // Try to identify the issue
                if (!jsonString.includes('"modules"')) {
                    this.logger.error('Response is missing "modules" field!');
                }
                if (!jsonString.includes('"summary"')) {
                    this.logger.error('Response is missing "summary" field!');
                }
                
                // Return fallback with analyzed file structure
                const fallbackModules = files.map(f => ({
                    name: f.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || f.path,
                    path: f.path,
                    type: this.inferModuleType(f.path),
                    layer: 'other' as const,
                    description: ''
                }));
                
                // Try one more time with a simpler approach - extract just module names
                if (!recovered) {
                    try {
                        // Look for any JSON-like structure with modules
                        const simpleModulesMatch = jsonString.match(/"modules"\s*:\s*\[(.*?)\]/s);
                        if (simpleModulesMatch) {
                            // Try to extract individual module objects
                            const moduleObjects = simpleModulesMatch[1].match(/\{[^}]*"path"\s*:\s*"[^"]+"[^}]*\}/g);
                            if (moduleObjects && moduleObjects.length > 0) {
                                const extractedModules: any[] = [];
                                for (const moduleStr of moduleObjects) {
                                    try {
                                        const moduleObj = JSON.parse(moduleStr);
                                        extractedModules.push(moduleObj);
                                    } catch {
                                        // Try to extract path and name
                                        const pathMatch = moduleStr.match(/"path"\s*:\s*"([^"]+)"/);
                                        const nameMatch = moduleStr.match(/"name"\s*:\s*"([^"]+)"/);
                                        if (pathMatch) {
                                            extractedModules.push({
                                                name: nameMatch ? nameMatch[1] : pathMatch[1].split('/').pop()?.replace(/\.[^/.]+$/, '') || pathMatch[1],
                                                path: pathMatch[1],
                                                type: this.inferModuleType(pathMatch[1]),
                                                layer: 'other' as const,
                                                description: ''
                                            });
                                        }
                                    }
                                }
                                if (extractedModules.length > 0) {
                                    parsed = {
                                        modules: extractedModules,
                                        relationships: [],
                                        summary: `Extracted ${extractedModules.length} modules from partial response`,
                                        pattern: { name: 'Unknown', confidence: 0.3, description: 'Partial analysis - JSON parsing had issues' }
                                    };
                                    recovered = true;
                                    this.logger.info(`✓ Recovered ${extractedModules.length} modules using simple extraction`);
                                }
                            }
                        }
                    } catch (e) {
                        this.logger.error('Final recovery attempt failed');
                    }
                }
                
                return {
                    modules: recovered && parsed ? parsed.modules : fallbackModules,
                    relationships: recovered && parsed ? parsed.relationships : [],
                    summary: recovered && parsed ? parsed.summary : `Failed to parse Ollama response. Using fallback structure based on file analysis. The AI response may have been malformed. Check server logs for details. Raw response length: ${fullResponse.length} chars.`,
                    pattern: recovered && parsed ? parsed.pattern : {
                        name: 'Unknown',
                        confidence: 0,
                        description: 'Could not determine architectural pattern - JSON parse failed'
                    },
                    layers: recovered && parsed ? parsed.layers : this.groupByLayers(fallbackModules),
                    raw: fullResponse.substring(0, 2000) // Save more for debugging
                };
            }
        } catch (e: any) {
            this.logger.error(`Ollama analysis failed: ${e.message}`);
            this.logger.error(`Error type: ${e.constructor?.name || 'Unknown'}`);
            this.logger.error(`Error code: ${e.code || 'N/A'}`);
            this.logger.error(`Stack trace: ${e.stack || 'N/A'}`);
            
            // More specific error messages
            if (e.message?.includes('fetch failed') || e.code === 'ECONNREFUSED') {
                this.logger.error(`Cannot connect to Ollama at ${this.baseUrl}`);
                this.logger.error(`Make sure Ollama is running: ollama serve`);
                this.logger.error(`Or check if Ollama is on a different port`);
            }
            
            // Return fallback with useful data instead of empty
            const fallbackModules = files.map(f => ({
                name: f.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || f.path,
                path: f.path,
                type: this.inferModuleType(f.path),
                layer: 'other' as const,
                description: ''
            }));
            
            return {
                modules: fallbackModules,
                relationships: [],
                summary: `Analysis failed: ${e.message}. Ensure Ollama is running at ${this.baseUrl}`,
                pattern: {
                    name: 'Unknown',
                    confidence: 0,
                    description: 'Analysis failed - cannot connect to Ollama'
                },
                layers: this.groupByLayers(fallbackModules),
                raw: e.toString()
            };
        }
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
                headers: { 'Content-Type': 'application/json' }
            });
            this.logger.info(`Health check response: ${response.ok} (status: ${response.status})`);
            return response.ok;
        } catch (error: any) {
            this.logger.error(`Health check failed: ${error.message}`);
            this.logger.error(`Error code: ${error.code || 'unknown'}`);
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
