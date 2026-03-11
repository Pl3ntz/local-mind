#!/usr/bin/env node
var T=(t,n)=>()=>(n||t((n={exports:{}}).exports,n),n.exports);var I=T((le,H)=>{var p=require("node:fs"),x=require("node:path"),_t=require("node:os"),A=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||x.join(_t.homedir(),".local-mind"),m=x.join(A,"settings.json"),w={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function dt(){p.existsSync(A)||p.mkdirSync(A,{recursive:!0,mode:448})}function mt(){let t={...w};try{if(p.existsSync(m)){let e=p.readFileSync(m,"utf-8");t={...t,...JSON.parse(e)}}}catch(e){console.error(`Settings: Failed to load ${m}: ${e.message}`)}let n=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return n&&(t={...t,skipTools:n.split(",").map(e=>e.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(t={...t,debug:!0}),t}function pt(t){dt();let n={...t};p.writeFileSync(m,JSON.stringify(n,null,2),{mode:384})}function Nt(t,n){return n.skipTools.includes(t)?!1:n.captureTools&&n.captureTools.length>0?n.captureTools.includes(t):!0}function gt(t,n,e){if(t.debug){let r=new Date().toISOString();console.error(e?`[${r}] ${n}: ${JSON.stringify(e)}`:`[${r}] ${n}`)}}H.exports={SETTINGS_DIR:A,SETTINGS_FILE:m,DEFAULT_SETTINGS:w,loadSettings:mt,saveSettings:pt,shouldCaptureTool:Nt,debugLog:gt}});var Y=T((_e,b)=>{async function Lt(){return new Promise((t,n)=>{let e="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{e+=r}),process.stdin.on("end",()=>{try{t(e.trim()?JSON.parse(e):{})}catch(r){n(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",n),process.stdin.isTTY&&t({})})}function N(t){console.log(JSON.stringify(t))}function yt(t=null){N(t?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t}}:{continue:!0,suppressOutput:!0})}function At(t){console.error(`LocalMind: ${t}`),N({continue:!0,suppressOutput:!0})}function Rt(t,n){N({hookSpecificOutput:{hookEventName:t,additionalContext:n}})}b.exports={readStdin:Lt,writeOutput:N,outputSuccess:yt,outputError:At,outputWithContext:Rt}});var h=T((de,k)=>{var Ot=require("better-sqlite3"),_=require("node:fs"),O=require("node:path"),v=require("node:os"),R=O.join(v.homedir(),".local-mind"),j=O.join(v.homedir(),".local-memory"),G=O.join(R,"memory.db"),d=null;function St(t){_.existsSync(t)||_.mkdirSync(t,{recursive:!0,mode:448})}function Dt(){if(!_.existsSync(R)&&_.existsSync(j))try{_.renameSync(j,R)}catch{}}function It(t=G){if(d)return d;let n=t===":memory:";n||(Dt(),St(O.dirname(t)));let e=new Ot(t);if(e.pragma("journal_mode = WAL"),e.pragma("foreign_keys = ON"),e.pragma("busy_timeout = 5000"),B(e),!n)try{_.chmodSync(t,384)}catch{}return d=e,e}function B(t){t.exec(`
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
  `),Ut(t),ht(t)}function ht(t){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let e of n)try{t.exec(e)}catch{}try{t.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let e=t.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();e&&e.sql&&!e.sql.includes("'gotcha'")&&t.transaction(()=>{t.exec(`
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
        `)})()}catch{}}function Ut(t){t.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||t.exec(`
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
  `)}function Mt(){d&&(d.close(),d=null)}k.exports={getDb:It,closeDb:Mt,runMigrations:B,DEFAULT_DB_PATH:G,DEFAULT_DB_DIR:R}});var q=T((me,$)=>{var Ct=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Ft(t,n=1e5){if(!t||typeof t!="string")return"";let e=t;for(let r of Ct)e=e.replace(r,"");return e.length>n&&(e=e.slice(0,n)),e}function Xt(t,n=1,e=1e5){return t.length<n?{valid:!1,reason:`content below minimum length (${n})`}:t.length>e?{valid:!1,reason:`content exceeds maximum length (${e})`}:{valid:!0}}function xt(t){return!t||typeof t!="string"?{valid:!1,reason:"tag is empty"}:t.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(t)?/^[-_]|[-_]$/.test(t)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function wt(t){if(!t||typeof t!="object")return{};let n={},e=0;for(let[r,s]of Object.entries(t)){if(e>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof s=="string"?(n[r]=s.slice(0,1024),e++):(typeof s=="number"&&Number.isFinite(s)||typeof s=="boolean")&&(n[r]=s,e++))}return n}$.exports={sanitizeContent:Ft,validateContentLength:Xt,validateContainerTag:xt,sanitizeMetadata:wt}});var z=T((pe,Z)=>{function W(t){if(!t)return .5;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function Ht(t){if(!t||t.length===0)return[];let n=Math.max(...t.map(e=>Math.abs(e.rank||0)));return t.map(e=>{let r=n>0?Math.abs(e.rank||0)/n:0,s=W(e.updated_at||e.created_at),o=r*.7+s*.3;return{...e,relevance:r,recency:s,score:o}}).sort((e,r)=>r.score-e.score)}function P(t,n){if(!n)return t;let e=(Date.now()-new Date(n).getTime())/864e5;return e<0?t:t*Math.exp(-.1*e)}function bt(t,n){let r=t.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(s=>P(s.confidence,s.reinforced_at)<.3).map(s=>s.id);if(r.length>0){let s=r.map(()=>"?").join(",");t.prepare(`DELETE FROM profile_facts WHERE id IN (${s})`).run(...r)}return r.length}Z.exports={recencyWeight:W,scoredResults:Ht,decayedConfidence:P,pruneDecayedFacts:bt,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3}});var V=T((ge,K)=>{var{getDb:Yt,closeDb:Ne}=h(),{sanitizeContent:J,sanitizeMetadata:jt,validateContainerTag:vt,validateContentLength:Gt}=q(),{scoredResults:Bt,pruneDecayedFacts:kt}=z(),$t="claudecode_default",U=class{constructor(n,e){this.containerTag=n||$t,this.dbPath=e}_getDb(){return Yt(this.dbPath)}async addMemory(n,e,r={},s=null){let o=this._getDb(),i=e||this.containerTag;vt(i);let a=J(n);Gt(a);let c=jt({source:"local-mind",...r}),u=c.project||null,f=c.type||"session_turn",l=JSON.stringify(c);if(s){let E=o.prepare("SELECT id FROM memories WHERE custom_id = ?").get(s);if(E)return o.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(a,i,u,f,l,s),{id:E.id,status:"updated",containerTag:i}}return{id:o.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a,i,u,f,c.session_id||null,s,l).lastInsertRowid,status:"created",containerTag:i}}async search(n,e,r={}){let s=this._getDb(),o=e||this.containerTag,i=r.limit||10,a=J(n).replace(/['"]/g,"").trim();if(!a)return{results:[],total:0};let c=a.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=i*2,f=s.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,o,u),l=Bt(f);return{results:l.slice(0,i).map(E=>({id:E.id,memory:E.content,content:E.content,similarity:E.score,relevance:E.relevance,recency:E.recency,containerTag:E.container_tag,title:E.project_name,createdAt:E.created_at,updatedAt:E.updated_at})),total:l.length}}catch{return{results:[],total:0}}}async getProfile(n,e){let r=this._getDb(),s=n||this.containerTag,o=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(s).map(c=>c.fact_text),i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(s).map(c=>c.fact_text),a=e?await this.search(e,s,{limit:10}):{results:[],total:0};return{profile:{static:o,dynamic:i},searchResults:a.results.length>0?a:void 0}}async listMemories(n,e=20){let r=this._getDb(),s=n||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(s,e)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,e,r,s=1){let o=this._getDb(),i=n||this.containerTag;o.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(i,e,r,s)}pruneOldDynamicFacts(n,e=20){let r=this._getDb(),s=n||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(s,e,s)}pruneDecayed(n){let e=this._getDb(),r=n||this.containerTag;return kt(e,r)}};K.exports={LocalMindClient:U}});var et=T((Le,tt)=>{var{execSync:Q}=require("node:child_process"),qt=require("node:crypto");function S(t){return qt.createHash("sha256").update(t).digest("hex").slice(0,16)}function M(t){try{return Q("git rev-parse --show-toplevel",{cwd:t,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Wt(t){let e=M(t)||t;return`claudecode_project_${S(e)}`}function Pt(t){return(M(t)||t).split("/").pop()||"unknown"}function Zt(){try{let n=Q("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${S(n)}`}catch{}let t=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${S(t)}`}tt.exports={sha256:S,getGitRoot:M,getContainerTag:Wt,getProjectName:Pt,getUserContainerTag:Zt}});var at=T((ye,it)=>{var nt=require("node:fs"),zt=500,Jt=["Read"],C=new Map;function rt(t){if(!nt.existsSync(t))return[];let e=nt.readFileSync(t,"utf-8").trim().split(`
`),r=[];for(let s of e)if(s.trim())try{r.push(JSON.parse(s))}catch{}return r}function st(t,n){if(!n)return t.filter(s=>s.type==="user"||s.type==="assistant");let e=!1,r=[];for(let s of t){if(s.uuid===n){e=!0;continue}e&&(s.type==="user"||s.type==="assistant")&&r.push(s)}return r}function ot(t){let n=[];if(t.type==="user"){let e=Kt(t.message);e&&n.push(e)}else if(t.type==="assistant"){let e=Vt(t.message);e&&n.push(e)}return n.join(`
`)}function Kt(t){if(!t?.content)return null;let n=t.content,e=[];if(typeof n=="string"){let r=g(n);r&&e.push(`[role:user]
${r}
[user:end]`)}else if(Array.isArray(n)){for(let r of n)if(r.type==="text"&&r.text){let s=g(r.text);s&&e.push(`[role:user]
${s}
[user:end]`)}else if(r.type==="tool_result"){let s=r.tool_use_id||"",o=C.get(s)||"Unknown";if(Jt.includes(o))continue;let i=F(g(r.content||""),zt),a=r.is_error?"error":"success";i&&e.push(`[tool_result:${o} status="${a}"]
${i}
[tool_result:end]`)}}return e.length>0?e.join(`

`):null}function Vt(t){if(!t?.content)return null;let n=t.content,e=[];if(!Array.isArray(n))return null;for(let r of n)if(r.type!=="thinking"){if(r.type==="text"&&r.text){let s=g(r.text);s&&e.push(`[role:assistant]
${s}
[assistant:end]`)}else if(r.type==="tool_use"){let s=r.name||"Unknown",o=r.id||"",i=r.input||{},a=Qt(i);e.push(`[tool:${s}]
${a}
[tool:end]`),o&&C.set(o,s)}}return e.length>0?e.join(`

`):null}function Qt(t){let n=[];for(let[e,r]of Object.entries(t)){let s=typeof r=="string"?r:JSON.stringify(r);s=F(s,200),n.push(`${e}: ${s}`)}return n.join(`
`)}function g(t){return!t||typeof t!="string"?"":t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function F(t,n){return!t||t.length<=n?t:`${t.slice(0,n)}...`}function te(t,n){C=new Map;let e=rt(t);if(e.length===0)return null;let r=st(e,n);if(r.length===0)return null;let s=r[0],o=r[r.length-1],i=s.timestamp||new Date().toISOString(),a=[];a.push(`[turn:start timestamp="${i}"]`);for(let u of r){let f=ot(u);f&&a.push(f)}a.push("[turn:end]");let c=a.join(`

`);return c.length<100?null:{formatted:c,lastUuid:o.uuid}}it.exports={parseTranscript:rt,getEntriesSinceLastCapture:st,formatEntry:ot,formatNewEntries:te,cleanContent:g,truncate:F}});var Tt=T((Ae,ft)=>{var L=require("node:fs"),{LocalMindClient:ee}=V(),{getContainerTag:ne,getProjectName:re}=et(),{formatNewEntries:se}=at(),{getDb:ct}=h(),{debugLog:oe,loadSettings:ie}=I();function Et(t){let e=ct().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(t);return e?{lastUuid:e.last_captured_uuid,lastByteOffset:e.last_byte_offset||0,containerTag:e.container_tag,projectName:e.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function D(t,n,e,r,s){let o=ct();o.prepare("SELECT id FROM sessions WHERE session_id = ?").get(t)?o.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(n,e,t):o.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(t,r,s,n,e)}function ut(t,n){if(!L.existsSync(t))return{entries:[],newOffset:n};let e=L.statSync(t),r=n;if(e.size<r&&(r=0),e.size===r)return{entries:[],newOffset:r};let s=L.openSync(t,"r"),o;try{o=Buffer.alloc(e.size-r),L.readSync(s,o,0,o.length,r)}finally{L.closeSync(s)}let i=o.toString("utf-8").split(`
`),a=[];for(let c of i)if(c.trim())try{a.push(JSON.parse(c))}catch{}return{entries:a,newOffset:e.size}}function ae({sessionId:t,transcriptPath:n,cwd:e}){if(!n||!t)return{saved:!1,reason:"missing_params"};let r=ie(),s=Et(t),o=s.containerTag||ne(e),i=s.projectName||re(e),{entries:a,newOffset:c}=ut(n,s.lastByteOffset);if(a.length===0)return{saved:!1,reason:"no_new_entries"};let u=a.filter(y=>y.type==="user"||y.type==="assistant");if(u.length===0)return D(t,s.lastUuid,c,o,i),{saved:!1,reason:"no_user_assistant_entries"};let f=se(n,s.lastUuid);return f?(new ee().addMemory(f.formatted,o,{type:"session_turn",project:i,timestamp:new Date().toISOString()},t),D(t,f.lastUuid,c,o,i),oe(r,"Incremental save",{entries:u.length,bytes:c-s.lastByteOffset}),{saved:!0,entries:u.length,newOffset:c}):(D(t,s.lastUuid,c,o,i),{saved:!1,reason:"format_empty"})}ft.exports={readNewEntries:ut,saveIncrementalTurns:ae,getSessionTracking:Et,updateSessionTracking:D}});var{loadSettings:ce,debugLog:X}=I(),{readStdin:Ee,outputSuccess:lt}=Y(),{saveIncrementalTurns:ue}=Tt();async function fe(){let t=ce();try{let n=await Ee(),e=n.session_id,r=n.transcript_path,s=n.cwd||process.cwd();if(X(t,"UserPromptSubmit",{sessionId:e}),r&&e){let o=ue({sessionId:e,transcriptPath:r,cwd:s});X(t,"Incremental save result",o)}lt()}catch(n){X(t,"Error",{error:n.message}),lt()}}fe().catch(t=>{console.error(`LocalMind fatal: ${t.message}`),process.exit(1)});
