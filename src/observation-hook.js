const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, outputSuccess } = require('./lib/stdin');
const { getContainerTag } = require('./lib/container-tag');
const { trackAgentInvocation } = require('./lib/agent-tracker');
const { getDb } = require('./lib/database');

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const sessionId = input.session_id;
    const toolName = input.tool_name;
    const cwd = input.cwd || process.cwd();

    debugLog(settings, 'PostToolUse', { sessionId, toolName });

    if (toolName === 'Task' && input.tool_input) {
      const agentName = input.tool_input.subagent_type;
      if (agentName && sessionId) {
        try {
          const containerTag = getContainerTag(cwd);
          const summary = (input.tool_input.description || '').slice(0, 200) || null;
          trackAgentInvocation(getDb(), containerTag, sessionId, agentName, summary);
          debugLog(settings, 'Agent tracked', { agentName, containerTag });
        } catch (trackErr) {
          debugLog(settings, 'Agent tracking failed', { error: trackErr.message });
        }
      }
    }

    outputSuccess();
  } catch (err) {
    debugLog(settings, 'Error', { error: err.message });
    outputSuccess();
  }
}

main().catch((err) => {
  console.error(`LocalMind fatal: ${err.message}`);
  process.exit(1);
});
