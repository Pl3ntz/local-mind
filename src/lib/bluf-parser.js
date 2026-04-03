/**
 * BLUF Parser — Extracts structured findings from agent output in BLUF format.
 *
 * Supports multiple output formats:
 * - ACHADOS (code-reviewer, security-reviewer, ux-reviewer, database-specialist, performance-optimizer)
 * - IMPACTO CROSS-SYSTEM (staff-engineer)
 * - ERROS CORRIGIDOS (build-error-resolver)
 * - DECISÃO DE DESIGN (architect)
 */

const SEVERITY_PATTERN = /\*\*\[(CRITICAL|HIGH|MEDIUM|LOW|INFO)\]\*\*/;
const FILE_PATTERN = /`(\.?[^`\s]*[./][^`\s]*)`/g;
const ACHADOS_SECTION = /###\s+ACHADOS[^\n]*/;
const IMPACTO_SECTION = /###\s+IMPACTO CROSS-SYSTEM/;
const ERROS_SECTION = /###\s+ERROS CORRIGIDOS/;
const DECISAO_SECTION = /###\s+DECISÃO DE DESIGN/;

function extractFilesFromText(text) {
  const files = [];
  const matches = text.matchAll(FILE_PATTERN);
  for (const match of matches) {
    const filePath = match[1].split(':')[0];
    if (filePath && !files.includes(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function extractSection(text, sectionPattern) {
  const match = text.match(sectionPattern);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  const rest = text.slice(startIdx);

  const nextSection = rest.match(/\n###\s+/);
  const endIdx = nextSection ? nextSection.index : rest.length;

  return rest.slice(0, endIdx).trim();
}

function parseAchadosLines(sectionText) {
  const findings = [];
  const lines = sectionText.split('\n').filter((l) => l.trim().startsWith('-'));

  for (const line of lines) {
    const severityMatch = line.match(SEVERITY_PATTERN);
    const severity = severityMatch ? severityMatch[1] : null;
    if (!severity) continue;

    const textAfterSeverity = line.slice(line.indexOf(severityMatch[0]) + severityMatch[0].length).trim();
    const files = extractFilesFromText(line);

    findings.push({
      severity,
      text: textAfterSeverity.replace(FILE_PATTERN, '').replace(/\s*[—-]\s*/g, ' ').trim(),
      files,
    });
  }

  return findings;
}

function parseImpactoLines(sectionText) {
  const findings = [];
  const lines = sectionText.split('\n').filter((l) => l.trim().startsWith('-'));

  for (const line of lines) {
    const severityMatch = line.match(/(CRITICAL|HIGH|MEDIUM|LOW)/i);
    const severity = severityMatch ? severityMatch[1].toUpperCase() : 'MEDIUM';
    const text = line.replace(/^-\s*/, '').trim();

    findings.push({
      severity,
      text,
      files: extractFilesFromText(line),
    });
  }

  return findings;
}

function parseErrosLines(sectionText) {
  const findings = [];
  const lines = sectionText.split('\n').filter((l) => l.trim().startsWith('-'));

  for (const line of lines) {
    const text = line.replace(/^-\s*/, '').trim();
    if (!text) continue;

    findings.push({
      severity: 'INFO',
      text,
      files: extractFilesFromText(line),
    });
  }

  return findings;
}

function parseDecisaoSection(sectionText) {
  if (!sectionText || !sectionText.trim()) return [];

  return [{
    severity: 'INFO',
    text: sectionText.split('\n')[0].trim(),
    files: extractFilesFromText(sectionText),
  }];
}

function parseBlufFindings(output) {
  if (!output || typeof output !== 'string') return [];

  let findings = [];

  const achadosSection = extractSection(output, ACHADOS_SECTION);
  if (achadosSection) {
    findings = [...findings, ...parseAchadosLines(achadosSection)];
  }

  const impactoSection = extractSection(output, IMPACTO_SECTION);
  if (impactoSection) {
    findings = [...findings, ...parseImpactoLines(impactoSection)];
  }

  const errosSection = extractSection(output, ERROS_SECTION);
  if (errosSection) {
    findings = [...findings, ...parseErrosLines(errosSection)];
  }

  const decisaoSection = extractSection(output, DECISAO_SECTION);
  if (decisaoSection && findings.length === 0) {
    findings = [...findings, ...parseDecisaoSection(decisaoSection)];
  }

  return findings;
}

function extractAgentOutputs(entries) {
  const outputs = [];
  let pendingAgent = null;

  for (const entry of entries) {
    if (entry.type === 'assistant' && entry.message?.content) {
      const content = Array.isArray(entry.message.content)
        ? entry.message.content
        : [];

      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'Task') {
          pendingAgent = block.input?.subagent_type || null;
        }
      }
    }

    if (entry.type === 'tool_result' && pendingAgent) {
      const resultText = typeof entry.content === 'string'
        ? entry.content
        : typeof entry.content === 'object'
          ? entry.content?.output || entry.content?.content || JSON.stringify(entry.content)
          : String(entry.content || '');

      outputs.push({
        agentName: pendingAgent,
        output: resultText,
      });
      pendingAgent = null;
    }
  }

  return outputs;
}

module.exports = {
  parseBlufFindings,
  extractAgentOutputs,
  extractFilesFromText,
};
