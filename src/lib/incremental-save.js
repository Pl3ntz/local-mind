const fs = require('node:fs');
const { LocalMindClient } = require('./local-mind-client');
const { getContainerTag, getProjectName } = require('./container-tag');
const { formatNewEntries } = require('./transcript-formatter');
const { getDb } = require('./database');
const { debugLog, loadSettings } = require('./settings');

function getSessionTracking(sessionId) {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?',
    )
    .get(sessionId);

  return row
    ? {
        lastUuid: row.last_captured_uuid,
        lastByteOffset: row.last_byte_offset || 0,
        containerTag: row.container_tag,
        projectName: row.project_name,
      }
    : { lastUuid: null, lastByteOffset: 0, containerTag: null, projectName: null };
}

function updateSessionTracking(sessionId, uuid, byteOffset, containerTag, projectName) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM sessions WHERE session_id = ?')
    .get(sessionId);

  if (existing) {
    db.prepare(
      `UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`,
    ).run(uuid, byteOffset, sessionId);
  } else {
    db.prepare(
      `INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, containerTag, projectName, uuid, byteOffset);
  }
}

function readNewEntries(transcriptPath, lastByteOffset) {
  if (!fs.existsSync(transcriptPath)) {
    return { entries: [], newOffset: lastByteOffset };
  }

  const stat = fs.statSync(transcriptPath);

  // File truncated/rotated — reset offset
  let offset = lastByteOffset;
  if (stat.size < offset) {
    offset = 0;
  }

  if (stat.size === offset) {
    return { entries: [], newOffset: offset };
  }

  const fd = fs.openSync(transcriptPath, 'r');
  let buffer;
  try {
    buffer = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buffer, 0, buffer.length, offset);
  } finally {
    fs.closeSync(fd);
  }

  const lines = buffer.toString('utf-8').split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  return { entries, newOffset: stat.size };
}

function saveIncrementalTurns({ sessionId, transcriptPath, cwd }) {
  if (!transcriptPath || !sessionId) {
    return { saved: false, reason: 'missing_params' };
  }

  const settings = loadSettings();
  const tracking = getSessionTracking(sessionId);
  const containerTag = tracking.containerTag || getContainerTag(cwd);
  const projectName = tracking.projectName || getProjectName(cwd);

  const { entries, newOffset } = readNewEntries(transcriptPath, tracking.lastByteOffset);

  if (entries.length === 0) {
    return { saved: false, reason: 'no_new_entries' };
  }

  const newEntries = entries.filter((e) => e.type === 'user' || e.type === 'assistant');
  if (newEntries.length === 0) {
    updateSessionTracking(sessionId, tracking.lastUuid, newOffset, containerTag, projectName);
    return { saved: false, reason: 'no_user_assistant_entries' };
  }

  const result = formatNewEntries(transcriptPath, tracking.lastUuid);

  if (!result) {
    updateSessionTracking(sessionId, tracking.lastUuid, newOffset, containerTag, projectName);
    return { saved: false, reason: 'format_empty' };
  }

  const client = new LocalMindClient();
  client.addMemory(
    result.formatted,
    containerTag,
    {
      type: 'session_turn',
      project: projectName,
      timestamp: new Date().toISOString(),
    },
    sessionId,
  );

  updateSessionTracking(sessionId, result.lastUuid, newOffset, containerTag, projectName);

  debugLog(settings, 'Incremental save', {
    entries: newEntries.length,
    bytes: newOffset - tracking.lastByteOffset,
  });

  return { saved: true, entries: newEntries.length, newOffset };
}

module.exports = {
  readNewEntries,
  saveIncrementalTurns,
  getSessionTracking,
  updateSessionTracking,
};
