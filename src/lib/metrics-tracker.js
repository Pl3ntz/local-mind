/**
 * Metrics Tracker — Track agent effectiveness over time.
 *
 * Records: findings per agent, findings per session, recall usage.
 * Enables answering: "Do agents actually improve output?"
 */

function recordSessionMetrics(db, containerTag, sessionId, metrics) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS session_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      agents_spawned INTEGER DEFAULT 0,
      findings_captured INTEGER DEFAULT 0,
      findings_by_severity TEXT DEFAULT '{}',
      agents_used TEXT DEFAULT '[]',
      session_duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `).run();

  db.prepare(`
    INSERT INTO session_metrics (container_tag, session_id, agents_spawned, findings_captured, findings_by_severity, agents_used, session_duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      agents_spawned = excluded.agents_spawned,
      findings_captured = excluded.findings_captured,
      findings_by_severity = excluded.findings_by_severity,
      agents_used = excluded.agents_used,
      session_duration_seconds = excluded.session_duration_seconds
  `).run(
    containerTag,
    sessionId,
    metrics.agentsSpawned || 0,
    metrics.findingsCaptured || 0,
    JSON.stringify(metrics.findingsBySeverity || {}),
    JSON.stringify(metrics.agentsUsed || []),
    metrics.sessionDuration || null,
  );
}

function getMetricsSummary(db, containerTag, days = 30) {
  const rows = db.prepare(`
    SELECT * FROM session_metrics
    WHERE container_tag = ?
      AND created_at > datetime('now', ?)
    ORDER BY created_at DESC
  `).all(containerTag, `-${days} days`);

  if (rows.length === 0) {
    return {
      sessions: 0,
      totalFindings: 0,
      avgFindingsPerSession: 0,
      topAgents: [],
      severityDistribution: {},
    };
  }

  let totalFindings = 0;
  let totalAgents = 0;
  const agentCounts = {};
  const severityTotals = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };

  for (const row of rows) {
    totalFindings += row.findings_captured;
    totalAgents += row.agents_spawned;

    try {
      const agents = JSON.parse(row.agents_used);
      for (const a of agents) {
        agentCounts[a] = (agentCounts[a] || 0) + 1;
      }
    } catch { /* ignore */ }

    try {
      const sev = JSON.parse(row.findings_by_severity);
      for (const [k, v] of Object.entries(sev)) {
        severityTotals[k] = (severityTotals[k] || 0) + v;
      }
    } catch { /* ignore */ }
  }

  const topAgents = Object.entries(agentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    sessions: rows.length,
    totalFindings,
    avgFindingsPerSession: rows.length > 0 ? (totalFindings / rows.length).toFixed(1) : 0,
    avgAgentsPerSession: rows.length > 0 ? (totalAgents / rows.length).toFixed(1) : 0,
    topAgents,
    severityDistribution: severityTotals,
  };
}

function formatMetricsSummary(summary) {
  if (summary.sessions === 0) return '';

  const lines = [
    `## Métricas (últimos 30 dias)`,
    `- Sessões: ${summary.sessions}`,
    `- Findings: ${summary.totalFindings} (média ${summary.avgFindingsPerSession}/sessão)`,
    `- Agentes/sessão: ${summary.avgAgentsPerSession}`,
  ];

  if (summary.topAgents.length > 0) {
    lines.push(`- Top agentes: ${summary.topAgents.map(a => `${a.name}(${a.count})`).join(', ')}`);
  }

  const sev = summary.severityDistribution;
  const sevLine = Object.entries(sev).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ');
  if (sevLine) {
    lines.push(`- Severidade: ${sevLine}`);
  }

  return lines.join('\n');
}

module.exports = {
  recordSessionMetrics,
  getMetricsSummary,
  formatMetricsSummary,
};
