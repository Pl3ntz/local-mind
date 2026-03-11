import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { readNewEntries, getSessionTracking, updateSessionTracking } = require('../../src/lib/incremental-save.js');
const { closeDb, getDb } = require('../../src/lib/database.js');

describe('incremental-save', () => {
  let tmpDir;

  beforeEach(() => {
    closeDb();
    getDb(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supermem-test-'));
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readNewEntries', () => {
    it('should read entries from byte offset 0', () => {
      const filePath = path.join(tmpDir, 'transcript.jsonl');
      const entries = [
        { type: 'user', uuid: 'u1', message: { content: 'hello' } },
        { type: 'assistant', uuid: 'a1', message: { content: [{ type: 'text', text: 'hi' }] } },
      ];
      fs.writeFileSync(filePath, entries.map(JSON.stringify).join('\n') + '\n');

      const result = readNewEntries(filePath, 0);
      expect(result.entries.length).toBe(2);
      expect(result.newOffset).toBeGreaterThan(0);
    });

    it('should read only new entries from byte offset', () => {
      const filePath = path.join(tmpDir, 'transcript.jsonl');
      const line1 = JSON.stringify({ type: 'user', uuid: 'u1', message: { content: 'first' } }) + '\n';
      const line2 = JSON.stringify({ type: 'user', uuid: 'u2', message: { content: 'second' } }) + '\n';

      fs.writeFileSync(filePath, line1);
      const offset = Buffer.byteLength(line1, 'utf-8');

      fs.appendFileSync(filePath, line2);

      const result = readNewEntries(filePath, offset);
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].uuid).toBe('u2');
    });

    it('should return empty if file has not grown', () => {
      const filePath = path.join(tmpDir, 'transcript.jsonl');
      const content = JSON.stringify({ type: 'user', uuid: 'u1' }) + '\n';
      fs.writeFileSync(filePath, content);

      const size = fs.statSync(filePath).size;
      const result = readNewEntries(filePath, size);
      expect(result.entries.length).toBe(0);
      expect(result.newOffset).toBe(size);
    });

    it('should return empty for nonexistent file', () => {
      const result = readNewEntries('/nonexistent/path.jsonl', 0);
      expect(result.entries.length).toBe(0);
    });

    it('should skip malformed JSON lines', () => {
      const filePath = path.join(tmpDir, 'transcript.jsonl');
      fs.writeFileSync(filePath, '{"valid":true}\nnot json\n{"also":"valid"}\n');

      const result = readNewEntries(filePath, 0);
      expect(result.entries.length).toBe(2);
    });
  });

  describe('session tracking', () => {
    it('should return defaults for unknown session', () => {
      const tracking = getSessionTracking('unknown-session');
      expect(tracking.lastUuid).toBeNull();
      expect(tracking.lastByteOffset).toBe(0);
    });

    it('should store and retrieve tracking data', () => {
      updateSessionTracking('sess1', 'uuid-abc', 1024, 'tag1', 'project1');

      const tracking = getSessionTracking('sess1');
      expect(tracking.lastUuid).toBe('uuid-abc');
      expect(tracking.lastByteOffset).toBe(1024);
      expect(tracking.containerTag).toBe('tag1');
      expect(tracking.projectName).toBe('project1');
    });

    it('should update existing session tracking', () => {
      updateSessionTracking('sess1', 'uuid-1', 100, 'tag1', 'project1');
      updateSessionTracking('sess1', 'uuid-2', 200, 'tag1', 'project1');

      const tracking = getSessionTracking('sess1');
      expect(tracking.lastUuid).toBe('uuid-2');
      expect(tracking.lastByteOffset).toBe(200);
    });
  });
});
