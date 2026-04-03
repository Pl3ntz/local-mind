---
name: agent-recall
description: Recall past findings from specialized agents. Use BEFORE spawning any agent to inject historical context. Enables shared memory between agents across sessions.
allowed-tools: Bash(node:*)
---

# Agent Recall — Shared Agent Memory

Query persistent findings from previous agent sessions. Use this skill to give agents awareness of what other agents have found in past sessions.

## How to Use

Before spawning an agent, run the recall script with the agent's name:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agent-recall.cjs" "AGENT_NAME"
```

Replace `AGENT_NAME` with the agent you're about to spawn (e.g., `code-reviewer`, `security-reviewer`, `architect`).

## Examples

- Before spawning code-reviewer:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/agent-recall.cjs" "code-reviewer"
  ```

- Before spawning security-reviewer:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/agent-recall.cjs" "security-reviewer"
  ```

- Before spawning architect:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/agent-recall.cjs" "architect"
  ```

## Output Format

Returns markdown with two sections:
1. **Seus achados anteriores** — past findings from the same agent type
2. **Achados de outros agentes** — relevant findings from other agents in the same project

Include this output in the agent's context preamble (`---agent-memory---` block).

## Integration with PE

The PE (Principal Engineer) should call this skill in the Agent Context Protocol (Section 9) before every agent spawn:

```
---agent-memory---
[output from /local-mind:agent-recall]
---end-agent-memory---
```

This enables agents to say: "Based on my previous analysis, I found X. Let me verify if it's still relevant."
