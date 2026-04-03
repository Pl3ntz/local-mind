#!/usr/bin/env node
var d=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var M=d((Ht,B)=>{var{execSync:j}=require("node:child_process"),Se=require("node:crypto");function O(e){return Se.createHash("sha256").update(e).digest("hex").slice(0,16)}function C(e){try{return j("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function De(e){let n=C(e)||e;return`claudecode_project_${O(n)}`}function he(e){return(C(e)||e).split("/").pop()||"unknown"}function Ue(){try{let t=j("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${O(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${O(e)}`}B.exports={sha256:O,getGitRoot:C,getContainerTag:De,getProjectName:he,getUserContainerTag:Ue}});var F=d((Yt,P)=>{var N=require("node:fs"),$=require("node:path"),Ce=require("node:os"),y=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||$.join(Ce.homedir(),".local-mind"),g=$.join(y,"settings.json"),k={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function Me(){N.existsSync(y)||N.mkdirSync(y,{recursive:!0,mode:448})}function Fe(){let e={...k};try{if(N.existsSync(g)){let n=N.readFileSync(g,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${g}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function Xe(e){Me();let t={...e};N.writeFileSync(g,JSON.stringify(t,null,2),{mode:384})}function xe(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function we(e,t,n){if(e.debug){let r=new Date().toISOString();console.error(n?`[${r}] ${t}: ${JSON.stringify(n)}`:`[${r}] ${t}`)}}P.exports={SETTINGS_DIR:y,SETTINGS_FILE:g,DEFAULT_SETTINGS:k,loadSettings:Fe,saveSettings:Xe,shouldCaptureTool:xe,debugLog:we}});var W=d((Gt,q)=>{async function He(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{n+=r}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(r){t(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function L(e){console.log(JSON.stringify(e))}function Ye(e=null){L(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function Ge(e){console.error(`LocalMind: ${e}`),L({continue:!0,suppressOutput:!0})}function be(e,t){L({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}q.exports={readStdin:He,writeOutput:L,outputSuccess:Ye,outputError:Ge,outputWithContext:be}});var X=d((bt,J)=>{var ve=require("better-sqlite3"),l=require("node:fs"),D=require("node:path"),K=require("node:os"),S=D.join(K.homedir(),".local-mind"),Z=D.join(K.homedir(),".local-memory"),V=D.join(S,"memory.db"),_=null;function je(e){l.existsSync(e)||l.mkdirSync(e,{recursive:!0,mode:448})}function Be(){if(!l.existsSync(S)&&l.existsSync(Z))try{l.renameSync(Z,S)}catch{}}function $e(e=V){if(_)return _;let t=e===":memory:";t||(Be(),je(D.dirname(e)));let n=new ve(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),z(n),!t)try{l.chmodSync(e,384)}catch{}return _=n,n}function z(e){e.exec(`
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
  `),qe(e),Pe(e),ke(e)}function ke(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function Pe(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
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
  `)}function qe(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function We(){_&&(_.close(),_=null)}J.exports={getDb:$e,closeDb:We,runMigrations:z,DEFAULT_DB_PATH:V,DEFAULT_DB_DIR:S}});var ee=d((vt,Q)=>{var Ze=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Ke(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let r of Ze)n=n.replace(r,"");return n.length>t&&(n=n.slice(0,t)),n}function Ve(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function ze(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function Je(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[r,s]of Object.entries(e)){if(n>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof s=="string"?(t[r]=s.slice(0,1024),n++):(typeof s=="number"&&Number.isFinite(s)||typeof s=="boolean")&&(t[r]=s,n++))}return t}Q.exports={sanitizeContent:Ke,validateContentLength:Ve,validateContainerTag:ze,sanitizeMetadata:Je}});var ie=d((jt,se)=>{function te(e){if(!e)return .5;let t=(Date.now()-new Date(e).getTime())/864e5;return t<0?1:Math.exp(-.15*t)}function Qe(e){if(!e||e.length===0)return[];let t=Math.max(...e.map(n=>Math.abs(n.rank||0)));return e.map(n=>{let r=t>0?Math.abs(n.rank||0)/t:0,s=te(n.updated_at||n.created_at),i=r*.7+s*.3;return{...n,relevance:r,recency:s,score:i}}).sort((n,r)=>r.score-n.score)}function ne(e,t){if(!t)return e;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?e:e*Math.exp(-.1*n)}function et(e,t){let r=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(t).filter(s=>ne(s.confidence,s.reinforced_at)<.3).map(s=>s.id);if(r.length>0){let s=r.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${s})`).run(...r)}return r.length}var re={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function tt(e,t,n){if(!t)return e;let r=(Date.now()-new Date(t).getTime())/864e5;if(r<0)return e;let s=re[n]||.1;return e*Math.exp(-s*r)}function nt(e){return 1+.1*Math.min(e||0,5)}se.exports={recencyWeight:te,scoredResults:Qe,decayedConfidence:ne,pruneDecayedFacts:et,findingDecayedConfidence:tt,recallBoost:nt,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:re}});var w=d(($t,ae)=>{var{getDb:rt,closeDb:Bt}=X(),{sanitizeContent:oe,sanitizeMetadata:st,validateContainerTag:it,validateContentLength:ot}=ee(),{scoredResults:at,pruneDecayedFacts:ct,decayedConfidence:Et,CONFIDENCE_PRUNE_THRESHOLD:Tt}=ie(),ft="claudecode_default",x=class{constructor(t,n){this.containerTag=t||ft,this.dbPath=n}_getDb(){return rt(this.dbPath)}async addMemory(t,n,r={},s=null){let i=this._getDb(),a=n||this.containerTag;it(a);let o=oe(t);ot(o);let c=st({source:"local-mind",...r}),E=c.project||null,T=c.type||"session_turn",u=JSON.stringify(c);if(s){let f=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(s);if(f)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(o,a,E,T,u,s),{id:f.id,status:"updated",containerTag:a}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(o,a,E,T,c.session_id||null,s,u).lastInsertRowid,status:"created",containerTag:a}}async search(t,n,r={}){let s=this._getDb(),i=n||this.containerTag,a=r.limit||10,o=oe(t).replace(/['"]/g,"").trim();if(!o)return{results:[],total:0};let c=o.split(/\s+/).filter(Boolean).map(E=>`"${E}"`).join(" OR ");try{let E=a*2,T=s.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,i,E),u=at(T);return{results:u.slice(0,a).map(f=>({id:f.id,memory:f.content,content:f.content,similarity:f.score,relevance:f.relevance,recency:f.recency,containerTag:f.container_tag,title:f.project_name,createdAt:f.created_at,updatedAt:f.updated_at})),total:u.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let r=this._getDb(),s=t||this.containerTag,i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(s).map(c=>c.fact_text),a=r.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(s).filter(c=>Et(c.confidence,c.reinforced_at)>=Tt).map(c=>c.fact_text),o=n?await this.search(n,s,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:a},searchResults:o.results.length>0?o:void 0}}async listMemories(t,n=20){let r=this._getDb(),s=t||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(s,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}addProfileFact(t,n,r,s=1){let i=this._getDb(),a=t||this.containerTag;i.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(a,n,r,s)}pruneOldDynamicFacts(t,n=20){let r=this._getDb(),s=t||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(s,n,s)}pruneDecayed(t){let n=this._getDb(),r=t||this.containerTag;return ct(n,r)}};ae.exports={LocalMindClient:x}});var de=d((kt,ue)=>{var ce=require("node:fs"),ut=500,dt=["Read"],H=new Map;function Ee(e){if(!ce.existsSync(e))return[];let n=ce.readFileSync(e,"utf-8").trim().split(`
`),r=[];for(let s of n)if(s.trim())try{r.push(JSON.parse(s))}catch{}return r}function Te(e,t){if(!t)return e.filter(s=>s.type==="user"||s.type==="assistant");let n=!1,r=[];for(let s of e){if(s.uuid===t){n=!0;continue}n&&(s.type==="user"||s.type==="assistant")&&r.push(s)}return r}function fe(e){let t=[];if(e.type==="user"){let n=lt(e.message);n&&t.push(n)}else if(e.type==="assistant"){let n=_t(e.message);n&&t.push(n)}return t.join(`
`)}function lt(e){if(!e?.content)return null;let t=e.content,n=[];if(typeof t=="string"){let r=R(t);r&&n.push(`[role:user]
${r}
[user:end]`)}else if(Array.isArray(t)){for(let r of t)if(r.type==="text"&&r.text){let s=R(r.text);s&&n.push(`[role:user]
${s}
[user:end]`)}else if(r.type==="tool_result"){let s=r.tool_use_id||"",i=H.get(s)||"Unknown";if(dt.includes(i))continue;let a=Y(R(r.content||""),ut),o=r.is_error?"error":"success";a&&n.push(`[tool_result:${i} status="${o}"]
${a}
[tool_result:end]`)}}return n.length>0?n.join(`

`):null}function _t(e){if(!e?.content)return null;let t=e.content,n=[];if(!Array.isArray(t))return null;for(let r of t)if(r.type!=="thinking"){if(r.type==="text"&&r.text){let s=R(r.text);s&&n.push(`[role:assistant]
${s}
[assistant:end]`)}else if(r.type==="tool_use"){let s=r.name||"Unknown",i=r.id||"",a=r.input||{},o=mt(a);n.push(`[tool:${s}]
${o}
[tool:end]`),i&&H.set(i,s)}}return n.length>0?n.join(`

`):null}function mt(e){let t=[];for(let[n,r]of Object.entries(e)){let s=typeof r=="string"?r:JSON.stringify(r);s=Y(s,200),t.push(`${n}: ${s}`)}return t.join(`
`)}function R(e){return!e||typeof e!="string"?"":e.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function Y(e,t){return!e||e.length<=t?e:`${e.slice(0,t)}...`}function pt(e,t){H=new Map;let n=Ee(e);if(n.length===0)return null;let r=Te(n,t);if(r.length===0)return null;let s=r[0],i=r[r.length-1],a=s.timestamp||new Date().toISOString(),o=[];o.push(`[turn:start timestamp="${a}"]`);for(let E of r){let T=fe(E);T&&o.push(T)}o.push("[turn:end]");let c=o.join(`

`);return c.length<100?null:{formatted:c,lastUuid:i.uuid}}ue.exports={parseTranscript:Ee,getEntriesSinceLastCapture:Te,formatEntry:fe,formatNewEntries:pt,cleanContent:R,truncate:Y}});var ge=d((Pt,pe)=>{var A=require("node:fs"),{LocalMindClient:gt}=w(),{getContainerTag:Nt,getProjectName:Lt}=M(),{formatNewEntries:Rt}=de(),{getDb:le}=X(),{debugLog:At,loadSettings:It}=F();function _e(e){let n=le().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(e);return n?{lastUuid:n.last_captured_uuid,lastByteOffset:n.last_byte_offset||0,containerTag:n.container_tag,projectName:n.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function h(e,t,n,r,s){let i=le();i.prepare("SELECT id FROM sessions WHERE session_id = ?").get(e)?i.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(t,n,e):i.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(e,r,s,t,n)}function me(e,t){if(!A.existsSync(e))return{entries:[],newOffset:t};let n=A.statSync(e),r=t;if(n.size<r&&(r=0),n.size===r)return{entries:[],newOffset:r};let s=A.openSync(e,"r"),i;try{i=Buffer.alloc(n.size-r),A.readSync(s,i,0,i.length,r)}finally{A.closeSync(s)}let a=i.toString("utf-8").split(`
`),o=[];for(let c of a)if(c.trim())try{o.push(JSON.parse(c))}catch{}return{entries:o,newOffset:n.size}}function Ot({sessionId:e,transcriptPath:t,cwd:n}){if(!t||!e)return{saved:!1,reason:"missing_params"};let r=It(),s=_e(e),i=s.containerTag||Nt(n),a=s.projectName||Lt(n),{entries:o,newOffset:c}=me(t,s.lastByteOffset);if(o.length===0)return{saved:!1,reason:"no_new_entries"};let E=o.filter(m=>m.type==="user"||m.type==="assistant");if(E.length===0)return h(e,s.lastUuid,c,i,a),{saved:!1,reason:"no_user_assistant_entries"};let T=Rt(t,s.lastUuid);return T?(new gt().addMemory(T.formatted,i,{type:"session_turn",project:a,timestamp:new Date().toISOString()},e),h(e,T.lastUuid,c,i,a),At(r,"Incremental save",{entries:E.length,bytes:c-s.lastByteOffset}),{saved:!0,entries:E.length,newOffset:c}):(h(e,s.lastUuid,c,i,a),{saved:!1,reason:"format_empty"})}pe.exports={readNewEntries:me,saveIncrementalTurns:Ot,getSessionTracking:_e,updateSessionTracking:h}});var Ae=d((qt,Re)=>{function Ne(e){try{let t=new Date(e),n=new Date,r=(n.getTime()-t.getTime())/1e3,s=r/60,i=r/3600,a=r/86400;if(s<30)return"just now";if(s<60)return`${Math.floor(s)}mins ago`;if(i<24)return`${Math.floor(i)}hrs ago`;if(a<7)return`${Math.floor(a)}d ago`;let o=t.toLocaleString("en",{month:"short"});return t.getFullYear()===n.getFullYear()?`${t.getDate()} ${o}`:`${t.getDate()} ${o}, ${t.getFullYear()}`}catch{return""}}function Le(e,t,n){let r=new Set,s=e.filter(o=>r.has(o)?!1:(r.add(o),!0)),i=t.filter(o=>r.has(o)?!1:(r.add(o),!0)),a=n.filter(o=>{let c=o.memory??"";return!c||r.has(c)?!1:(r.add(c),!0)});return{static:s,dynamic:i,searchResults:a}}function yt(e,t=!0,n=!1,r=10){if(!e)return null;let s=e.profile?.static||[],i=e.profile?.dynamic||[],a=e.searchResults?.results||[],o=Le(t?s:[],t?i:[],n?a:[]),c=o.static.slice(0,r),E=o.dynamic.slice(0,r),T=o.searchResults.slice(0,r);if(c.length===0&&E.length===0&&T.length===0)return null;let u=[];if(c.length>0&&u.push(`## User Profile (Persistent)
`+c.map(I=>`- ${I}`).join(`
`)),E.length>0&&u.push(`## Recent Context
`+E.map(I=>`- ${I}`).join(`
`)),T.length>0){let Ie=T.map(p=>{let U=p.memory??"",Oe=U.length>500?`${U.slice(0,500)}...`:U,v=p.updatedAt?Ne(p.updatedAt):"",ye=p.similarity!=null?`[${p.similarity.toFixed(2)}]`:"";return`- ${v?`[${v}] `:""}${Oe} ${ye}`.trim()});u.push(`## Relevant Memories (scored)
`+Ie.join(`
`))}return`<local-mind-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${u.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-mind-context>`}Re.exports={formatContext:yt,formatRelativeTime:Ne,deduplicateMemories:Le}});var{getContainerTag:St,getProjectName:Dt}=M(),{loadSettings:ht,debugLog:G}=F(),{readStdin:Ut,writeOutput:b}=W(),{saveIncrementalTurns:Ct}=ge(),{LocalMindClient:Mt}=w(),{formatContext:Ft}=Ae();async function Xt(){let e=ht();try{let t=await Ut(),n=t.cwd||process.cwd(),r=t.session_id,s=t.transcript_path;if(G(e,"PreCompact",{sessionId:r}),s&&r){let T=Ct({sessionId:r,transcriptPath:s,cwd:n});G(e,"PreCompact save",T)}let i=St(n),a=Dt(n),c=await new Mt(i).getProfile(i,a).catch(()=>null),E=Ft(c,e.injectProfile,!0,15);b(E?{hookSpecificOutput:{hookEventName:"PreCompact",additionalContext:E}}:{continue:!0})}catch(t){G(e,"PreCompact error",{error:t.message}),b({continue:!0})}}Xt().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
