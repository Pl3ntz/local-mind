const PT_WORDS = new Set([
  'que', 'para', 'com', 'nao', 'uma', 'por', 'mas', 'como', 'mais', 'quando',
  'muito', 'isso', 'este', 'essa', 'dele', 'dela', 'aqui', 'onde', 'agora',
  'voce', 'quero', 'pode', 'vamos', 'tudo', 'tambem', 'ainda', 'sobre',
  'fazer', 'depois', 'antes', 'preciso', 'obrigado', 'sim', 'entao',
]);

const TRIVIAL_COMMANDS = new Set([
  'ls', 'cd', 'cat', 'head', 'tail', 'pwd', 'echo', 'clear', 'which', 'whoami',
]);

function extractFacts(entries) {
  const files = new Set();
  const commands = new Set();
  const errors = [];
  let userTextChars = 0;
  let ptWordCount = 0;
  let totalWordCount = 0;
  let firstUserPrompt = '';

  for (const entry of entries) {
    if (entry.type === 'user') {
      extractFromUserEntry(entry, {
        files, commands, errors, firstUserPrompt,
        onText: (text) => {
          if (!firstUserPrompt) firstUserPrompt = text;
          userTextChars += text.length;
          const words = text.toLowerCase().split(/\s+/).filter(Boolean);
          totalWordCount += words.length;
          ptWordCount += words.filter((w) => PT_WORDS.has(w)).length;
        },
      });
    } else if (entry.type === 'assistant') {
      extractFromAssistantEntry(entry, { files, commands, errors });
    }
  }

  const sessionFacts = buildSessionFacts(files, commands, errors, firstUserPrompt);
  const userFacts = buildUserFacts(ptWordCount, totalWordCount);

  return { sessionFacts, userFacts };
}

function extractFromUserEntry(entry, ctx) {
  const content = entry.message?.content;
  if (!content) return;

  if (typeof content === 'string') {
    ctx.onText(content);
    return;
  }

  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      ctx.onText(block.text);
    } else if (block.type === 'tool_result') {
      if (block.is_error && block.content) {
        const errText = typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content);
        if (errText.length > 10) {
          ctx.errors.push(truncateError(errText));
        }
      }
    }
  }
}

function extractFromAssistantEntry(entry, ctx) {
  const content = entry.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (block.type !== 'tool_use') continue;

    const input = block.input || {};
    const toolName = block.name || '';

    if ((toolName === 'Edit' || toolName === 'Write') && input.file_path) {
      ctx.files.add(extractFileName(input.file_path));
    }

    if (toolName === 'Bash' && input.command) {
      const cmd = extractBaseCommand(input.command);
      if (cmd && !TRIVIAL_COMMANDS.has(cmd)) {
        ctx.commands.add(input.command.length > 60 ? input.command.slice(0, 60) : input.command);
      }
    }
  }
}

function extractFileName(filePath) {
  if (!filePath) return 'unknown';
  const parts = filePath.split('/');
  return parts.slice(-2).join('/');
}

function extractBaseCommand(command) {
  if (!command || typeof command !== 'string') return '';
  const trimmed = command.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return '';
  // Remove command prefixes to get actual tool (e.g., "npx vitest" -> "vitest")
  return firstWord.replace(/^(sudo|npx|bunx)$/, '') || trimmed.split(/\s+/)[1] || firstWord;
}

function truncateError(text) {
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}...` : firstLine;
}

function buildSessionFacts(files, commands, errors, firstUserPrompt) {
  const facts = [];

  if (files.size > 0) {
    const fileList = [...files].slice(0, 10).join(', ');
    facts.push(`files: ${fileList}`);
  }

  if (commands.size > 0) {
    const cmdList = [...commands].slice(0, 5).join(', ');
    facts.push(`commands: ${cmdList}`);
  }

  if (errors.length > 0) {
    const errList = errors.slice(0, 3).join('; ');
    facts.push(`errors: ${errList}`);
  }

  if (firstUserPrompt) {
    const summary = firstUserPrompt.length > 120
      ? `${firstUserPrompt.slice(0, 120)}...`
      : firstUserPrompt;
    facts.push(`summary: ${summary}`);
  }

  return facts;
}

function buildUserFacts(ptWordCount, totalWordCount) {
  const facts = [];

  if (totalWordCount > 10 && ptWordCount / totalWordCount > 0.15) {
    facts.push('idioma: pt-br');
  }

  return facts;
}

module.exports = {
  extractFacts,
  extractFromUserEntry,
  extractFromAssistantEntry,
  extractFileName,
  extractBaseCommand,
  buildSessionFacts,
  buildUserFacts,
};
