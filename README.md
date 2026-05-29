# MyExt Kod Düzenleyici — Demo Fork

This is a stripped-down fork of [Copilot Arena](https://github.com/lmarena/copilot-arena) built as a course demo.
It wires a fine-tuned LLM into VS Code and shows **two output formats side by side** so a course audience can compare them.

| Side | Format | What the model outputs |
| --- | --- | --- |
| **A** — left tab | SEARCH/REPLACE blocks (Aider-style) | Targeted hunks; only the changed lines |
| **B** — right tab | Whole-file rewrite (EDIT-Bench paper §D) | The complete file, rewritten |

No telemetry, no data collection, no login, no leaderboard.

---

## Quick start for teammates

### 1. Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [VS Code](https://code.visualstudio.com/) 1.85 or later
- `@vscode/vsce` for packaging (one-time install):

```bash
npm install -g @vscode/vsce
```

### 2. Clone and build

```bash
git clone <your-fork-url>
cd copilot-arena/vscode
npm install
npm run compile
```

### 3. Package as VSIX

```bash
cd vscode
vsce package --allow-missing-metadata
```

This produces `myext-0.1.0.vsix` in the `vscode/` folder.

### 4. Install in VS Code

1. Open VS Code
2. Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Extensions: Install from VSIX...**
3. Select the `myext-0.1.0.vsix` file
4. Click **Reload** when prompted

---

## Configuration — what every teammate must set

After installing, you need to provide two things: the **API base URL** and an **API key**.

### Set the API key (stored securely, never in settings files)

Command Palette → **MyExt: API Anahtarını Ayarla**

Paste your key and press Enter. The key is stored in VS Code's encrypted SecretStorage — it is **not** written to any settings file or committed to git.

> To update the key later, run the same command again.

### Set the API base URL and model name (in VS Code Settings)

Open Settings (`Ctrl+,` / `Cmd+,`) and search for `myext`.

| Setting | What to put | Example |
| --- | --- | --- |
| `myext.apiBaseUrl` | Root URL of your OpenAI-compatible endpoint, **no trailing slash** | `https://api.openai.com/v1` |
| `myext.model` | Exact model ID your endpoint expects | `ft:gpt-4o-mini-2024-07-18:org:name:id` |
| `myext.requestTimeoutMs` | Milliseconds before a request is cancelled | `60000` (default) |

You can also edit `settings.json` directly:

```jsonc
{
  "myext.apiBaseUrl": "https://api.openai.com/v1",
  "myext.model": "ft:gpt-4o-mini-2024-07-18:your-org:your-name:abc123",
  "myext.requestTimeoutMs": 60000
}
```

> The API key is **not** a settings.json field. It lives in SecretStorage. Do not put it in settings.json.

---

## Usage

1. Open any source file in VS Code.
2. Optionally **highlight** the section you want to change.
3. Press **Ctrl+I** (Windows/Linux) or **Cmd+I** (Mac).
4. Type your instruction in Turkish or English and press Enter.
5. Two diff tabs open side by side:
   - **Left — "A: Arama & Değiştirme"**: the SEARCH/REPLACE result
   - **Right — "B: Tüm Dosya"**: the whole-file rewrite
6. Pick your preferred result using the keybindings below.

| Key | Action |
| --- | --- |
| `Ctrl+1` / `Cmd+1` | Accept A — apply the SEARCH/REPLACE diff |
| `Ctrl+2` / `Cmd+2` | Accept B — apply the whole-file rewrite |
| `Ctrl+3` / `Cmd+3` | Reject both — original file is unchanged |

> If A fails to parse (model didn't follow the format), a warning is shown and `Ctrl+1` is disabled for that round. B is always available if the model responded.

---

## Development workflow (F5 dev host)

If you want to iterate on the extension code without packaging:

```bash
cd vscode
npm run compile   # or: npm run watch (rebuilds on save)
```

Then open the `vscode/` folder in VS Code and press **F5**. A second VS Code window opens with the extension loaded. After any code change: re-run compile, then reload the dev host window (`Ctrl+R`).

---

## Changing the prompts

The prompts are pinned for methodological fidelity with the EDIT-Bench paper.
They live in [`vscode/src/prompts.ts`](vscode/src/prompts.ts).

- `buildPromptA` — SEARCH/REPLACE format
- `buildPromptB` — Whole-file format (Figure 13 / Figure 15)

**Do not edit these without consulting the course instructor.**

---

## Changing the extension name / publisher

All identifiers use the placeholder prefix `myext` / `MyExt`.
To finalize them, do a project-wide search-and-replace:

- `package.json` → `name`, `displayName`, `publisher`
- `package.json` → all `"myext.*"` command and config IDs
- `src/extension.ts` → command ID strings
- `src/api.ts` → SecretStorage key `'myext.apiKey'`
- `src/statusBar.ts` → command ID `'myext.showOptions'`

---

## Repository layout

```text
copilot-arena/
  vscode/                    ← The VS Code extension (all work happens here)
    src/
      extension.ts           ← Entry point, command registration
      api.ts                 ← chatCompletion() — single OpenAI-compatible request
      prompts.ts             ← Prompt A and Prompt B templates (pinned)
      searchReplace.ts       ← SEARCH/REPLACE parser and applier
      promptToDiff.ts        ← Ctrl+I handler: fires A+B in parallel, calls manager
      statusBar.ts           ← Status bar (loading spinner / idle label)
      diff/verticalPerLine/
        manager.ts           ← Opens vscode.diff tabs, handles accept/reject
    package.json
    tsconfig.json
    esbuild.js
  server/                    ← Original Arena server (not used by this fork)
  data/                      ← Original Arena data (not used by this fork)
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "API key not set" error | Run **MyExt: API Anahtarını Ayarla** from Command Palette |
| Both sides show "Model isteği başarısız oldu" | Check `myext.apiBaseUrl` in Settings and verify the key is correct |
| "A uygulanamadı" warning | The model's SEARCH/REPLACE output didn't match the file exactly; use B instead |
| Diff tabs don't open | Make sure a file is open and focused before pressing Ctrl+I |
| Compile error after pulling changes | `cd vscode && npm install && npm run compile` |
