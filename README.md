# DocChat — RAG Chatbot

**Rozmawiaj z własnymi dokumentami PDF** używając modeli AI od Anthropic, Google lub OpenAI.  
Działa w przeglądarce — bez backendu, bez instalacji.

🌐 **[Otwórz aplikację](https://dolildev.github.io/RAGchatbot/)**

---

## Jak to działa

```
Wgraj PDF  →  Ekstrakcja tekstu (pdf.js)  →  Podział na fragmenty
                                                       ↓
                                            Indeks TF-IDF w pamięci
                                                       ↓
Zadaj pytanie  →  Top-8 fragmentów (podobieństwo cosinusowe + keyword bonus)
                                                       ↓
                              Fragmenty + pytanie → model AI → odpowiedź
                                                       ↓
                              Odpowiedź z odnośnikami do stron PDF
```

---

## Funkcje

- **Multi-provider** — Anthropic Claude, Google Gemini, OpenAI GPT
- **Drag & drop** — przeciągnij jeden lub wiele plików PDF
- **Cytowane źródła** — każda odpowiedź pokazuje fragmenty z których korzystał model
- **Podgląd PDF** — kliknij źródło, żeby otworzyć PDF na właściwej stronie z podświetlonym tekstem
- **Ciemny motyw** — przełącznik w nagłówku, zapisywany w localStorage
- **Klucze API tylko w sesji** — przechowywane w `sessionStorage`, nigdy nie opuszczają przeglądarki

---

## Obsługiwane modele

| Provider | Modele |
|---|---|
| **Anthropic** | Claude Sonnet 4, Claude Opus 4.7, Claude Haiku 4.5 |
| **Google** | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3.5 Flash, Gemini 3.1 Flash Lite |
| **OpenAI** | GPT-4o, GPT-4o mini, GPT-3.5 Turbo |

---

## Szybki start

1. Otwórz **[dolildev.github.io/RAGchatbot](https://dolildev.github.io/RAGchatbot/)**
2. Wybierz providera i model
3. Wklej klucz API → **Zapisz klucz**
4. Wgraj pliki PDF
5. Zadaj pytanie

### Klucze API

| Provider | Format klucza | Gdzie zdobyć |
|---|---|---|
| Anthropic | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| Google | `AIzaSy...` | [aistudio.google.com](https://aistudio.google.com) |
| OpenAI | `sk-...` | [platform.openai.com](https://platform.openai.com) |

> **Uwaga:** OpenAI blokuje żądania z przeglądarki (CORS). Działa lokalnie przez serwer proxy lub bezpośrednio tylko z Anthropic i Google.

---

## Uruchomienie lokalnie

Żaden build nie jest wymagany — wystarczy serwer plików statycznych:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Następnie otwórz `http://localhost:8080`.

---

## Struktura projektu

```
RAGchatbot/
├── index.html   — szkielet HTML
├── style.css    — style i zmienne CSS (dark mode)
├── app.js       — logika RAG, API, podgląd PDF
└── .nojekyll    — wyłącza Jekyll na GitHub Pages
```

---

## Stack technologiczny

- **Vanilla JS** (ES2020) — zero frameworków, zero zależności npm
- **[pdf.js](https://mozilla.github.io/pdf.js/)** — ekstrakcja tekstu i podgląd PDF
- **TF-IDF + cosine similarity** — wyszukiwanie fragmentów (własna implementacja)
- **GitHub Pages** — hosting

---

## Licencja

MIT
