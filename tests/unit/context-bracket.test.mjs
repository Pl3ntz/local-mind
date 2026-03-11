import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { estimateContextBracket } = require('../../src/lib/context-bracket.js');

function createTempTranscript(sizeKB) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bracket-test-'));
  const tmpFile = path.join(tmpDir, 'transcript.jsonl');
  const content = 'x'.repeat(sizeKB * 1024);
  fs.writeFileSync(tmpFile, content);
  return { path: tmpFile, cleanup: () => fs.rmSync(tmpDir, { recursive: true }) };
}

describe('context-bracket', () => {
  describe('estimateContextBracket', () => {
    it('should return FRESH for small transcript (< 320KB)', () => {
      const tmp = createTempTranscript(50);
      try {
        const result = estimateContextBracket(tmp.path);
        expect(result.bracket).toBe('FRESH');
        expect(result.maxResults).toBe(3);
        expect(result.includeGotchas).toBe(false);
        expect(result.includeSearch).toBe(false);
      } finally {
        tmp.cleanup();
      }
    });

    it('should return MODERATE for medium transcript (~400KB)', () => {
      const tmp = createTempTranscript(400);
      try {
        const result = estimateContextBracket(tmp.path);
        expect(result.bracket).toBe('MODERATE');
        expect(result.maxResults).toBe(8);
        expect(result.includeGotchas).toBe(true);
      } finally {
        tmp.cleanup();
      }
    });

    it('should return DEPLETED for large transcript (~620KB)', () => {
      const tmp = createTempTranscript(620);
      try {
        const result = estimateContextBracket(tmp.path);
        expect(result.bracket).toBe('DEPLETED');
        expect(result.maxResults).toBe(12);
        expect(result.includeGotchas).toBe(true);
        expect(result.includeSearch).toBe(true);
      } finally {
        tmp.cleanup();
      }
    });

    it('should return CRITICAL for very large transcript (> 720KB)', () => {
      const tmp = createTempTranscript(750);
      try {
        const result = estimateContextBracket(tmp.path);
        expect(result.bracket).toBe('CRITICAL');
        expect(result.maxResults).toBe(15);
      } finally {
        tmp.cleanup();
      }
    });

    it('should fallback to MODERATE for invalid path', () => {
      const result = estimateContextBracket('/nonexistent/path/transcript.jsonl');
      expect(result.bracket).toBe('MODERATE');
      expect(result.maxResults).toBe(8);
    });

    it('should include bracket name as string field', () => {
      const result = estimateContextBracket('/nonexistent/path');
      expect(typeof result.bracket).toBe('string');
      expect(['FRESH', 'MODERATE', 'DEPLETED', 'CRITICAL']).toContain(result.bracket);
    });
  });
});
