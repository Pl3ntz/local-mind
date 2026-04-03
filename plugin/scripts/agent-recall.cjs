#!/usr/bin/env node
var d=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var D=d((ce,p)=>{var h=require("better-sqlite3"),c=require("node:fs"),f=require("node:path"),A=require("node:os"),N=f.join(A.homedir(),".local-mind"),l=f.join(A.homedir(),".local-memory"),R=f.join(N,"memory.db"),_=null;function Y(e){c.existsSync(e)||c.mkdirSync(e,{recursive:!0,mode:448})}function B(){if(!c.existsSync(N)&&c.existsSync(l))try{c.renameSync(l,N)}catch{}}function j(e=R){if(_)return _;let t=e===":memory:";t||(B(),Y(f.dirname(e)));let n=new h(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),u(n),!t)try{c.chmodSync(e,384)}catch{}return _=n,n}function u(e){e.exec(`
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
  `),Z(e),q(e),W(e)}function W(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
  `)}function Z(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function v(){_&&(_.close(),_=null)}p.exports={getDb:j,closeDb:v,runMigrations:u,DEFAULT_DB_PATH:R,DEFAULT_DB_DIR:N}});var F=d((_e,C)=>{function O(e){if(!e)return .5;let t=(Date.now()-new Date(e).getTime())/864e5;return t<0?1:Math.exp(-.15*t)}function P(e){if(!e||e.length===0)return[];let t=Math.max(...e.map(n=>Math.abs(n.rank||0)));return e.map(n=>{let i=t>0?Math.abs(n.rank||0)/t:0,o=O(n.updated_at||n.created_at),E=i*.7+o*.3;return{...n,relevance:i,recency:o,score:E}}).sort((n,i)=>i.score-n.score)}function U(e,t){if(!t)return e;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?e:e*Math.exp(-.1*n)}function V(e,t){let i=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(t).filter(o=>U(o.confidence,o.reinforced_at)<.3).map(o=>o.id);if(i.length>0){let o=i.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${o})`).run(...i)}return i.length}var S={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function $(e,t,n){if(!t)return e;let i=(Date.now()-new Date(t).getTime())/864e5;if(i<0)return e;let o=S[n]||.1;return e*Math.exp(-o*i)}function k(e){return 1+.1*Math.min(e||0,5)}C.exports={recencyWeight:O,scoredResults:P,decayedConfidence:U,pruneDecayedFacts:V,findingDecayedConfidence:$,recallBoost:k,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:S}});var M=d((de,X)=>{var{findingDecayedConfidence:K,recallBoost:b,CONFIDENCE_PRUNE_THRESHOLD:Q}=F(),m=["CRITICAL","HIGH","MEDIUM","LOW","INFO"];function z(e,{containerTag:t,sessionId:n,agentName:i,severity:o,findingText:E,fileRefs:a=[]}){if(!m.includes(o))throw new Error(`Invalid severity: ${o}. Must be one of: ${m.join(", ")}`);let r=JSON.stringify(a),s=e.prepare("SELECT id, confidence FROM agent_findings WHERE container_tag = ? AND agent_name = ? AND finding_text = ?").get(t,i,E);return s?(e.prepare(`UPDATE agent_findings SET
         confidence = MIN(confidence + 0.2, 2.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         session_id = ?
       WHERE id = ?`).run(n,s.id),{id:s.id,status:"reinforced"}):{id:e.prepare(`INSERT INTO agent_findings (container_tag, agent_name, session_id, finding_text, severity, related_files)
       VALUES (?, ?, ?, ?, ?, ?)`).run(t,i,n,E,o,r).lastInsertRowid,status:"created"}}function J(e,t,n={}){let{agentName:i,limit:o=10,includeGlobal:E=!1}=n,a="SELECT * FROM agent_findings WHERE status = 'open'",r=[];return E?(a+=" AND (container_tag = ? OR container_tag = ?)",r.push(t,"_global")):(a+=" AND container_tag = ?",r.push(t)),i&&(a+=" AND agent_name = ?",r.push(i)),a+=` ORDER BY
    CASE severity
      WHEN 'CRITICAL' THEN 5
      WHEN 'HIGH' THEN 4
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 2
      WHEN 'INFO' THEN 1
    END DESC,
    reinforced_at DESC
  LIMIT ?`,r.push(o),e.prepare(a).all(...r).filter(T=>K(T.confidence,T.reinforced_at,T.severity)*b(T.recall_count)>=Q)}function ee(e){return!e||e.length===0?"":e.map(n=>`- [${n.created_at?n.created_at.split("T")[0]:"unknown"}] **${n.severity}** (${n.agent_name}): ${n.finding_text}`).join(`
`)}function te(e,t){if(!t||t.length===0)return;let n=e.prepare(`UPDATE agent_findings SET
       recall_count = recall_count + 1,
       reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`);for(let i of t)n.run(i)}X.exports={saveFinding:z,queryFindings:J,formatFindingsForInjection:ee,reinforceFindings:te,VALID_SEVERITIES:m}});var w=d((Ne,H)=>{var{execSync:y}=require("node:child_process"),ne=require("node:crypto");function g(e){return ne.createHash("sha256").update(e).digest("hex").slice(0,16)}function I(e){try{return y("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function ie(e){let n=I(e)||e;return`claudecode_project_${g(n)}`}function oe(e){return(I(e)||e).split("/").pop()||"unknown"}function Ee(){try{let t=y("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${g(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${g(e)}`}H.exports={sha256:g,getGitRoot:I,getContainerTag:ie,getProjectName:oe,getUserContainerTag:Ee}});var{getDb:re}=D(),{queryFindings:x,formatFindingsForInjection:G}=M(),{getContainerTag:ae}=w();function Te(){let e=process.argv.slice(2),t=e[0];t||(console.error("Usage: node agent-recall.cjs <agent-name> [container-tag]"),process.exit(1));let n=e[1]||ae(process.cwd()),i=re(),o=x(i,n,{agentName:t,limit:5,includeGlobal:!1}),E=x(i,n,{limit:5,includeGlobal:!0}).filter(L=>L.agent_name!==t);if([...o,...E.slice(0,3)].length===0){console.log("Nenhum achado anterior encontrado para este agente/projeto.");return}let r=o.length>0?`## Seus achados anteriores (${t})
${G(o)}`:"",s=E.length>0?`## Achados de outros agentes neste projeto
${G(E.slice(0,3))}`:"",T=[r,s].filter(Boolean).join(`

`);console.log(T)}Te();
