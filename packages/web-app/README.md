# CodeAtlas Web App

Web-based architecture analysis tool - paste a GitHub URL and get instant architecture insights.

## Features

- 🔗 **GitHub Integration**: Analyze any public GitHub repository
- 🤖 **AI-Powered**: Uses Ollama or Gemini for intelligent analysis
- 📊 **Visual Diagrams**: Interactive Mermaid architecture diagrams
- ⚡ **Real-time**: Fast analysis with progress indicators
- 🎨 **Modern UI**: Clean, responsive interface built with Next.js + Tailwind

## Getting Started

### Prerequisites

- Node.js 18+
- Ollama installed (or Gemini API key)
- Running Ollama server: `ollama serve`
- Qwen model pulled: `ollama pull qwen2.5-coder:3b`

### Installation

```bash
npm install
```

### Configuration

Create `.env.local`:

```env
# AI Provider (ollama or gemini)
AI_PROVIDER=ollama

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b

# Gemini Configuration (if using Gemini)
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Enter GitHub URL**: Paste any public repo URL
2. **Click Analyze**: AI analyzes the codebase
3. **View Results**: See architecture diagram and insights
4. **Download/Share**: Export results or share link

## Architecture

```
web-app/
├── app/              # Next.js app router
│   ├── page.tsx     # Home page (GitHub URL input)
│   ├── analyze/     # Analysis page
│   └── api/         # API routes
│       ├── analyze/ # Analysis endpoint
│       └── github/  # GitHub API proxy
├── components/       # React components
│   ├── AnalysisForm.tsx
│   ├── DiagramView.tsx
│   └── ResultsPanel.tsx
├── lib/             # Utilities
│   └── github.ts    # GitHub API client
└── public/          # Static assets
```

## API Routes

### POST /api/analyze

Analyzes a GitHub repository.

**Request:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "provider": "ollama"
}
```

**Response:**
```json
{
  "modules": [...],
  "relationships": [...],
  "pattern": {...},
  "diagram": "mermaid code..."
}
```

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel deploy
```

### Docker

```bash
docker build -t codeatlas-web .
docker run -p 3000:3000 codeatlas-web
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider (ollama/gemini) | `ollama` |
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `qwen2.5-coder:3b` |
| `GEMINI_API_KEY` | Gemini API key | - |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |

## License

MIT
