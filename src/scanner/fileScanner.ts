import * as vscode from 'vscode';
import * as path from 'path';
import fg = require('fast-glob');
import { Logger } from '../utils/logger';
import { FileContext } from '../types';

export async function scanWorkspace(): Promise<FileContext[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    Logger.info(`Scanning workspace: ${rootPath}`);

    try {
        // Scan for common code file types in the entire workspace
        const entries = await fg(['**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,go,rs,rb,php,cs,swift}'], {
            cwd: rootPath,
            ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/out/**',
                '**/build/**',
                '**/.git/**',
                '**/.vscode/**',
                '**/.vscode-test/**',
                '**/vendor/**',
                '**/target/**',
                '**/__pycache__/**',
                '**/venv/**',
                '**/env/**',
                '**/.next/**',
                '**/.nuxt/**',
                '**/coverage/**',
                '**/*.min.js',
                '**/*.bundle.js',
                '**/package-lock.json',
                '**/yarn.lock'
            ],
            dot: false,
            onlyFiles: true
        });

        // Limit to 20 files for MVP, prioritize non-test files
        const nonTestFiles = entries.filter(f => 
            !f.includes('.test.') && 
            !f.includes('.spec.') && 
            !f.includes('/test/') && 
            !f.includes('/tests/') &&
            !f.includes('\\test\\') &&
            !f.includes('\\tests\\')
        );
        
        const filesToProcess = (nonTestFiles.length > 0 ? nonTestFiles : entries).slice(0, 20);
        Logger.info(`Found ${entries.length} files (${nonTestFiles.length} non-test), processing ${filesToProcess.length}`);

        const fileContexts: FileContext[] = [];
        for (const file of filesToProcess) {
            try {
                const fullPath = path.join(rootPath, file);
                const doc = await vscode.workspace.openTextDocument(fullPath);
                const content = doc.getText();
                
                // Limit content size to avoid overwhelming the AI
                const maxContentLength = 5000;
                fileContexts.push({
                    path: file,
                    content: content.substring(0, maxContentLength)
                });
                
                Logger.info(`  Loaded: ${file} (${content.length} chars, using ${Math.min(content.length, maxContentLength)})`);
            } catch (e) {
                Logger.error(`Failed to read file ${file}: ${e}`);
            }
        }
        return fileContexts;
    } catch (err) {
        Logger.error(`Scan failed: ${err}`);
        throw err;
    }
}
