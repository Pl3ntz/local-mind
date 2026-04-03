/**
 * Agent Recall Script — Query past findings for a specific agent.
 *
 * Usage: node agent-recall.cjs <agent-name> [container-tag]
 *
 * If no container-tag provided, auto-detects from cwd using git root hash.
 */
const { getDb } = require('./lib/database');
const { queryFindings, formatFindingsForInjection } = require('./lib/agent-findings');
const { getContainerTag } = require('./lib/container-tag');

function main() {
  const args = process.argv.slice(2);
  const agentName = args[0];

  if (!agentName) {
    console.error('Usage: node agent-recall.cjs <agent-name> [container-tag]');
    process.exit(1);
  }

  const containerTag = args[1] || getContainerTag(process.cwd());
  const db = getDb();

  // Query findings for this agent + global findings
  const agentFindings = queryFindings(db, containerTag, {
    agentName,
    limit: 5,
    includeGlobal: false,
  });

  // Also get cross-agent findings (from other agents, same project)
  const crossAgentFindings = queryFindings(db, containerTag, {
    limit: 5,
    includeGlobal: true,
  }).filter((f) => f.agent_name !== agentName);

  const allFindings = [...agentFindings, ...crossAgentFindings.slice(0, 3)];

  if (allFindings.length === 0) {
    console.log('Nenhum achado anterior encontrado para este agente/projeto.');
    return;
  }

  // Format for injection
  const ownSection = agentFindings.length > 0
    ? `## Seus achados anteriores (${agentName})\n${formatFindingsForInjection(agentFindings)}`
    : '';

  const crossSection = crossAgentFindings.length > 0
    ? `## Achados de outros agentes neste projeto\n${formatFindingsForInjection(crossAgentFindings.slice(0, 3))}`
    : '';

  const output = [ownSection, crossSection].filter(Boolean).join('\n\n');
  console.log(output);
}

main();
