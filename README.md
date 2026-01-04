# CodeAtlas: AI-Powered Codebase Visualizer

[![License: MIT](https://img.shields.io/github/license/time-ai-net/codeatlas)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/time-ai-net/codeatlas)](https://github.com/time-ai-net/codeatlas/releases)
[![GitHub issues](https://img.shields.io/github/issues/time-ai-net/codeatlas)](https://github.com/time-ai-net/codeatlas/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**CodeAtlas** transforms complex codebases into interactive, easy-to-understand architecture diagrams directly within VS Code. Powered by **local Ollama models** for fast, private, and completely free code analysis.

> **New to the project?** Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## Key Features

*   **Instant Visualization**: Generate architecture diagrams from your folder structure in seconds.
*   **AI-Driven Insights**: Leverages local Ollama models to understand code semantics, relationships, and dependencies.
*   **100% Private**: Your code never leaves your machine - all analysis runs locally.
*   **Completely Free**: No API costs - use powerful open-source models.
*   **Interactive Diagrams**: Pan, zoom, and explore nodes to understand module connections.
*   **Zero Configuration**: Works out of the box for TypeScript/JavaScript projects (Multi-language support coming soon).

## Installation

### 1. Install Ollama
```powershell
# Windows (PowerShell)
winget install Ollama.Ollama
```

Or download from: https://ollama.com/download

### 2. Pull a Model
```powershell
ollama pull qwen2.5-coder:3b
```

### 3. Install Extension

**Option A: From VS Code Marketplace** (Coming Soon)
```
Ext: Install Extensions → Search "CodeAtlas"
```

**Option B: From Source** (For Contributors)
```bash
git clone https://github.com/YOUR_USERNAME/CodeAtlas.git
cd CodeAtlas
npm install
npm run compile
```

Press `F5` to launch Extension Development Host.

**Detailed setup guide**: See [docs/OLLAMA_SETUP.md](docs/OLLAMA_SETUP.md)

## Configuration

Configure your preferred model in VS Code settings:

```json
{
  "CodeAtlas.ollamaModel": "qwen2.5-coder:3b",
  "CodeAtlas.ollamaUrl": "http://localhost:11434"
}
```

**Recommended Models:**
- `qwen2.5-coder:3b` (2GB) - Fast and efficient
- `qwen2.5-coder:7b` (4.7GB) - Better quality
- `deepseek-coder:6.7b` (3.8GB) - Alternative option

## Usage

1.  Press `F5` to launch the Extension Development Host.
2.  Open any project folder.
3.  Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
4.  Run: `CodeAtlas: Analyze Architecture`.
5.  View the generated diagram in the CodeAtlas panel.

## Architecture

CodeAtlas is built with a clean, modular architecture:

*   **Scanner** ([src/scanner](src/scanner/)): Efficiently traverses workspace using `fast-glob` to find code files
*   **AI Client** ([src/ai](src/ai/)): Interfaces with local Ollama for code analysis
*   **Webview Panel** ([src/webview](src/webview/)): Renders interactive Mermaid.js diagrams
*   **Extension Core** ([src/extension.ts](src/extension.ts)): Orchestrates the analysis workflow

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical documentation.

## Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test your changes thoroughly
4. Commit with clear messages (`git commit -m 'Add amazing feature'`)
5. Push and open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Found a Bug?
Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, VS Code version, Ollama model)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Ollama](https://ollama.com/) for making local AI accessible
- [Mermaid.js](https://mermaid.js.org/) for diagram rendering
- All our [contributors](https://github.com/YOUR_USERNAME/CodeAtlas/graphs/contributors)

---

**Star us on GitHub if you find CodeAtlas useful!**
