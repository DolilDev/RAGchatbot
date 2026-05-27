# DocChat – RAG Chatbot

A browser-based RAG (Retrieval-Augmented Generation) chatbot that lets you chat with PDF documents using your choice of AI provider — no backend required.

## Features

- **Multi-provider support** — Anthropic Claude, Google Gemini, OpenAI GPT
- **PDF ingestion** — drag & drop or file picker, processes multiple files
- **TF-IDF retrieval** — cosine similarity search over document chunks
- **Source citations** — every answer shows which document fragments were used
- **Session-only key storage** — API keys are kept in `sessionStorage`, never sent anywhere except the provider's API
- **Single file** — the entire app is one `index.html`, no build step needed

## Supported Models

| Provider | Models |
|---|---|
| Anthropic | Claude Sonnet 4, Claude Opus 4.7, Claude Haiku 4.5 |
| Google | Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro |
| OpenAI | GPT-4o, GPT-4o mini, GPT-3.5 Turbo |

## Getting Started

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge)
2. Select a provider and model from the dropdowns
3. Paste your API key and click **Zapisz klucz**
4. Upload one or more PDF files
5. Ask questions in the chat input

No installation, no server, no dependencies to install.

## How It Works

```
PDF upload → text extraction (pdf.js) → chunking (500 tokens, 50 overlap)
                                              ↓
                                    TF-IDF index built in memory
                                              ↓
User query → top-5 chunks retrieved (cosine similarity)
                                              ↓
                              Context + query sent to AI provider API
                                              ↓
                                    Answer displayed with sources
```

## API Key Requirements

- **Anthropic** — key starting with `sk-ant-`
- **Google Gemini** — key starting with `AIza`
- **OpenAI** — key starting with `sk-`

Keys are stored only in `sessionStorage` and cleared when the browser tab is closed.

## Running Locally

No server needed for Anthropic and Google Gemini. OpenAI requires a server or a CORS-enabled proxy due to browser restrictions.

```bash
# Simplest option — just open the file
open index.html

# Or serve with any static file server
npx serve .
python -m http.server 8080
```

## Tech Stack

- Vanilla JavaScript (ES2020)
- [pdf.js](https://mozilla.github.io/pdf.js/) for PDF parsing
- TF-IDF + cosine similarity for retrieval (implemented from scratch)
- Direct fetch to provider REST APIs

## License

MIT
