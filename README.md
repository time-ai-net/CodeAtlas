# CodeAtlas

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/time-ai-net/CodeAtlas/workflows/CI/badge.svg)](https://github.com/time-ai-net/CodeAtlas/actions)
[![GitHub Issues](https://img.shields.io/github/issues/time-ai-net/CodeAtlas.svg)](https://github.com/time-ai-net/CodeAtlas/issues)
[![GitHub Stars](https://img.shields.io/github/stars/time-ai-net/CodeAtlas.svg)](https://github.com/time-ai-net/CodeAtlas/stargazers)

> Transform your codebase into interactive architecture diagrams using local AI models.

**CodeAtlas** is a VS Code extension that automatically analyzes your code structure and generates visual architecture diagrams. All processing happens locally using Ollama - your code never leaves your machine.

## Features

- **Local AI Analysis** - Uses Ollama models for private, offline code analysis
- **Multi-Language Support** - TypeScript, JavaScript, Python, Java, C++, Go, Rust, Ruby, PHP, C#, Swift
- **Interactive Diagrams** - Mermaid.js visualizations with pan and zoom
- **Zero Cost** - No API fees, completely free and open source
- **Privacy First** - All analysis runs on your machine

## Quick Start

### Prerequisites

1. **VS Code** 1.85.0 or higher
2. **Ollama** installed and running
3. A code model (recommended: `qwen2.5-coder:3b`)

### Installation

**Option 1: From Source**
```bash
git clone https://github.com/time-ai-net/CodeAtlas.git
cd CodeAtlas
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

**Option 2: VS Code Marketplace** (Coming Soon)

### Setup Ollama

```bash
# Install Ollama
winget install Ollama.Ollama

# Pull a model
ollama pull qwen2.5-coder:3b
```

See [docs/OLLAMA_SETUP.md](docs/OLLAMA_SETUP.md) for detailed instructions.

## Usage

1. Open any project in VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Run command: **CodeAtlas: Analyze Architecture**
4. View the generated diagram in the CodeAtlas panel

The extension scans your workspace, analyzes code structure, and generates an interactive architecture diagram showing modules and their relationships.

## Configuration

Configure in VS Code settings (`Ctrl+,` or `Cmd+,`):

```json
{
  "codeatlas.ollamaModel": "qwen2.5-coder:3b",
  "codeatlas.ollamaUrl": "http://localhost:11434"
}
```

### Recommended Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `qwen2.5-coder:3b` | 1.9GB | Fast | Good | Development, quick analysis |
| `qwen2.5-coder:7b` | 4.7GB | Medium | Better | Production, detailed analysis |
| `deepseek-coder:6.7b` | 3.8GB | Medium | Good | Alternative option |

## Architecture

CodeAtlas follows a clean, modular design:

```
src/
├── extension.ts       # Main extension entry point
├── ai/
│   └── ollamaClient.ts   # Ollama API integration
├── scanner/
│   └── fileScanner.ts    # Workspace file discovery
├── webview/
│   └── Panel.ts          # Diagram visualization
└── utils/
    └── logger.ts         # Logging utilities
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/CodeAtlas.git`
3. **Create a branch**: `git checkout -b feature/your-feature`
4. **Make changes** and test thoroughly
5. **Commit**: `git commit -m 'feat: add your feature'`
6. **Push**: `git push origin feature/your-feature`
7. **Open a Pull Request**

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Supported Languages

TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, C, C++, Scala, Dart, Shell scripts, and more.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for complete details.

## Support

- **Report Issues**: [GitHub Issues](https://github.com/time-ai-net/CodeAtlas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/time-ai-net/CodeAtlas/discussions)

## Acknowledgments

- [Ollama](https://ollama.com/) - Local AI inference platform
- [Mermaid.js](https://mermaid.js.org/) - Diagram generation library
- All our [contributors](https://github.com/time-ai-net/CodeAtlas/graphs/contributors)

---

**Star ⭐ this repository if you find CodeAtlas useful!**

