# DocChat — RAG Chatbot

**Chat with your own PDF documents** using AI models from Anthropic, Google, or OpenAI.  
Runs entirely in the browser — no backend, no installation, no data sent to any server except the AI provider.

🌐 **[Open the app](https://dolildev.github.io/RAGchatbot/)**

---

## How It Works

```
  ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
  │  PDF Upload  │───▶│ Text Extraction  │───▶│  Chunk & Index    │
  │  (drag&drop) │    │    (pdf.js)      │    │  TF-IDF in memory │
  └─────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                        │
                                               cosine similarity
                                               + keyword bonus
                                                        │
  ┌─────────────┐    ┌──────────────────┐    ┌─────────▼─────────┐
  │   Answer    │◀───│   AI Provider    │◀───│  Top 8 Chunks     │
  │  + Sources  │    │ Claude/Gemini/   │    │  retrieved for    │
  │  + PDF page │    │      GPT         │    │  the query        │
  └─────────────┘    └────────▲─────────┘    └───────────────────┘
                               │
                      ┌────────┴────────┐
                      │  User Question  │
                      └─────────────────┘
```

Each answer includes **clickable source citations** that open the PDF preview directly on the page where the information was found, with the relevant text highlighted.

---

## Features

- **Multi-provider** — switch between Anthropic Claude, Google Gemini, and OpenAI GPT
- **Drag & drop** — upload one or multiple PDFs at once
- **Source citations** — every answer shows the exact fragments used by the model
- **PDF preview** — click a source to jump to the right page with highlighted text
- **Dark mode** — toggle in the header, preference saved across sessions
- **Fully client-side** — API keys stored only in `sessionStorage`, never leave the browser
- **Responsive** — works on desktop, tablet, and mobile

---

## Supported Models

| Provider | Models |
|---|---|
| **Anthropic** | Claude Sonnet 4 · Claude Opus 4.7 · Claude Haiku 4.5 |
| **Google** | Gemini 2.5 Flash · Gemini 2.5 Pro · Gemini 3.5 Flash · Gemini 3.1 Flash Lite |
| **OpenAI** | GPT-4o · GPT-4o mini · GPT-3.5 Turbo |

---

## Quick Start

1. Open **[dolildev.github.io/RAGchatbot](https://dolildev.github.io/RAGchatbot/)**
2. Select a provider and model from the dropdowns
3. Paste your API key and click **Zapisz klucz** *(Save key)*
4. Upload one or more PDF files
5. Ask a question — the app retrieves relevant fragments and sends them to the AI

### API Keys

| Provider | Key format | Get yours |
|---|---|---|
| Anthropic | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| Google | `AIzaSy...` | [aistudio.google.com](https://aistudio.google.com) |
| OpenAI | `sk-...` | [platform.openai.com](https://platform.openai.com) |

> **Note:** OpenAI blocks direct browser requests (CORS policy). Anthropic and Google Gemini work without restrictions.

---

## Running Locally

No build step required — just serve the files statically:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080`.

---

## Project Structure

```
RAGchatbot/
├── index.html    HTML skeleton
├── style.css     Styles & CSS variables (light / dark theme)
├── app.js        RAG logic, API calls, PDF preview
└── .nojekyll     Disables Jekyll processing on GitHub Pages
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Vanilla JS (ES2020), no frameworks |
| PDF rendering | [pdf.js](https://mozilla.github.io/pdf.js/) 3.11 |
| Retrieval | TF-IDF + cosine similarity (custom implementation) |
| Hosting | GitHub Pages |

---

## License

MIT
