#!/usr/bin/env node
var T=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var G=T((kn,K)=>{var{execSync:V}=require("node:child_process"),Ze=require("node:crypto");function C(e){return Ze.createHash("sha256").update(e).digest("hex").slice(0,16)}function b(e){try{return V("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Ve(e){let n=b(e)||e;return`claudecode_project_${C(n)}`}function Ke(e){return(b(e)||e).split("/").pop()||"unknown"}function Qe(){try{let t=V("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${C(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${C(e)}`}K.exports={sha256:C,getGitRoot:b,getContainerTag:Ve,getProjectName:Ke,getUserContainerTag:Qe}});var Y=T((qn,te)=>{var I=require("node:fs"),Q=require("node:path"),et=require("node:os"),F=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||Q.join(et.homedir(),".local-mind"),A=Q.join(F,"settings.json"),ee={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function tt(){I.existsSync(F)||I.mkdirSync(F,{recursive:!0,mode:448})}function nt(){let e={...ee};try{if(I.existsSync(A)){let n=I.readFileSync(A,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${A}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function st(e){tt();let t={...e};I.writeFileSync(A,JSON.stringify(t,null,2),{mode:384})}function rt(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function it(e,t,n){if(e.debug){let s=new Date().toISOString();console.error(n?`[${s}] ${t}: ${JSON.stringify(n)}`:`[${s}] ${t}`)}}te.exports={SETTINGS_DIR:F,SETTINGS_FILE:A,DEFAULT_SETTINGS:ee,loadSettings:nt,saveSettings:st,shouldCaptureTool:rt,debugLog:it}});var se=T((Pn,ne)=>{async function ot(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",s=>{n+=s}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(s){t(new Error(`Failed to parse stdin JSON: ${s.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function O(e){console.log(JSON.stringify(e))}function at(e=null){O(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function ct(e){console.error(`LocalMind: ${e}`),O({continue:!0,suppressOutput:!0})}function ft(e,t){O({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}ne.exports={readStdin:ot,writeOutput:O,outputSuccess:at,outputError:ct,outputWithContext:ft}});var x=T((zn,ce)=>{var ut=require("better-sqlite3"),L=require("node:fs"),M=require("node:path"),ie=require("node:os"),U=M.join(ie.homedir(),".local-mind"),re=M.join(ie.homedir(),".local-memory"),oe=M.join(U,"memory.db"),S=null;function Et(e){L.existsSync(e)||L.mkdirSync(e,{recursive:!0,mode:448})}function lt(){if(!L.existsSync(U)&&L.existsSync(re))try{L.renameSync(re,U)}catch{}}function dt(e=oe){if(S)return S;let t=e===":memory:";t||(lt(),Et(M.dirname(e)));let n=new ut(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),ae(n),!t)try{L.chmodSync(e,384)}catch{}return S=n,n}function ae(e){e.exec(`
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
  `),gt(e),_t(e),Tt(e)}function Tt(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function _t(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
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
  `)}function gt(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function pt(){S&&(S.close(),S=null)}ce.exports={getDb:dt,closeDb:pt,runMigrations:ae,DEFAULT_DB_PATH:oe,DEFAULT_DB_DIR:U}});var ue=T((Jn,fe)=>{var mt=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Nt(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let s of mt)n=n.replace(s,"");return n.length>t&&(n=n.slice(0,t)),n}function Lt(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function St(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function At(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[s,r]of Object.entries(e)){if(n>=50)break;s.length>128||/[^\w.-]/.test(s)||(typeof r=="string"?(t[s]=r.slice(0,1024),n++):(typeof r=="number"&&Number.isFinite(r)||typeof r=="boolean")&&(t[s]=r,n++))}return t}fe.exports={sanitizeContent:Nt,validateContentLength:Lt,validateContainerTag:St,sanitizeMetadata:At}});var $=T((Zn,Te)=>{function Ee(e){if(!e)return .5;let t=(Date.now()-new Date(e).getTime())/864e5;return t<0?1:Math.exp(-.15*t)}function It(e){if(!e||e.length===0)return[];let t=Math.max(...e.map(n=>Math.abs(n.rank||0)));return e.map(n=>{let s=t>0?Math.abs(n.rank||0)/t:0,r=Ee(n.updated_at||n.created_at),i=s*.7+r*.3;return{...n,relevance:s,recency:r,score:i}}).sort((n,s)=>s.score-n.score)}function le(e,t){if(!t)return e;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?e:e*Math.exp(-.1*n)}function Ot(e,t){let s=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(t).filter(r=>le(r.confidence,r.reinforced_at)<.3).map(r=>r.id);if(s.length>0){let r=s.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${r})`).run(...s)}return s.length}var de={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function Rt(e,t,n){if(!t)return e;let s=(Date.now()-new Date(t).getTime())/864e5;if(s<0)return e;let r=de[n]||.1;return e*Math.exp(-r*s)}function yt(e){return 1+.1*Math.min(e||0,5)}Te.exports={recencyWeight:Ee,scoredResults:It,decayedConfidence:le,pruneDecayedFacts:Ot,findingDecayedConfidence:Rt,recallBoost:yt,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:de}});var B=T((Kn,ge)=>{var{getDb:Dt,closeDb:Vn}=x(),{sanitizeContent:_e,sanitizeMetadata:ht,validateContainerTag:Ct,validateContentLength:Ft}=ue(),{scoredResults:Ut,pruneDecayedFacts:Mt,decayedConfidence:xt,CONFIDENCE_PRUNE_THRESHOLD:wt}=$(),Ht="claudecode_default",j=class{constructor(t,n){this.containerTag=t||Ht,this.dbPath=n}_getDb(){return Dt(this.dbPath)}async addMemory(t,n,s={},r=null){let i=this._getDb(),o=n||this.containerTag;Ct(o);let a=_e(t);Ft(a);let f=ht({source:"local-mind",...s}),u=f.project||null,c=f.type||"session_turn",E=JSON.stringify(f);if(r){let l=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(r);if(l)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(a,o,u,c,E,r),{id:l.id,status:"updated",containerTag:o}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a,o,u,c,f.session_id||null,r,E).lastInsertRowid,status:"created",containerTag:o}}async search(t,n,s={}){let r=this._getDb(),i=n||this.containerTag,o=s.limit||10,a=_e(t).replace(/['"]/g,"").trim();if(!a)return{results:[],total:0};let f=a.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=o*2,c=r.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(f,i,u),E=Ut(c);return{results:E.slice(0,o).map(l=>({id:l.id,memory:l.content,content:l.content,similarity:l.score,relevance:l.relevance,recency:l.recency,containerTag:l.container_tag,title:l.project_name,createdAt:l.created_at,updatedAt:l.updated_at})),total:E.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let s=this._getDb(),r=t||this.containerTag,i=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(r).map(f=>f.fact_text),o=s.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(r).filter(f=>xt(f.confidence,f.reinforced_at)>=wt).map(f=>f.fact_text),a=n?await this.search(n,r,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:o},searchResults:a.results.length>0?a:void 0}}async listMemories(t,n=20){let s=this._getDb(),r=t||this.containerTag;return{memories:s.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(r,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}addProfileFact(t,n,s,r=1){let i=this._getDb(),o=t||this.containerTag;i.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(o,n,s,r)}pruneOldDynamicFacts(t,n=20){let s=this._getDb(),r=t||this.containerTag;s.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(r,n,r)}pruneDecayed(t){let n=this._getDb(),s=t||this.containerTag;return Mt(n,s)}};ge.exports={LocalMindClient:j}});var Ae=T((Qn,Se)=>{var pe=require("node:fs"),vt=500,Xt=["Read"],W=new Map;function me(e){if(!pe.existsSync(e))return[];let n=pe.readFileSync(e,"utf-8").trim().split(`
`),s=[];for(let r of n)if(r.trim())try{s.push(JSON.parse(r))}catch{}return s}function Ne(e,t){if(!t)return e.filter(r=>r.type==="user"||r.type==="assistant");let n=!1,s=[];for(let r of e){if(r.uuid===t){n=!0;continue}n&&(r.type==="user"||r.type==="assistant")&&s.push(r)}return s}function Le(e){let t=[];if(e.type==="user"){let n=bt(e.message);n&&t.push(n)}else if(e.type==="assistant"){let n=Gt(e.message);n&&t.push(n)}return t.join(`
`)}function bt(e){if(!e?.content)return null;let t=e.content,n=[];if(typeof t=="string"){let s=R(t);s&&n.push(`[role:user]
${s}
[user:end]`)}else if(Array.isArray(t)){for(let s of t)if(s.type==="text"&&s.text){let r=R(s.text);r&&n.push(`[role:user]
${r}
[user:end]`)}else if(s.type==="tool_result"){let r=s.tool_use_id||"",i=W.get(r)||"Unknown";if(Xt.includes(i))continue;let o=k(R(s.content||""),vt),a=s.is_error?"error":"success";o&&n.push(`[tool_result:${i} status="${a}"]
${o}
[tool_result:end]`)}}return n.length>0?n.join(`

`):null}function Gt(e){if(!e?.content)return null;let t=e.content,n=[];if(!Array.isArray(t))return null;for(let s of t)if(s.type!=="thinking"){if(s.type==="text"&&s.text){let r=R(s.text);r&&n.push(`[role:assistant]
${r}
[assistant:end]`)}else if(s.type==="tool_use"){let r=s.name||"Unknown",i=s.id||"",o=s.input||{},a=Yt(o);n.push(`[tool:${r}]
${a}
[tool:end]`),i&&W.set(i,r)}}return n.length>0?n.join(`

`):null}function Yt(e){let t=[];for(let[n,s]of Object.entries(e)){let r=typeof s=="string"?s:JSON.stringify(s);r=k(r,200),t.push(`${n}: ${r}`)}return t.join(`
`)}function R(e){return!e||typeof e!="string"?"":e.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function k(e,t){return!e||e.length<=t?e:`${e.slice(0,t)}...`}function $t(e,t){W=new Map;let n=me(e);if(n.length===0)return null;let s=Ne(n,t);if(s.length===0)return null;let r=s[0],i=s[s.length-1],o=r.timestamp||new Date().toISOString(),a=[];a.push(`[turn:start timestamp="${o}"]`);for(let u of s){let c=Le(u);c&&a.push(c)}a.push("[turn:end]");let f=a.join(`

`);return f.length<100?null:{formatted:f,lastUuid:i.uuid}}Se.exports={parseTranscript:me,getEntriesSinceLastCapture:Ne,formatEntry:Le,formatNewEntries:$t,cleanContent:R,truncate:k}});var q=T((es,ye)=>{var y=require("node:fs"),{LocalMindClient:jt}=B(),{getContainerTag:Bt,getProjectName:Wt}=G(),{formatNewEntries:kt}=Ae(),{getDb:Ie}=x(),{debugLog:qt,loadSettings:Pt}=Y();function Oe(e){let n=Ie().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(e);return n?{lastUuid:n.last_captured_uuid,lastByteOffset:n.last_byte_offset||0,containerTag:n.container_tag,projectName:n.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function w(e,t,n,s,r){let i=Ie();i.prepare("SELECT id FROM sessions WHERE session_id = ?").get(e)?i.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(t,n,e):i.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(e,s,r,t,n)}function Re(e,t){if(!y.existsSync(e))return{entries:[],newOffset:t};let n=y.statSync(e),s=t;if(n.size<s&&(s=0),n.size===s)return{entries:[],newOffset:s};let r=y.openSync(e,"r"),i;try{i=Buffer.alloc(n.size-s),y.readSync(r,i,0,i.length,s)}finally{y.closeSync(r)}let o=i.toString("utf-8").split(`
`),a=[];for(let f of o)if(f.trim())try{a.push(JSON.parse(f))}catch{}return{entries:a,newOffset:n.size}}function zt({sessionId:e,transcriptPath:t,cwd:n}){if(!t||!e)return{saved:!1,reason:"missing_params"};let s=Pt(),r=Oe(e),i=r.containerTag||Bt(n),o=r.projectName||Wt(n),{entries:a,newOffset:f}=Re(t,r.lastByteOffset);if(a.length===0)return{saved:!1,reason:"no_new_entries"};let u=a.filter(d=>d.type==="user"||d.type==="assistant");if(u.length===0)return w(e,r.lastUuid,f,i,o),{saved:!1,reason:"no_user_assistant_entries"};let c=kt(t,r.lastUuid);return c?(new jt().addMemory(c.formatted,i,{type:"session_turn",project:o,timestamp:new Date().toISOString()},e),w(e,c.lastUuid,f,i,o),qt(s,"Incremental save",{entries:u.length,bytes:f-r.lastByteOffset}),{saved:!0,entries:u.length,newOffset:f}):(w(e,r.lastUuid,f,i,o),{saved:!1,reason:"format_empty"})}ye.exports={readNewEntries:Re,saveIncrementalTurns:zt,getSessionTracking:Oe,updateSessionTracking:w}});var we=T((ts,xe)=>{var Jt=new Set(["que","para","com","nao","uma","por","mas","como","mais","quando","muito","isso","este","essa","dele","dela","aqui","onde","agora","voce","quero","pode","vamos","tudo","tambem","ainda","sobre","fazer","depois","antes","preciso","obrigado","sim","entao"]),Zt=new Set(["ls","cd","cat","head","tail","pwd","echo","clear","which","whoami"]);function Vt(e){let t=new Set,n=new Set,s=[],r=0,i=0,o=0,a="";for(let c of e)c.type==="user"?De(c,{files:t,commands:n,errors:s,firstUserPrompt:a,onText:E=>{a||(a=E),r+=E.length;let d=E.toLowerCase().split(/\s+/).filter(Boolean);o+=d.length,i+=d.filter(l=>Jt.has(l)).length}}):c.type==="assistant"&&he(c,{files:t,commands:n,errors:s});let f=Ue(t,n,s,a),u=Me(i,o);return{sessionFacts:f,userFacts:u}}function De(e,t){let n=e.message?.content;if(n){if(typeof n=="string"){t.onText(n);return}if(Array.isArray(n)){for(let s of n)if(s.type==="text"&&s.text)t.onText(s.text);else if(s.type==="tool_result"&&s.is_error&&s.content){let r=typeof s.content=="string"?s.content:JSON.stringify(s.content);r.length>10&&t.errors.push(Kt(r))}}}}function he(e,t){let n=e.message?.content;if(Array.isArray(n))for(let s of n){if(s.type!=="tool_use")continue;let r=s.input||{},i=s.name||"";if((i==="Edit"||i==="Write")&&r.file_path&&t.files.add(Ce(r.file_path)),i==="Bash"&&r.command){let o=Fe(r.command);o&&!Zt.has(o)&&t.commands.add(r.command.length>60?r.command.slice(0,60):r.command)}}}function Ce(e){return e?e.split("/").slice(-2).join("/"):"unknown"}function Fe(e){if(!e||typeof e!="string")return"";let t=e.trim(),n=t.split(/\s+/)[0];return n?n.replace(/^(sudo|npx|bunx)$/,"")||t.split(/\s+/)[1]||n:""}function Kt(e){let t=e.split(`
`)[0].trim();return t.length>120?`${t.slice(0,120)}...`:t}function Ue(e,t,n,s){let r=[];if(e.size>0){let i=[...e].slice(0,10).join(", ");r.push(`files: ${i}`)}if(t.size>0){let i=[...t].slice(0,5).join(", ");r.push(`commands: ${i}`)}if(n.length>0){let i=n.slice(0,3).join("; ");r.push(`errors: ${i}`)}if(s){let i=s.length>120?`${s.slice(0,120)}...`:s;r.push(`summary: ${i}`)}return r}function Me(e,t){let n=[];return t>10&&e/t>.15&&n.push("idioma: pt-br"),n}xe.exports={extractFacts:Vt,extractFromUserEntry:De,extractFromAssistantEntry:he,extractFileName:Ce,extractBaseCommand:Fe,buildSessionFacts:Ue,buildUserFacts:Me}});var be=T((ns,Xe)=>{function He(e){return e?String(e).split(`
`)[0].trim().replace(/["'].*?["']/g,'"X"').replace(/`.*?`/g,"`X`").replace(/\d+/g,"N").substring(0,100):""}function ve(e){let t=5381;for(let n=0;n<e.length;n++)t=(t<<5)+t+e.charCodeAt(n)>>>0;return t.toString(36)}var Qt={build:["build","compile","esbuild","webpack","tsc","syntax error"],test:["test","vitest","jest","expect","assert","spec"],lint:["lint","eslint","biome","prettier","format"],runtime:["typeerror","referenceerror","rangeerror","syntaxerror","cannot read","undefined is not"],integration:["fetch","network","timeout","econnrefused","api"],security:["csrf","xss","injection","unauthorized","forbidden","cors"],database:["sqlite","postgres","sql","column","table","migration","constraint"]};function P(e){if(!e)return"general";let t=e.toLowerCase();for(let[n,s]of Object.entries(Qt))if(s.some(r=>t.includes(r)))return n;return"general"}function en(e,t,n,s=null){let r=He(n);if(!r)return;let i=ve(r),o=P(n),a=e.prepare("SELECT * FROM gotchas_tracking WHERE container_tag = ? AND pattern_hash = ?").get(t,i);if(a){let f=JSON.parse(a.samples),u=String(n).split(`
`)[0].trim(),c=f.length<5&&!f.includes(u)?[...f,u]:f,E=JSON.parse(a.related_files),d=s&&!E.includes(s)?[...E,s]:E,l=a.count+1,m=l>=3&&!a.promoted;e.prepare(`UPDATE gotchas_tracking
       SET count = ?, samples = ?, related_files = ?, category = ?,
           last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`).run(l,JSON.stringify(c),JSON.stringify(d),o,a.id),m&&(e.prepare("UPDATE gotchas_tracking SET promoted = 1 WHERE id = ?").run(a.id),e.prepare(`INSERT OR IGNORE INTO profile_facts (container_tag, fact_type, fact_text, confidence)
         VALUES (?, 'gotcha', ?, 1.0)`).run(t,`[${o}] ${r} (seen ${l}x)`))}else{let f=String(n).split(`
`)[0].trim(),u=JSON.stringify([f]),c=s?JSON.stringify([s]):"[]";e.prepare(`INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, related_files)
       VALUES (?, ?, ?, ?, 1, ?, ?)`).run(t,i,r,o,u,c)}}function tn(e,t,n=""){let s=e.prepare(`SELECT * FROM gotchas_tracking
       WHERE container_tag = ? AND promoted = 1
       ORDER BY last_seen DESC`).all(t);if(s.length===0)return"";let r=P(n),o=(n||"").toLowerCase().split(/\s+/).filter(Boolean),a=s.map(c=>{let E=0;c.category===r&&r!=="general"&&(E+=3);for(let l of o)c.normalized_pattern.toLowerCase().includes(l)&&(E+=1);let d=JSON.parse(c.related_files);for(let l of o)d.some(m=>m.toLowerCase().includes(l))&&(E+=2);return{...c,score:E}});return a.sort((c,E)=>E.score-c.score),`## Known Gotchas
${a.slice(0,5).map(c=>{let E=JSON.parse(c.related_files),d=E.length>0?` (files: ${E.join(", ")})`:"";return`- **[Gotcha: ${c.category}]** ${c.normalized_pattern} \u2014 seen ${c.count}x${d}`}).join(`
`)}`}Xe.exports={normalizeErrorPattern:He,djb2Hash:ve,detectCategory:P,trackError:en,getRelevantGotchas:tn}});var $e=T((ss,Ye)=>{var nn=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function Ge(e){if(!e)return null;let t=String(e).trim();return t?t.toLowerCase().replace(/\s+/g,"-"):null}function sn(e,t,n,s,r){let i=Ge(s);if(!i)return;let o=e.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(t,n,i);o?e.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(o.invocation_count+1,r,o.id):e.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(t,n,i,r)}function rn(e,t,n=10){return e.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(t,n)}function on(e){return!e||e.length===0?"":`## Agent Usage
${e.map(n=>{let s=n.sessions_used===1?"session":"sessions";return`- **${n.agent_name}**: ${n.total_invocations}x (${n.sessions_used} ${s})`}).join(`
`)}`}Ye.exports={normalizeAgentName:Ge,trackAgentInvocation:sn,getAgentStats:rn,formatAgentStats:on,KNOWN_AGENTS:nn}});var We=T((rs,Be)=>{var an=/\*\*\[(CRITICAL|HIGH|MEDIUM|LOW|INFO)\]\*\*/,je=/`(\.?[^`\s]*[./][^`\s]*)`/g,cn=/###\s+ACHADOS[^\n]*/,fn=/###\s+IMPACTO CROSS-SYSTEM/,un=/###\s+ERROS CORRIGIDOS/,En=/###\s+DECISÃO DE DESIGN/;function D(e){let t=[],n=e.matchAll(je);for(let s of n){let r=s[1].split(":")[0];r&&!t.includes(r)&&t.push(r)}return t}function H(e,t){let n=e.match(t);if(!n)return null;let s=n.index+n[0].length,r=e.slice(s),i=r.match(/\n###\s+/),o=i?i.index:r.length;return r.slice(0,o).trim()}function ln(e){let t=[],n=e.split(`
`).filter(s=>s.trim().startsWith("-"));for(let s of n){let r=s.match(an),i=r?r[1]:null;if(!i)continue;let o=s.slice(s.indexOf(r[0])+r[0].length).trim(),a=D(s);t.push({severity:i,text:o.replace(je,"").replace(/\s*[—-]\s*/g," ").trim(),files:a})}return t}function dn(e){let t=[],n=e.split(`
`).filter(s=>s.trim().startsWith("-"));for(let s of n){let r=s.match(/(CRITICAL|HIGH|MEDIUM|LOW)/i),i=r?r[1].toUpperCase():"MEDIUM",o=s.replace(/^-\s*/,"").trim();t.push({severity:i,text:o,files:D(s)})}return t}function Tn(e){let t=[],n=e.split(`
`).filter(s=>s.trim().startsWith("-"));for(let s of n){let r=s.replace(/^-\s*/,"").trim();r&&t.push({severity:"INFO",text:r,files:D(s)})}return t}function _n(e){return!e||!e.trim()?[]:[{severity:"INFO",text:e.split(`
`)[0].trim(),files:D(e)}]}function gn(e){if(!e||typeof e!="string")return[];let t=[],n=H(e,cn);n&&(t=[...t,...ln(n)]);let s=H(e,fn);s&&(t=[...t,...dn(s)]);let r=H(e,un);r&&(t=[...t,...Tn(r)]);let i=H(e,En);return i&&t.length===0&&(t=[...t,..._n(i)]),t}function pn(e){let t=[],n=null;for(let s of e){if(s.type==="assistant"&&s.message?.content){let r=Array.isArray(s.message.content)?s.message.content:[];for(let i of r)i.type==="tool_use"&&i.name==="Task"&&(n=i.input?.subagent_type||null)}if(s.type==="tool_result"&&n){let r=typeof s.content=="string"?s.content:typeof s.content=="object"?s.content?.output||s.content?.content||JSON.stringify(s.content):String(s.content||"");t.push({agentName:n,output:r}),n=null}}return t}Be.exports={parseBlufFindings:gn,extractAgentOutputs:pn,extractFilesFromText:D}});var qe=T((is,ke)=>{var{findingDecayedConfidence:mn,recallBoost:Nn,CONFIDENCE_PRUNE_THRESHOLD:Ln}=$(),z=["CRITICAL","HIGH","MEDIUM","LOW","INFO"];function Sn(e,{containerTag:t,sessionId:n,agentName:s,severity:r,findingText:i,fileRefs:o=[]}){if(!z.includes(r))throw new Error(`Invalid severity: ${r}. Must be one of: ${z.join(", ")}`);let a=JSON.stringify(o),f=e.prepare("SELECT id, confidence FROM agent_findings WHERE container_tag = ? AND agent_name = ? AND finding_text = ?").get(t,s,i);return f?(e.prepare(`UPDATE agent_findings SET
         confidence = MIN(confidence + 0.2, 2.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         session_id = ?
       WHERE id = ?`).run(n,f.id),{id:f.id,status:"reinforced"}):{id:e.prepare(`INSERT INTO agent_findings (container_tag, agent_name, session_id, finding_text, severity, related_files)
       VALUES (?, ?, ?, ?, ?, ?)`).run(t,s,n,i,r,a).lastInsertRowid,status:"created"}}function An(e,t,n={}){let{agentName:s,limit:r=10,includeGlobal:i=!1}=n,o="SELECT * FROM agent_findings WHERE status = 'open'",a=[];return i?(o+=" AND (container_tag = ? OR container_tag = ?)",a.push(t,"_global")):(o+=" AND container_tag = ?",a.push(t)),s&&(o+=" AND agent_name = ?",a.push(s)),o+=` ORDER BY
    CASE severity
      WHEN 'CRITICAL' THEN 5
      WHEN 'HIGH' THEN 4
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 2
      WHEN 'INFO' THEN 1
    END DESC,
    reinforced_at DESC
  LIMIT ?`,a.push(r),e.prepare(o).all(...a).filter(u=>mn(u.confidence,u.reinforced_at,u.severity)*Nn(u.recall_count)>=Ln)}function In(e){return!e||e.length===0?"":e.map(n=>`- [${n.created_at?n.created_at.split("T")[0]:"unknown"}] **${n.severity}** (${n.agent_name}): ${n.finding_text}`).join(`
`)}function On(e,t){if(!t||t.length===0)return;let n=e.prepare(`UPDATE agent_findings SET
       recall_count = recall_count + 1,
       reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`);for(let s of t)n.run(s)}ke.exports={saveFinding:Sn,queryFindings:An,formatFindingsForInjection:In,reinforceFindings:On,VALID_SEVERITIES:z}});var ze=T((os,Pe)=>{function Rn(e,t,n,s){e.prepare(`
    CREATE TABLE IF NOT EXISTS session_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_tag TEXT NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      agents_spawned INTEGER DEFAULT 0,
      findings_captured INTEGER DEFAULT 0,
      findings_by_severity TEXT DEFAULT '{}',
      agents_used TEXT DEFAULT '[]',
      session_duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `).run(),e.prepare(`
    INSERT INTO session_metrics (container_tag, session_id, agents_spawned, findings_captured, findings_by_severity, agents_used, session_duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      agents_spawned = excluded.agents_spawned,
      findings_captured = excluded.findings_captured,
      findings_by_severity = excluded.findings_by_severity,
      agents_used = excluded.agents_used,
      session_duration_seconds = excluded.session_duration_seconds
  `).run(t,n,s.agentsSpawned||0,s.findingsCaptured||0,JSON.stringify(s.findingsBySeverity||{}),JSON.stringify(s.agentsUsed||[]),s.sessionDuration||null)}function yn(e,t,n=30){let s=e.prepare(`
    SELECT * FROM session_metrics
    WHERE container_tag = ?
      AND created_at > datetime('now', ?)
    ORDER BY created_at DESC
  `).all(t,`-${n} days`);if(s.length===0)return{sessions:0,totalFindings:0,avgFindingsPerSession:0,topAgents:[],severityDistribution:{}};let r=0,i=0,o={},a={CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0,INFO:0};for(let u of s){r+=u.findings_captured,i+=u.agents_spawned;try{let c=JSON.parse(u.agents_used);for(let E of c)o[E]=(o[E]||0)+1}catch{}try{let c=JSON.parse(u.findings_by_severity);for(let[E,d]of Object.entries(c))a[E]=(a[E]||0)+d}catch{}}let f=Object.entries(o).sort((u,c)=>c[1]-u[1]).slice(0,5).map(([u,c])=>({name:u,count:c}));return{sessions:s.length,totalFindings:r,avgFindingsPerSession:s.length>0?(r/s.length).toFixed(1):0,avgAgentsPerSession:s.length>0?(i/s.length).toFixed(1):0,topAgents:f,severityDistribution:a}}function Dn(e){if(e.sessions===0)return"";let t=["## M\xE9tricas (\xFAltimos 30 dias)",`- Sess\xF5es: ${e.sessions}`,`- Findings: ${e.totalFindings} (m\xE9dia ${e.avgFindingsPerSession}/sess\xE3o)`,`- Agentes/sess\xE3o: ${e.avgAgentsPerSession}`];e.topAgents.length>0&&t.push(`- Top agentes: ${e.topAgents.map(r=>`${r.name}(${r.count})`).join(", ")}`);let n=e.severityDistribution,s=Object.entries(n).filter(([,r])=>r>0).map(([r,i])=>`${r}:${i}`).join(" ");return s&&t.push(`- Severidade: ${s}`),t.join(`
`)}Pe.exports={recordSessionMetrics:Rn,getMetricsSummary:yn,formatMetricsSummary:Dn}});var{getContainerTag:hn,getProjectName:Cn,getUserContainerTag:Fn}=G(),{loadSettings:Un,debugLog:h}=Y(),{readStdin:Mn,writeOutput:J}=se(),{saveIncrementalTurns:xn,getSessionTracking:wn}=q(),{readNewEntries:Hn}=q(),{extractFacts:vn}=we(),{trackError:Xn}=be(),{trackAgentInvocation:bn}=$e(),{parseBlufFindings:Je,extractAgentOutputs:Gn}=We(),{saveFinding:Yn}=qe(),{recordSessionMetrics:$n}=ze(),{getDb:v}=x(),{LocalMindClient:jn}=B();async function Bn(){let e=Un();try{let t=await Mn(),n=t.cwd||process.cwd(),s=t.session_id,r=t.transcript_path;if(h(e,"Stop",{sessionId:s,transcriptPath:r}),!r||!s){h(e,"Missing transcript path or session id"),J({continue:!0});return}let i=xn({sessionId:s,transcriptPath:r,cwd:n});h(e,"Final save",i);let o=wn(s),a=hn(n),f=Cn(n),{entries:u}=Hn(r,0);if(u.length>0){let c=vn(u),E=new jn;for(let _ of c.sessionFacts)E.addProfileFact(a,"dynamic",_);E.pruneOldDynamicFacts(a,20),E.pruneDecayed(a);let d=c.sessionFacts.filter(_=>_.startsWith("errors:"));for(let _ of d){let p=_.replace("errors: ","").split("; ");for(let g of p)g.trim()&&Xn(v(),a,g.trim())}if(c.userFacts.length>0){let _=Fn();for(let p of c.userFacts)E.addProfileFact(_,"static",p)}for(let _ of u){if(_.type!=="assistant")continue;let p=_.message?.content;if(Array.isArray(p)){for(let g of p)if(g.type==="tool_use"&&g.name==="Task"){let N=g.input?.subagent_type;N&&bn(v(),a,s,N,(g.input?.description||"").slice(0,200)||null)}}}let l=Gn(u),m=0;for(let{agentName:_,output:p}of l){let g=Je(p);for(let N of g)try{Yn(v(),{containerTag:a,sessionId:s,agentName:_,severity:N.severity,findingText:N.text,fileRefs:N.files}),m++}catch{}}let X={},Z=new Set;for(let{agentName:_,output:p}of l){Z.add(_);for(let g of Je(p))X[g.severity]=(X[g.severity]||0)+1}try{$n(v(),a,s,{agentsSpawned:l.length,findingsCaptured:m,findingsBySeverity:X,agentsUsed:[...Z]})}catch{}h(e,"Facts extracted",{session:c.sessionFacts.length,user:c.userFacts.length,agentFindings:m})}J({continue:!0})}catch(t){h(e,"Error",{error:t.message}),console.error(`LocalMind: ${t.message}`),J({continue:!0})}}Bn().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
