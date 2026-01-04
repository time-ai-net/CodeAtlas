# Contributing to CodeAtlas

Thank you for considering contributing to CodeAtlas! It's people like you that make CodeAtlas a great tool for developers everywhere.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project follows a simple rule: **Be respectful and constructive**. We're all here to learn and improve CodeAtlas together.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CodeAtlas.git
   cd CodeAtlas
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/CodeAtlas.git
   ```

## Development Setup

### Prerequisites
- Node.js 16+ and npm
- VS Code (latest version)
- Ollama installed and running
- A code model pulled (e.g., `ollama pull qwen2.5-coder:3b`)

### Install Dependencies
```bash
npm install
```

### Build the Extension
```bash
npm run compile
```

### Run in Development Mode
1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new VS Code window

### Watch Mode
```bash
npm run watch
```

## Project Structure

```
CodeAtlas/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── ai/
│   │   └── ollamaClient.ts   # Ollama API integration
│   ├── scanner/
│   │   └── fileScanner.ts    # Workspace file scanner
│   ├── utils/
│   │   └── logger.ts         # Logging utilities
│   ├── webview/
│   │   └── Panel.ts          # Webview panel UI
│   └── test/
│       └── suite/            # Integration tests
├── docs/                    # Documentation
├── out/                     # Compiled output (git-ignored)
├── package.json             # Extension manifest
└── tsconfig.json            # TypeScript config
```

## How to Contribute

### Reporting Bugs

Found a bug? [Open an issue](https://github.com/YOUR_USERNAME/CodeAtlas/issues/new) with:

- Clear title describing the problem
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Environment details (OS, VS Code version, Ollama model)
- Screenshots/logs if applicable

### Suggesting Features

Have an idea? [Open an issue](https://github.com/YOUR_USERNAME/CodeAtlas/issues/new) with:

- Clear description of the feature
- Use case: Why is this useful?
- Proposed implementation (if you have ideas)
- Mockups/examples (if applicable)

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos or clarify existing docs
- Add examples or tutorials
- Improve API documentation

### Code Contributions

1. Comment on the issue to let others know you're working on it
2. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding guidelines
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork and open a Pull Request

## Coding Guidelines

### TypeScript Style

- Use TypeScript for all new code
- Follow existing code style (ESLint)
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Prefer async/await over promises

### Code Quality

**Do:**
- Keep functions small and focused (< 50 lines)
- Handle errors gracefully with try/catch
- Add logging (`Logger.info()`, `Logger.error()`)
- Write self-documenting code

**Don't:**
- Leave commented-out code
- Use `any` type without good reason
- Ignore TypeScript errors
- Use console.log (use Logger instead)

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

Add tests in `src/test/suite/` for new features, bug fixes, and edge cases.

Example:
```typescript
suite('Feature Name', () => {
    test('should do something', async () => {
        const result = await yourFunction(input);
        assert.strictEqual(result, expected);
    });
});
```

### Manual Testing Checklist

- [ ] Extension activates without errors
- [ ] Command appears in Command Palette
- [ ] Analysis completes successfully
- [ ] Webview displays correctly
- [ ] No errors in Debug Console

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(scanner): add Python file support
fix(webview): resolve undefined summary
docs(readme): update installation steps
```

## Pull Request Process

1. Update documentation if needed
2. Ensure tests pass (`npm test`)
3. Compile without errors (`npm run compile`)
4. Update CHANGELOG.md (under "Unreleased")
5. Fill out PR template
6. Request review from maintainers
7. Address feedback promptly

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass
- [ ] CHANGELOG.md updated

## Questions?

- **Stuck?** Open a [Discussion](https://github.com/YOUR_USERNAME/CodeAtlas/discussions)
- **Need help?** Comment on your issue

---

**Thank you for contributing to CodeAtlas!** Every contribution makes a difference.
