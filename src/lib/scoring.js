const DECAY_LAMBDA = 0.15; // half-life ~4.6 days
const FACT_DECAY_LAMBDA = 0.1; // half-life ~7 days
const BM25_WEIGHT = 0.7;
const RECENCY_WEIGHT = 0.3;
const CONFIDENCE_PRUNE_THRESHOLD = 0.3;

function recencyWeight(updatedAt) {
  if (!updatedAt) return 0.5;
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
  if (days < 0) return 1.0;
  return Math.exp(-DECAY_LAMBDA * days);
}

function scoredResults(ftsResults) {
  if (!ftsResults || ftsResults.length === 0) return [];

  const maxRank = Math.max(...ftsResults.map((r) => Math.abs(r.rank || 0)));

  return ftsResults
    .map((r) => {
      const relevance = maxRank > 0 ? Math.abs(r.rank || 0) / maxRank : 0;
      const recency = recencyWeight(r.updated_at || r.created_at);
      const score = relevance * BM25_WEIGHT + recency * RECENCY_WEIGHT;

      return { ...r, relevance, recency, score };
    })
    .sort((a, b) => b.score - a.score);
}

function decayedConfidence(confidence, reinforcedAt) {
  if (!reinforcedAt) return confidence;
  const days = (Date.now() - new Date(reinforcedAt).getTime()) / 86400000;
  if (days < 0) return confidence;
  return confidence * Math.exp(-FACT_DECAY_LAMBDA * days);
}

function pruneDecayedFacts(db, containerTag) {
  const facts = db
    .prepare(
      'SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?',
    )
    .all(containerTag);

  const toDelete = facts
    .filter((f) => decayedConfidence(f.confidence, f.reinforced_at) < CONFIDENCE_PRUNE_THRESHOLD)
    .map((f) => f.id);

  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM profile_facts WHERE id IN (${placeholders})`).run(...toDelete);
  }

  return toDelete.length;
}

module.exports = {
  recencyWeight,
  scoredResults,
  decayedConfidence,
  pruneDecayedFacts,
  DECAY_LAMBDA,
  FACT_DECAY_LAMBDA,
  BM25_WEIGHT,
  RECENCY_WEIGHT,
  CONFIDENCE_PRUNE_THRESHOLD,
};
