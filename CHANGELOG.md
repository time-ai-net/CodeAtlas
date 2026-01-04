# Changelog

All notable changes to CodeAtlas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Prepared repository for open source contributions
- Improved documentation structure
- Removed emojis for professional appearance

## [0.1.0] - 2026-01-05

### Added
- Initial release of CodeAtlas
- AI-powered codebase analysis using local Ollama models
- Support for multiple programming languages (TypeScript, JavaScript, Python, Java, C++, Go, Rust, Ruby, PHP, C#, Swift)
- Interactive Mermaid.js architecture diagrams in webview panel
- File scanner with configurable patterns and ignore rules
- Comprehensive logging to Debug Console and Output panel
- VS Code command: `CodeAtlas: Analyze Architecture`

### Features
- **100% Private**: All analysis runs locally, code never leaves your machine
- **Completely Free**: No API costs, uses open-source Ollama models
- **Fast Analysis**: Scans up to 20 files, analyzes in seconds
- **Visual Diagrams**: Automatically generated architecture graphs
- **Zero Config**: Works out of the box with sensible defaults

### Configuration
- `CodeAtlas.ollamaModel`: Choose your preferred Ollama model (default: `qwen2.5-coder:3b`)
- `CodeAtlas.ollamaUrl`: Ollama server URL (default: `http://localhost:11434`)

### Documentation
- README.md with setup instructions
- CONTRIBUTING.md with development guidelines
- docs/OLLAMA_SETUP.md for detailed Ollama installation
- Example usage and testing instructions

### Technical Details
- Built with TypeScript on VS Code Extension API
- Uses `fast-glob` for efficient file scanning
- Integrates with Ollama via REST API
- Mermaid.js for diagram rendering
- Comprehensive error handling and logging

### Known Limitations
- Analyzes maximum 20 files per scan (MVP limit)
- Each file capped at 5000 characters for AI analysis
- Best suited for small to medium projects currently

---

## Release Notes Format

### Added
New features and capabilities

### Changed
Changes in existing functionality

### Deprecated
Soon-to-be removed features

### Removed
Removed features

### Fixed
Bug fixes

### Security
Security vulnerability fixes

---

[Unreleased]: https://github.com/YOUR_USERNAME/CodeAtlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YOUR_USERNAME/CodeAtlas/releases/tag/v0.1.0
