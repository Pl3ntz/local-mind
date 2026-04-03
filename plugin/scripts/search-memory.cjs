#!/usr/bin/env node
var N=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var U=N((Ae,O)=>{var j=require("better-sqlite3"),_=require("node:fs"),g=require("node:path"),A=require("node:os"),m=g.join(A.homedir(),".local-mind"),R=g.join(A.homedir(),".local-memory"),I=g.join(m,"memory.db"),d=null;function v(e){_.existsSync(e)||_.mkdirSync(e,{recursive:!0,mode:448})}function P(){if(!_.existsSync(m)&&_.existsSync(R))try{_.renameSync(R,m)}catch{}}function W(e=I){if(d)return d;let n=e===":memory:";n||(P(),v(g.dirname(e)));let t=new j(e);if(t.pragma("journal_mode = WAL"),t.pragma("foreign_keys = ON"),t.pragma("busy_timeout = 5000"),D(t),!n)try{_.chmodSync(e,384)}catch{}return d=t,t}function D(e){e.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      container_tag TEXT NOT NULL,
      project_name TEXT,
      memory_type TEXT NOT NULL DEFAULT 'session_turn',
      session_id TEXT,
      custom_id TEXT UNIQUE,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, project_name,
      content=memories, content_rowid=id,
      tokenize='porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS profile_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      fact_type TEXT NOT NULL CHECK (fact_type IN ('static','dynamic','gotcha')),
      fact_text TEXT NOT NULL,
      source_memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(container_tag, fact_type, fact_text)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      container_tag TEXT NOT NULL,
      project_name TEXT,
      last_captured_uuid TEXT,
      started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      ended_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_memories_container ON memories(container_tag);
    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_profile_container ON profile_facts(container_tag, fact_type);

    CREATE TABLE IF NOT EXISTS gotchas_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      pattern_hash TEXT NOT NULL,
      normalized_pattern TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      count INTEGER DEFAULT 1,
      samples TEXT DEFAULT '[]',
      related_files TEXT DEFAULT '[]',
      first_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      promoted INTEGER DEFAULT 0,
      UNIQUE(container_tag, pattern_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_gotchas_container ON gotchas_tracking(container_tag, promoted);

    CREATE TABLE IF NOT EXISTS agent_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      session_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      invocation_count INTEGER DEFAULT 1,
      task_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(container_tag, session_id, agent_name)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_usage_container
      ON agent_usage(container_tag, agent_name);

    CREATE TABLE IF NOT EXISTS agent_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      session_id TEXT,
      finding_text TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM'
        CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','resolved','superseded','wont_fix')),
      related_files TEXT DEFAULT '[]',
      confidence REAL DEFAULT 1.0,
      recall_count INTEGER DEFAULT 0,
      reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(container_tag, agent_name, finding_text)
    );

    CREATE INDEX IF NOT EXISTS idx_findings_container_status
      ON agent_findings(container_tag, status, severity);
    CREATE INDEX IF NOT EXISTS idx_findings_agent
      ON agent_findings(container_tag, agent_name);
    CREATE INDEX IF NOT EXISTS idx_findings_session
      ON agent_findings(session_id);

    CREATE TABLE IF NOT EXISTS recall_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      finding_id INTEGER NOT NULL REFERENCES agent_findings(id) ON DELETE CASCADE,
      recalled_by TEXT NOT NULL,
      session_id TEXT NOT NULL,
      acted_on INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recall_finding ON recall_log(finding_id);
    CREATE INDEX IF NOT EXISTS idx_recall_session ON recall_log(session_id, recalled_by);
  `),$(e),q(e),Z(e)}function Z(e){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let t of n)try{e.exec(t)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let t=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();t&&t.sql&&!t.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
          CREATE TABLE profile_facts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            container_tag TEXT NOT NULL,
            fact_type TEXT NOT NULL CHECK (fact_type IN ('static','dynamic','gotcha')),
            fact_text TEXT NOT NULL,
            source_memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL,
            confidence REAL DEFAULT 1.0,
            reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            UNIQUE(container_tag, fact_type, fact_text)
          );
          INSERT INTO profile_facts_new (id, container_tag, fact_type, fact_text, source_memory_id, confidence, reinforced_at, created_at, updated_at)
            SELECT id, container_tag, fact_type, fact_text, source_memory_id, confidence, reinforced_at, created_at, updated_at FROM profile_facts;
          DROP TABLE profile_facts;
          ALTER TABLE profile_facts_new RENAME TO profile_facts;
          CREATE INDEX IF NOT EXISTS idx_profile_container ON profile_facts(container_tag, fact_type);
          CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at);
        `)})()}catch{}}function q(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS findings_fts USING fts5(
      finding_text, agent_name,
      content=agent_findings, content_rowid=id,
      tokenize='porter unicode61'
    );

    CREATE TRIGGER findings_ai AFTER INSERT ON agent_findings BEGIN
      INSERT INTO findings_fts(rowid, finding_text, agent_name)
      VALUES (new.id, new.finding_text, new.agent_name);
    END;

    CREATE TRIGGER findings_au AFTER UPDATE ON agent_findings BEGIN
      INSERT INTO findings_fts(findings_fts, rowid, finding_text, agent_name)
      VALUES ('delete', old.id, old.finding_text, old.agent_name);
      INSERT INTO findings_fts(rowid, finding_text, agent_name)
      VALUES (new.id, new.finding_text, new.agent_name);
    END;

    CREATE TRIGGER findings_ad AFTER DELETE ON agent_findings BEGIN
      INSERT INTO findings_fts(findings_fts, rowid, finding_text, agent_name)
      VALUES ('delete', old.id, old.finding_text, old.agent_name);
    END;
  `)}function $(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
    CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, project_name)
      VALUES (new.id, new.content, new.project_name);
    END;

    CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project_name)
      VALUES ('delete', old.id, old.content, old.project_name);
      INSERT INTO memories_fts(rowid, content, project_name)
      VALUES (new.id, new.content, new.project_name);
    END;

    CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, project_name)
      VALUES ('delete', old.id, old.content, old.project_name);
    END;
  `)}function k(){d&&(d.close(),d=null)}O.exports={getDb:W,closeDb:k,runMigrations:D,DEFAULT_DB_PATH:I,DEFAULT_DB_DIR:m}});var C=N((Ie,y)=>{var V=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function K(e,n=1e5){if(!e||typeof e!="string")return"";let t=e;for(let o of V)t=t.replace(o,"");return t.length>n&&(t=t.slice(0,n)),t}function z(e,n=1,t=1e5){return e.length<n?{valid:!1,reason:`content below minimum length (${n})`}:e.length>t?{valid:!1,reason:`content exceeds maximum length (${t})`}:{valid:!0}}function Q(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function J(e){if(!e||typeof e!="object")return{};let n={},t=0;for(let[o,i]of Object.entries(e)){if(t>=50)break;o.length>128||/[^\w.-]/.test(o)||(typeof i=="string"?(n[o]=i.slice(0,1024),t++):(typeof i=="number"&&Number.isFinite(i)||typeof i=="boolean")&&(n[o]=i,t++))}return n}y.exports={sanitizeContent:K,validateContentLength:z,validateContainerTag:Q,sanitizeMetadata:J}});var X=N((De,h)=>{function F(e){if(!e)return .5;let n=(Date.now()-new Date(e).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function ee(e){if(!e||e.length===0)return[];let n=Math.max(...e.map(t=>Math.abs(t.rank||0)));return e.map(t=>{let o=n>0?Math.abs(t.rank||0)/n:0,i=F(t.updated_at||t.created_at),r=o*.7+i*.3;return{...t,relevance:o,recency:i,score:r}}).sort((t,o)=>o.score-t.score)}function S(e,n){if(!n)return e;let t=(Date.now()-new Date(n).getTime())/864e5;return t<0?e:e*Math.exp(-.1*t)}function te(e,n){let o=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(i=>S(i.confidence,i.reinforced_at)<.3).map(i=>i.id);if(o.length>0){let i=o.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${i})`).run(...o)}return o.length}var M={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function ne(e,n,t){if(!n)return e;let o=(Date.now()-new Date(n).getTime())/864e5;if(o<0)return e;let i=M[t]||.1;return e*Math.exp(-i*o)}function ie(e){return 1+.1*Math.min(e||0,5)}h.exports={recencyWeight:F,scoredResults:ee,decayedConfidence:S,pruneDecayedFacts:te,findingDecayedConfidence:ne,recallBoost:ie,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:M}});var w=N((Ue,H)=>{var{getDb:oe,closeDb:Oe}=U(),{sanitizeContent:x,sanitizeMetadata:ae,validateContainerTag:re,validateContentLength:se}=C(),{scoredResults:ce,pruneDecayedFacts:Ee,decayedConfidence:Te,CONFIDENCE_PRUNE_THRESHOLD:_e}=X(),de="claudecode_default",L=class{constructor(n,t){this.containerTag=n||de,this.dbPath=t}_getDb(){return oe(this.dbPath)}async addMemory(n,t,o={},i=null){let r=this._getDb(),a=t||this.containerTag;re(a);let E=x(n);se(E);let s=ae({source:"local-mind",...o}),T=s.project||null,l=s.type||"session_turn",f=JSON.stringify(s);if(i){let c=r.prepare("SELECT id FROM memories WHERE custom_id = ?").get(i);if(c)return r.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(E,a,T,l,f,i),{id:c.id,status:"updated",containerTag:a}}return{id:r.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(E,a,T,l,s.session_id||null,i,f).lastInsertRowid,status:"created",containerTag:a}}async search(n,t,o={}){let i=this._getDb(),r=t||this.containerTag,a=o.limit||10,E=x(n).replace(/['"]/g,"").trim();if(!E)return{results:[],total:0};let s=E.split(/\s+/).filter(Boolean).map(T=>`"${T}"`).join(" OR ");try{let T=a*2,l=i.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(s,r,T),f=ce(l);return{results:f.slice(0,a).map(c=>({id:c.id,memory:c.content,content:c.content,similarity:c.score,relevance:c.relevance,recency:c.recency,containerTag:c.container_tag,title:c.project_name,createdAt:c.created_at,updatedAt:c.updated_at})),total:f.length}}catch{return{results:[],total:0}}}async getProfile(n,t){let o=this._getDb(),i=n||this.containerTag,r=o.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(i).map(s=>s.fact_text),a=o.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(i).filter(s=>Te(s.confidence,s.reinforced_at)>=_e).map(s=>s.fact_text),E=t?await this.search(t,i,{limit:10}):{results:[],total:0};return{profile:{static:r,dynamic:a},searchResults:E.results.length>0?E:void 0}}async listMemories(n,t=20){let o=this._getDb(),i=n||this.containerTag;return{memories:o.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(i,t)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,t,o,i=1){let r=this._getDb(),a=n||this.containerTag;r.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(a,t,o,i)}pruneOldDynamicFacts(n,t=20){let o=this._getDb(),i=n||this.containerTag;o.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(i,t,i)}pruneDecayed(n){let t=this._getDb(),o=n||this.containerTag;return Ee(t,o)}};H.exports={LocalMindClient:L}});var B=N((ye,G)=>{var{execSync:Y}=require("node:child_process"),fe=require("node:crypto");function u(e){return fe.createHash("sha256").update(e).digest("hex").slice(0,16)}function p(e){try{return Y("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Ne(e){let t=p(e)||e;return`claudecode_project_${u(t)}`}function le(e){return(p(e)||e).split("/").pop()||"unknown"}function me(){try{let n=Y("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${u(n)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${u(e)}`}G.exports={sha256:u,getGitRoot:p,getContainerTag:Ne,getProjectName:le,getUserContainerTag:me}});var{LocalMindClient:ge}=w(),{getContainerTag:ue,getProjectName:Le}=B();async function pe(){let e=process.argv.slice(2).join(" ");if(!e||!e.trim()){console.log("No search query provided. Please specify what you want to search for.");return}let n=process.cwd(),t=ue(n),o=Le(n);try{let r=await new ge(t).getProfile(t,e);console.log(`## Memory Search: "${e}"`),console.log(`Project: ${o}
`),r.profile&&(r.profile.static?.length>0&&(console.log("### User Preferences"),r.profile.static.forEach(a=>console.log(`- ${a}`)),console.log("")),r.profile.dynamic?.length>0&&(console.log("### Recent Context"),r.profile.dynamic.forEach(a=>console.log(`- ${a}`)),console.log(""))),r.searchResults?.results?.length>0?(console.log("### Relevant Memories"),r.searchResults.results.forEach((a,E)=>{let s=Math.round(a.similarity*100),T=a.memory||a.content||"";console.log(`
**Memory ${E+1}** (${s}% match)`),a.title&&console.log(`*${a.title}*`),console.log(T.slice(0,500))})):(console.log("No memories found matching your query."),console.log("Memories are automatically saved as you work in this project."))}catch(i){console.error(`Error searching memories: ${i.message}`)}}pe().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
