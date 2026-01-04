import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { CodeAtlasPanel } from './webview/Panel';
import { scanWorkspace } from './scanner/fileScanner';
import { OllamaClient } from './ai/ollamaClient';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize();
    Logger.info('CodeAtlas is now active!');

    let disposable = vscode.commands.registerCommand('CodeAtlas.analyze', async () => {
        try {
            const separator = '='.repeat(60);
            console.log('\n' + separator);
            console.log('🚀 CodeAtlas: Starting analysis...');
            console.log(separator);
            
            vscode.window.showInformationMessage('CodeAtlas: Starting analysis...');
            Logger.info('Starting analysis...');
            Logger.info(separator);

            // 1. Show Loading Panel
            CodeAtlasPanel.createOrShow(context.extensionUri);

            // 2. Scan
            console.log('\n📁 STEP 1: Scanning workspace files...');
            Logger.info('Step 1: Scanning workspace files...');
            const files = await scanWorkspace();
            console.log(`✅ Scanned ${files.length} files`);
            Logger.info(`✅ Scanned ${files.length} files.`);
            
            if (files.length === 0) {
                const msg = 'No files found to analyze. Make sure your workspace has code files.';
                console.error('❌ ' + msg);
                vscode.window.showWarningMessage(msg);
                Logger.error('No files to analyze');
                if (CodeAtlasPanel.currentPanel) {
                    CodeAtlasPanel.currentPanel.update({
                        modules: [],
                        relationships: [],
                        summary: 'No source files found. Make sure you have code files in your workspace.'
                    });
                }
                return;
            }
            
            // Log first few files for debugging
            const filesList = files.slice(0, 5).map(f => f.path).join(', ');
            console.log(`📄 First files: ${filesList}`);
            Logger.info(`First files: ${filesList}`);

            // 3. Analyze with Ollama
            console.log('\n🔧 STEP 2: Setting up Ollama client...');
            Logger.info('Step 2: Setting up Ollama client...');
            const loggerAdapter = {
                info: (msg: string) => {
                    console.log('ℹ️  ' + msg);
                    Logger.info(msg);
                },
                error: (err: any) => {
                    console.error('❌ ' + err);
                    Logger.error(err);
                }
            };

            // Get model from configuration or use default
            const config = vscode.workspace.getConfiguration('CodeAtlas');
            const model = config.get<string>('ollamaModel', 'qwen2.5-coder:3b');
            const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');

            console.log(`🤖 Using Ollama model: ${model} at ${ollamaUrl}`);
            Logger.info(`Using Ollama model: ${model} at ${ollamaUrl}`);

            const client = new OllamaClient(loggerAdapter, model, ollamaUrl);
            
            // Check if Ollama is running
            console.log('\n🔍 STEP 3: Checking Ollama connection...');
            Logger.info('Step 3: Checking Ollama connection...');
            const isHealthy = await client.checkHealth();
            if (!isHealthy) {
                const errorMsg = `Ollama is not running at ${ollamaUrl}. Please start Ollama first.`;
                console.error('❌ ' + errorMsg);
                vscode.window.showErrorMessage(errorMsg);
                Logger.error(errorMsg);
                Logger.error('Run: ollama serve');
                if (CodeAtlasPanel.currentPanel) {
                    CodeAtlasPanel.currentPanel.update({
                        modules: [],
                        relationships: [],
                        summary: `Error: ${errorMsg}`
                    });
                }
                return;
            }
            console.log('✅ Ollama is running');
            Logger.info('✅ Ollama is running');

            // Check if model is available
            console.log('\n📦 STEP 4: Checking if model is available...');
            Logger.info('Step 4: Checking if model is available...');
            const models = await client.listModels();
            console.log(`Available models: ${models.join(', ')}`);
            Logger.info(`Available models: ${models.join(', ')}`);
            
            if (!models.includes(model)) {
                const msg = `Model '${model}' not found.`;
                console.error('❌ ' + msg);
                const pullIt = await vscode.window.showWarningMessage(
                    `Model '${model}' not found. Would you like to pull it?`,
                    'Yes', 'No'
                );
                
                if (pullIt === 'Yes') {
                    vscode.window.showInformationMessage(`Pulling ${model}... This may take a few minutes.`);
                    console.log(`Run: ollama pull ${model}`);
                    Logger.info(`Run: ollama pull ${model}`);
                    vscode.window.showInformationMessage(`Please run in terminal: ollama pull ${model}`);
                }
                if (CodeAtlasPanel.currentPanel) {
                    CodeAtlasPanel.currentPanel.update({
                        modules: [],
                        relationships: [],
                        summary: `Model ${model} not found. Run: ollama pull ${model}`
                    });
                }
                return;
            }
            console.log(`✅ Model ${model} is available`);
            Logger.info(`✅ Model ${model} is available`);

            console.log('\n🧠 STEP 5: Analyzing code with Ollama...');
            Logger.info('Step 5: Analyzing code with Ollama...');
            console.log('⏱️  This may take 10-60 seconds. Please wait...');
            const analysis = await client.analyze(files);

            console.log('\n' + separator);
            console.log('📊 STEP 6: Analysis Results');
            console.log(separator);
            console.log(`Modules found: ${analysis.modules?.length || 0}`);
            console.log(`Relationships found: ${analysis.relationships?.length || 0}`);
            console.log(`Summary length: ${analysis.summary?.length || 0} chars`);
            
            Logger.info(separator);
            Logger.info('Step 6: Analysis completed!');
            Logger.info(`Modules found: ${analysis.modules?.length || 0}`);
            Logger.info(`Relationships found: ${analysis.relationships?.length || 0}`);
            Logger.info(`Summary: ${analysis.summary?.substring(0, 100) || 'None'}...`);
            
            if (analysis.modules && analysis.modules.length > 0) {
                console.log('First 5 modules: ' + analysis.modules.slice(0, 5).join(', '));
                Logger.info('First 5 modules: ' + analysis.modules.slice(0, 5).join(', '));
            }
            
            if (analysis.relationships && analysis.relationships.length > 0) {
                console.log('First 3 relationships: ' + analysis.relationships.slice(0, 3).map(r => `${r.from}->${r.to}`).join(', '));
                Logger.info('First 3 relationships: ' + analysis.relationships.slice(0, 3).map(r => `${r.from}->${r.to}`).join(', '));
            }
            
            if ((!analysis.modules || analysis.modules.length === 0) && 
                (!analysis.relationships || analysis.relationships.length === 0)) {
                console.error('⚠️ WARNING: Analysis returned empty results!');
                Logger.error('⚠️ WARNING: Analysis returned empty results!');
                if (analysis.raw) {
                    console.error('Raw response: ' + analysis.raw.substring(0, 500));
                    Logger.error('Raw response: ' + analysis.raw.substring(0, 500));
                }
            }
            console.log(separator + '\n');
            Logger.info(separator);

            // 4. Update Panel
            if (CodeAtlasPanel.currentPanel) {
                console.log('✅ Updating panel with analysis...');
                Logger.info('Updating panel with analysis...');
                CodeAtlasPanel.currentPanel.update(analysis);
                vscode.window.showInformationMessage(`✅ Analysis complete! Found ${analysis.modules?.length || 0} modules and ${analysis.relationships?.length || 0} relationships.`);
            } else {
                console.error('❌ Panel was closed before analysis completed');
                Logger.error('Panel was closed before analysis completed');
                vscode.window.showWarningMessage('Panel was closed. Run the command again to see results.');
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`CodeAtlas Error: ${error.message}`);
            Logger.error(error);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
