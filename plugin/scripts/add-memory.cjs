#!/usr/bin/env node
var f=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var g=f((ue,y)=>{var B=require("better-sqlite3"),_=require("node:fs"),p=require("node:path"),D=require("node:os"),N=p.join(D.homedir(),".local-mind"),A=p.join(D.homedir(),".local-memory"),I=p.join(N,"memory.db"),m=null;function G(e){_.existsSync(e)||_.mkdirSync(e,{recursive:!0,mode:448})}function v(){if(!_.existsSync(N)&&_.existsSync(A))try{_.renameSync(A,N)}catch{}}function W(e=I){if(m)return m;let n=e===":memory:";n||(v(),G(p.dirname(e)));let t=new B(e);if(t.pragma("journal_mode = WAL"),t.pragma("foreign_keys = ON"),t.pragma("busy_timeout = 5000"),O(t),!n)try{_.chmodSync(e,384)}catch{}return m=t,t}function O(e){e.exec(`
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
  `),q(e),P(e)}function P(e){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let t of n)try{e.exec(t)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let t=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();t&&t.sql&&!t.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function q(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function Z(){m&&(m.close(),m=null)}y.exports={getDb:W,closeDb:Z,runMigrations:O,DEFAULT_DB_PATH:I,DEFAULT_DB_DIR:N}});var F=f((ge,U)=>{var k=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function $(e,n=1e5){if(!e||typeof e!="string")return"";let t=e;for(let r of k)t=t.replace(r,"");return t.length>n&&(t=t.slice(0,n)),t}function K(e,n=1,t=1e5){return e.length<n?{valid:!1,reason:`content below minimum length (${n})`}:e.length>t?{valid:!1,reason:`content exceeds maximum length (${t})`}:{valid:!0}}function z(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function V(e){if(!e||typeof e!="object")return{};let n={},t=0;for(let[r,o]of Object.entries(e)){if(t>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof o=="string"?(n[r]=o.slice(0,1024),t++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(n[r]=o,t++))}return n}U.exports={sanitizeContent:$,validateContentLength:K,validateContainerTag:z,sanitizeMetadata:V}});var h=f((Le,S)=>{function C(e){if(!e)return .5;let n=(Date.now()-new Date(e).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function Q(e){if(!e||e.length===0)return[];let n=Math.max(...e.map(t=>Math.abs(t.rank||0)));return e.map(t=>{let r=n>0?Math.abs(t.rank||0)/n:0,o=C(t.updated_at||t.created_at),a=r*.7+o*.3;return{...t,relevance:r,recency:o,score:a}}).sort((t,r)=>r.score-t.score)}function M(e,n){if(!n)return e;let t=(Date.now()-new Date(n).getTime())/864e5;return t<0?e:e*Math.exp(-.1*t)}function J(e,n){let r=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(o=>M(o.confidence,o.reinforced_at)<.3).map(o=>o.id);if(r.length>0){let o=r.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${o})`).run(...r)}return r.length}S.exports={recencyWeight:C,scoredResults:Q,decayedConfidence:M,pruneDecayedFacts:J,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3}});var x=f((Ae,H)=>{var{getDb:ee,closeDb:Re}=g(),{sanitizeContent:X,sanitizeMetadata:te,validateContainerTag:ne,validateContentLength:re}=F(),{scoredResults:oe,pruneDecayedFacts:ae}=h(),ie="claudecode_default",L=class{constructor(n,t){this.containerTag=n||ie,this.dbPath=t}_getDb(){return ee(this.dbPath)}async addMemory(n,t,r={},o=null){let a=this._getDb(),i=t||this.containerTag;ne(i);let E=X(n);re(E);let s=te({source:"local-mind",...r}),T=s.project||null,l=s.type||"session_turn",d=JSON.stringify(s);if(o){let c=a.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(c)return a.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(E,i,T,l,d,o),{id:c.id,status:"updated",containerTag:i}}return{id:a.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(E,i,T,l,s.session_id||null,o,d).lastInsertRowid,status:"created",containerTag:i}}async search(n,t,r={}){let o=this._getDb(),a=t||this.containerTag,i=r.limit||10,E=X(n).replace(/['"]/g,"").trim();if(!E)return{results:[],total:0};let s=E.split(/\s+/).filter(Boolean).map(T=>`"${T}"`).join(" OR ");try{let T=i*2,l=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(s,a,T),d=oe(l);return{results:d.slice(0,i).map(c=>({id:c.id,memory:c.content,content:c.content,similarity:c.score,relevance:c.relevance,recency:c.recency,containerTag:c.container_tag,title:c.project_name,createdAt:c.created_at,updatedAt:c.updated_at})),total:d.length}}catch{return{results:[],total:0}}}async getProfile(n,t){let r=this._getDb(),o=n||this.containerTag,a=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(s=>s.fact_text),i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(s=>s.fact_text),E=t?await this.search(t,o,{limit:10}):{results:[],total:0};return{profile:{static:a,dynamic:i},searchResults:E.results.length>0?E:void 0}}async listMemories(n,t=20){let r=this._getDb(),o=n||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,t)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,t,r,o=1){let a=this._getDb(),i=n||this.containerTag;a.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(i,t,r,o)}pruneOldDynamicFacts(n,t=20){let r=this._getDb(),o=n||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(o,t,o)}pruneDecayed(n){let t=this._getDb(),r=n||this.containerTag;return ae(t,r)}};H.exports={LocalMindClient:L}});var b=f((De,w)=>{var{execSync:Y}=require("node:child_process"),ce=require("node:crypto");function u(e){return ce.createHash("sha256").update(e).digest("hex").slice(0,16)}function R(e){try{return Y("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function se(e){let t=R(e)||e;return`claudecode_project_${u(t)}`}function Ee(e){return(R(e)||e).split("/").pop()||"unknown"}function Te(){try{let n=Y("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${u(n)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${u(e)}`}w.exports={sha256:u,getGitRoot:R,getContainerTag:se,getProjectName:Ee,getUserContainerTag:Te}});var{LocalMindClient:_e}=x(),{getContainerTag:me,getProjectName:de}=b(),{getDb:fe}=g();async function le(e,n){let t=fe(),r=t.prepare("DELETE FROM memories WHERE container_tag = ?").run(e);t.prepare("DELETE FROM profile_facts WHERE container_tag = ?").run(e),t.prepare("DELETE FROM sessions WHERE container_tag = ?").run(e),console.log(`Cleared ${r.changes} memories for project: ${n}`),console.log("New memories will be saved as you continue working.")}async function Ne(){let e=process.argv.slice(2),n=process.cwd(),t=me(n),r=de(n);if(e[0]==="--clear-project")return le(t,r);let o=e.join(" ");if(!o||!o.trim()){console.log('No content provided. Usage: node add-memory.cjs "content to save"');return}try{let i=await new _e(t).addMemory(o,t,{type:"manual",project:r,timestamp:new Date().toISOString()});console.log(`Memory saved to project: ${r}`),console.log(`ID: ${i.id}`)}catch(a){console.error(`Error saving memory: ${a.message}`)}}Ne().catch(e=>{console.error(`Fatal error: ${e.message}`),process.exit(1)});
