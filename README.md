<p align="center">
  <img src="assets/logo.svg" alt="Local Mind" width="120" height="120"/>
</p>

<h1 align="center">Local Mind</h1>

<p align="center">
  <em>Persistent, private, local-first memory for Claude Code. Zero cloud. Zero API keys. All yours.</em>
</p>

Local Mind gives Claude Code a long-term memory that persists across sessions. It automatically captures what you work on, extracts facts, detects recurring errors, and injects relevant context when you start a new session -- all stored locally in SQLite on your machine.

## Why Local Mind?

This project started as a fork of [supermemoryai/claude-supermemory](https://github.com/supermemoryai/claude-supermemory) but has diverged completely. The original relies on a cloud API for storage and search. Local Mind replaced everything with local SQLite, added scoring with exponential decay, fact extraction, agent tracking, gotcha detection, and incremental transcript capture.

| Feature | Supermemory (original) | Local Mind |
|---------|----------------------|------------|
| Storage | Cloud API | Local SQLite |
| Privacy | Data sent to external server | 100% on your machine |
| Setup | Account + API key required | Zero config |
| Offline | No | Yes |
| Search | Cloud API | FTS5 + BM25 local |
| Scoring | Basic | Exponential decay + relevance |
| Fact extraction | No | Yes (session + user profile) |
| Agent tracking | No | Yes |
| Gotcha detection | No | Yes (recurring error patterns) |
| Incremental capture | No | Yes (byte-offset transcript reading) |
| Context preservation | No | Yes (PreCompact hook) |

## How It Works

Local Mind hooks into Claude Code's lifecycle events:

```
Session Start ──> Inject stored context (profile, facts, memories, gotchas)
     │
User Prompt ────> Incrementally capture transcript turns
     │
Tool Use ───────> Track agent invocations
     │
Pre-Compact ────> Save unsaved turns + re-inject context before compaction
     │
Session Stop ───> Final save + extract facts + detect gotchas + track agents
```

All data is stored in `~/.local-mind/memory.db` (SQLite with WAL mode and FTS5 full-text search).

## Features

- **Context injection on session start** -- Profile facts, recent context, relevant memories, gotchas, and agent stats are injected when you start a new Claude Code session
- **Incremental transcript capture** -- Reads only new bytes from the transcript file using byte-offset tracking, avoiding re-processing
- **Fact extraction** -- Automatically extracts session facts (dynamic, per-project) and user facts (static, cross-project) at session end
- **Exponential decay scoring** -- Memories are scored by `relevance * recency` where recency uses exponential decay (`e^(-0.15t)`, ~4.6 day half-life)
- **Agent usage tracking** -- Tracks which Claude Code agents are invoked, with counts and summaries
- **Gotcha detection** -- Detects recurring error patterns and promotes them to profile facts when they repeat enough
- **Context preservation on compaction** -- Re-injects memories before Claude Code compacts the context window, preventing memory loss
- **Context bracket system** -- Adapts how much context to inject based on transcript size (FRESH/LIGHT/MODERATE/HEAVY/CRITICAL)
- **Project isolation** -- Memories are scoped per project via container tags, with cross-project user facts

## Installation

```bash
# Clone the repo
git clone https://github.com/Pl3ntz/local-mind.git

# Install dependencies (root for build tools)
cd local-mind
npm install

# Install plugin dependencies
cd plugin && npm install && cd ..

# Build the plugin scripts
npm run build

# Install as Claude Code plugin
claude plugin add ./plugin
```

## Skills / Commands

| Command | Description |
|---------|-------------|
| `/local-mind:index` | Deep-index the current codebase into memory |
| `/local-mind:logout` | Clear all memories for the current project |
| `/local-mind:super-search "query"` | Search past sessions, decisions, and saved information |

## Architecture

```
local-mind/
  src/
    lib/
      local-mind-client.js    # Core client (CRUD, search, profile, facts)
      database.js              # SQLite setup, migrations, FTS5
      settings.js              # Config from ~/.local-mind/settings.json + env vars
      scoring.js               # Exponential decay scoring
      fact-extractor.js        # Session + user fact extraction
      agent-tracker.js         # Agent invocation tracking
      gotcha-tracker.js        # Recurring error pattern detection
      incremental-save.js      # Byte-offset transcript capture
      context-bracket.js       # Adaptive context injection sizing
      format-context.js        # Memory formatting for injection
      transcript-formatter.js  # JSONL transcript parsing
      container-tag.js         # Per-project scoping
    context-hook.js            # SessionStart hook
    prompt-hook.js             # UserPromptSubmit hook
    observation-hook.js        # PostToolUse hook
    compact-hook.js            # PreCompact hook
    summary-hook.js            # Stop hook
  plugin/
    scripts/*.cjs              # Built bundles (esbuild)
    hooks/hooks.json           # Hook definitions
    commands/                  # Slash commands
    skills/                    # Skills (super-search)
  tests/
    unit/                      # 15 test suites
    integration/               # 1 roundtrip test
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_MIND_DIR` | `~/.local-mind` | Data directory |
| `LOCAL_MIND_SKIP_TOOLS` | `Read,Glob,Grep,TodoWrite,AskUserQuestion` | Tools to skip capturing |
| `LOCAL_MIND_DEBUG` | `false` | Enable debug logging to stderr |

Legacy `LOCAL_MEMORY_*` env vars are still supported for backward compatibility.

### Settings File

`~/.local-mind/settings.json`:

```json
{
  "skipTools": ["Read", "Glob", "Grep", "TodoWrite", "AskUserQuestion"],
  "captureTools": ["Edit", "Write", "Bash", "Task"],
  "maxProfileItems": 5,
  "debug": false,
  "injectProfile": true
}
```

## Migration from claude-local-memory

If you were using the previous version (`~/.local-memory/`), Local Mind automatically migrates your data directory on first run. No manual steps needed.

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Build plugin scripts
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
