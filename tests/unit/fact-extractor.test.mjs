import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  extractFacts,
  extractFileName,
  extractBaseCommand,
  buildSessionFacts,
  buildUserFacts,
} = require('../../src/lib/fact-extractor.js');

describe('fact-extractor', () => {
  describe('extractFacts', () => {
    it('should extract files from Edit tool_use entries', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Edit',
                input: { file_path: '/home/user/project/src/auth.ts' },
              },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.sessionFacts).toContainEqual(expect.stringContaining('auth.ts'));
    });

    it('should extract files from Write tool_use entries', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Write',
                input: { file_path: '/home/user/project/config/settings.json' },
              },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.sessionFacts[0]).toContain('settings.json');
    });

    it('should extract commands from Bash entries', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Bash',
                input: { command: 'npm test' },
              },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.sessionFacts).toContainEqual(expect.stringContaining('npm test'));
    });

    it('should filter trivial commands', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
              { type: 'tool_use', name: 'Bash', input: { command: 'cat file.txt' } },
              { type: 'tool_use', name: 'Bash', input: { command: 'npm install express' } },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      const commandFact = result.sessionFacts.find((f) => f.startsWith('commands:'));
      expect(commandFact).toContain('npm install express');
      expect(commandFact).not.toContain('ls -la');
    });

    it('should detect errors from tool_results', () => {
      const entries = [
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                is_error: true,
                content: 'TypeError: Cannot read property of undefined in auth.ts line 42',
              },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.sessionFacts).toContainEqual(expect.stringContaining('TypeError'));
    });

    it('should extract summary from first user prompt', () => {
      const entries = [
        {
          type: 'user',
          message: { content: 'Quero implementar autenticacao JWT no projeto' },
        },
        {
          type: 'user',
          message: { content: 'Segunda mensagem' },
        },
      ];

      const result = extractFacts(entries);
      expect(result.sessionFacts).toContainEqual(
        expect.stringContaining('Quero implementar autenticacao JWT'),
      );
    });

    it('should detect PT-BR language', () => {
      const entries = [
        {
          type: 'user',
          message: {
            content:
              'Quero que voce implemente isso para mim, preciso muito disso porque nao tenho como fazer sozinho agora',
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.userFacts).toContainEqual('idioma: pt-br');
    });

    it('should NOT detect PT-BR for english text', () => {
      const entries = [
        {
          type: 'user',
          message: {
            content:
              'I want you to implement this feature for me because I need authentication in the application',
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.userFacts).not.toContainEqual('idioma: pt-br');
    });

    it('should not extract tech stack as user facts', () => {
      const entries = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Bash',
                input: { command: 'npm install react' },
              },
            ],
          },
        },
      ];

      const result = extractFacts(entries);
      expect(result.userFacts.some((f) => f.includes('react'))).toBe(false);
    });
  });

  describe('extractFileName', () => {
    it('should return last two path segments', () => {
      expect(extractFileName('/home/user/project/src/auth.ts')).toBe('src/auth.ts');
    });

    it('should return unknown for null', () => {
      expect(extractFileName(null)).toBe('unknown');
    });
  });

  describe('extractBaseCommand', () => {
    it('should extract first word as base command', () => {
      expect(extractBaseCommand('npm install express')).toBe('npm');
    });

    it('should return empty for null', () => {
      expect(extractBaseCommand(null)).toBe('');
    });
  });

  describe('buildSessionFacts', () => {
    it('should build facts from files and commands', () => {
      const files = new Set(['src/auth.ts', 'src/login.tsx']);
      const commands = new Set(['npm test']);
      const errors = [];
      const prompt = 'Fix auth bug';

      const facts = buildSessionFacts(files, commands, errors, prompt);
      expect(facts).toContainEqual(expect.stringContaining('auth.ts'));
      expect(facts).toContainEqual(expect.stringContaining('npm test'));
      expect(facts).toContainEqual(expect.stringContaining('Fix auth bug'));
    });

    it('should limit files to 10', () => {
      const files = new Set(Array.from({ length: 15 }, (_, i) => `file${i}.ts`));
      const facts = buildSessionFacts(files, new Set(), [], '');
      const fileFact = facts.find((f) => f.startsWith('files:'));
      const count = fileFact.split(',').length;
      expect(count).toBeLessThanOrEqual(10);
    });
  });

  describe('buildUserFacts', () => {
    it('should detect PT-BR when ratio > 15%', () => {
      const facts = buildUserFacts(20, 100);
      expect(facts).toContainEqual('idioma: pt-br');
    });

    it('should not detect PT-BR when ratio <= 15%', () => {
      const facts = buildUserFacts(10, 100);
      expect(facts).not.toContainEqual('idioma: pt-br');
    });

    it('should not detect PT-BR with too few words', () => {
      const facts = buildUserFacts(3, 5);
      expect(facts).not.toContainEqual('idioma: pt-br');
    });
  });
});
