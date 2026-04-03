const { loadSettings, debugLog } = require('./lib/settings');
const { readStdin, outputSuccess } = require('./lib/stdin');
const { saveIncrementalTurns } = require('./lib/incremental-save');

async function main() {
  const settings = loadSettings();

  try {
    const input = await readStdin();
    const sessionId = input.session_id;
    const transcriptPath = input.transcript_path;
    const cwd = input.cwd || process.cwd();

    debugLog(settings, 'UserPromptSubmit', { sessionId });

    if (transcriptPath && sessionId) {
      const result = saveIncrementalTurns({ sessionId, transcriptPath, cwd });
      debugLog(settings, 'Incremental save result', result);
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
