#!/usr/bin/env node
var _=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var y=_((gt,H)=>{var p=require("node:fs"),x=require("node:path"),le=require("node:os"),I=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||x.join(le.homedir(),".local-mind"),m=x.join(I,"settings.json"),w={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function me(){p.existsSync(I)||p.mkdirSync(I,{recursive:!0,mode:448})}function pe(){let e={...w};try{if(p.existsSync(m)){let t=p.readFileSync(m,"utf-8");e={...e,...JSON.parse(t)}}}catch(t){console.error(`Settings: Failed to load ${m}: ${t.message}`)}let n=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return n&&(e={...e,skipTools:n.split(",").map(t=>t.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function Ne(e){me();let n={...e};p.writeFileSync(m,JSON.stringify(n,null,2),{mode:384})}function ge(e,n){return n.skipTools.includes(e)?!1:n.captureTools&&n.captureTools.length>0?n.captureTools.includes(e):!0}function Le(e,n,t){if(e.debug){let s=new Date().toISOString();console.error(t?`[${s}] ${n}: ${JSON.stringify(t)}`:`[${s}] ${n}`)}}H.exports={SETTINGS_DIR:I,SETTINGS_FILE:m,DEFAULT_SETTINGS:w,loadSettings:pe,saveSettings:Ne,shouldCaptureTool:ge,debugLog:Le}});var G=_((Lt,Y)=>{async function Ae(){return new Promise((e,n)=>{let t="";process.stdin.setEncoding("utf8"),process.stdin.on("data",s=>{t+=s}),process.stdin.on("end",()=>{try{e(t.trim()?JSON.parse(t):{})}catch(s){n(new Error(`Failed to parse stdin JSON: ${s.message}`))}}),process.stdin.on("error",n),process.stdin.isTTY&&e({})})}function N(e){console.log(JSON.stringify(e))}function Ie(e=null){N(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function Re(e){console.error(`LocalMind: ${e}`),N({continue:!0,suppressOutput:!0})}function Oe(e,n){N({hookSpecificOutput:{hookEventName:e,additionalContext:n}})}Y.exports={readStdin:Ae,writeOutput:N,outputSuccess:Ie,outputError:Re,outputWithContext:Oe}});var U=_((At,k)=>{var Se=require("better-sqlite3"),u=require("node:fs"),O=require("node:path"),B=require("node:os"),R=O.join(B.homedir(),".local-mind"),b=O.join(B.homedir(),".local-memory"),v=O.join(R,"memory.db"),l=null;function De(e){u.existsSync(e)||u.mkdirSync(e,{recursive:!0,mode:448})}function ye(){if(!u.existsSync(R)&&u.existsSync(b))try{u.renameSync(b,R)}catch{}}function Ue(e=v){if(l)return l;let n=e===":memory:";n||(ye(),De(O.dirname(e)));let t=new Se(e);if(t.pragma("journal_mode = WAL"),t.pragma("foreign_keys = ON"),t.pragma("busy_timeout = 5000"),j(t),!n)try{u.chmodSync(e,384)}catch{}return l=t,t}function j(e){e.exec(`
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
  `),Me(e),Fe(e),Ce(e)}function Ce(e){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let t of n)try{e.exec(t)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let t=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();t&&t.sql&&!t.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function Fe(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
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
  `)}function Me(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function he(){l&&(l.close(),l=null)}k.exports={getDb:Ue,closeDb:he,runMigrations:j,DEFAULT_DB_PATH:v,DEFAULT_DB_DIR:R}});var P=_((It,$)=>{var Xe=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function xe(e,n=1e5){if(!e||typeof e!="string")return"";let t=e;for(let s of Xe)t=t.replace(s,"");return t.length>n&&(t=t.slice(0,n)),t}function we(e,n=1,t=1e5){return e.length<n?{valid:!1,reason:`content below minimum length (${n})`}:e.length>t?{valid:!1,reason:`content exceeds maximum length (${t})`}:{valid:!0}}function He(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function Ye(e){if(!e||typeof e!="object")return{};let n={},t=0;for(let[s,r]of Object.entries(e)){if(t>=50)break;s.length>128||/[^\w.-]/.test(s)||(typeof r=="string"?(n[s]=r.slice(0,1024),t++):(typeof r=="number"&&Number.isFinite(r)||typeof r=="boolean")&&(n[s]=r,t++))}return n}$.exports={sanitizeContent:xe,validateContentLength:we,validateContainerTag:He,sanitizeMetadata:Ye}});var V=_((Rt,K)=>{function W(e){if(!e)return .5;let n=(Date.now()-new Date(e).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function Ge(e){if(!e||e.length===0)return[];let n=Math.max(...e.map(t=>Math.abs(t.rank||0)));return e.map(t=>{let s=n>0?Math.abs(t.rank||0)/n:0,r=W(t.updated_at||t.created_at),i=s*.7+r*.3;return{...t,relevance:s,recency:r,score:i}}).sort((t,s)=>s.score-t.score)}function q(e,n){if(!n)return e;let t=(Date.now()-new Date(n).getTime())/864e5;return t<0?e:e*Math.exp(-.1*t)}function be(e,n){let s=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(r=>q(r.confidence,r.reinforced_at)<.3).map(r=>r.id);if(s.length>0){let r=s.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${r})`).run(...s)}return s.length}var Z={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function Be(e,n,t){if(!n)return e;let s=(Date.now()-new Date(n).getTime())/864e5;if(s<0)return e;let r=Z[t]||.1;return e*Math.exp(-r*s)}function ve(e){return 1+.1*Math.min(e||0,5)}K.exports={recencyWeight:W,scoredResults:Ge,decayedConfidence:q,pruneDecayedFacts:be,findingDecayedConfidence:Be,recallBoost:ve,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:Z}});var Q=_((St,J)=>{var{getDb:je,closeDb:Ot}=U(),{sanitizeContent:z,sanitizeMetadata:ke,validateContainerTag:$e,validateContentLength:Pe}=P(),{scoredResults:We,pruneDecayedFacts:qe,decayedConfidence:Ze,CONFIDENCE_PRUNE_THRESHOLD:Ke}=V(),Ve="claudecode_default",C=class{constructor(n,t){this.containerTag=n||Ve,this.dbPath=t}_getDb(){return je(this.dbPath)}async addMemory(n,t,s={},r=null){let i=this._getDb(),o=t||this.containerTag;$e(o);let c=z(n);Pe(c);let a=ke({source:"local-mind",...s}),T=a.project||null,f=a.type||"session_turn",d=JSON.stringify(a);if(r){let E=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(r);if(E)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(c,o,T,f,d,r),{id:E.id,status:"updated",containerTag:o}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c,o,T,f,a.session_id||null,r,d).lastInsertRowid,status:"created",containerTag:o}}async search(n,t,s={}){let r=this._getDb(),i=t||this.containerTag,o=s.limit||10,c=z(n).replace(/['"]/g,"").trim();if(!c)return{results:[],total:0};let a=c.split(/\s+/).filter(Boolean).map(T=>`"${T}"`).join(" OR ");try{let T=o*2,f=r.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(a,i,T),d=We(f);return{results:d.slice(0,o).map(E=>({id:E.id,memory:E.content,content:E.content,similarity:E.score,relevance:E.relevance,recency:E.recency,containerTag:E.container_tag,title:E.project_name,createdAt:E.created_at,updatedAt:E.updated_at})),total:d.length}}catch{return{results:[],total:0}}}async getProfile(n,t){let s=this._getDb(),r=n||this.containerTag,i=s.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(r).map(a=>a.fact_text),o=s.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(r).filter(a=>Ze(a.confidence,a.reinforced_at)>=Ke).map(a=>a.fact_text),c=t?await this.search(t,r,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:o},searchResults:c.results.length>0?c:void 0}}async listMemories(n,t=20){let s=this._getDb(),r=n||this.containerTag;return{memories:s.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(r,t)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,t,s,r=1){let i=this._getDb(),o=n||this.containerTag;i.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(o,t,s,r)}pruneOldDynamicFacts(n,t=20){let s=this._getDb(),r=n||this.containerTag;s.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(r,t,r)}pruneDecayed(n){let t=this._getDb(),s=n||this.containerTag;return qe(t,s)}};J.exports={LocalMindClient:C}});var ne=_((Dt,te)=>{var{execSync:ee}=require("node:child_process"),ze=require("node:crypto");function S(e){return ze.createHash("sha256").update(e).digest("hex").slice(0,16)}function F(e){try{return ee("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Je(e){let t=F(e)||e;return`claudecode_project_${S(t)}`}function Qe(e){return(F(e)||e).split("/").pop()||"unknown"}function et(){try{let n=ee("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${S(n)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${S(e)}`}te.exports={sha256:S,getGitRoot:F,getContainerTag:Je,getProjectName:Qe,getUserContainerTag:et}});var ce=_((yt,ae)=>{var se=require("node:fs"),tt=500,nt=["Read"],M=new Map;function re(e){if(!se.existsSync(e))return[];let t=se.readFileSync(e,"utf-8").trim().split(`
`),s=[];for(let r of t)if(r.trim())try{s.push(JSON.parse(r))}catch{}return s}function ie(e,n){if(!n)return e.filter(r=>r.type==="user"||r.type==="assistant");let t=!1,s=[];for(let r of e){if(r.uuid===n){t=!0;continue}t&&(r.type==="user"||r.type==="assistant")&&s.push(r)}return s}function oe(e){let n=[];if(e.type==="user"){let t=st(e.message);t&&n.push(t)}else if(e.type==="assistant"){let t=rt(e.message);t&&n.push(t)}return n.join(`
`)}function st(e){if(!e?.content)return null;let n=e.content,t=[];if(typeof n=="string"){let s=g(n);s&&t.push(`[role:user]
${s}
[user:end]`)}else if(Array.isArray(n)){for(let s of n)if(s.type==="text"&&s.text){let r=g(s.text);r&&t.push(`[role:user]
${r}
[user:end]`)}else if(s.type==="tool_result"){let r=s.tool_use_id||"",i=M.get(r)||"Unknown";if(nt.includes(i))continue;let o=h(g(s.content||""),tt),c=s.is_error?"error":"success";o&&t.push(`[tool_result:${i} status="${c}"]
${o}
[tool_result:end]`)}}return t.length>0?t.join(`

`):null}function rt(e){if(!e?.content)return null;let n=e.content,t=[];if(!Array.isArray(n))return null;for(let s of n)if(s.type!=="thinking"){if(s.type==="text"&&s.text){let r=g(s.text);r&&t.push(`[role:assistant]
${r}
[assistant:end]`)}else if(s.type==="tool_use"){let r=s.name||"Unknown",i=s.id||"",o=s.input||{},c=it(o);t.push(`[tool:${r}]
${c}
[tool:end]`),i&&M.set(i,r)}}return t.length>0?t.join(`

`):null}function it(e){let n=[];for(let[t,s]of Object.entries(e)){let r=typeof s=="string"?s:JSON.stringify(s);r=h(r,200),n.push(`${t}: ${r}`)}return n.join(`
`)}function g(e){return!e||typeof e!="string"?"":e.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function h(e,n){return!e||e.length<=n?e:`${e.slice(0,n)}...`}function ot(e,n){M=new Map;let t=re(e);if(t.length===0)return null;let s=ie(t,n);if(s.length===0)return null;let r=s[0],i=s[s.length-1],o=r.timestamp||new Date().toISOString(),c=[];c.push(`[turn:start timestamp="${o}"]`);for(let T of s){let f=oe(T);f&&c.push(f)}c.push("[turn:end]");let a=c.join(`

`);return a.length<100?null:{formatted:a,lastUuid:i.uuid}}ae.exports={parseTranscript:re,getEntriesSinceLastCapture:ie,formatEntry:oe,formatNewEntries:ot,cleanContent:g,truncate:h}});var de=_((Ut,_e)=>{var L=require("node:fs"),{LocalMindClient:at}=Q(),{getContainerTag:ct,getProjectName:Et}=ne(),{formatNewEntries:Tt}=ce(),{getDb:Ee}=U(),{debugLog:ft,loadSettings:_t}=y();function Te(e){let t=Ee().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(e);return t?{lastUuid:t.last_captured_uuid,lastByteOffset:t.last_byte_offset||0,containerTag:t.container_tag,projectName:t.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function D(e,n,t,s,r){let i=Ee();i.prepare("SELECT id FROM sessions WHERE session_id = ?").get(e)?i.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(n,t,e):i.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(e,s,r,n,t)}function fe(e,n){if(!L.existsSync(e))return{entries:[],newOffset:n};let t=L.statSync(e),s=n;if(t.size<s&&(s=0),t.size===s)return{entries:[],newOffset:s};let r=L.openSync(e,"r"),i;try{i=Buffer.alloc(t.size-s),L.readSync(r,i,0,i.length,s)}finally{L.closeSync(r)}let o=i.toString("utf-8").split(`
`),c=[];for(let a of o)if(a.trim())try{c.push(JSON.parse(a))}catch{}return{entries:c,newOffset:t.size}}function dt({sessionId:e,transcriptPath:n,cwd:t}){if(!n||!e)return{saved:!1,reason:"missing_params"};let s=_t(),r=Te(e),i=r.containerTag||ct(t),o=r.projectName||Et(t),{entries:c,newOffset:a}=fe(n,r.lastByteOffset);if(c.length===0)return{saved:!1,reason:"no_new_entries"};let T=c.filter(A=>A.type==="user"||A.type==="assistant");if(T.length===0)return D(e,r.lastUuid,a,i,o),{saved:!1,reason:"no_user_assistant_entries"};let f=Tt(n,r.lastUuid);return f?(new at().addMemory(f.formatted,i,{type:"session_turn",project:o,timestamp:new Date().toISOString()},e),D(e,f.lastUuid,a,i,o),ft(s,"Incremental save",{entries:T.length,bytes:a-r.lastByteOffset}),{saved:!0,entries:T.length,newOffset:a}):(D(e,r.lastUuid,a,i,o),{saved:!1,reason:"format_empty"})}_e.exports={readNewEntries:fe,saveIncrementalTurns:dt,getSessionTracking:Te,updateSessionTracking:D}});var{loadSettings:ut,debugLog:X}=y(),{readStdin:lt,outputSuccess:ue}=G(),{saveIncrementalTurns:mt}=de();async function pt(){let e=ut();try{let n=await lt(),t=n.session_id,s=n.transcript_path,r=n.cwd||process.cwd();if(X(e,"UserPromptSubmit",{sessionId:t}),s&&t){let i=mt({sessionId:t,transcriptPath:s,cwd:r});X(e,"Incremental save result",i)}ue()}catch(n){X(e,"Error",{error:n.message}),ue()}}pt().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
