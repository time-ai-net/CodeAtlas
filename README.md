# CodeAtlas Monorepo

AI-powered code architecture analysis - Available as VS Code extension and web application.

## 📦 Packages

### [@codeatlas/core](./packages/core)
Shared core logic for AI analysis, file scanning, and diagram generation.

- 🤖 AI Clients (Ollama, Gemini)
- 📊 Architecture Analysis Engine
- 🔍 Smart File Scanner
- 📈 Mermaid Diagram Generator

### [@codeatlas/vscode-extension](./packages/vscode-extension)
VS Code extension for analyzing codebases directly in your editor.

- 📁 Analyze workspace architecture
- 🎨 Interactive visualizations
- ⚡ Fast local analysis with Ollama
- ☁️ Cloud analysis with Gemini

### [@codeatlas/web-app](./packages/web-app)
Web application for analyzing GitHub repositories.

- 🔗 GitHub URL input
- 🌐 No installation required
- 📊 Share results via link
- 🎨 Modern Next.js UI

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Build All Packages

```bash
npm run build
```

### Run Web App (Development with Hot Reload)

**Option 1: Run both core watch and web app together (Recommended)**
```bash
npm run dev
```

This runs:
- `watch:core` - Watches and rebuilds core package on changes
- `dev:web` - Runs Next.js dev server

**Option 2: Run separately**

Terminal 1:
```bash
npm run watch:core
```

Terminal 2:
```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000)

### Build VS Code Extension

```bash
npm run build:extension
```

Then press F5 in VS Code to debug the extension.

## 📁 Project Structure

```
CodeAtlas-Monorepo/
├── packages/
│   ├── core/              # Shared core logic
│   │   ├── src/
│   │   │   ├── ollamaClient.ts
│   │   │   ├── geminiClient.ts
│   │   │   ├── fileScanner.ts
│   │   │   ├── diagramGenerator.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── vscode-extension/  # VS Code extension
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   └── webview/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── web-app/           # Next.js web app
│       ├── app/
│       │   ├── page.tsx
│       │   ├── analyze/
│       │   └── api/
│       ├── components/
│       ├── package.json
│       └── README.md
│
├── package.json           # Root workspace config
└── README.md
```

## 🛠️ Development

### Watch Mode (Core)

```bash
npm run watch:core
```

### Build Individual Packages

```bash
npm run build:core
npm run build:extension
npm run build:web
```

### Testing

```bash
npm test
```

## 📝 Prerequisites

### For Local AI (Ollama)

1. Install Ollama: https://ollama.ai
2. Pull model: `ollama pull qwen2.5-coder:3b`
3. Start server: `ollama serve`

### For Cloud AI (Gemini)

1. Get API key: https://aistudio.google.com/apikey
2. Set in environment:
   - Extension: VS Code settings
   - Web app: `.env.local`

## 🎯 Use Cases

### VS Code Extension
- Analyze your current project
- Generate architecture diagrams
- Understand codebase structure
- Local, private analysis

### Web Application
- Analyze public GitHub repos
- Share analysis results
- No installation needed
- Quick demos and presentations

## 📊 Performance

| Provider | Speed | Cost | Privacy |
|----------|-------|------|---------|
| Ollama (3b) | ~50s/5 files | Free | 100% Local |
| Ollama (7b) | ~90s/5 files | Free | 100% Local |
| Gemini API | ~10s/5 files | Pay-per-use | Cloud |

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License

MIT

## 🔗 Links

- [VS Code Extension Documentation](./packages/vscode-extension/README.md)
- [Web App Documentation](./packages/web-app/README.md)
- [Core API Documentation](./packages/core/README.md)
