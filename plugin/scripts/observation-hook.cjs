#!/usr/bin/env node
var c=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var I=c((pe,A)=>{var E=require("node:fs"),L=require("node:path"),k=require("node:os"),m=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||L.join(k.homedir(),".local-mind"),T=L.join(m,"settings.json"),g={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function B(){E.existsSync(m)||E.mkdirSync(m,{recursive:!0,mode:448})}function j(){let e={...g};try{if(E.existsSync(T)){let n=E.readFileSync(T,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${T}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function H(e){B();let t={...e};E.writeFileSync(T,JSON.stringify(t,null,2),{mode:384})}function q(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function $(e,t,n){if(e.debug){let o=new Date().toISOString();console.error(n?`[${o}] ${t}: ${JSON.stringify(n)}`:`[${o}] ${t}`)}}A.exports={SETTINGS_DIR:m,SETTINGS_FILE:T,DEFAULT_SETTINGS:g,loadSettings:j,saveSettings:H,shouldCaptureTool:q,debugLog:$}});var S=c((le,R)=>{async function P(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",o=>{n+=o}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(o){t(new Error(`Failed to parse stdin JSON: ${o.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function _(e){console.log(JSON.stringify(e))}function b(e=null){_(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function Z(e){console.error(`LocalMind: ${e}`),_({continue:!0,suppressOutput:!0})}function K(e,t){_({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}R.exports={readStdin:P,writeOutput:_,outputSuccess:b,outputError:Z,outputWithContext:K}});var D=c((Le,U)=>{var{execSync:O}=require("node:child_process"),W=require("node:crypto");function d(e){return W.createHash("sha256").update(e).digest("hex").slice(0,16)}function l(e){try{return O("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function z(e){let n=l(e)||e;return`claudecode_project_${d(n)}`}function Q(e){return(l(e)||e).split("/").pop()||"unknown"}function J(){try{let t=O("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${d(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${d(e)}`}U.exports={sha256:d,getGitRoot:l,getContainerTag:z,getProjectName:Q,getUserContainerTag:J}});var C=c((ge,X)=>{var V=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function y(e){if(!e)return null;let t=String(e).trim();return t?t.toLowerCase().replace(/\s+/g,"-"):null}function ee(e,t,n,o,u){let i=y(o);if(!i)return;let r=e.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(t,n,i);r?e.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(r.invocation_count+1,u,r.id):e.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(t,n,i,u)}function te(e,t,n=10){return e.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(t,n)}function ne(e){return!e||e.length===0?"":`## Agent Usage
${e.map(n=>{let o=n.sessions_used===1?"session":"sessions";return`- **${n.agent_name}**: ${n.total_invocations}x (${n.sessions_used} ${o})`}).join(`
`)}`}X.exports={normalizeAgentName:y,trackAgentInvocation:ee,getAgentStats:te,formatAgentStats:ne,KNOWN_AGENTS:V}});var G=c((Ae,x)=>{var oe=require("better-sqlite3"),s=require("node:fs"),f=require("node:path"),M=require("node:os"),N=f.join(M.homedir(),".local-mind"),F=f.join(M.homedir(),".local-memory"),h=f.join(N,"memory.db"),a=null;function re(e){s.existsSync(e)||s.mkdirSync(e,{recursive:!0,mode:448})}function ie(){if(!s.existsSync(N)&&s.existsSync(F))try{s.renameSync(F,N)}catch{}}function se(e=h){if(a)return a;let t=e===":memory:";t||(ie(),re(f.dirname(e)));let n=new oe(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),w(n),!t)try{s.chmodSync(e,384)}catch{}return a=n,n}function w(e){e.exec(`
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
  `),ce(e),ae(e)}function ae(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function ce(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function Te(){a&&(a.close(),a=null)}x.exports={getDb:se,closeDb:Te,runMigrations:w,DEFAULT_DB_PATH:h,DEFAULT_DB_DIR:N}});var{loadSettings:Ee,debugLog:p}=I(),{readStdin:_e,outputSuccess:v}=S(),{getContainerTag:ue}=D(),{trackAgentInvocation:me}=C(),{getDb:de}=G();async function Ne(){let e=Ee();try{let t=await _e(),n=t.session_id,o=t.tool_name,u=t.cwd||process.cwd();if(p(e,"PostToolUse",{sessionId:n,toolName:o}),o==="Task"&&t.tool_input){let i=t.tool_input.subagent_type;if(i&&n)try{let r=ue(u),Y=(t.tool_input.description||"").slice(0,200)||null;me(de(),r,n,i,Y),p(e,"Agent tracked",{agentName:i,containerTag:r})}catch(r){p(e,"Agent tracking failed",{error:r.message})}}v()}catch(t){p(e,"Error",{error:t.message}),v()}}Ne().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
