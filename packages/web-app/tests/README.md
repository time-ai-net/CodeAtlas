# CodeAtlas Test Suite

This directory contains comprehensive test scripts for the CodeAtlas backend API.

## Test Files

### Core Tests

- **`test-backend.js`** - Basic backend API test
- **`test-data-quality.js`** - Detailed data quality analysis
- **`test-final-verification.js`** - Final verification with comprehensive checks
- **`test-multiple-repos.js`** - Test multiple repositories in sequence
- **`test-rds-detailed.js`** - Detailed test for RDS repository
- **`test-rds-repo.js`** - Simple RDS repository test
- **`test-stress.js`** - Stress test with multiple repositories

### PowerShell Tests

- **`test-rds-direct.ps1`** - PowerShell-based direct API test

## Running Tests

### Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure Ollama is running (if using Ollama provider):
   ```bash
   ollama serve
   ```

### Run Individual Tests

```bash
# Basic backend test
node tests/test-backend.js

# Data quality test
node tests/test-data-quality.js

# Multiple repositories test
node tests/test-multiple-repos.js

# Stress test
node tests/test-stress.js

# Final verification
node tests/test-final-verification.js
```

### Run All Tests

```bash
# Run comprehensive test suite
node tests/test-multiple-repos.js

# Run stress test
node tests/test-stress.js
```

## Test Results

Tests validate:
- ✅ Response structure (all required fields present)
- ✅ Module quality (names, paths, types, descriptions)
- ✅ Relationship validity (from/to fields)
- ✅ Layer mapping (modules assigned to layers)
- ✅ Pattern detection (not "Unknown")
- ✅ Diagram generation (valid Mermaid format)
- ✅ Summary generation (meaningful content)

## Expected Results

- **Success Rate**: 100%
- **Quality Score**: 80-100% (Grade A-B)
- **Pattern Detection**: 70-80% confidence
- **Layer Mapping**: 100% success
- **Diagram Generation**: 100% success

## Troubleshooting

If tests fail:

1. **Server not running**: Start with `npm run dev`
2. **Ollama not accessible**: Ensure Ollama is running at `http://localhost:11434`
3. **Timeout errors**: Increase timeout in test scripts (default: 300s)
4. **Connection errors**: Check firewall and network settings

