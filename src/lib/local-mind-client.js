const { getDb, closeDb } = require('./database');
const { sanitizeContent, sanitizeMetadata, validateContainerTag, validateContentLength } = require('./validate-local');
const { scoredResults, pruneDecayedFacts, decayedConfidence, CONFIDENCE_PRUNE_THRESHOLD } = require('./scoring');

const DEFAULT_PROJECT_ID = 'claudecode_default';

class LocalMindClient {
  constructor(containerTag, dbPath) {
    this.containerTag = containerTag || DEFAULT_PROJECT_ID;
    this.dbPath = dbPath;
  }

  _getDb() {
    return getDb(this.dbPath);
  }

  async addMemory(content, containerTag, metadata = {}, customId = null) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;
    validateContainerTag(tag);
    const sanitized = sanitizeContent(content);
    validateContentLength(sanitized);
    const safeMeta = sanitizeMetadata({
      source: 'local-mind',
      ...metadata,
    });
    const projectName = safeMeta.project || null;
    const memoryType = safeMeta.type || 'session_turn';
    const metaJson = JSON.stringify(safeMeta);

    if (customId) {
      const existing = db
        .prepare('SELECT id FROM memories WHERE custom_id = ?')
        .get(customId);

      if (existing) {
        db.prepare(
          `UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`,
        ).run(sanitized, tag, projectName, memoryType, metaJson, customId);

        return {
          id: existing.id,
          status: 'updated',
          containerTag: tag,
        };
      }
    }

    const result = db
      .prepare(
        `INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sanitized,
        tag,
        projectName,
        memoryType,
        safeMeta.session_id || null,
        customId,
        metaJson,
      );

    return {
      id: result.lastInsertRowid,
      status: 'created',
      containerTag: tag,
    };
  }

  async search(query, containerTag, options = {}) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;
    const limit = options.limit || 10;

    const sanitizedQuery = sanitizeContent(query)
      .replace(/['"]/g, '')
      .trim();

    if (!sanitizedQuery) {
      return { results: [], total: 0 };
    }

    const ftsQuery = sanitizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(' OR ');

    try {
      const fetchLimit = limit * 2;
      const rows = db
        .prepare(
          `SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(ftsQuery, tag, fetchLimit);

      const scored = scoredResults(rows);

      const results = scored.slice(0, limit).map((row) => ({
        id: row.id,
        memory: row.content,
        content: row.content,
        similarity: row.score,
        relevance: row.relevance,
        recency: row.recency,
        containerTag: row.container_tag,
        title: row.project_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return {
        results,
        total: scored.length,
      };
    } catch {
      return { results: [], total: 0 };
    }
  }

  async getProfile(containerTag, query) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;

    const staticFacts = db
      .prepare(
        `SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`,
      )
      .all(tag)
      .map((r) => r.fact_text);

    const dynamicFacts = db
      .prepare(
        `SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`,
      )
      .all(tag)
      .filter((r) => decayedConfidence(r.confidence, r.reinforced_at) >= CONFIDENCE_PRUNE_THRESHOLD)
      .map((r) => r.fact_text);

    const searchResults = query
      ? await this.search(query, tag, { limit: 10 })
      : { results: [], total: 0 };

    return {
      profile: {
        static: staticFacts,
        dynamic: dynamicFacts,
      },
      searchResults: searchResults.results.length > 0
        ? searchResults
        : undefined,
    };
  }

  async listMemories(containerTag, limit = 20) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;

    const rows = db
      .prepare(
        `SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(tag, limit);

    return { memories: rows };
  }

  async deleteMemory(memoryId) {
    const db = this._getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(memoryId);
  }

  addProfileFact(containerTag, factType, factText, confidence = 1.0) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;

    db.prepare(
      `INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    ).run(tag, factType, factText, confidence);
  }

  pruneOldDynamicFacts(containerTag, maxFacts = 20) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;

    db.prepare(
      `DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`,
    ).run(tag, maxFacts, tag);
  }

  pruneDecayed(containerTag) {
    const db = this._getDb();
    const tag = containerTag || this.containerTag;
    return pruneDecayedFacts(db, tag);
  }
}

module.exports = { LocalMindClient };
