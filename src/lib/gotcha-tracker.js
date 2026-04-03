function normalizeErrorPattern(errorText) {
  if (!errorText) return '';

  const firstLine = String(errorText).split('\n')[0].trim();

  const normalized = firstLine
    .replace(/["'].*?["']/g, '"X"')
    .replace(/`.*?`/g, '`X`')
    .replace(/\d+/g, 'N');

  return normalized.substring(0, 100);
}

function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

const CATEGORY_KEYWORDS = {
  build: ['build', 'compile', 'esbuild', 'webpack', 'tsc', 'syntax error'],
  test: ['test', 'vitest', 'jest', 'expect', 'assert', 'spec'],
  lint: ['lint', 'eslint', 'biome', 'prettier', 'format'],
  runtime: ['typeerror', 'referenceerror', 'rangeerror', 'syntaxerror', 'cannot read', 'undefined is not'],
  integration: ['fetch', 'network', 'timeout', 'econnrefused', 'api'],
  security: ['csrf', 'xss', 'injection', 'unauthorized', 'forbidden', 'cors'],
  database: ['sqlite', 'postgres', 'sql', 'column', 'table', 'migration', 'constraint'],
};

function detectCategory(errorText) {
  if (!errorText) return 'general';

  const lower = errorText.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

function trackError(db, containerTag, errorText, filePath = null) {
  const normalized = normalizeErrorPattern(errorText);
  if (!normalized) return;

  const hash = djb2Hash(normalized);
  const category = detectCategory(errorText);

  const existing = db
    .prepare('SELECT * FROM gotchas_tracking WHERE container_tag = ? AND pattern_hash = ?')
    .get(containerTag, hash);

  if (existing) {
    const samples = JSON.parse(existing.samples);
    const firstLine = String(errorText).split('\n')[0].trim();
    const newSamples = samples.length < 5 && !samples.includes(firstLine)
      ? [...samples, firstLine]
      : samples;

    const relatedFiles = JSON.parse(existing.related_files);
    const newRelatedFiles = filePath && !relatedFiles.includes(filePath)
      ? [...relatedFiles, filePath]
      : relatedFiles;

    const newCount = existing.count + 1;
    const shouldPromote = newCount >= 3 && !existing.promoted;

    db.prepare(
      `UPDATE gotchas_tracking
       SET count = ?, samples = ?, related_files = ?, category = ?,
           last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    ).run(newCount, JSON.stringify(newSamples), JSON.stringify(newRelatedFiles), category, existing.id);

    if (shouldPromote) {
      db.prepare('UPDATE gotchas_tracking SET promoted = 1 WHERE id = ?').run(existing.id);

      db.prepare(
        `INSERT OR IGNORE INTO profile_facts (container_tag, fact_type, fact_text, confidence)
         VALUES (?, 'gotcha', ?, 1.0)`,
      ).run(containerTag, `[${category}] ${normalized} (seen ${newCount}x)`);
    }
  } else {
    const firstLine = String(errorText).split('\n')[0].trim();
    const samples = JSON.stringify([firstLine]);
    const relatedFiles = filePath ? JSON.stringify([filePath]) : '[]';

    db.prepare(
      `INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, related_files)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    ).run(containerTag, hash, normalized, category, samples, relatedFiles);
  }
}

function getRelevantGotchas(db, containerTag, taskContext = '') {
  const promoted = db
    .prepare(
      `SELECT * FROM gotchas_tracking
       WHERE container_tag = ? AND promoted = 1
       ORDER BY last_seen DESC`,
    )
    .all(containerTag);

  if (promoted.length === 0) return '';

  const taskCategory = detectCategory(taskContext);
  const taskLower = (taskContext || '').toLowerCase();
  const taskWords = taskLower.split(/\s+/).filter(Boolean);

  const scored = promoted.map((row) => {
    let score = 0;

    if (row.category === taskCategory && taskCategory !== 'general') {
      score += 3;
    }

    for (const word of taskWords) {
      if (row.normalized_pattern.toLowerCase().includes(word)) {
        score += 1;
      }
    }

    const relatedFiles = JSON.parse(row.related_files);
    for (const word of taskWords) {
      if (relatedFiles.some((f) => f.toLowerCase().includes(word))) {
        score += 2;
      }
    }

    return { ...row, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);

  const lines = top.map((g) => {
    const filesInfo = JSON.parse(g.related_files);
    const fileStr = filesInfo.length > 0 ? ` (files: ${filesInfo.join(', ')})` : '';
    return `- **[Gotcha: ${g.category}]** ${g.normalized_pattern} — seen ${g.count}x${fileStr}`;
  });

  return `## Known Gotchas\n${lines.join('\n')}`;
}

module.exports = {
  normalizeErrorPattern,
  djb2Hash,
  detectCategory,
  trackError,
  getRelevantGotchas,
};
