import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getDb, closeDb } = require('../../src/lib/database.js');

let saveFinding;
let queryFindings;
let formatFindingsForInjection;
let reinforceFindings;

beforeEach(() => {
  const findings = require('../../src/lib/agent-findings.js');
  saveFinding = findings.saveFinding;
  queryFindings = findings.queryFindings;
  formatFindingsForInjection = findings.formatFindingsForInjection;
  reinforceFindings = findings.reinforceFindings;
});

afterEach(() => {
  closeDb();
});

describe('agent-findings', () => {
  const TAG = 'test-project-abc';
  const SESSION = 'session-001';

  describe('saveFinding', () => {
    it('should insert a new finding', () => {
      const db = getDb(':memory:');
      const result = saveFinding(db, {
        containerTag: TAG,
        sessionId: SESSION,
        agentName: 'code-reviewer',
        severity: 'HIGH',
        findingText: 'Race condition in scheduler.py:45',
        fileRefs: ['scheduler.py'],
      });

      expect(result.status).toBe('created');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should upsert on duplicate finding (reinforce confidence)', () => {
      const db = getDb(':memory:');
      saveFinding(db, {
        containerTag: TAG,
        sessionId: SESSION,
        agentName: 'code-reviewer',
        severity: 'HIGH',
        findingText: 'Race condition in scheduler.py:45',
        fileRefs: ['scheduler.py'],
      });

      const result = saveFinding(db, {
        containerTag: TAG,
        sessionId: 'session-002',
        agentName: 'code-reviewer',
        severity: 'HIGH',
        findingText: 'Race condition in scheduler.py:45',
        fileRefs: ['scheduler.py'],
      });

      expect(result.status).toBe('reinforced');

      const row = db.prepare('SELECT confidence FROM agent_findings WHERE id = ?').get(result.id);
      expect(row.confidence).toBeGreaterThan(1.0);
    });

    it('should validate severity', () => {
      const db = getDb(':memory:');
      expect(() => saveFinding(db, {
        containerTag: TAG,
        sessionId: SESSION,
        agentName: 'code-reviewer',
        severity: 'INVALID',
        findingText: 'test',
      })).toThrow();
    });

    it('should store file references as JSON', () => {
      const db = getDb(':memory:');
      const result = saveFinding(db, {
        containerTag: TAG,
        sessionId: SESSION,
        agentName: 'security-reviewer',
        severity: 'CRITICAL',
        findingText: '.env with 644 permissions',
        fileRefs: ['.env', '/root/myproject/.env'],
      });

      const row = db.prepare('SELECT related_files FROM agent_findings WHERE id = ?').get(result.id);
      expect(JSON.parse(row.related_files)).toEqual(['.env', '/root/myproject/.env']);
    });
  });

  describe('queryFindings', () => {
    it('should return findings for a specific agent', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Bug in auth module' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'security-reviewer', severity: 'CRITICAL', findingText: '.env exposed' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'MEDIUM', findingText: 'Missing error handling' });

      const results = queryFindings(db, TAG, { agentName: 'code-reviewer' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.agent_name === 'code-reviewer')).toBe(true);
    });

    it('should return all open findings when no agent specified', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Bug 1' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'security-reviewer', severity: 'CRITICAL', findingText: 'Vuln 1' });

      const results = queryFindings(db, TAG);
      expect(results).toHaveLength(2);
    });

    it('should order by severity (CRITICAL first)', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'LOW', findingText: 'Minor issue' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'CRITICAL', findingText: 'Major issue' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Important issue' });

      const results = queryFindings(db, TAG);
      expect(results[0].severity).toBe('CRITICAL');
      expect(results[1].severity).toBe('HIGH');
      expect(results[2].severity).toBe('LOW');
    });

    it('should respect limit', () => {
      const db = getDb(':memory:');
      for (let i = 0; i < 20; i++) {
        saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'MEDIUM', findingText: `Finding ${i}` });
      }

      const results = queryFindings(db, TAG, { limit: 5 });
      expect(results).toHaveLength(5);
    });

    it('should only return open findings by default', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Open bug' });
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Resolved bug' });

      db.prepare("UPDATE agent_findings SET status = 'resolved' WHERE finding_text = 'Resolved bug'").run();

      const results = queryFindings(db, TAG);
      expect(results).toHaveLength(1);
      expect(results[0].finding_text).toBe('Open bug');
    });

    it('should include global findings', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Project bug' });
      saveFinding(db, { containerTag: '_global', sessionId: SESSION, agentName: 'security-reviewer', severity: 'CRITICAL', findingText: 'Always use 600 for .env' });

      const results = queryFindings(db, TAG, { includeGlobal: true });
      expect(results).toHaveLength(2);
    });

    it('should isolate by container_tag', () => {
      const db = getDb(':memory:');
      saveFinding(db, { containerTag: 'project-a', sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Bug in A' });
      saveFinding(db, { containerTag: 'project-b', sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Bug in B' });

      const results = queryFindings(db, 'project-a');
      expect(results).toHaveLength(1);
      expect(results[0].finding_text).toBe('Bug in A');
    });
  });

  describe('formatFindingsForInjection', () => {
    it('should format findings as markdown block', () => {
      const findings = [
        { agent_name: 'security-reviewer', severity: 'CRITICAL', finding_text: '.env exposed', created_at: '2026-03-28T10:00:00Z', status: 'open' },
        { agent_name: 'code-reviewer', severity: 'HIGH', finding_text: 'Race condition', created_at: '2026-03-29T10:00:00Z', status: 'open' },
      ];

      const result = formatFindingsForInjection(findings);
      expect(result).toContain('security-reviewer');
      expect(result).toContain('CRITICAL');
      expect(result).toContain('.env exposed');
      expect(result).toContain('code-reviewer');
    });

    it('should return empty string for no findings', () => {
      expect(formatFindingsForInjection([])).toBe('');
      expect(formatFindingsForInjection(null)).toBe('');
    });
  });

  describe('reinforceFindings', () => {
    it('should increment recall_count', () => {
      const db = getDb(':memory:');
      const { id } = saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Test finding' });

      reinforceFindings(db, [id]);

      const row = db.prepare('SELECT recall_count FROM agent_findings WHERE id = ?').get(id);
      expect(row.recall_count).toBe(1);
    });

    it('should handle multiple finding ids', () => {
      const db = getDb(':memory:');
      const r1 = saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'HIGH', findingText: 'Finding 1' });
      const r2 = saveFinding(db, { containerTag: TAG, sessionId: SESSION, agentName: 'code-reviewer', severity: 'MEDIUM', findingText: 'Finding 2' });

      reinforceFindings(db, [r1.id, r2.id]);

      const row1 = db.prepare('SELECT recall_count FROM agent_findings WHERE id = ?').get(r1.id);
      const row2 = db.prepare('SELECT recall_count FROM agent_findings WHERE id = ?').get(r2.id);
      expect(row1.recall_count).toBe(1);
      expect(row2.recall_count).toBe(1);
    });

    it('should handle empty array', () => {
      const db = getDb(':memory:');
      expect(() => reinforceFindings(db, [])).not.toThrow();
    });
  });
});
