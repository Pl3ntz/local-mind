import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseBlufFindings, extractAgentOutputs } = require('../../src/lib/bluf-parser.js');

describe('bluf-parser', () => {
  describe('parseBlufFindings', () => {
    it('should parse standard BLUF ACHADOS format', () => {
      const output = `### ACHADOS (max 5, ordenados por severidade)
- **[CRITICAL]** SQL injection em auth.py — \`auth.py:45\` — query sem parametrização
- **[HIGH]** .env com 644 — \`.env\` — permissão deve ser 600

### PRÓXIMO PASSO: Corrigir SQL injection imediatamente

### RESUMO: Análise encontrou 2 vulnerabilidades no módulo de autenticação.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].text).toContain('SQL injection');
      expect(findings[0].files).toContain('auth.py');
      expect(findings[1].severity).toBe('HIGH');
      expect(findings[1].files).toContain('.env');
    });

    it('should parse ACHADOS without file references', () => {
      const output = `### ACHADOS (max 5, ordenados por severidade)
- **[MEDIUM]** Falta rate limiting nos endpoints — descrição do problema

### RESUMO: Encontrado 1 achado.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].files).toEqual([]);
    });

    it('should parse AMEAÇAS + ACHADOS format (security-reviewer)', () => {
      const output = `### AMEAÇAS
| Área | Nível |
|------|-------|
| SSH | HIGH |

### ACHADOS (max 5, ordenados por severidade)
- **[HIGH]** Root login habilitado — \`/etc/ssh/sshd_config\` — PermitRootLogin yes
- **[MEDIUM]** Sem fail2ban — servidor exposto a bruteforce

### RESUMO: Auditoria de segurança encontrou 2 issues.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].files).toContain('/etc/ssh/sshd_config');
    });

    it('should parse IMPACTO CROSS-SYSTEM format (staff-engineer)', () => {
      const output = `### IMPACTO CROSS-SYSTEM
- project-alpha — schema change afeta queries — HIGH

### PROPAGAÇÃO DE PADRÃO: Sim, vai virar template

### DÍVIDA TÉCNICA: Nova dívida criada em project-beta

### RESUMO: Mudança impacta 2 projetos.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].text).toContain('project-alpha');
    });

    it('should parse ERROS CORRIGIDOS format (build-error-resolver)', () => {
      const output = `### ERROS CORRIGIDOS
- ModuleNotFoundError: neo4j — Adicionado ao requirements.txt
- TypeError em scheduler.py:12 — Corrigido tipo de retorno

### RESUMO: 2 erros corrigidos.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].text).toContain('ModuleNotFoundError');
    });

    it('should parse DECISÃO DE DESIGN format (architect)', () => {
      const output = `### DECISÃO DE DESIGN
Adotar repository pattern para backend-service

### ALTERNATIVAS
| Opção | Pros | Contras |
|-------|------|---------|
| A | Simples | Menos flexível |

### RESUMO: Decisão arquitetural tomada.`;

      const findings = parseBlufFindings(output);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].text).toContain('repository pattern');
    });

    it('should return empty array for no findings', () => {
      expect(parseBlufFindings('')).toEqual([]);
      expect(parseBlufFindings(null)).toEqual([]);
      expect(parseBlufFindings('No issues found')).toEqual([]);
    });

    it('should handle malformed BLUF gracefully', () => {
      const output = `Some random text without proper formatting
- This is not a finding
### RESUMO: Nothing here`;

      const findings = parseBlufFindings(output);
      expect(findings).toEqual([]);
    });

    it('should extract multiple file references from backticks', () => {
      const output = `### ACHADOS (max 5, ordenados por severidade)
- **[HIGH]** Race condition — \`scheduler.py:45\`, \`worker.py:12\` — async sem lock`;

      const findings = parseBlufFindings(output);
      expect(findings[0].files).toContain('scheduler.py');
      expect(findings[0].files).toContain('worker.py');
    });
  });

  describe('extractAgentOutputs', () => {
    it('should extract agent name and output from transcript entries', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Task',
                input: { subagent_type: 'code-reviewer', description: 'Review auth module' },
              },
            ],
          },
        },
        {
          type: 'tool_result',
          content: '### ACHADOS\n- **[HIGH]** Bug in auth — `auth.py:10` — missing validation\n\n### RESUMO: 1 bug found.',
        },
      ];

      const outputs = extractAgentOutputs(entries);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].agentName).toBe('code-reviewer');
      expect(outputs[0].output).toContain('ACHADOS');
    });

    it('should handle entries with no agent outputs', () => {
      const entries = [
        { type: 'human', message: { content: 'hello' } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } },
      ];

      const outputs = extractAgentOutputs(entries);
      expect(outputs).toEqual([]);
    });

    it('should handle multiple agent outputs in one session', () => {
      const entries = [
        {
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Task', input: { subagent_type: 'code-reviewer', description: 'review' } }] },
        },
        { type: 'tool_result', content: '### ACHADOS\n- **[HIGH]** Bug 1\n\n### RESUMO: done' },
        {
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Task', input: { subagent_type: 'security-reviewer', description: 'audit' } }] },
        },
        { type: 'tool_result', content: '### ACHADOS\n- **[CRITICAL]** Vuln 1\n\n### RESUMO: done' },
      ];

      const outputs = extractAgentOutputs(entries);
      expect(outputs).toHaveLength(2);
      expect(outputs[0].agentName).toBe('code-reviewer');
      expect(outputs[1].agentName).toBe('security-reviewer');
    });

    it('should skip non-Task tool uses', () => {
      const entries = [
        {
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] },
        },
        { type: 'tool_result', content: 'file1.txt\nfile2.txt' },
      ];

      const outputs = extractAgentOutputs(entries);
      expect(outputs).toEqual([]);
    });
  });
});
