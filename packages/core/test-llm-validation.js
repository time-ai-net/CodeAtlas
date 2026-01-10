/**
 * Test script to verify LLM endpoint validation
 * Run with: node packages/core/test-llm-validation.js
 */

const { OllamaClient } = require('./dist/ollamaClient');
const { ConsoleLogger } = require('./dist/logger');

class TestLogger {
    info(msg) { console.log(`[INFO] ${msg}`); }
    error(msg) { console.error(`[ERROR] ${msg}`); }
    warn(msg) { console.warn(`[WARN] ${msg}`); }
}

async function testValidation() {
    console.log('🧪 Testing LLM Endpoint Validation\n');
    
    const logger = new TestLogger();
    const client = new OllamaClient(logger, 'qwen2.5-coder:3b', 'http://localhost:11434');
    
    // Test with mock files
    const mockFiles = [
        { path: 'test1.py', content: 'def hello(): pass' },
        { path: 'test2.py', content: 'def world(): pass' }
    ];
    
    console.log('1. Testing health check...');
    const health = await client.checkHealth();
    console.log(`   Health check: ${health ? '✓ PASS' : '✗ FAIL'}\n`);
    
    console.log('2. Testing analysis (will validate LLM endpoint)...');
    try {
        const startTime = Date.now();
        const result = await client.analyze(mockFiles);
        const duration = Date.now() - startTime;
        
        console.log(`\n✓ Analysis completed in ${Math.round(duration / 1000)}s`);
        console.log(`  Modules: ${result.modules?.length || 0}`);
        console.log(`  Relationships: ${result.relationships?.length || 0}`);
        console.log(`  Pattern: ${result.pattern?.name || 'Unknown'}`);
        console.log(`  Summary: ${result.summary?.substring(0, 100) || 'N/A'}...`);
        
        if (result.summary?.includes('Fallback')) {
            console.log('\n⚠️  WARNING: Analysis used fallback - LLM endpoint may not be working');
        } else {
            console.log('\n✓ SUCCESS: LLM endpoint is working correctly');
        }
    } catch (error) {
        console.error(`\n✗ Analysis failed: ${error.message}`);
        console.error(`  Stack: ${error.stack}`);
    }
}

testValidation().catch(console.error);

