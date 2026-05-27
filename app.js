'use strict';

// ════════════════════════════════════════════
// PROVIDER DEFINITIONS
// ════════════════════════════════════════════
const PROVIDERS = {
    anthropic: {
        label:       'Anthropic',
        badgeClass:  'badge-anthropic',
        placeholder: 'sk-ant-api03-…',
        prefix:      'sk-ant-',
        models: [
            { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4'   },
            { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7'  },
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
        ]
    },
    google: {
        label:       'Google',
        badgeClass:  'badge-google',
        placeholder: 'AIzaSy…',
        prefix:      'AIza',
        models: [
            { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash'      },
            { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro'        },
            { id: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash'      },
            { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' }
        ]
    },
    openai: {
        label:       'OpenAI',
        badgeClass:  'badge-openai',
        placeholder: 'sk-…',
        prefix:      'sk-',
        models: [
            { id: 'gpt-4o',        label: 'GPT-4o'        },
            { id: 'gpt-4o-mini',   label: 'GPT-4o mini'   },
            { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ]
    }
};

const MAX_TOKENS = 2048;
const CHUNK_SIZE = 600;
const CHUNK_OVER = 80;
const TOP_K      = 8;

const SYSTEM_PROMPT =
    'Jesteś asystentem do analizy dokumentów. Działasz jak wyszukiwarka — wydobywasz informacje z tekstu, nie tworzysz ich.\n\n' +
    'BEZWZGLĘDNE ZASADY:\n' +
    '- Odpowiadasz TYLKO na podstawie fragmentów podanych poniżej w sekcji KONTEKST.\n' +
    '- ZAKAZ używania jakiejkolwiek wiedzy spoza dostarczonego kontekstu.\n' +
    '- Jeśli odpowiedź nie wynika z kontekstu — napisz: "Nie znalazłem tej informacji w dostarczonych dokumentach." Jeśli jest częściowa — podaj co jest i zaznacz że reszty brak.\n' +
    '- Nie domyślaj się ani nie uzupełniaj wiedzy spoza kontekstu.\n' +
    '- Cytuj dosłownie kluczowe fragmenty używając cudzysłowów.\n' +
    '- Podawaj konkretne liczby, daty i nazwy dokładnie tak jak są w tekście.';

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
let chunks     = [];
let tfidf      = null;
let chatHistory = [];
let busy       = false;
let fileStore  = {};

let previewPdfDoc      = null;
let previewPage        = 1;
let previewTotal       = 0;
let previewSourceChunk = null;

// ════════════════════════════════════════════
// PROVIDER SWITCHING
// ════════════════════════════════════════════
function currentProvider() { return document.getElementById('providerSel').value; }
function currentModel()    { return document.getElementById('modelSel').value; }

function onProviderChange() {
    const id  = currentProvider();
    const cfg = PROVIDERS[id];

    const badge = document.getElementById('providerBadge');
    badge.textContent = cfg.label;
    badge.className   = `badge ${cfg.badgeClass}`;

    document.getElementById('keyInput').placeholder = cfg.placeholder;

    const sel = document.getElementById('modelSel');
    sel.innerHTML = cfg.models
        .map(m => `<option value="${m.id}">${m.label}</option>`)
        .join('');

    const saved = sessionStorage.getItem(`ak_${id}`) || '';
    document.getElementById('keyInput').value = saved;
    refreshKeyDot();

    chatHistory = [];
}

// ════════════════════════════════════════════
// API KEY
// ════════════════════════════════════════════
function saveKey() {
    const id  = currentProvider();
    const cfg = PROVIDERS[id];
    const v   = document.getElementById('keyInput').value.trim();

    if (!v) return toast('Wprowadź klucz API', 'error');
    if (!v.startsWith(cfg.prefix))
        return toast(`Klucz ${cfg.label} powinien zaczynać się od "${cfg.prefix}"`, 'error');

    sessionStorage.setItem(`ak_${id}`, v);
    refreshKeyDot();
    toast(`Klucz ${cfg.label} zapisany`, 'success');
}

function getKey() { return sessionStorage.getItem(`ak_${currentProvider()}`) || ''; }

function refreshKeyDot() {
    document.getElementById('keyDot').classList.toggle('on', !!getKey());
}

function toggleKey() {
    const inp  = document.getElementById('keyInput');
    const icon = document.getElementById('eyeIcon');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.innerHTML =
            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' +
            'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' +
            'm-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
            '<line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        inp.type = 'password';
        icon.innerHTML =
            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
            '<circle cx="12" cy="12" r="3"/>';
    }
}

// ════════════════════════════════════════════
// PDF PARSING
// ════════════════════════════════════════════
async function handleFiles(files) {
    const pdfs = Array.from(files).filter(f =>
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return toast('Wybierz pliki PDF', 'error');

    showProgress(true);

    for (let i = 0; i < pdfs.length; i++) {
        const file = pdfs[i];
        setProgress(file.name, (i / pdfs.length) * 100);
        try {
            const pages = await extractPdf(file, (pg, tot) => {
                const base = (i / pdfs.length) * 100;
                const inc  = (pg / tot) * (100 / pdfs.length);
                setProgress(`${file.name}  (str. ${pg}/${tot})`, base + inc);
            });
            const nc = splitChunks(pages, file.name, chunks.length);
            chunks.push(...nc);
            fileStore[file.name] = file;
            addFileRow(file.name, nc.length);
        } catch (e) {
            toast(`Błąd: ${file.name} – ${e.message}`, 'error');
        }
    }

    setProgress('Gotowe', 100);
    setTimeout(() => showProgress(false), 700);
    document.getElementById('fileInput').value = '';

    if (chunks.length > 0) {
        tfidf = buildTFIDF(chunks.map(c => c.text));
        setInputEnabled(true);
        toast(`Załadowano łącznie ${chunks.length} fragmentów`, 'success');
    }
}

async function extractPdf(file, onProgress) {
    const buf   = await file.arrayBuffer();
    const pdf   = await pdfjsLib.getDocument({ data: buf }).promise;
    const total = pdf.numPages;
    const pages = [];
    for (let p = 1; p <= total; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        const text    = content.items.map(it => it.str).join(' ');
        pages.push({ page: p, text });
        onProgress(p, total);
    }
    return pages;
}

function splitChunks(pages, source, startIdx) {
    let fullText = '';
    const pageMap = [];
    for (const { page, text } of pages) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        if (!cleaned) continue;
        const start = fullText.length;
        fullText += cleaned + ' ';
        for (let i = start; i < fullText.length; i++) pageMap[i] = page;
    }

    const result = [];
    let pos = 0, idx = startIdx;
    while (pos < fullText.length) {
        let end = pos + CHUNK_SIZE;
        if (end < fullText.length) {
            const sp = fullText.lastIndexOf(' ', end);
            if (sp > pos + CHUNK_SIZE * 0.5) end = sp;
        }
        end = Math.min(end, fullText.length);
        const chunk = fullText.slice(pos, end).trim();
        if (chunk.length > 30) {
            result.push({ text: chunk, source, idx: idx++, page: pageMap[pos] || 1 });
        }
        pos = pos + (CHUNK_SIZE - CHUNK_OVER);
        if (pos >= fullText.length) break;
    }
    return result;
}

// ════════════════════════════════════════════
// TF-IDF + COSINE
// ════════════════════════════════════════════
function tokenize(txt) {
    return txt.toLowerCase()
        .replace(/[^\w\sÀ-ɏ]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
}

function buildTFIDF(texts) {
    const docs = texts.map(tokenize);
    const N    = docs.length;
    const df   = {};
    docs.forEach(toks => new Set(toks).forEach(t => { df[t] = (df[t] || 0) + 1; }));
    const idf = {};
    Object.keys(df).forEach(t => { idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1; });
    const vectors = docs.map(toks => {
        if (!toks.length) return {};
        const tf  = {};
        toks.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
        const vec = {};
        Object.keys(tf).forEach(t => { vec[t] = (tf[t] / toks.length) * (idf[t] || 1); });
        return vec;
    });
    return { vectors, idf };
}

function makeQueryVec(query, idf) {
    const toks = tokenize(query);
    if (!toks.length) return {};
    const tf  = {};
    toks.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    const vec = {};
    Object.keys(tf).forEach(t => { vec[t] = (tf[t] / toks.length) * (idf[t] || 1); });
    return vec;
}

function cosine(v1, v2) {
    let dot = 0, m1 = 0, m2 = 0;
    Object.keys(v1).forEach(k => { m1 += v1[k] * v1[k]; if (v2[k]) dot += v1[k] * v2[k]; });
    Object.keys(v2).forEach(k => { m2 += v2[k] * v2[k]; });
    return (m1 && m2) ? dot / (Math.sqrt(m1) * Math.sqrt(m2)) : 0;
}

function retrieve(query, k) {
    if (!tfidf || !chunks.length) return [];
    const qTokens = new Set(tokenize(query));
    const qv      = makeQueryVec(query, tfidf.idf);

    return chunks
        .map((c, i) => {
            let score = cosine(qv, tfidf.vectors[i]);
            const cText = c.text.toLowerCase();
            qTokens.forEach(t => { if (cText.includes(t)) score += 0.15; });
            return { c, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map(x => x.c);
}

// ════════════════════════════════════════════
// API CALLS (per-provider)
// ════════════════════════════════════════════
async function callAPI(messages, systemPrompt) {
    const provider = currentProvider();
    const model    = currentModel();
    const key      = getKey();

    if (provider === 'anthropic') return callAnthropic(messages, systemPrompt, model, key);
    if (provider === 'google')    return callGemini(messages, systemPrompt, model, key);
    if (provider === 'openai')    return callOpenAI(messages, systemPrompt, model, key);
    throw new Error('Nieznany provider');
}

async function callAnthropic(messages, systemPrompt, model, key) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, temperature: 0, system: systemPrompt, messages })
    });
    if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error?.message || `HTTP ${r.status}`);
    }
    const d = await r.json();
    return d.content[0].text;
}

async function callGemini(messages, systemPrompt, model, key) {
    const contents = messages.map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0 }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error?.message || `HTTP ${r.status}`);
    }
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Pusta odpowiedź od Gemini');
    return text;
}

async function callOpenAI(messages, systemPrompt, model, key) {
    const oaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, temperature: 0, messages: oaiMessages })
    });
    if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error?.message || `HTTP ${r.status}`);
    }
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Pusta odpowiedź od OpenAI');
    return text;
}

// ════════════════════════════════════════════
// CHAT FLOW
// ════════════════════════════════════════════
async function sendMessage() {
    if (busy) return;
    const inp   = document.getElementById('chatInput');
    const query = inp.value.trim();
    if (!query) return;

    if (!getKey())      return toast('Zapisz klucz API przed wysłaniem', 'error');
    if (!chunks.length) return toast('Wgraj dokumenty PDF', 'error');

    inp.value = '';
    autoResize(inp);
    setBusy(true);

    addMsg('user', query);
    chatHistory.push({ role: 'user', content: query });

    const relevant  = retrieve(query, TOP_K);
    const ctxBlock  = relevant.length
        ? relevant.map((c, i) => `[Fragment ${i+1} | Źródło: ${c.source}]\n${c.text}`).join('\n\n---\n\n')
        : 'Brak pasujących fragmentów w dokumentach.';
    const sysPrompt = `${SYSTEM_PROMPT}\n\n=== KONTEKST Z DOKUMENTÓW ===\n\n${ctxBlock}\n\n=== KONIEC KONTEKSTU ===`;
    const estTok    = Math.ceil(sysPrompt.length / 4);

    document.getElementById('tokenCounter').textContent =
        `Kontekst: ~${estTok.toLocaleString()} est. tokenów`;

    try {
        const text = await callAPI(chatHistory, sysPrompt);
        chatHistory.push({ role: 'assistant', content: text });
        addMsg('assistant', text, relevant);
    } catch (err) {
        chatHistory.pop();
        addErrorMsg(err.message);
    }

    setBusy(false);
}

// ════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════
function addMsg(role, text, sources = []) {
    const c     = document.getElementById('chatMessages');
    const empty = document.getElementById('emptyState');
    if (empty) empty.remove();

    const row    = el('div', `msg-row ${role}`);
    const avatar = el('div', 'msg-avatar');
    avatar.textContent = role === 'user' ? 'Ty' : 'AI';

    const content = el('div', 'msg-content');
    const bubble  = el('div', 'msg-bubble');
    bubble.textContent = text;
    content.appendChild(bubble);

    if (role === 'assistant' && sources.length) {
        const details = document.createElement('details');
        details.className = 'sources';
        const summary = document.createElement('summary');
        summary.textContent = ` Źródła (${sources.length} fragmentów)`;
        details.appendChild(summary);
        sources.forEach((s, i) => {
            const item = el('div', 'source-item');
            const meta = el('div', 'source-meta');
            meta.textContent = `Fragment ${i+1} · ${s.source}`;
            if (s.page) {
                const btn = document.createElement('button');
                btn.className   = 'page-link';
                btn.textContent = `str. ${s.page} ↗`;
                btn.title       = `Otwórz PDF na stronie ${s.page}`;
                btn.onclick = e => { e.stopPropagation(); openPreviewAtPage(s.source, s.page, s.text); };
                meta.appendChild(btn);
            }
            const snip = el('div', 'source-text');
            snip.textContent = s.text.length > 300 ? s.text.slice(0, 300) + '…' : s.text;
            item.append(meta, snip);
            details.appendChild(item);
        });
        content.appendChild(details);
    }

    row.append(avatar, content);
    c.appendChild(row);
    c.scrollTop = c.scrollHeight;
}

function addErrorMsg(errText) {
    const c   = document.getElementById('chatMessages');
    const row = el('div', 'msg-row assistant');
    const av  = el('div', 'msg-avatar');
    av.style.cssText = 'background:#fee2e2;color:#dc2626;';
    av.textContent = '!';
    const cnt = el('div', 'msg-content');
    const bub = el('div', 'msg-bubble error-bubble');
    bub.textContent = `Błąd API: ${errText}`;
    cnt.appendChild(bub);
    row.append(av, cnt);
    c.appendChild(row);
    c.scrollTop = c.scrollHeight;
}

function addFileRow(name, count) {
    const list  = document.getElementById('fileList');
    const empty = document.getElementById('fileEmpty');
    if (empty) empty.remove();
    const item = el('div', 'file-item');
    item.title  = 'Kliknij, aby podejrzeć PDF';
    item.onclick = () => openPreview(name);
    item.innerHTML =
        `<svg class="file-pdf-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">` +
        `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>` +
        `<polyline points="14 2 14 8 20 8"/></svg>` +
        `<div class="file-info">` +
        `<div class="file-name" title="${esc(name)}">${esc(name)}</div>` +
        `<div class="file-meta">${count} fragmentów · kliknij, aby podejrzeć</div></div>`;
    list.appendChild(item);
}

function clearDocs() {
    if (!chunks.length) return toast('Brak dokumentów', 'info');
    chunks = []; tfidf = null; fileStore = {};
    document.getElementById('fileList').innerHTML =
        '<div class="file-empty" id="fileEmpty">Brak wgranych dokumentów</div>';
    setInputEnabled(false);
    document.getElementById('tokenCounter').textContent = 'Kontekst: 0 est. tokenów';
    toast('Dokumenty wyczyszczone', 'info');
}

function setBusy(state) {
    busy = state;
    const btn = document.getElementById('sendBtn');
    const inp = document.getElementById('chatInput');
    if (state) {
        btn.innerHTML = '<div class="spinner"></div> Generowanie…';
        btn.disabled  = true; inp.disabled = true;
        const c   = document.getElementById('chatMessages');
        const row = el('div', 'msg-row assistant'); row.id = 'typing';
        const av  = el('div', 'msg-avatar'); av.textContent = 'AI';
        const cnt = el('div', 'msg-content');
        const bub = el('div', 'msg-bubble');
        bub.style.cssText = 'background:#fff;border:1px solid var(--border);';
        bub.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
        cnt.appendChild(bub); row.append(av, cnt); c.appendChild(row);
        c.scrollTop = c.scrollHeight;
    } else {
        btn.innerHTML =
            '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">' +
            '<line x1="22" y1="2" x2="11" y2="13"/>' +
            '<polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Wyślij';
        btn.disabled = !chunks.length; inp.disabled = !chunks.length;
        const t = document.getElementById('typing'); if (t) t.remove();
    }
}

function setInputEnabled(on) {
    document.getElementById('chatInput').disabled = !on;
    document.getElementById('sendBtn').disabled   = !on;
}

function showProgress(v) { document.getElementById('progressWrap').style.display = v ? 'block' : 'none'; }
function setProgress(label, pct) {
    document.getElementById('progressTxt').textContent = label;
    document.getElementById('progressPct').textContent = `${Math.round(pct)}%`;
    document.getElementById('progressBar').style.width = `${Math.min(pct, 100)}%`;
}

function toast(msg, type = 'info') {
    const t = el('div', `toast ${type}`);
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3400);
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function autoResize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }

// ════════════════════════════════════════════
// DARK MODE
// ════════════════════════════════════════════
const SUN_ICON =
    '<circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const MOON_ICON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(dark ? 'light' : 'dark');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeIcon').innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
    localStorage.setItem('docchat_theme', theme);
}

// ════════════════════════════════════════════
// PDF PREVIEW
// ════════════════════════════════════════════
async function openPreview(name, startPage = 1, chunkText = null) {
    const file = fileStore[name];
    if (!file) return toast('Plik niedostępny', 'error');

    previewSourceChunk = chunkText;
    document.getElementById('previewTitle').textContent = name;
    document.getElementById('previewModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const body = document.getElementById('modalBody');
    body.innerHTML = '<div class="modal-spinner"><div class="spinner"></div> Ładowanie…</div>';

    try {
        const buf = await file.arrayBuffer();
        previewPdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        previewTotal  = previewPdfDoc.numPages;
        previewPage   = Math.min(Math.max(startPage, 1), previewTotal);
        await renderPreviewPage(previewPage);
    } catch (e) {
        body.innerHTML = `<div class="modal-spinner" style="color:#f87171">Błąd: ${e.message}</div>`;
    }
}

async function openPreviewAtPage(name, page, chunkText = null) {
    previewSourceChunk = chunkText;
    if (previewPdfDoc && document.getElementById('previewTitle').textContent === name) {
        previewPage = Math.min(Math.max(page, 1), previewTotal);
        await renderPreviewPage(previewPage);
    } else {
        await openPreview(name, page, chunkText);
    }
}

async function renderPreviewPage(n) {
    const body = document.getElementById('modalBody');
    body.innerHTML = '<div class="modal-spinner"><div class="spinner"></div> Renderowanie…</div>';

    const page     = await previewPdfDoc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const maxW     = body.clientWidth - 40;
    const scale    = Math.min(maxW / viewport.width, 2.5);
    const vp       = page.getViewport({ scale });

    const canvas  = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;

    body.innerHTML = '';
    const wrap = el('div', 'modal-canvas-wrap');
    wrap.appendChild(canvas);
    body.appendChild(wrap);

    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    try {
        const textContent  = await page.getTextContent();
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className    = 'text-layer';
        textLayerDiv.style.cssText = `width:${vp.width}px;height:${vp.height}px`;
        wrap.appendChild(textLayerDiv);

        await pdfjsLib.renderTextLayer({
            textContent,
            container: textLayerDiv,
            viewport: vp,
            textDivs: []
        }).promise;

        if (previewSourceChunk) highlightTextLayer(textLayerDiv, previewSourceChunk);
    } catch (_) { /* text layer not critical */ }

    if (previewSourceChunk) {
        const panel = el('div', 'source-panel');
        const lbl   = el('div', 'source-panel-label');
        lbl.textContent = 'Znaleziony fragment';
        const txt = el('div', 'source-panel-text');
        txt.textContent = previewSourceChunk;
        panel.append(lbl, txt);
        body.appendChild(panel);
    }

    document.getElementById('pageInfo').textContent = `${n} / ${previewTotal}`;
    document.getElementById('prevBtn').disabled = n <= 1;
    document.getElementById('nextBtn').disabled = n >= previewTotal;
}

function highlightTextLayer(container, chunkText) {
    const words = chunkText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!words.length) return;
    container.querySelectorAll('span').forEach(span => {
        const t = span.textContent.toLowerCase();
        if (words.some(w => t.includes(w))) span.classList.add('hl');
    });
}

async function previewPrevPage() {
    if (previewPage > 1) { previewPage--; await renderPreviewPage(previewPage); }
}

async function previewNextPage() {
    if (previewPage < previewTotal) { previewPage++; await renderPreviewPage(previewPage); }
}

function closePreview() {
    document.getElementById('previewModal').classList.add('hidden');
    document.body.style.overflow = '';
    previewPdfDoc      = null;
    previewSourceChunk = null;
}

function onModalOverlayClick(e) {
    if (e.target === document.getElementById('previewModal')) closePreview();
}

// ════════════════════════════════════════════
// EVENTS + INIT
// ════════════════════════════════════════════
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

document.getElementById('fileInput').addEventListener('change', e => handleFiles(e.target.files));

document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) sendMessage(); }
});
document.getElementById('chatInput').addEventListener('input', function () { autoResize(this); });

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

onProviderChange();
setTheme(localStorage.getItem('docchat_theme') || 'light');
