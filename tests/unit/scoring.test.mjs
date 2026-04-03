import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  recencyWeight,
  scoredResults,
  decayedConfidence,
  pruneDecayedFacts,
  findingDecayedConfidence,
  recallBoost,
  DECAY_LAMBDA,
} = require('../../src/lib/scoring.js');
const { getDb, closeDb } = require('../../src/lib/database.js');

describe('scoring', () => {
  describe('recencyWeight', () => {
    it('should return ~1.0 for now', () => {
      const now = new Date().toISOString();
      const weight = recencyWeight(now);
      expect(weight).toBeGreaterThan(0.99);
    });

    it('should return ~0.5 for 4.6 days ago (half-life)', () => {
      const halfLife = Math.LN2 / DECAY_LAMBDA;
      const past = new Date(Date.now() - halfLife * 86400000).toISOString();
      const weight = recencyWeight(past);
      expect(weight).toBeCloseTo(0.5, 1);
    });

    it('should return ~0.05 for 20 days ago', () => {
      const past = new Date(Date.now() - 20 * 86400000).toISOString();
      const weight = recencyWeight(past);
      expect(weight).toBeLessThan(0.1);
    });

    it('should return 0.5 for null/undefined', () => {
      expect(recencyWeight(null)).toBe(0.5);
      expect(recencyWeight(undefined)).toBe(0.5);
    });

    it('should return 1.0 for future dates', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      expect(recencyWeight(future)).toBe(1.0);
    });
  });

  describe('scoredResults', () => {
    it('should combine BM25 (70%) and recency (30%)', () => {
      const now = new Date().toISOString();
      const results = [
        { rank: -2.0, updated_at: now, content: 'recent high rank' },
        { rank: -1.0, updated_at: now, content: 'recent low rank' },
      ];

      const scored = scoredResults(results);
      expect(scored[0].content).toBe('recent high rank');
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
    });

    it('should boost recent results over old high-rank ones', () => {
      const now = new Date().toISOString();
      const old = new Date(Date.now() - 30 * 86400000).toISOString();

      const results = [
        { rank: -1.5, updated_at: old, content: 'old high rank' },
        { rank: -1.2, updated_at: now, content: 'recent medium rank' },
      ];

      const scored = scoredResults(results);
      // Recent result should score higher despite lower BM25
      expect(scored[0].content).toBe('recent medium rank');
    });

    it('should return empty for empty input', () => {
      expect(scoredResults([])).toEqual([]);
      expect(scoredResults(null)).toEqual([]);
    });

    it('should include relevance and recency fields', () => {
      const results = [
        { rank: -1.0, updated_at: new Date().toISOString(), content: 'test' },
      ];

      const scored = scoredResults(results);
      expect(scored[0].relevance).toBeDefined();
      expect(scored[0].recency).toBeDefined();
      expect(scored[0].score).toBeDefined();
    });
  });

  describe('decayedConfidence', () => {
    it('should return full confidence for just now', () => {
      const now = new Date().toISOString();
      expect(decayedConfidence(1.0, now)).toBeCloseTo(1.0, 1);
    });

    it('should return ~0.5 after 7 days (fact half-life)', () => {
      const past = new Date(Date.now() - 7 * 86400000).toISOString();
      expect(decayedConfidence(1.0, past)).toBeCloseTo(0.5, 1);
    });

    it('should be below 0.3 after ~13 days without reinforcement', () => {
      const past = new Date(Date.now() - 13 * 86400000).toISOString();
      const result = decayedConfidence(1.0, past);
      expect(result).toBeLessThan(0.3);
    });

    it('should return original confidence for null reinforcedAt', () => {
      expect(decayedConfidence(0.8, null)).toBe(0.8);
    });
  });

  describe('pruneDecayedFacts', () => {
    let db;

    beforeEach(() => {
      closeDb();
      db = getDb(':memory:');
    });

    afterEach(() => {
      closeDb();
    });

    it('should remove facts below confidence threshold', () => {
      // Insert a fact with old reinforced_at so it decays below 0.3
      const oldDate = new Date(Date.now() - 30 * 86400000).toISOString();
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('tag1', 'dynamic', 'old fact', 0.5, oldDate);

      // Insert a fresh fact
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('tag1', 'dynamic', 'fresh fact', 1.0, new Date().toISOString());

      const pruned = pruneDecayedFacts(db, 'tag1');
      expect(pruned).toBe(1);

      const remaining = db.prepare('SELECT * FROM profile_facts WHERE container_tag = ?').all('tag1');
      expect(remaining.length).toBe(1);
      expect(remaining[0].fact_text).toBe('fresh fact');
    });

    it('should not remove recent facts', () => {
      db.prepare(
        `INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('tag1', 'static', 'recent fact', 1.0, new Date().toISOString());

      const pruned = pruneDecayedFacts(db, 'tag1');
      expect(pruned).toBe(0);
    });

    it('should handle empty table', () => {
      const pruned = pruneDecayedFacts(db, 'tag1');
      expect(pruned).toBe(0);
    });
  });

  describe('findingDecayedConfidence', () => {
    it('should decay CRITICAL slowly (~35 day half-life)', () => {
      const past35 = new Date(Date.now() - 35 * 86400000).toISOString();
      const result = findingDecayedConfidence(1.0, past35, 'CRITICAL');
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should decay HIGH faster (~14 day half-life)', () => {
      const past14 = new Date(Date.now() - 14 * 86400000).toISOString();
      const result = findingDecayedConfidence(1.0, past14, 'HIGH');
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should decay INFO fastest (~3.5 day half-life)', () => {
      const past4 = new Date(Date.now() - 4 * 86400000).toISOString();
      const result = findingDecayedConfidence(1.0, past4, 'INFO');
      expect(result).toBeLessThan(0.5);
    });

    it('should return full confidence for just now', () => {
      const now = new Date().toISOString();
      expect(findingDecayedConfidence(1.0, now, 'CRITICAL')).toBeCloseTo(1.0, 1);
    });
  });

  describe('recallBoost', () => {
    it('should return 1.0 for zero recalls', () => {
      expect(recallBoost(0)).toBe(1.0);
    });

    it('should return 1.1 for 1 recall', () => {
      expect(recallBoost(1)).toBeCloseTo(1.1);
    });

    it('should cap at 1.5 for 5+ recalls', () => {
      expect(recallBoost(5)).toBeCloseTo(1.5);
      expect(recallBoost(10)).toBeCloseTo(1.5);
      expect(recallBoost(100)).toBeCloseTo(1.5);
    });
  });
});
