#!/usr/bin/env node
var T=(t,n)=>()=>(n||t((n={exports:{}}).exports,n),n.exports);var C=T((Ue,G)=>{var{execSync:$}=require("node:child_process"),St=require("node:crypto");function O(t){return St.createHash("sha256").update(t).digest("hex").slice(0,16)}function U(t){try{return $("git rev-parse --show-toplevel",{cwd:t,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function ht(t){let e=U(t)||t;return`claudecode_project_${O(e)}`}function Dt(t){return(U(t)||t).split("/").pop()||"unknown"}function It(){try{let n=$("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${O(n)}`}catch{}let t=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${O(t)}`}G.exports={sha256:O,getGitRoot:U,getContainerTag:ht,getProjectName:Dt,getUserContainerTag:It}});var F=T((Ce,q)=>{var N=require("node:fs"),B=require("node:path"),Mt=require("node:os"),S=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||B.join(Mt.homedir(),".local-mind"),g=B.join(S,"settings.json"),k={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function Ut(){N.existsSync(S)||N.mkdirSync(S,{recursive:!0,mode:448})}function Ct(){let t={...k};try{if(N.existsSync(g)){let e=N.readFileSync(g,"utf-8");t={...t,...JSON.parse(e)}}}catch(e){console.error(`Settings: Failed to load ${g}: ${e.message}`)}let n=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return n&&(t={...t,skipTools:n.split(",").map(e=>e.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(t={...t,debug:!0}),t}function Ft(t){Ut();let n={...t};N.writeFileSync(g,JSON.stringify(n,null,2),{mode:384})}function wt(t,n){return n.skipTools.includes(t)?!1:n.captureTools&&n.captureTools.length>0?n.captureTools.includes(t):!0}function xt(t,n,e){if(t.debug){let r=new Date().toISOString();console.error(e?`[${r}] ${n}: ${JSON.stringify(e)}`:`[${r}] ${n}`)}}q.exports={SETTINGS_DIR:S,SETTINGS_FILE:g,DEFAULT_SETTINGS:k,loadSettings:Ct,saveSettings:Ft,shouldCaptureTool:wt,debugLog:xt}});var W=T((Fe,P)=>{async function Xt(){return new Promise((t,n)=>{let e="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{e+=r}),process.stdin.on("end",()=>{try{t(e.trim()?JSON.parse(e):{})}catch(r){n(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",n),process.stdin.isTTY&&t({})})}function L(t){console.log(JSON.stringify(t))}function Ht(t=null){L(t?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t}}:{continue:!0,suppressOutput:!0})}function Yt(t){console.error(`LocalMind: ${t}`),L({continue:!0,suppressOutput:!0})}function bt(t,n){L({hookSpecificOutput:{hookEventName:t,additionalContext:n}})}P.exports={readStdin:Xt,writeOutput:L,outputSuccess:Ht,outputError:Yt,outputWithContext:bt}});var w=T((we,V)=>{var jt=require("better-sqlite3"),d=require("node:fs"),D=require("node:path"),z=require("node:os"),h=D.join(z.homedir(),".local-mind"),Z=D.join(z.homedir(),".local-memory"),J=D.join(h,"memory.db"),m=null;function vt(t){d.existsSync(t)||d.mkdirSync(t,{recursive:!0,mode:448})}function $t(){if(!d.existsSync(h)&&d.existsSync(Z))try{d.renameSync(Z,h)}catch{}}function Gt(t=J){if(m)return m;let n=t===":memory:";n||($t(),vt(D.dirname(t)));let e=new jt(t);if(e.pragma("journal_mode = WAL"),e.pragma("foreign_keys = ON"),e.pragma("busy_timeout = 5000"),K(e),!n)try{d.chmodSync(t,384)}catch{}return m=e,e}function K(t){t.exec(`
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
  `),kt(t),Bt(t)}function Bt(t){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let e of n)try{t.exec(e)}catch{}try{t.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let e=t.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();e&&e.sql&&!e.sql.includes("'gotcha'")&&t.transaction(()=>{t.exec(`
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
        `)})()}catch{}}function kt(t){t.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||t.exec(`
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
  `)}function qt(){m&&(m.close(),m=null)}V.exports={getDb:Gt,closeDb:qt,runMigrations:K,DEFAULT_DB_PATH:J,DEFAULT_DB_DIR:h}});var tt=T((xe,Q)=>{var Pt=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Wt(t,n=1e5){if(!t||typeof t!="string")return"";let e=t;for(let r of Pt)e=e.replace(r,"");return e.length>n&&(e=e.slice(0,n)),e}function Zt(t,n=1,e=1e5){return t.length<n?{valid:!1,reason:`content below minimum length (${n})`}:t.length>e?{valid:!1,reason:`content exceeds maximum length (${e})`}:{valid:!0}}function zt(t){return!t||typeof t!="string"?{valid:!1,reason:"tag is empty"}:t.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(t)?/^[-_]|[-_]$/.test(t)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function Jt(t){if(!t||typeof t!="object")return{};let n={},e=0;for(let[r,o]of Object.entries(t)){if(e>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof o=="string"?(n[r]=o.slice(0,1024),e++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(n[r]=o,e++))}return n}Q.exports={sanitizeContent:Wt,validateContentLength:Zt,validateContainerTag:zt,sanitizeMetadata:Jt}});var ot=T((Xe,rt)=>{function et(t){if(!t)return .5;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function Kt(t){if(!t||t.length===0)return[];let n=Math.max(...t.map(e=>Math.abs(e.rank||0)));return t.map(e=>{let r=n>0?Math.abs(e.rank||0)/n:0,o=et(e.updated_at||e.created_at),s=r*.7+o*.3;return{...e,relevance:r,recency:o,score:s}}).sort((e,r)=>r.score-e.score)}function nt(t,n){if(!n)return t;let e=(Date.now()-new Date(n).getTime())/864e5;return e<0?t:t*Math.exp(-.1*e)}function Vt(t,n){let r=t.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(o=>nt(o.confidence,o.reinforced_at)<.3).map(o=>o.id);if(r.length>0){let o=r.map(()=>"?").join(",");t.prepare(`DELETE FROM profile_facts WHERE id IN (${o})`).run(...r)}return r.length}rt.exports={recencyWeight:et,scoredResults:Kt,decayedConfidence:nt,pruneDecayedFacts:Vt,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3}});var X=T((Ye,it)=>{var{getDb:Qt,closeDb:He}=w(),{sanitizeContent:st,sanitizeMetadata:te,validateContainerTag:ee,validateContentLength:ne}=tt(),{scoredResults:re,pruneDecayedFacts:oe}=ot(),se="claudecode_default",x=class{constructor(n,e){this.containerTag=n||se,this.dbPath=e}_getDb(){return Qt(this.dbPath)}async addMemory(n,e,r={},o=null){let s=this._getDb(),a=e||this.containerTag;ee(a);let i=st(n);ne(i);let c=te({source:"local-mind",...r}),u=c.project||null,f=c.type||"session_turn",E=JSON.stringify(c);if(o){let l=s.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(l)return s.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(i,a,u,f,E,o),{id:l.id,status:"updated",containerTag:a}}return{id:s.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(i,a,u,f,c.session_id||null,o,E).lastInsertRowid,status:"created",containerTag:a}}async search(n,e,r={}){let o=this._getDb(),s=e||this.containerTag,a=r.limit||10,i=st(n).replace(/['"]/g,"").trim();if(!i)return{results:[],total:0};let c=i.split(/\s+/).filter(Boolean).map(u=>`"${u}"`).join(" OR ");try{let u=a*2,f=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,s,u),E=re(f);return{results:E.slice(0,a).map(l=>({id:l.id,memory:l.content,content:l.content,similarity:l.score,relevance:l.relevance,recency:l.recency,containerTag:l.container_tag,title:l.project_name,createdAt:l.created_at,updatedAt:l.updated_at})),total:E.length}}catch{return{results:[],total:0}}}async getProfile(n,e){let r=this._getDb(),o=n||this.containerTag,s=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(c=>c.fact_text),a=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(c=>c.fact_text),i=e?await this.search(e,o,{limit:10}):{results:[],total:0};return{profile:{static:s,dynamic:a},searchResults:i.results.length>0?i:void 0}}async listMemories(n,e=20){let r=this._getDb(),o=n||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,e)}}async deleteMemory(n){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(n)}addProfileFact(n,e,r,o=1){let s=this._getDb(),a=n||this.containerTag;s.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(a,e,r,o)}pruneOldDynamicFacts(n,e=20){let r=this._getDb(),o=n||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(o,e,o)}pruneDecayed(n){let e=this._getDb(),r=n||this.containerTag;return oe(e,r)}};it.exports={LocalMindClient:x}});var Et=T((be,lt)=>{var at=require("node:fs"),ie=500,ae=["Read"],H=new Map;function ct(t){if(!at.existsSync(t))return[];let e=at.readFileSync(t,"utf-8").trim().split(`
`),r=[];for(let o of e)if(o.trim())try{r.push(JSON.parse(o))}catch{}return r}function ut(t,n){if(!n)return t.filter(o=>o.type==="user"||o.type==="assistant");let e=!1,r=[];for(let o of t){if(o.uuid===n){e=!0;continue}e&&(o.type==="user"||o.type==="assistant")&&r.push(o)}return r}function ft(t){let n=[];if(t.type==="user"){let e=ce(t.message);e&&n.push(e)}else if(t.type==="assistant"){let e=ue(t.message);e&&n.push(e)}return n.join(`
`)}function ce(t){if(!t?.content)return null;let n=t.content,e=[];if(typeof n=="string"){let r=y(n);r&&e.push(`[role:user]
${r}
[user:end]`)}else if(Array.isArray(n)){for(let r of n)if(r.type==="text"&&r.text){let o=y(r.text);o&&e.push(`[role:user]
${o}
[user:end]`)}else if(r.type==="tool_result"){let o=r.tool_use_id||"",s=H.get(o)||"Unknown";if(ae.includes(s))continue;let a=Y(y(r.content||""),ie),i=r.is_error?"error":"success";a&&e.push(`[tool_result:${s} status="${i}"]
${a}
[tool_result:end]`)}}return e.length>0?e.join(`

`):null}function ue(t){if(!t?.content)return null;let n=t.content,e=[];if(!Array.isArray(n))return null;for(let r of n)if(r.type!=="thinking"){if(r.type==="text"&&r.text){let o=y(r.text);o&&e.push(`[role:assistant]
${o}
[assistant:end]`)}else if(r.type==="tool_use"){let o=r.name||"Unknown",s=r.id||"",a=r.input||{},i=fe(a);e.push(`[tool:${o}]
${i}
[tool:end]`),s&&H.set(s,o)}}return e.length>0?e.join(`

`):null}function fe(t){let n=[];for(let[e,r]of Object.entries(t)){let o=typeof r=="string"?r:JSON.stringify(r);o=Y(o,200),n.push(`${e}: ${o}`)}return n.join(`
`)}function y(t){return!t||typeof t!="string"?"":t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function Y(t,n){return!t||t.length<=n?t:`${t.slice(0,n)}...`}function le(t,n){H=new Map;let e=ct(t);if(e.length===0)return null;let r=ut(e,n);if(r.length===0)return null;let o=r[0],s=r[r.length-1],a=o.timestamp||new Date().toISOString(),i=[];i.push(`[turn:start timestamp="${a}"]`);for(let u of r){let f=ft(u);f&&i.push(f)}i.push("[turn:end]");let c=i.join(`

`);return c.length<100?null:{formatted:c,lastUuid:s.uuid}}lt.exports={parseTranscript:ct,getEntriesSinceLastCapture:ut,formatEntry:ft,formatNewEntries:le,cleanContent:y,truncate:Y}});var pt=T((je,_t)=>{var R=require("node:fs"),{LocalMindClient:Ee}=X(),{getContainerTag:Te,getProjectName:de}=C(),{formatNewEntries:me}=Et(),{getDb:Tt}=w(),{debugLog:_e,loadSettings:pe}=F();function dt(t){let e=Tt().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(t);return e?{lastUuid:e.last_captured_uuid,lastByteOffset:e.last_byte_offset||0,containerTag:e.container_tag,projectName:e.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function I(t,n,e,r,o){let s=Tt();s.prepare("SELECT id FROM sessions WHERE session_id = ?").get(t)?s.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(n,e,t):s.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(t,r,o,n,e)}function mt(t,n){if(!R.existsSync(t))return{entries:[],newOffset:n};let e=R.statSync(t),r=n;if(e.size<r&&(r=0),e.size===r)return{entries:[],newOffset:r};let o=R.openSync(t,"r"),s;try{s=Buffer.alloc(e.size-r),R.readSync(o,s,0,s.length,r)}finally{R.closeSync(o)}let a=s.toString("utf-8").split(`
`),i=[];for(let c of a)if(c.trim())try{i.push(JSON.parse(c))}catch{}return{entries:i,newOffset:e.size}}function ge({sessionId:t,transcriptPath:n,cwd:e}){if(!n||!t)return{saved:!1,reason:"missing_params"};let r=pe(),o=dt(t),s=o.containerTag||Te(e),a=o.projectName||de(e),{entries:i,newOffset:c}=mt(n,o.lastByteOffset);if(i.length===0)return{saved:!1,reason:"no_new_entries"};let u=i.filter(_=>_.type==="user"||_.type==="assistant");if(u.length===0)return I(t,o.lastUuid,c,s,a),{saved:!1,reason:"no_user_assistant_entries"};let f=me(n,o.lastUuid);return f?(new Ee().addMemory(f.formatted,s,{type:"session_turn",project:a,timestamp:new Date().toISOString()},t),I(t,f.lastUuid,c,s,a),_e(r,"Incremental save",{entries:u.length,bytes:c-o.lastByteOffset}),{saved:!0,entries:u.length,newOffset:c}):(I(t,o.lastUuid,c,s,a),{saved:!1,reason:"format_empty"})}_t.exports={readNewEntries:mt,saveIncrementalTurns:ge,getSessionTracking:dt,updateSessionTracking:I}});var yt=T((ve,Lt)=>{function gt(t){try{let n=new Date(t),e=new Date,r=(e.getTime()-n.getTime())/1e3,o=r/60,s=r/3600,a=r/86400;if(o<30)return"just now";if(o<60)return`${Math.floor(o)}mins ago`;if(s<24)return`${Math.floor(s)}hrs ago`;if(a<7)return`${Math.floor(a)}d ago`;let i=n.toLocaleString("en",{month:"short"});return n.getFullYear()===e.getFullYear()?`${n.getDate()} ${i}`:`${n.getDate()} ${i}, ${n.getFullYear()}`}catch{return""}}function Nt(t,n,e){let r=new Set,o=t.filter(i=>r.has(i)?!1:(r.add(i),!0)),s=n.filter(i=>r.has(i)?!1:(r.add(i),!0)),a=e.filter(i=>{let c=i.memory??"";return!c||r.has(c)?!1:(r.add(c),!0)});return{static:o,dynamic:s,searchResults:a}}function Ne(t,n=!0,e=!1,r=10){if(!t)return null;let o=t.profile?.static||[],s=t.profile?.dynamic||[],a=t.searchResults?.results||[],i=Nt(n?o:[],n?s:[],e?a:[]),c=i.static.slice(0,r),u=i.dynamic.slice(0,r),f=i.searchResults.slice(0,r);if(c.length===0&&u.length===0&&f.length===0)return null;let E=[];if(c.length>0&&E.push(`## User Profile (Persistent)
`+c.map(A=>`- ${A}`).join(`
`)),u.length>0&&E.push(`## Recent Context
`+u.map(A=>`- ${A}`).join(`
`)),f.length>0){let Rt=f.map(p=>{let M=p.memory??"",At=M.length>500?`${M.slice(0,500)}...`:M,v=p.updatedAt?gt(p.updatedAt):"",Ot=p.similarity!=null?`[${p.similarity.toFixed(2)}]`:"";return`- ${v?`[${v}] `:""}${At} ${Ot}`.trim()});E.push(`## Relevant Memories (scored)
`+Rt.join(`
`))}return`<local-mind-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${E.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-mind-context>`}Lt.exports={formatContext:Ne,formatRelativeTime:gt,deduplicateMemories:Nt}});var{getContainerTag:Le,getProjectName:ye}=C(),{loadSettings:Re,debugLog:b}=F(),{readStdin:Ae,writeOutput:j}=W(),{saveIncrementalTurns:Oe}=pt(),{LocalMindClient:Se}=X(),{formatContext:he}=yt();async function De(){let t=Re();try{let n=await Ae(),e=n.cwd||process.cwd(),r=n.session_id,o=n.transcript_path;if(b(t,"PreCompact",{sessionId:r}),o&&r){let f=Oe({sessionId:r,transcriptPath:o,cwd:e});b(t,"PreCompact save",f)}let s=Le(e),a=ye(e),c=await new Se(s).getProfile(s,a).catch(()=>null),u=he(c,t.injectProfile,!0,15);j(u?{hookSpecificOutput:{hookEventName:"PreCompact",additionalContext:u}}:{continue:!0})}catch(n){b(t,"PreCompact error",{error:n.message}),j({continue:!0})}}De().catch(t=>{console.error(`LocalMind fatal: ${t.message}`),process.exit(1)});
