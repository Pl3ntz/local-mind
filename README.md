<p align="center">
  <img src="assets/logo.svg" alt="Local Mind" width="120" height="120"/>
</p>

<h1 align="center">Local Mind</h1>

<p align="center">
  <em>Persistent, private, local-first memory for Claude Code. Zero cloud. Zero API keys. All yours.</em>
</p>

<p align="center">
  <a href="#installation">Installation</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#shared-agent-memory">Shared Agent Memory</a> &bull;
  <a href="#skills--commands">Commands</a> &bull;
  <a href="#architecture">Architecture</a>
</p>

---

Local Mind gives Claude Code a long-term memory that persists across sessions. It automatically captures what you work on, extracts facts, detects recurring errors, shares knowledge between agents, and injects relevant context when you start a new session — all stored locally in SQLite on your machine.

> Originally inspired by [supermemoryai/claude-supermemory](https://github.com/supermemoryai/claude-supermemory) (cloud-based). Local Mind was rebuilt from scratch with a completely different architecture: local SQLite instead of cloud API, exponential decay scoring, shared agent memory, BLUF parser, severity-based decay, and 310 tests.

## Features

### Core Memory
- **Context injection on session start** — Profile facts, recent context, relevant memories, gotchas, and agent stats injected automatically
- **Incremental transcript capture** — Reads only new bytes using offset tracking, no re-processing
- **Fact extraction** — Session facts (per-project) and user facts (cross-project) extracted at session end
- **Exponential decay scoring** — `BM25 * 0.7 + Recency * 0.3` where recency = `e^(-0.15t)` (~4.6 day half-life)
- **Gotcha detection** — Recurring error patterns detected and promoted to profile facts at 3+ occurrences
- **Agent usage tracking** — Tracks which agents are invoked, with counts and summaries

### Shared Agent Memory
- **Agent findings persistence** — Agents save structured findings (severity, files, status) that survive across sessions
- **BLUF output parser** — Extracts findings from 4 agent output formats (ACHADOS, IMPACTO, ERROS, DECISAO)
- **Agent recall skill** — Query past findings per agent before spawning, enabling cross-agent knowledge
- **Severity-based decay** — CRITICAL findings persist 35 days, INFO decays in 3.5 days
- **Recall boost** — Frequently-used findings rise in relevance (feedback loop, cap 1.5x)
- **Session metrics** — Tracks agents spawned, findings captured, severity distribution per session

### Context Management
- **Context preservation on compaction** — Re-injects memories before Claude Code compacts the context window
- **Adaptive context brackets** — Adjusts injection volume based on remaining context (FRESH/LIGHT/MODERATE/HEAVY/CRITICAL)
- **Project isolation** — Memories scoped per project via container tags, with cross-project user facts

## How It Works

```
Session Start ──> Inject stored context (profile, facts, memories, gotchas, agent findings)
     |
User Prompt ────> Incrementally capture transcript turns
     |
Tool Use ───────> Track agent invocations
     |
Pre-Compact ────> Save unsaved turns + re-inject context before compaction
     |
Session Stop ───> Final save + extract facts + detect gotchas + capture agent findings + metrics
```

All data stored in `~/.local-mind/memory.db` (SQLite with WAL mode and FTS5 full-text search).

## Installation

```bash
git clone https://github.com/Pl3ntz/local-mind.git
cd local-mind
npm install
cd plugin && npm install && cd ..
npm run build
claude plugin add ./plugin
```

## Skills / Commands

| Command | Description |
|---------|-------------|
| `/local-mind:super-search "query"` | Search past sessions, decisions, and saved information |
| `/local-mind:agent-recall "agent-name"` | Recall past findings for a specific agent (own + cross-agent) |
| `/local-mind:index` | Deep-index the current codebase into memory |
| `/local-mind:logout` | Clear all memories for the current project |

## Architecture

```
local-mind/
  src/
    lib/
      local-mind-client.js    # Core client (CRUD, search, profile, facts)
      database.js              # SQLite setup, migrations, FTS5, 9 tables
      scoring.js               # BM25 + exponential decay + recall boost
      agent-findings.js        # Shared Agent Memory (save, query, reinforce)
      bluf-parser.js           # BLUF output parser (extract findings from agents)
      metrics-tracker.js       # Session metrics (agents, findings, severity)
      fact-extractor.js        # Session + user fact extraction
      agent-tracker.js         # Agent invocation tracking
      gotcha-tracker.js        # Recurring error pattern detection
      incremental-save.js      # Byte-offset transcript capture
      context-bracket.js       # Adaptive context injection sizing
      format-context.js        # Memory formatting for injection
      transcript-formatter.js  # JSONL transcript parsing
      container-tag.js         # Per-project scoping
      settings.js              # Config from ~/.local-mind/settings.json
      validate-local.js        # Input sanitization
    context-hook.js            # SessionStart hook
    prompt-hook.js             # UserPromptSubmit hook
    observation-hook.js        # PostToolUse hook
    compact-hook.js            # PreCompact hook
    summary-hook.js            # Stop hook
    agent-recall.js            # Agent recall CLI script
  plugin/
    scripts/*.cjs              # Built bundles (esbuild)
    hooks/hooks.json           # Hook definitions
    commands/                  # Slash commands
    skills/
      super-search/            # Memory search skill
      agent-recall/            # Agent findings recall skill
  tests/
    unit/                      # 18 test suites
    integration/               # Roundtrip test
```

**Total: 18 test suites, 310 tests.**

## Database Schema

| Table | Purpose |
|-------|---------|
| `memories` | Session turns and manual memories |
| `memories_fts` | FTS5 full-text search index |
| `profile_facts` | Static/dynamic/gotcha facts with confidence + decay |
| `sessions` | Session tracking with byte-offset |
| `gotchas_tracking` | Error pattern detection + promotion |
| `agent_usage` | Agent invocation tracking |
| `agent_findings` | Shared Agent Memory findings |
| `findings_fts` | FTS5 index for agent findings |
| `recall_log` | Finding injection tracking |
| `session_metrics` | Per-session agent effectiveness |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_MIND_DIR` | `~/.local-mind` | Data directory |
| `LOCAL_MIND_SKIP_TOOLS` | `Read,Glob,Grep,TodoWrite,AskUserQuestion` | Tools to skip |
| `LOCAL_MIND_DEBUG` | `false` | Enable debug logging |

### Settings File

`~/.local-mind/settings.json`:

```json
{
  "skipTools": ["Read", "Glob", "Grep", "TodoWrite", "AskUserQuestion"],
  "captureTools": ["Edit", "Write", "Bash", "Task"],
  "debug": false,
  "injectProfile": true
}
```

## Development

```bash
npm test              # Run tests (18 suites, 310 tests)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run build         # Build plugin scripts
npm run lint          # Lint with Biome
npm run format        # Format with Biome
```

## Integration with Quarterdeck

Local Mind works standalone, but integrates with [Quarterdeck](https://github.com/Pl3ntz/quarterdeck) for full agent orchestration:

- **Agent findings** captured from Quarterdeck's 16 specialized agents persist in local-mind
- **Agent recall** injects historical context before spawning agents
- **Session metrics** track agent effectiveness over time

## Author

Created by [Pl3ntz](https://github.com/Pl3ntz)

## License

MIT
