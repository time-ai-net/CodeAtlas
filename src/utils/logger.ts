import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel | undefined;

    public static initialize() {
        // Only run VS Code specific logic if we are in VS Code context
        // In standalone script, this might still be called but we can't depend on vscode.window being present if not in extension host
        // However, this file imports 'vscode' at top level. 
        // This will crash node.js script.
        try {
            this.outputChannel = vscode.window.createOutputChannel('CodeAtlas');
        } catch (e) {
            // Context likely not available
        }
    }

    public static info(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[INFO] ${message}`);
        } else {
            console.log(`[INFO] ${message}`);
        }
    }

    public static error(error: any) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[ERROR] ${error}`);
        } else {
            console.error(`[ERROR] ${error}`);
        }
        console.error(error);
    }
}
