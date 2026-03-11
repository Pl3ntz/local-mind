const fs = require('node:fs');

const BRACKETS = {
  FRESH:    { minPct: 60, maxResults: 3,  includeGotchas: false, includeSearch: false },
  MODERATE: { minPct: 30, maxResults: 8,  includeGotchas: true,  includeSearch: true  },
  DEPLETED: { minPct: 10, maxResults: 12, includeGotchas: true,  includeSearch: true  },
  CRITICAL: { minPct: 0,  maxResults: 15, includeGotchas: true,  includeSearch: true  },
};

const TOKENS_PER_KB = 250;
const MAX_TOKENS = 200000;

function estimateContextBracket(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') {
    return { ...BRACKETS.MODERATE, bracket: 'MODERATE' };
  }

  try {
    const stats = fs.statSync(transcriptPath);
    const transcriptKB = stats.size / 1024;
    const estimatedTokens = transcriptKB * TOKENS_PER_KB;
    const remainingPct = Math.max(0, 100 - (estimatedTokens / MAX_TOKENS) * 100);

    if (remainingPct >= 60) return { ...BRACKETS.FRESH, bracket: 'FRESH' };
    if (remainingPct >= 30) return { ...BRACKETS.MODERATE, bracket: 'MODERATE' };
    if (remainingPct >= 10) return { ...BRACKETS.DEPLETED, bracket: 'DEPLETED' };
    return { ...BRACKETS.CRITICAL, bracket: 'CRITICAL' };
  } catch {
    return { ...BRACKETS.MODERATE, bracket: 'MODERATE' };
  }
}

module.exports = {
  estimateContextBracket,
  BRACKETS,
};
