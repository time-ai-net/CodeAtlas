import * as vscode from 'vscode';
import { ArchitectureAnalysis } from '../types';

export class CodeAtlasPanel {
    public static currentPanel: CodeAtlasPanel | undefined;
    public static readonly viewType = 'codeAtlas';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (CodeAtlasPanel.currentPanel) {
            CodeAtlasPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            CodeAtlasPanel.viewType,
            'CodeAtlas Architecture',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        CodeAtlasPanel.currentPanel = new CodeAtlasPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public update(analysis: ArchitectureAnalysis) {
        this._panel.webview.html = this._getHtmlForWebview(analysis);
    }

    public dispose() {
        CodeAtlasPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getLoadingHtml();
    }

    private _getLoadingHtml() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CodeAtlas</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .spinner {
                    border: 4px solid var(--vscode-button-background);
                    border-top: 4px solid var(--vscode-textLink-foreground);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px 0;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <h1>🔍 Analyzing Codebase...</h1>
            <div class="spinner"></div>
            <p>Please wait while Ollama analyzes your architecture.</p>
            <p><em>Check Output → CodeAtlas for detailed logs</em></p>
        </body>
        </html>`;
    }

    private _getHtmlForWebview(analysis: ArchitectureAnalysis) {
        // Safe relationship handling
        const relationships = analysis.relationships || [];
        const modules = analysis.modules || [];
        const summary = analysis.summary || 'No summary available';

        // Convert analysis to Mermaid graph
        const mermaidLines = relationships.map(r => {
            // Sanitize names for Mermaid (remove special chars)
            const safeFrom = r.from.replace(/[^a-zA-Z0-9]/g, '_');
            const safeTo = r.to.replace(/[^a-zA-Z0-9]/g, '_');
            return `    ${safeFrom} -->|${r.type}| ${safeTo}`;
        });

        const mermaidGraph = `
        graph TD
        ${mermaidLines.join('\n')}
        `;

        // Modules not in relationships
        const modulesInRel = new Set<string>();
        relationships.forEach(r => {
            modulesInRel.add(r.from.replace(/[^a-zA-Z0-9]/g, '_'));
            modulesInRel.add(r.to.replace(/[^a-zA-Z0-9]/g, '_'));
        });

        // Add modules that are not in relationships
        modules.forEach(m => {
            const safeM = m.replace(/[^a-zA-Z0-9]/g, '_');
            if (!modulesInRel.has(safeM)) {
                // mermaidGraph += `\n    ${safeM}`;
            }
        });

        // Simple way to handle orphan nodes in mermaid is just listing them, but let's stick to connected ones for now or append
        const orphanNodes = modules
            .map(m => m.replace(/[^a-zA-Z0-9]/g, '_'))
            .filter(m => !modulesInRel.has(m))
            .map(m => `    ${m}`)
            .join('\n');

        const fullMermaid = `${mermaidGraph}\n${orphanNodes}`;

        // Generate modules list
        const modulesList = modules.length > 0 
            ? `<ul>${modules.map(m => `<li>${m}</li>`).join('')}</ul>`
            : '<p>No modules detected</p>';

        // Generate relationships list
        const relationshipsList = relationships.length > 0
            ? `<ul>${relationships.map(r => `<li><strong>${r.from}</strong> ${r.type} <strong>${r.to}</strong></li>`).join('')}</ul>`
            : '<p>No relationships detected</p>';

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data: https:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CodeAtlas Architecture</title>
             <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                mermaid.initialize({ startOnLoad: true, theme: 'dark' });
            </script>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .summary { 
                    margin-bottom: 20px; 
                    padding: 15px; 
                    background-color: var(--vscode-textBlockQuote-background); 
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    border-radius: 2px; 
                }
                .section {
                    margin: 20px 0;
                }
                .section h2 {
                    color: var(--vscode-textLink-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 5px;
                }
                ul {
                    list-style-type: none;
                    padding-left: 0;
                }
                li {
                    padding: 5px 0;
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                .mermaid {
                    background-color: white;
                    padding: 20px;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <h1>Architecture Overview</h1>
            <div class="summary">
                <strong>Summary:</strong> ${summary}
            </div>
            
            <div class="section">
                <h2>📦 Modules (${modules.length})</h2>
                ${modulesList}
            </div>

            <div class="section">
                <h2>🔗 Relationships (${relationships.length})</h2>
                ${relationshipsList}
            </div>

            ${relationships.length > 0 ? `
            <div class="section">
                <h2>📊 Architecture Diagram</h2>
                <div class="mermaid">
                    ${fullMermaid}
                </div>
            </div>
            ` : ''}
        </body>
        </html>`;
    }
}
