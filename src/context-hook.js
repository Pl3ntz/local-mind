const { execSync } = require('node:child_process');
const path = require('node:path');
const { LocalMindClient } = require('./lib/local-mind-client');
const { getContainerTag, getProjectName, getUserContainerTag } = require('./lib/container-tag');
const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, writeOutput } = require('./lib/stdin');
const { formatContext } = require('./lib/format-context');
const { estimateContextBracket } = require('./lib/context-bracket');
const { getRelevantGotchas } = require('./lib/gotcha-tracker');
const { getAgentStats, formatAgentStats } = require('./lib/agent-tracker');

function buildContextualQuery(cwd, projectName) {
  const queryParts = [projectName];

  if (!cwd || !path.isAbsolute(cwd)) return queryParts.join(' ');

  try {
    const branch = execSync('git branch --show-current', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (branch && !['main', 'master'].includes(branch)) {
      queryParts.push(branch);
    }
  } catch {
    // not a git repo or git not available
  }

  try {
    const files = execSync('git diff --name-only HEAD~3 HEAD 2>/dev/null | head -5', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();
    if (files) {
      const fileNames = files
        .split('\n')
        .map((f) => f.split('/').pop())
        .filter(Boolean);
      queryParts.push(...fileNames);
    }
  } catch {
    // no recent commits or git not available
  }

  return queryParts.join(' ');
}

function getUserFacts() {
  try {
    const { getDb } = require('./lib/database');
    const db = getDb();
    const userTag = getUserContainerTag();

    return db
      .prepare(
        `SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY reinforced_at DESC LIMIT 5`,
      )
      .all(userTag)
      .map((r) => r.fact_text);
  } catch {
    return [];
  }
}

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const cwd = input.cwd || process.cwd();
    const containerTag = getContainerTag(cwd);
    const projectName = getProjectName(cwd);

    debugLog(settings, 'SessionStart', { cwd, containerTag, projectName });

    const query = buildContextualQuery(cwd, projectName);
    debugLog(settings, 'Contextual query', { query });

    const client = new LocalMindClient(containerTag);
    const profileResult = await client
      .getProfile(containerTag, query)
      .catch(() => null);

    // Merge cross-project user facts into profile
    if (profileResult) {
      const userFacts = getUserFacts();
      if (userFacts.length > 0) {
        const existingStatic = new Set(profileResult.profile.static);
        const newFacts = userFacts.filter((f) => !existingStatic.has(f));
        profileResult.profile.static = [...newFacts, ...profileResult.profile.static];
      }
    }

    const transcriptPath = input.transcript_path;
    const bracket = estimateContextBracket(transcriptPath);
    debugLog(settings, 'Context bracket', { bracket: bracket.bracket, maxResults: bracket.maxResults });

    const additionalContext = formatContext(
      profileResult,
      settings.injectProfile,
      bracket.includeSearch,
      bracket.maxResults,
    );

    if (!additionalContext) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `<local-mind-context>
No previous memories found for this project.
Memories will be saved as you work.
</local-mind-context>`,
        },
      });
      return;
    }

    // Inject gotchas if bracket allows it
    let finalContext = additionalContext;
    if (bracket.includeGotchas) {
      try {
        const { getDb } = require('./lib/database');
        const gotchasMarkdown = getRelevantGotchas(getDb(), containerTag, query);
        if (gotchasMarkdown) {
          finalContext = finalContext.replace(
            '</local-mind-context>',
            `\n${gotchasMarkdown}\n</local-mind-context>`,
          );
        }
      } catch {
        // Gotcha injection is best-effort
      }
    }

    // Inject agent usage stats if bracket allows gotchas (same gate)
    if (bracket.includeGotchas) {
      try {
        const { getDb: getDatabase } = require('./lib/database');
        const stats = getAgentStats(getDatabase(), containerTag, 8);
        const statsMarkdown = formatAgentStats(stats);
        if (statsMarkdown) {
          finalContext = finalContext.replace(
            '</local-mind-context>',
            `\n${statsMarkdown}\n</local-mind-context>`,
          );
        }
      } catch {
        // Agent stats injection is best-effort
      }
    }

    debugLog(settings, 'Context generated', {
      length: finalContext.length,
      bracket: bracket.bracket,
    });

    writeOutput({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: finalContext },
    });
  } catch (err) {
    debugLog(settings, 'Error', { error: err.message });
    console.error(`LocalMind: ${err.message}`);
    writeOutput({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `<local-mind-status>
Failed to load memories. Session will continue without memory context.
</local-mind-status>`,
      },
    });
  }
}

module.exports = { buildContextualQuery, getUserFacts };

main().catch((err) => {
  console.error(`LocalMind fatal: ${err.message}`);
  process.exit(1);
});
