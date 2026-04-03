#!/usr/bin/env node
var T=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var A=T((Le,p)=>{var c=require("node:fs"),l=require("node:path"),H=require("node:os"),N=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||l.join(H.homedir(),".local-mind"),E=l.join(N,"settings.json"),I={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function B(){c.existsSync(N)||c.mkdirSync(N,{recursive:!0,mode:448})}function k(){let e={...I};try{if(c.existsSync(E)){let n=c.readFileSync(E,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${E}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function j(e){B();let t={...e};c.writeFileSync(E,JSON.stringify(t,null,2),{mode:384})}function q(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function P(e,t,n){if(e.debug){let i=new Date().toISOString();console.error(n?`[${i}] ${t}: ${JSON.stringify(n)}`:`[${i}] ${t}`)}}p.exports={SETTINGS_DIR:N,SETTINGS_FILE:E,DEFAULT_SETTINGS:I,loadSettings:k,saveSettings:j,shouldCaptureTool:q,debugLog:P}});var O=T((le,R)=>{async function $(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",i=>{n+=i}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(i){t(new Error(`Failed to parse stdin JSON: ${i.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function _(e){console.log(JSON.stringify(e))}function Z(e=null){_(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function K(e){console.error(`LocalMind: ${e}`),_({continue:!0,suppressOutput:!0})}function b(e,t){_({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}R.exports={readStdin:$,writeOutput:_,outputSuccess:Z,outputError:K,outputWithContext:b}});var D=T((Ie,U)=>{var{execSync:S}=require("node:child_process"),W=require("node:crypto");function f(e){return W.createHash("sha256").update(e).digest("hex").slice(0,16)}function L(e){try{return S("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function V(e){let n=L(e)||e;return`claudecode_project_${f(n)}`}function z(e){return(L(e)||e).split("/").pop()||"unknown"}function Q(){try{let t=S("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${f(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${f(e)}`}U.exports={sha256:f,getGitRoot:L,getContainerTag:V,getProjectName:z,getUserContainerTag:Q}});var C=T((pe,F)=>{var J=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function X(e){if(!e)return null;let t=String(e).trim();return t?t.toLowerCase().replace(/\s+/g,"-"):null}function ee(e,t,n,i,d){let r=X(i);if(!r)return;let o=e.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(t,n,r);o?e.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(o.invocation_count+1,d,o.id):e.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(t,n,r,d)}function te(e,t,n=10){return e.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(t,n)}function ne(e){return!e||e.length===0?"":`## Agent Usage
${e.map(n=>{let i=n.sessions_used===1?"session":"sessions";return`- **${n.agent_name}**: ${n.total_invocations}x (${n.sessions_used} ${i})`}).join(`
`)}`}F.exports={normalizeAgentName:X,trackAgentInvocation:ee,getAgentStats:te,formatAgentStats:ne,KNOWN_AGENTS:J}});var h=T((Ae,G)=>{var ie=require("better-sqlite3"),s=require("node:fs"),u=require("node:path"),M=require("node:os"),g=u.join(M.homedir(),".local-mind"),y=u.join(M.homedir(),".local-memory"),x=u.join(g,"memory.db"),a=null;function oe(e){s.existsSync(e)||s.mkdirSync(e,{recursive:!0,mode:448})}function re(){if(!s.existsSync(g)&&s.existsSync(y))try{s.renameSync(y,g)}catch{}}function se(e=x){if(a)return a;let t=e===":memory:";t||(re(),oe(u.dirname(e)));let n=new ie(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),w(n),!t)try{s.chmodSync(e,384)}catch{}return a=n,n}function w(e){e.exec(`
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
  `),Ee(e),Te(e),ae(e)}function ae(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function Te(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
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
  `)}function Ee(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function ce(){a&&(a.close(),a=null)}G.exports={getDb:se,closeDb:ce,runMigrations:w,DEFAULT_DB_PATH:x,DEFAULT_DB_DIR:g}});var{loadSettings:_e,debugLog:m}=A(),{readStdin:de,outputSuccess:Y}=O(),{getContainerTag:Ne}=D(),{trackAgentInvocation:fe}=C(),{getDb:ge}=h();async function ue(){let e=_e();try{let t=await de(),n=t.session_id,i=t.tool_name,d=t.cwd||process.cwd();if(m(e,"PostToolUse",{sessionId:n,toolName:i}),i==="Task"&&t.tool_input){let r=t.tool_input.subagent_type;if(r&&n)try{let o=Ne(d),v=(t.tool_input.description||"").slice(0,200)||null;fe(ge(),o,n,r,v),m(e,"Agent tracked",{agentName:r,containerTag:o})}catch(o){m(e,"Agent tracking failed",{error:o.message})}}Y()}catch(t){m(e,"Error",{error:t.message}),Y()}}ue().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
