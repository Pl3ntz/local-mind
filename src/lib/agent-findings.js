const { findingDecayedConfidence, recallBoost, CONFIDENCE_PRUNE_THRESHOLD } = require('./scoring');

const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function saveFinding(db, { containerTag, sessionId, agentName, severity, findingText, fileRefs = [] }) {
  if (!VALID_SEVERITIES.includes(severity)) {
    throw new Error(`Invalid severity: ${severity}. Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  const relatedFiles = JSON.stringify(fileRefs);

  const existing = db
    .prepare('SELECT id, confidence FROM agent_findings WHERE container_tag = ? AND agent_name = ? AND finding_text = ?')
    .get(containerTag, agentName, findingText);

  if (existing) {
    db.prepare(
      `UPDATE agent_findings SET
         confidence = MIN(confidence + 0.2, 2.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         session_id = ?
       WHERE id = ?`,
    ).run(sessionId, existing.id);

    return { id: existing.id, status: 'reinforced' };
  }

  const result = db
    .prepare(
      `INSERT INTO agent_findings (container_tag, agent_name, session_id, finding_text, severity, related_files)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(containerTag, agentName, sessionId, findingText, severity, relatedFiles);

  return { id: result.lastInsertRowid, status: 'created' };
}

function queryFindings(db, containerTag, options = {}) {
  const { agentName, limit = 10, includeGlobal = false } = options;

  let sql = `SELECT * FROM agent_findings WHERE status = 'open'`;
  const params = [];

  if (includeGlobal) {
    sql += ' AND (container_tag = ? OR container_tag = ?)';
    params.push(containerTag, '_global');
  } else {
    sql += ' AND container_tag = ?';
    params.push(containerTag);
  }

  if (agentName) {
    sql += ' AND agent_name = ?';
    params.push(agentName);
  }

  sql += ` ORDER BY
    CASE severity
      WHEN 'CRITICAL' THEN 5
      WHEN 'HIGH' THEN 4
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 2
      WHEN 'INFO' THEN 1
    END DESC,
    reinforced_at DESC
  LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  // Filter by effective confidence (decay + recall boost)
  return rows.filter((r) => {
    const effective = findingDecayedConfidence(r.confidence, r.reinforced_at, r.severity)
      * recallBoost(r.recall_count);
    return effective >= CONFIDENCE_PRUNE_THRESHOLD;
  });
}

function formatFindingsForInjection(findings) {
  if (!findings || findings.length === 0) return '';

  const lines = findings.map((f) => {
    const date = f.created_at ? f.created_at.split('T')[0] : 'unknown';
    return `- [${date}] **${f.severity}** (${f.agent_name}): ${f.finding_text}`;
  });

  return lines.join('\n');
}

function reinforceFindings(db, findingIds) {
  if (!findingIds || findingIds.length === 0) return;

  const stmt = db.prepare(
    `UPDATE agent_findings SET
       recall_count = recall_count + 1,
       reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
  );

  for (const id of findingIds) {
    stmt.run(id);
  }
}

module.exports = {
  saveFinding,
  queryFindings,
  formatFindingsForInjection,
  reinforceFindings,
  VALID_SEVERITIES,
};
