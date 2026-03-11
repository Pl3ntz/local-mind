const KNOWN_AGENTS = new Set([
  'staff-engineer',
  'architect',
  'planner',
  'security-reviewer',
  'code-reviewer',
  'ux-reviewer',
  'tdd-guide',
  'e2e-runner',
  'incident-responder',
  'performance-optimizer',
  'database-specialist',
  'devops-specialist',
  'build-error-resolver',
  'refactor-cleaner',
  'doc-updater',
  'explore',
  'general-purpose',
  'bash',
  'plan',
]);

function normalizeAgentName(rawName) {
  if (!rawName) return null;

  const trimmed = String(rawName).trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-');

  return normalized;
}

function trackAgentInvocation(db, containerTag, sessionId, agentName, taskSummary) {
  const normalized = normalizeAgentName(agentName);
  if (!normalized) return;

  const existing = db
    .prepare(
      'SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?',
    )
    .get(containerTag, sessionId, normalized);

  if (existing) {
    db.prepare(
      'UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?',
    ).run(existing.invocation_count + 1, taskSummary, existing.id);
  } else {
    db.prepare(
      'INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)',
    ).run(containerTag, sessionId, normalized, taskSummary);
  }
}

function getAgentStats(db, containerTag, limit = 10) {
  return db
    .prepare(
      `SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`,
    )
    .all(containerTag, limit);
}

function formatAgentStats(stats) {
  if (!stats || stats.length === 0) return '';

  const lines = stats.map((s) => {
    const sessionLabel = s.sessions_used === 1 ? 'session' : 'sessions';
    return `- **${s.agent_name}**: ${s.total_invocations}x (${s.sessions_used} ${sessionLabel})`;
  });

  return `## Agent Usage\n${lines.join('\n')}`;
}

module.exports = {
  normalizeAgentName,
  trackAgentInvocation,
  getAgentStats,
  formatAgentStats,
  KNOWN_AGENTS,
};
