import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getDb, closeDb } = require('../../src/lib/database.js');

// Will be required after implementation
let normalizeErrorPattern;
let djb2Hash;
let detectCategory;
let trackError;
let getRelevantGotchas;

beforeEach(() => {
  const tracker = require('../../src/lib/gotcha-tracker.js');
  normalizeErrorPattern = tracker.normalizeErrorPattern;
  djb2Hash = tracker.djb2Hash;
  detectCategory = tracker.detectCategory;
  trackError = tracker.trackError;
  getRelevantGotchas = tracker.getRelevantGotchas;
});

describe('gotcha-tracker', () => {
  describe('normalizeErrorPattern', () => {
    it('should replace numbers with N', () => {
      const result = normalizeErrorPattern('Error at line 42 column 10');
      expect(result).toBe('Error at line N column N');
    });

    it('should replace quoted strings with "X"', () => {
      const result = normalizeErrorPattern("Cannot find module 'express'");
      expect(result).toBe('Cannot find module "X"');
    });

    it('should replace backtick strings with `X`', () => {
      const result = normalizeErrorPattern('Type `string` is not assignable to type `number`');
      expect(result).toBe('Type `X` is not assignable to type `X`');
    });

    it('should take only first line', () => {
      const result = normalizeErrorPattern('Error: foo\n  at bar.js:10\n  at baz.js:20');
      expect(result).toBe('Error: foo');
    });

    it('should truncate to 100 chars', () => {
      const long = 'E'.repeat(200);
      const result = normalizeErrorPattern(long);
      expect(result.length).toBe(100);
    });

    it('should handle empty/null input', () => {
      expect(normalizeErrorPattern('')).toBe('');
      expect(normalizeErrorPattern(null)).toBe('');
    });
  });

  describe('djb2Hash', () => {
    it('should return consistent hash for same input', () => {
      const h1 = djb2Hash('test string');
      const h2 = djb2Hash('test string');
      expect(h1).toBe(h2);
    });

    it('should return different hash for different input', () => {
      const h1 = djb2Hash('hello');
      const h2 = djb2Hash('world');
      expect(h1).not.toBe(h2);
    });

    it('should return a string', () => {
      expect(typeof djb2Hash('test')).toBe('string');
    });
  });

  describe('detectCategory', () => {
    it('should detect build errors', () => {
      expect(detectCategory('Build failed: syntax error')).toBe('build');
    });

    it('should detect test errors', () => {
      expect(detectCategory('Test suite failed to run')).toBe('test');
    });

    it('should detect lint errors', () => {
      expect(detectCategory('ESLint: no-unused-vars')).toBe('lint');
    });

    it('should detect runtime errors', () => {
      expect(detectCategory('TypeError: undefined is not a function')).toBe('runtime');
    });

    it('should detect database errors', () => {
      expect(detectCategory('SQLite: no such column')).toBe('database');
    });

    it('should detect security errors', () => {
      expect(detectCategory('CSRF token mismatch')).toBe('security');
    });

    it('should return general for unknown', () => {
      expect(detectCategory('Something went wrong')).toBe('general');
    });
  });

  describe('trackError', () => {
    let db;

    beforeEach(() => {
      closeDb();
      db = getDb(':memory:');
    });

    afterEach(() => {
      closeDb();
    });

    it('should insert new error pattern', () => {
      trackError(db, 'project1', 'Error at line 42');

      const row = db.prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ?').get('project1');
      expect(row).toBeDefined();
      expect(row.count).toBe(1);
      expect(row.promoted).toBe(0);
    });

    it('should increment count on duplicate pattern', () => {
      trackError(db, 'project1', 'Error at line 42');
      trackError(db, 'project1', 'Error at line 99');

      const row = db.prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ?').get('project1');
      expect(row.count).toBe(2);
    });

    it('should promote to gotcha at count >= 3', () => {
      trackError(db, 'project1', 'Error at line 1');
      trackError(db, 'project1', 'Error at line 2');
      trackError(db, 'project1', 'Error at line 3');

      const row = db.prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ?').get('project1');
      expect(row.count).toBe(3);
      expect(row.promoted).toBe(1);

      const fact = db.prepare(
        "SELECT * FROM profile_facts WHERE container_tag = ? AND fact_type = 'gotcha'",
      ).get('project1');
      expect(fact).toBeDefined();
      expect(fact.fact_text).toContain('Error at line N');
    });

    it('should not create duplicate gotcha on subsequent tracks', () => {
      trackError(db, 'project1', 'Error at line 1');
      trackError(db, 'project1', 'Error at line 2');
      trackError(db, 'project1', 'Error at line 3');
      trackError(db, 'project1', 'Error at line 4');

      const facts = db.prepare(
        "SELECT * FROM profile_facts WHERE container_tag = ? AND fact_type = 'gotcha'",
      ).all('project1');
      expect(facts.length).toBe(1);
    });

    it('should store samples as JSON array (max 5)', () => {
      for (let i = 0; i < 7; i++) {
        trackError(db, 'project1', `Error at line ${i}`);
      }

      const row = db.prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ?').get('project1');
      const samples = JSON.parse(row.samples);
      expect(samples.length).toBeLessThanOrEqual(5);
    });

    it('should track related files', () => {
      trackError(db, 'project1', 'Error at line 1', 'src/foo.js');
      trackError(db, 'project1', 'Error at line 2', 'src/bar.js');

      const row = db.prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ?').get('project1');
      const files = JSON.parse(row.related_files);
      expect(files).toContain('src/foo.js');
      expect(files).toContain('src/bar.js');
    });
  });

  describe('getRelevantGotchas', () => {
    let db;

    beforeEach(() => {
      closeDb();
      db = getDb(':memory:');
    });

    afterEach(() => {
      closeDb();
    });

    it('should return empty string when no gotchas exist', () => {
      const result = getRelevantGotchas(db, 'project1', 'some task');
      expect(result).toBe('');
    });

    it('should return markdown for promoted gotchas', () => {
      // Create a promoted gotcha manually
      db.prepare(
        `INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, promoted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('project1', 'hash1', 'Error at line N', 'build', 5, '["Error at line 1","Error at line 2"]', 1);

      const result = getRelevantGotchas(db, 'project1', 'build task');
      expect(result).toContain('Error at line N');
      expect(result).toContain('Gotcha');
    });

    it('should score category matches higher', () => {
      db.prepare(
        `INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, promoted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('project1', 'h1', 'Build failed', 'build', 3, '[]', 1);
      db.prepare(
        `INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, promoted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('project1', 'h2', 'Test failed', 'test', 3, '[]', 1);

      const result = getRelevantGotchas(db, 'project1', 'build is broken');
      const lines = result.split('\n').filter((l) => l.includes('failed'));
      // Build-related gotcha should appear first
      expect(lines[0]).toContain('Build failed');
    });

    it('should limit to top 5 results', () => {
      for (let i = 0; i < 8; i++) {
        db.prepare(
          `INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, promoted)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run('project1', `h${i}`, `Error pattern ${i}`, 'general', 3, '[]', 1);
      }

      const result = getRelevantGotchas(db, 'project1', 'task');
      const gotchaLines = result.split('\n').filter((l) => l.startsWith('- '));
      expect(gotchaLines.length).toBeLessThanOrEqual(5);
    });
  });
});
