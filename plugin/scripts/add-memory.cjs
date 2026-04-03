#!/usr/bin/env node
var N=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var u=N((De,U)=>{var j=require("better-sqlite3"),_=require("node:fs"),l=require("node:path"),I=require("node:os"),g=l.join(I.homedir(),".local-mind"),A=l.join(I.homedir(),".local-memory"),D=l.join(g,"memory.db"),d=null;function v(e){_.existsSync(e)||_.mkdirSync(e,{recursive:!0,mode:448})}function W(){if(!_.existsSync(g)&&_.existsSync(A))try{_.renameSync(A,g)}catch{}}function P(e=D){if(d)return d;let n=e===":memory:";n||(W(),v(l.dirname(e)));let t=new j(e);if(t.pragma("journal_mode = WAL"),t.pragma("foreign_keys = ON"),t.pragma("busy_timeout = 5000"),O(t),!n)try{_.chmodSync(e,384)}catch{}return d=t,t}function O(e){e.exec(`
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
  `),k(e),q(e),Z(e)}function Z(e){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let t of n)try{e.exec(t)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let t=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();t&&t.sql&&!t.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
  `)}function k(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function V(){d&&(d.close(),d=null)}U.exports={getDb:P,closeDb:V,runMigrations:O,DEFAULT_DB_PATH:D,DEFAULT_DB_DIR:g}});var F=N((Oe,C)=>{var $=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function K(e,n=1e5){if(!e||typeof e!="string")return"";let t=e;for(let i of $)t=t.replace(i,"");return t.length>n&&(t=t.slice(0,n)),t}function z(e,n=1,t=1e5){return e.length<n?{valid:!1,reason:`content below minimum length (${n})`}:e.length>t?{valid:!1,reason:`content exceeds maximum length (${t})`}:{valid:!0}}function Q(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function J(e){if(!e||typeof e!="object")return{};let n={},t=0;for(let[i,a]of Object.entries(e)){if(t>=50)break;i.length>128||/[^\w.-]/.test(i)||(typeof a=="string"?(n[i]=a.slice(0,1024),t++):(typeof a=="number"&&Number.isFinite(a)||typeof a=="boolean")&&(n[i]=a,t++))}return n}C.exports={sanitizeContent:K,validateContentLength:z,validateContainerTag:Q,sanitizeMetadata:J}});var h=N((Ue,X)=>{function y(e){if(!e)return .5;let n=(Date.now()-new Date(e).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function ee(e){if(!e||e.length===0)return[];let n=Math.max(...e.map(t=>Math.abs(t.rank||0)));return e.map(t=>{let i=n>0?Math.abs(t.rank||0)/n:0,a=y(t.updated_at||t.created_at),r=i*.7+a*.3;return{...t,relevance:i,recency:a,score:r}}).sort((t,i)=>i.score-t.score)}function S(e,n){if(!n)return e;let t=(Date.now()-new Date(n).getTime())/864e5;return t<0?e:e*Math.exp(-.1*t)}function te(e,n){let i=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(a=>S(a.confidence,a.reinforced_at)<.3).map(a=>a.id);if(i.length>0){let a=i.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${a})`).run(...i)}return i.length}var M={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function ne(e,n,t){if(!n)return e;let i=(Date.now()-new Date(n).getTime())/864e5;if(i<0)return e;let a=M[t]||.1;return e*Math.exp(-a*i)}function ie(e){return 1+.1*Math.min(e||0,5)}X.exports={recencyWeight:y,scoredResults:ee,decayedConfidence:S,pruneDecayedFacts:te,findingDecayedConfidence:ne,recallBoost:ie,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:M}});var w=N((Fe,H)=>{var{getDb:ae,closeDb:Ce}=u(),{sanitizeContent:x,sanitizeMetadata:re,validateContainerTag:oe,validateContentLength:se}=F(),{scoredResults:ce,pruneDecayedFacts:Ee,decayedConfidence:Te,CONFIDENCE_PRUNE_THRESHOLD:_e}=h(),de="claudecode_default",p=class{constructor(n,t){this.containerTag=n||de,this.dbPath=t}_getDb(){return ae(this.dbPath)}async addMemory(n,t,i={},a=null){let r=this._getDb(),o=t||this.containerTag;oe(o);let E=x(n);se(E);let s=re({source:"local-mind",...i}),T=s.project||null,m=s.type||"session_turn",f=JSON.stringify(s);if(a){let c=r.prepare("SELECT id FROM memories WHERE custom_id = ?").get(a);if(c)return r.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(E,o,T,m,f,a),{id:c.id,status:"updated",containerTag:o}}return{id:r.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(E,o,T,m,s.session_id||null,a,f).lastInsertRowid,status:"created",containerTag:o}}async search(n,t,i={}){let a=this._getDb(),r=t||this.containerTag,o=i.limit||10,E=x(n).replace(/['"]/g,"").trim();if(!E)return{results:[],total:0};let s=E.split(/\s+/).filter(Boolean).map(T=>`"${T}"`).join(" OR ");try{let T=o*2,m=a.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(s,r,T),f=ce(m);return{results:f.slice(0,o).map(c=>({id:c.id,memory:c.content,content:c.content,similarity:c.score,relevance:c.relevance,recency:c.recency,containerTag:c.container_tag,title:c.project_name,createdAt:c.created_at,updatedAt:c.updated_at})),total:f.length}}catch{return{results:[],total:0}}}async getProfile(n,t){let i=this._getDb(),a=n||this.containerTag,r=i.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(a).map(s=>s.fact_text),o=i.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(a).filter(s=>Te(s.confidence,s.reinforced_at)>=_e).map(s=>s.fact_text),E=t?await this.search(t,a,{limit:10}):{results:[],total:0};return{profile:{static:r,dynamic:o},searchResults:E.results.length>0?E:void 0}}async listMemories(n,t=20){let i=this._getDb(),a=n||this.containerTag;return{memories:i.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(a,t)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,t,i,a=1){let r=this._getDb(),o=n||this.containerTag;r.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(o,t,i,a)}pruneOldDynamicFacts(n,t=20){let i=this._getDb(),a=n||this.containerTag;i.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(a,t,a)}pruneDecayed(n){let t=this._getDb(),i=n||this.containerTag;return Ee(t,i)}};H.exports={LocalMindClient:p}});var B=N((ye,G)=>{var{execSync:Y}=require("node:child_process"),fe=require("node:crypto");function L(e){return fe.createHash("sha256").update(e).digest("hex").slice(0,16)}function R(e){try{return Y("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Ne(e){let t=R(e)||e;return`claudecode_project_${L(t)}`}function me(e){return(R(e)||e).split("/").pop()||"unknown"}function ge(){try{let n=Y("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${L(n)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${L(e)}`}G.exports={sha256:L,getGitRoot:R,getContainerTag:Ne,getProjectName:me,getUserContainerTag:ge}});var{LocalMindClient:le}=w(),{getContainerTag:Le,getProjectName:ue}=B(),{getDb:pe}=u();async function Re(e,n){let t=pe(),i=t.prepare("DELETE FROM memories WHERE container_tag = ?").run(e);t.prepare("DELETE FROM profile_facts WHERE container_tag = ?").run(e),t.prepare("DELETE FROM sessions WHERE container_tag = ?").run(e),console.log(`Cleared ${i.changes} memories for project: ${n}`),console.log("New memories will be saved as you continue working.")}async function Ae(){let e=process.argv.slice(2),n=process.cwd(),t=Le(n),i=ue(n);if(e[0]==="--clear-project")return Re(t,i);let a=e.join(" ");if(!a||!a.trim()){console.log('No content provided. Usage: node add-memory.cjs "content to save"');return}try{let o=await new le(t).addMemory(a,t,{type:"manual",project:i,timestamp:new Date().toISOString()});console.log(`Memory saved to project: ${i}`),console.log(`ID: ${o.id}`)}catch(r){console.error(`Error saving memory: ${r.message}`)}}Ae().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
