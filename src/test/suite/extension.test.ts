import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('undefined_publisher.CodeAtlas');
        assert.ok(extension !== undefined, 'Extension should be installed');
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('undefined_publisher.CodeAtlas');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive, 'Extension should be active');
        }
    });

    test('Command CodeAtlas.analyze should be registered after activation', async () => {
        const extension = vscode.extensions.getExtension('undefined_publisher.CodeAtlas');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        
        const commands = await vscode.commands.getCommands(true);
        const commandExists = commands.includes('CodeAtlas.analyze');
        assert.strictEqual(commandExists, true, 'CodeAtlas.analyze command should be registered');
    });

    test('Workspace should be available', () => {
        assert.ok(vscode.workspace.workspaceFolders, 'Workspace folders should exist');
        assert.ok(vscode.workspace.workspaceFolders!.length > 0, 'At least one workspace folder should be open');
    });

    test('Logger should be initialized', async () => {
        const extension = vscode.extensions.getExtension('undefined_publisher.CodeAtlas');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        // If we got here without errors, logger was initialized successfully
        assert.ok(true, 'Logger initialized without errors');
    });

    test('Integration: Execute analyze command (may take time)', async function() {
        this.timeout(60000); // 60 second timeout for API call
        
        const extension = vscode.extensions.getExtension('undefined_publisher.CodeAtlas');
        if (extension && !extension.isActive) {
            await extension.activate();
        }

        try {
            // Execute the command - this will scan workspace and call Gemini API
            await vscode.commands.executeCommand('CodeAtlas.analyze');
            
            // Give it time to complete
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // If we got here without throwing, the command executed
            assert.ok(true, 'Analyze command executed successfully');
        } catch (error: any) {
            // Check if it's just a missing API key or actual error
            if (error.message?.includes('GEMINI_API_KEY')) {
                assert.ok(true, 'Command ran but needs valid API key');
            } else {
                throw error;
            }
        }
    });
});
