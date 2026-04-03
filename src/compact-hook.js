const { getContainerTag, getProjectName } = require('./lib/container-tag');
const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, writeOutput } = require('./lib/stdin');
const { saveIncrementalTurns } = require('./lib/incremental-save');
const { LocalMindClient } = require('./lib/local-mind-client');
const { formatContext } = require('./lib/format-context');

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const cwd = input.cwd || process.cwd();
    const sessionId = input.session_id;
    const transcriptPath = input.transcript_path;

    debugLog(settings, 'PreCompact', { sessionId });

    // Save any unsaved turns before compact discards them
    if (transcriptPath && sessionId) {
      const result = saveIncrementalTurns({ sessionId, transcriptPath, cwd });
      debugLog(settings, 'PreCompact save', result);
    }

    // Re-inject context so Claude retains memory after compact
    const containerTag = getContainerTag(cwd);
    const projectName = getProjectName(cwd);
    const client = new LocalMindClient(containerTag);
    const profileResult = await client
      .getProfile(containerTag, projectName)
      .catch(() => null);

    // Force CRITICAL bracket — maximize preservation before compact
    const additionalContext = formatContext(
      profileResult,
      settings.injectProfile,
      true,
      15,
    );

    if (additionalContext) {
      writeOutput({
        hookSpecificOutput: {
          hookEventName: 'PreCompact',
          additionalContext,
        },
      });
    } else {
      writeOutput({ continue: true });
    }
  } catch (err) {
    debugLog(settings, 'PreCompact error', { error: err.message });
    writeOutput({ continue: true });
  }
}

main().catch((err) => {
  console.error(`LocalMind fatal: ${err.message}`);
  process.exit(1);
});
