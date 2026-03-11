const { getContainerTag, getProjectName, getUserContainerTag } = require('./lib/container-tag');
const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, writeOutput } = require('./lib/stdin');
const { saveIncrementalTurns, getSessionTracking } = require('./lib/incremental-save');
const { readNewEntries } = require('./lib/incremental-save');
const { extractFacts } = require('./lib/fact-extractor');
const { trackError } = require('./lib/gotcha-tracker');
const { trackAgentInvocation } = require('./lib/agent-tracker');
const { getDb } = require('./lib/database');
const { LocalMindClient } = require('./lib/local-mind-client');

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const cwd = input.cwd || process.cwd();
    const sessionId = input.session_id;
    const transcriptPath = input.transcript_path;

    debugLog(settings, 'Stop', { sessionId, transcriptPath });

    if (!transcriptPath || !sessionId) {
      debugLog(settings, 'Missing transcript path or session id');
      writeOutput({ continue: true });
      return;
    }

    // Final incremental save
    const saveResult = saveIncrementalTurns({ sessionId, transcriptPath, cwd });
    debugLog(settings, 'Final save', saveResult);

    // Extract and save facts
    const tracking = getSessionTracking(sessionId);
    const containerTag = getContainerTag(cwd);
    const projectName = getProjectName(cwd);

    // Read full transcript for fact extraction (from byte 0)
    const { entries } = readNewEntries(transcriptPath, 0);

    if (entries.length > 0) {
      const facts = extractFacts(entries);
      const client = new LocalMindClient();

      // Dynamic facts per project
      for (const fact of facts.sessionFacts) {
        client.addProfileFact(containerTag, 'dynamic', fact);
      }
      client.pruneOldDynamicFacts(containerTag, 20);

      // Track errors for gotcha detection
      const errorFacts = facts.sessionFacts.filter((f) => f.startsWith('errors:'));
      for (const errorFact of errorFacts) {
        const errors = errorFact.replace('errors: ', '').split('; ');
        for (const err of errors) {
          if (err.trim()) {
            trackError(getDb(), containerTag, err.trim());
          }
        }
      }

      // Static facts (user preferences, cross-project)
      if (facts.userFacts.length > 0) {
        const userTag = getUserContainerTag();
        for (const fact of facts.userFacts) {
          client.addProfileFact(userTag, 'static', fact);
        }
      }

      // Safety net: extract agent invocations from transcript
      for (const entry of entries) {
        if (entry.type !== 'assistant') continue;
        const content = entry.message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
          if (block.type === 'tool_use' && block.name === 'Task') {
            const agentName = block.input?.subagent_type;
            if (agentName) {
              trackAgentInvocation(
                getDb(),
                containerTag,
                sessionId,
                agentName,
                (block.input?.description || '').slice(0, 200) || null,
              );
            }
          }
        }
      }

      debugLog(settings, 'Facts extracted', {
        session: facts.sessionFacts.length,
        user: facts.userFacts.length,
      });
    }

    writeOutput({ continue: true });
  } catch (err) {
    debugLog(settings, 'Error', { error: err.message });
    console.error(`LocalMind: ${err.message}`);
    writeOutput({ continue: true });
  }
}

main().catch((err) => {
  console.error(`LocalMind fatal: ${err.message}`);
  process.exit(1);
});
