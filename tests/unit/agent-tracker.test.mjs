import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getDb, closeDb } = require('../../src/lib/database.js');

let normalizeAgentName;
let trackAgentInvocation;
let getAgentStats;
let formatAgentStats;

beforeEach(() => {
  const tracker = require('../../src/lib/agent-tracker.js');
  normalizeAgentName = tracker.normalizeAgentName;
  trackAgentInvocation = tracker.trackAgentInvocation;
  getAgentStats = tracker.getAgentStats;
  formatAgentStats = tracker.formatAgentStats;
});

describe('agent-tracker', () => {
  describe('normalizeAgentName', () => {
    it('should return null for empty input', () => {
      expect(normalizeAgentName('')).toBeNull();
      expect(normalizeAgentName(null)).toBeNull();
      expect(normalizeAgentName(undefined)).toBeNull();
    });

    it('should lowercase and hyphenate', () => {
      expect(normalizeAgentName('Code Reviewer')).toBe('code-reviewer');
      expect(normalizeAgentName('TDD Guide')).toBe('tdd-guide');
    });

    it('should already-normalized names pass through', () => {
      expect(normalizeAgentName('code-reviewer')).toBe('code-reviewer');
      expect(normalizeAgentName('tdd-guide')).toBe('tdd-guide');
      expect(normalizeAgentName('incident-responder')).toBe('incident-responder');
    });

    it('should match known agents case-insensitively', () => {
      expect(normalizeAgentName('CODE-REVIEWER')).toBe('code-reviewer');
      expect(normalizeAgentName('Architect')).toBe('architect');
      expect(normalizeAgentName('PLANNER')).toBe('planner');
    });

    it('should trim whitespace', () => {
      expect(normalizeAgentName('  code-reviewer  ')).toBe('code-reviewer');
    });

    it('should handle unknown agent names by normalizing them', () => {
      expect(normalizeAgentName('Custom Agent')).toBe('custom-agent');
      expect(normalizeAgentName('My Special Tool')).toBe('my-special-tool');
    });

    it('should handle Explore and other subagent types', () => {
      expect(normalizeAgentName('Explore')).toBe('explore');
      expect(normalizeAgentName('general-purpose')).toBe('general-purpose');
      expect(normalizeAgentName('Bash')).toBe('bash');
    });
  });

  describe('trackAgentInvocation', () => {
    let db;

    beforeEach(() => {
      closeDb();
      db = getDb(':memory:');
    });

    afterEach(() => {
      closeDb();
    });

    it('should insert new agent invocation', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'Review auth module');

      const row = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').get('project1');
      expect(row).toBeDefined();
      expect(row.agent_name).toBe('code-reviewer');
      expect(row.invocation_count).toBe(1);
      expect(row.task_summary).toBe('Review auth module');
    });

    it('should increment count on duplicate (same session + agent)', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'First task');
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'Second task');

      const row = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').get('project1');
      expect(row.invocation_count).toBe(2);
      expect(row.task_summary).toBe('Second task');
    });

    it('should create separate rows for different sessions', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'Task A');
      trackAgentInvocation(db, 'project1', 'session2', 'code-reviewer', 'Task B');

      const rows = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').all('project1');
      expect(rows.length).toBe(2);
    });

    it('should create separate rows for different agents', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'Review');
      trackAgentInvocation(db, 'project1', 'session1', 'tdd-guide', 'Tests');

      const rows = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').all('project1');
      expect(rows.length).toBe(2);
    });

    it('should handle null task_summary', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', null);

      const row = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').get('project1');
      expect(row).toBeDefined();
      expect(row.task_summary).toBeNull();
    });

    it('should normalize agent name before tracking', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'Code Reviewer', 'Task');

      const row = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').get('project1');
      expect(row.agent_name).toBe('code-reviewer');
    });

    it('should skip tracking for null/empty agent names', () => {
      trackAgentInvocation(db, 'project1', 'session1', '', 'Task');
      trackAgentInvocation(db, 'project1', 'session1', null, 'Task');

      const rows = db.prepare('SELECT * FROM agent_usage WHERE container_tag = ?').all('project1');
      expect(rows.length).toBe(0);
    });
  });

  describe('getAgentStats', () => {
    let db;

    beforeEach(() => {
      closeDb();
      db = getDb(':memory:');
    });

    afterEach(() => {
      closeDb();
    });

    it('should return empty array when no data', () => {
      const stats = getAgentStats(db, 'project1');
      expect(stats).toEqual([]);
    });

    it('should aggregate invocations across sessions', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'A');
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'B');
      trackAgentInvocation(db, 'project1', 'session2', 'code-reviewer', 'C');

      const stats = getAgentStats(db, 'project1');
      expect(stats.length).toBe(1);
      expect(stats[0].agent_name).toBe('code-reviewer');
      expect(stats[0].total_invocations).toBe(3);
      expect(stats[0].sessions_used).toBe(2);
    });

    it('should order by total_invocations DESC', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'tdd-guide', 'A');
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'B');
      trackAgentInvocation(db, 'project1', 'session2', 'code-reviewer', 'C');
      trackAgentInvocation(db, 'project1', 'session2', 'code-reviewer', 'D');

      const stats = getAgentStats(db, 'project1');
      expect(stats[0].agent_name).toBe('code-reviewer');
      expect(stats[1].agent_name).toBe('tdd-guide');
    });

    it('should respect limit parameter', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'A');
      trackAgentInvocation(db, 'project1', 'session1', 'tdd-guide', 'B');
      trackAgentInvocation(db, 'project1', 'session1', 'architect', 'C');

      const stats = getAgentStats(db, 'project1', 2);
      expect(stats.length).toBe(2);
    });

    it('should scope by container_tag', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'A');
      trackAgentInvocation(db, 'project2', 'session1', 'tdd-guide', 'B');

      const stats = getAgentStats(db, 'project1');
      expect(stats.length).toBe(1);
      expect(stats[0].agent_name).toBe('code-reviewer');
    });

    it('should count distinct sessions', () => {
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'A');
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'B');
      trackAgentInvocation(db, 'project1', 'session1', 'code-reviewer', 'C');

      const stats = getAgentStats(db, 'project1');
      expect(stats[0].sessions_used).toBe(1);
    });
  });

  describe('formatAgentStats', () => {
    it('should return empty string for no data', () => {
      expect(formatAgentStats([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatAgentStats(null)).toBe('');
      expect(formatAgentStats(undefined)).toBe('');
    });

    it('should format single agent stats', () => {
      const stats = [
        { agent_name: 'code-reviewer', total_invocations: 12, sessions_used: 8 },
      ];
      const result = formatAgentStats(stats);
      expect(result).toContain('## Agent Usage');
      expect(result).toContain('**code-reviewer**');
      expect(result).toContain('12x');
      expect(result).toContain('8 sessions');
    });

    it('should format multiple agent stats', () => {
      const stats = [
        { agent_name: 'code-reviewer', total_invocations: 12, sessions_used: 8 },
        { agent_name: 'tdd-guide', total_invocations: 5, sessions_used: 3 },
      ];
      const result = formatAgentStats(stats);
      const lines = result.split('\n').filter((l) => l.startsWith('- '));
      expect(lines.length).toBe(2);
    });

    it('should show singular "session" for count of 1', () => {
      const stats = [
        { agent_name: 'architect', total_invocations: 1, sessions_used: 1 },
      ];
      const result = formatAgentStats(stats);
      expect(result).toContain('1 session)');
      expect(result).not.toContain('1 sessions)');
    });
  });
});
