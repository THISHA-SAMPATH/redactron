# Redactron — Privacy-First Web Copilot

A browser extension that guides you through **any website's UI** using
natural-language goals, while guaranteeing that sensitive data on the
page is redacted **on-device, before anything is sent to an LLM.**

Most "AI browser copilots" ship a screenshot of your screen to a server.
Redactron never does that: it extracts a structured, accessibility-tree-style
snapshot of the page, strips out anything that looks like a secret or PII
using a local regex/heuristic engine, and only then sends the sanitized
snapshot to the model. Every proposed action is highlighted on the real
page and requires an explicit user click to execute — nothing runs
automatically.

Works with **Gemini or Groq (both free, no card required)**, or Claude
if you have API credits — swap providers anytime from the popup settings.

## How it works

```
┌─────────────┐   DOM    ┌──────────────────────┐   redacted   ┌─────────────┐
│  Live page   │ ───────▶ │ pageStateExtractor.js │ ───────────▶│ redaction.js │
│ (any website)│          │ (accessibility-tree)  │   snapshot   │ (on-device)  │
└─────────────┘          └──────────────────────┘              └──────┬──────┘
                                                                        │
                                                        redacted only   ▼
┌─────────────┐  highlight+confirm  ┌────────────────┐   fetch()  ┌──────────────┐
│ actionGrounder│◀────────────────── │  background.js │ ─────────▶│ Gemini/Groq/ │
│ (content script)│  next action     │ (service worker)│           │ Claude API   │
└─────────────┘                     └────────────────┘           └──────────────┘
```

- **`src/pageStateExtractor.js`** — walks the live DOM and produces a compact
  JSON snapshot of interactive elements (role, label, text, position) —
  never raw HTML, never a screenshot.
- **`src/redaction.js`** — the only thing standing between page content and
  the network. Regex-based detection for AWS/Azure/GCP identifiers, ARNs,
  access keys, JWTs, emails, phone numbers, credit cards (Luhn-validated),
  SSNs, IPs, IBANs. Runs entirely in the content script.
- **`src/actionGrounder.js`** — resolves the model's proposed action back to
  a real DOM element, highlights it on the page, and waits for the user to
  click **Confirm** or **Skip** before anything executes.
- **`src/agentLoop.js`** — pure prompt-building and response-parsing logic
  (no network calls) shared with the background worker.
- **`src/providers/`** — one small adapter per LLM (`gemini.js`, `groq.js`,
  `anthropic.js`) behind a common `callProvider(id, key, system, user)`
  interface. Swapping providers never touches redaction, extraction, or
  grounding — that's the whole point of the abstraction.
- **`src/background.js`** — the *only* file allowed to call `fetch()`. Owns
  the agent loop: get redacted snapshot → call the configured provider →
  propose action → wait for confirmation → repeat, up to a step limit.
- **`popup-src/`** — the popup UI source: React + Framer Motion + lucide-react,
  bundled with esbuild into `popup/popup.bundle.js` (no CDN scripts, no
  `eval`, safe under the default MV3 extension CSP).

## Setup

1. Load the extension:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - **Load unpacked** → select the `redactron/` folder
2. Click the Redactron icon → gear icon → pick a provider chip
   (**Gemini** is the default, free, no card required) → paste an API key:
   - Gemini key: https://aistudio.google.com/apikey
   - Groq key: https://console.groq.com/keys
   - Claude key (paid): https://console.anthropic.com
3. Navigate to any page, open the popup, and either:
   - **Scan page for sensitive data** — standalone redaction demo, no LLM call
   - Type a goal (e.g. *"create a new storage bucket"*) and click
     **Start guiding**

Keys are stored locally via `chrome.storage.local` and are only ever sent
directly from the background service worker to that provider's API — never
bundled into the extension, never sent anywhere else.

## Rebuilding the popup UI

The popup ships pre-built (`popup/popup.bundle.js`), so it works out of the
box. If you want to edit `popup-src/`:

```bash
npm install
npm run build   # rebuilds popup/popup.bundle.js via esbuild
```

Then reload the extension from `chrome://extensions`.

## Known limitations (be upfront about these in an interview)

- **Action grounding is probabilistic.** The model can propose the wrong
  element on cluttered or unusual UIs. This is why every action requires
  explicit confirmation before it executes — treat that as the safety
  boundary, not a UX inconvenience.
- **Redaction is regex/heuristic-based (Phase 1).** It reliably catches
  structured secrets (keys, ARNs, cards, emails) but not free-text PII like
  names embedded in prose. A Phase 2 addition would be a local NER model
  (e.g. via `transformers.js`) running in the content script for that case.
- **One LLM call per navigation step.** Fine for a demo; a known scaling/
  cost constraint worth naming rather than hiding.
- **Free-tier rate limits.** Gemini and Groq's free tiers are generous but
  not unlimited — expect occasional 429s under heavy testing.

## Repo layout

```
redactron/
├── manifest.json
├── package.json               # dev deps: react, framer-motion, lucide-react, esbuild
├── src/
│   ├── redaction.js            # on-device redaction engine
│   ├── pageStateExtractor.js   # DOM → structured snapshot
│   ├── actionGrounder.js       # snapshot action → real DOM + confirm UI
│   ├── content.js              # content-script message router
│   ├── agentLoop.js            # prompt building / response parsing
│   ├── background.js           # service worker, owns the only fetch()
│   ├── providers/              # gemini.js / groq.js / anthropic.js / index.js
│   └── overlay.css             # highlight + tooltip styling
├── popup-src/                  # React source for the popup (edit here)
│   ├── main.jsx
│   ├── App.jsx
│   ├── providers.js
│   └── components/
│       ├── Header.jsx
│       ├── SettingsPanel.jsx
│       ├── GoalPanel.jsx
│       └── ActivityLog.jsx
├── popup/                      # built output, loaded by the extension
│   ├── popup.html
│   ├── popup.css
│   └── popup.bundle.js         # pre-built — run `npm run build` to refresh
└── icons/
```

