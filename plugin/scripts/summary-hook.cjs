#!/usr/bin/env node
var p=(t,n)=>()=>(n||t((n={exports:{}}).exports,n),n.exports);var M=p((Qe,G)=>{var{execSync:$}=require("node:child_process"),xt=require("node:crypto");function O(t){return xt.createHash("sha256").update(t).digest("hex").slice(0,16)}function U(t){try{return $("git rev-parse --show-toplevel",{cwd:t,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Xt(t){let e=U(t)||t;return`claudecode_project_${O(e)}`}function bt(t){return(U(t)||t).split("/").pop()||"unknown"}function Ht(){try{let n=$("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(n)return`claudecode_user_${O(n)}`}catch{}let t=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${O(t)}`}G.exports={sha256:O,getGitRoot:U,getContainerTag:Xt,getProjectName:bt,getUserContainerTag:Ht}});var w=p((tn,q)=>{var L=require("node:fs"),B=require("node:path"),vt=require("node:os"),h=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||B.join(vt.homedir(),".local-mind"),N=B.join(h,"settings.json"),W={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function jt(){L.existsSync(h)||L.mkdirSync(h,{recursive:!0,mode:448})}function kt(){let t={...W};try{if(L.existsSync(N)){let e=L.readFileSync(N,"utf-8");t={...t,...JSON.parse(e)}}}catch(e){console.error(`Settings: Failed to load ${N}: ${e.message}`)}let n=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return n&&(t={...t,skipTools:n.split(",").map(e=>e.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(t={...t,debug:!0}),t}function Yt(t){jt();let n={...t};L.writeFileSync(N,JSON.stringify(n,null,2),{mode:384})}function $t(t,n){return n.skipTools.includes(t)?!1:n.captureTools&&n.captureTools.length>0?n.captureTools.includes(t):!0}function Gt(t,n,e){if(t.debug){let r=new Date().toISOString();console.error(e?`[${r}] ${n}: ${JSON.stringify(e)}`:`[${r}] ${n}`)}}q.exports={SETTINGS_DIR:h,SETTINGS_FILE:N,DEFAULT_SETTINGS:W,loadSettings:kt,saveSettings:Yt,shouldCaptureTool:$t,debugLog:Gt}});var P=p((en,z)=>{async function Bt(){return new Promise((t,n)=>{let e="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{e+=r}),process.stdin.on("end",()=>{try{t(e.trim()?JSON.parse(e):{})}catch(r){n(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",n),process.stdin.isTTY&&t({})})}function y(t){console.log(JSON.stringify(t))}function Wt(t=null){y(t?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t}}:{continue:!0,suppressOutput:!0})}function qt(t){console.error(`LocalMind: ${t}`),y({continue:!0,suppressOutput:!0})}function zt(t,n){y({hookSpecificOutput:{hookEventName:t,additionalContext:n}})}z.exports={readStdin:Bt,writeOutput:y,outputSuccess:Wt,outputError:qt,outputWithContext:zt}});var C=p((nn,Q)=>{var Pt=require("better-sqlite3"),m=require("node:fs"),I=require("node:path"),Z=require("node:os"),D=I.join(Z.homedir(),".local-mind"),J=I.join(Z.homedir(),".local-memory"),K=I.join(D,"memory.db"),g=null;function Jt(t){m.existsSync(t)||m.mkdirSync(t,{recursive:!0,mode:448})}function Zt(){if(!m.existsSync(D)&&m.existsSync(J))try{m.renameSync(J,D)}catch{}}function Kt(t=K){if(g)return g;let n=t===":memory:";n||(Zt(),Jt(I.dirname(t)));let e=new Pt(t);if(e.pragma("journal_mode = WAL"),e.pragma("foreign_keys = ON"),e.pragma("busy_timeout = 5000"),V(e),!n)try{m.chmodSync(t,384)}catch{}return g=e,e}function V(t){t.exec(`
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
  `),Qt(t),Vt(t)}function Vt(t){let n=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let e of n)try{t.exec(e)}catch{}try{t.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let e=t.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();e&&e.sql&&!e.sql.includes("'gotcha'")&&t.transaction(()=>{t.exec(`
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
        `)})()}catch{}}function Qt(t){t.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||t.exec(`
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
  `)}function te(){g&&(g.close(),g=null)}Q.exports={getDb:Kt,closeDb:te,runMigrations:V,DEFAULT_DB_PATH:K,DEFAULT_DB_DIR:D}});var et=p((rn,tt)=>{var ee=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function ne(t,n=1e5){if(!t||typeof t!="string")return"";let e=t;for(let r of ee)e=e.replace(r,"");return e.length>n&&(e=e.slice(0,n)),e}function re(t,n=1,e=1e5){return t.length<n?{valid:!1,reason:`content below minimum length (${n})`}:t.length>e?{valid:!1,reason:`content exceeds maximum length (${e})`}:{valid:!0}}function se(t){return!t||typeof t!="string"?{valid:!1,reason:"tag is empty"}:t.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(t)?/^[-_]|[-_]$/.test(t)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function oe(t){if(!t||typeof t!="object")return{};let n={},e=0;for(let[r,s]of Object.entries(t)){if(e>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof s=="string"?(n[r]=s.slice(0,1024),e++):(typeof s=="number"&&Number.isFinite(s)||typeof s=="boolean")&&(n[r]=s,e++))}return n}tt.exports={sanitizeContent:ne,validateContentLength:re,validateContainerTag:se,sanitizeMetadata:oe}});var ot=p((sn,st)=>{function nt(t){if(!t)return .5;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?1:Math.exp(-.15*n)}function ie(t){if(!t||t.length===0)return[];let n=Math.max(...t.map(e=>Math.abs(e.rank||0)));return t.map(e=>{let r=n>0?Math.abs(e.rank||0)/n:0,s=nt(e.updated_at||e.created_at),o=r*.7+s*.3;return{...e,relevance:r,recency:s,score:o}}).sort((e,r)=>r.score-e.score)}function rt(t,n){if(!n)return t;let e=(Date.now()-new Date(n).getTime())/864e5;return e<0?t:t*Math.exp(-.1*e)}function ae(t,n){let r=t.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(n).filter(s=>rt(s.confidence,s.reinforced_at)<.3).map(s=>s.id);if(r.length>0){let s=r.map(()=>"?").join(",");t.prepare(`DELETE FROM profile_facts WHERE id IN (${s})`).run(...r)}return r.length}st.exports={recencyWeight:nt,scoredResults:ie,decayedConfidence:rt,pruneDecayedFacts:ae,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3}});var X=p((an,at)=>{var{getDb:ce,closeDb:on}=C(),{sanitizeContent:it,sanitizeMetadata:ue,validateContainerTag:le,validateContentLength:fe}=et(),{scoredResults:Ee,pruneDecayedFacts:de}=ot(),pe="claudecode_default",x=class{constructor(n,e){this.containerTag=n||pe,this.dbPath=e}_getDb(){return ce(this.dbPath)}async addMemory(n,e,r={},s=null){let o=this._getDb(),i=e||this.containerTag;le(i);let a=it(n);fe(a);let l=ue({source:"local-mind",...r}),E=l.project||null,c=l.type||"session_turn",f=JSON.stringify(l);if(s){let u=o.prepare("SELECT id FROM memories WHERE custom_id = ?").get(s);if(u)return o.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(a,i,E,c,f,s),{id:u.id,status:"updated",containerTag:i}}return{id:o.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a,i,E,c,l.session_id||null,s,f).lastInsertRowid,status:"created",containerTag:i}}async search(n,e,r={}){let s=this._getDb(),o=e||this.containerTag,i=r.limit||10,a=it(n).replace(/['"]/g,"").trim();if(!a)return{results:[],total:0};let l=a.split(/\s+/).filter(Boolean).map(E=>`"${E}"`).join(" OR ");try{let E=i*2,c=s.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(l,o,E),f=Ee(c);return{results:f.slice(0,i).map(u=>({id:u.id,memory:u.content,content:u.content,similarity:u.score,relevance:u.relevance,recency:u.recency,containerTag:u.container_tag,title:u.project_name,createdAt:u.created_at,updatedAt:u.updated_at})),total:f.length}}catch{return{results:[],total:0}}}async getProfile(n,e){let r=this._getDb(),s=n||this.containerTag,o=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(s).map(l=>l.fact_text),i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(s).map(l=>l.fact_text),a=e?await this.search(e,s,{limit:10}):{results:[],total:0};return{profile:{static:o,dynamic:i},searchResults:a.results.length>0?a:void 0}}async listMemories(n,e=20){let r=this._getDb(),s=n||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
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
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(s,e,s)}pruneDecayed(n){let e=this._getDb(),r=n||this.containerTag;return de(e,r)}};at.exports={LocalMindClient:x}});var dt=p((cn,Et)=>{var ct=require("node:fs"),_e=500,Te=["Read"],b=new Map;function ut(t){if(!ct.existsSync(t))return[];let e=ct.readFileSync(t,"utf-8").trim().split(`
`),r=[];for(let s of e)if(s.trim())try{r.push(JSON.parse(s))}catch{}return r}function lt(t,n){if(!n)return t.filter(s=>s.type==="user"||s.type==="assistant");let e=!1,r=[];for(let s of t){if(s.uuid===n){e=!0;continue}e&&(s.type==="user"||s.type==="assistant")&&r.push(s)}return r}function ft(t){let n=[];if(t.type==="user"){let e=me(t.message);e&&n.push(e)}else if(t.type==="assistant"){let e=ge(t.message);e&&n.push(e)}return n.join(`
`)}function me(t){if(!t?.content)return null;let n=t.content,e=[];if(typeof n=="string"){let r=S(n);r&&e.push(`[role:user]
${r}
[user:end]`)}else if(Array.isArray(n)){for(let r of n)if(r.type==="text"&&r.text){let s=S(r.text);s&&e.push(`[role:user]
${s}
[user:end]`)}else if(r.type==="tool_result"){let s=r.tool_use_id||"",o=b.get(s)||"Unknown";if(Te.includes(o))continue;let i=H(S(r.content||""),_e),a=r.is_error?"error":"success";i&&e.push(`[tool_result:${o} status="${a}"]
${i}
[tool_result:end]`)}}return e.length>0?e.join(`

`):null}function ge(t){if(!t?.content)return null;let n=t.content,e=[];if(!Array.isArray(n))return null;for(let r of n)if(r.type!=="thinking"){if(r.type==="text"&&r.text){let s=S(r.text);s&&e.push(`[role:assistant]
${s}
[assistant:end]`)}else if(r.type==="tool_use"){let s=r.name||"Unknown",o=r.id||"",i=r.input||{},a=Ne(i);e.push(`[tool:${s}]
${a}
[tool:end]`),o&&b.set(o,s)}}return e.length>0?e.join(`

`):null}function Ne(t){let n=[];for(let[e,r]of Object.entries(t)){let s=typeof r=="string"?r:JSON.stringify(r);s=H(s,200),n.push(`${e}: ${s}`)}return n.join(`
`)}function S(t){return!t||typeof t!="string"?"":t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").replace(/<local-mind-context>[\s\S]*?<\/local-mind-context>/g,"").replace(/<local-memory-context>[\s\S]*?<\/local-memory-context>/g,"").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/g,"").trim()}function H(t,n){return!t||t.length<=n?t:`${t.slice(0,n)}...`}function Le(t,n){b=new Map;let e=ut(t);if(e.length===0)return null;let r=lt(e,n);if(r.length===0)return null;let s=r[0],o=r[r.length-1],i=s.timestamp||new Date().toISOString(),a=[];a.push(`[turn:start timestamp="${i}"]`);for(let E of r){let c=ft(E);c&&a.push(c)}a.push("[turn:end]");let l=a.join(`

`);return l.length<100?null:{formatted:l,lastUuid:o.uuid}}Et.exports={parseTranscript:ut,getEntriesSinceLastCapture:lt,formatEntry:ft,formatNewEntries:Le,cleanContent:S,truncate:H}});var v=p((un,mt)=>{var A=require("node:fs"),{LocalMindClient:ye}=X(),{getContainerTag:Se,getProjectName:Ae}=M(),{formatNewEntries:Re}=dt(),{getDb:pt}=C(),{debugLog:Oe,loadSettings:he}=w();function _t(t){let e=pt().prepare("SELECT last_captured_uuid, last_byte_offset, container_tag, project_name FROM sessions WHERE session_id = ?").get(t);return e?{lastUuid:e.last_captured_uuid,lastByteOffset:e.last_byte_offset||0,containerTag:e.container_tag,projectName:e.project_name}:{lastUuid:null,lastByteOffset:0,containerTag:null,projectName:null}}function F(t,n,e,r,s){let o=pt();o.prepare("SELECT id FROM sessions WHERE session_id = ?").get(t)?o.prepare(`UPDATE sessions
       SET last_captured_uuid = ?, last_byte_offset = ?,
           ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE session_id = ?`).run(n,e,t):o.prepare(`INSERT INTO sessions (session_id, container_tag, project_name, last_captured_uuid, last_byte_offset)
       VALUES (?, ?, ?, ?, ?)`).run(t,r,s,n,e)}function Tt(t,n){if(!A.existsSync(t))return{entries:[],newOffset:n};let e=A.statSync(t),r=n;if(e.size<r&&(r=0),e.size===r)return{entries:[],newOffset:r};let s=A.openSync(t,"r"),o;try{o=Buffer.alloc(e.size-r),A.readSync(s,o,0,o.length,r)}finally{A.closeSync(s)}let i=o.toString("utf-8").split(`
`),a=[];for(let l of i)if(l.trim())try{a.push(JSON.parse(l))}catch{}return{entries:a,newOffset:e.size}}function De({sessionId:t,transcriptPath:n,cwd:e}){if(!n||!t)return{saved:!1,reason:"missing_params"};let r=he(),s=_t(t),o=s.containerTag||Se(e),i=s.projectName||Ae(e),{entries:a,newOffset:l}=Tt(n,s.lastByteOffset);if(a.length===0)return{saved:!1,reason:"no_new_entries"};let E=a.filter(d=>d.type==="user"||d.type==="assistant");if(E.length===0)return F(t,s.lastUuid,l,o,i),{saved:!1,reason:"no_user_assistant_entries"};let c=Re(n,s.lastUuid);return c?(new ye().addMemory(c.formatted,o,{type:"session_turn",project:i,timestamp:new Date().toISOString()},t),F(t,c.lastUuid,l,o,i),Oe(r,"Incremental save",{entries:E.length,bytes:l-s.lastByteOffset}),{saved:!0,entries:E.length,newOffset:l}):(F(t,s.lastUuid,l,o,i),{saved:!1,reason:"format_empty"})}mt.exports={readNewEntries:Tt,saveIncrementalTurns:De,getSessionTracking:_t,updateSessionTracking:F}});var Ot=p((ln,Rt)=>{var Ie=new Set(["que","para","com","nao","uma","por","mas","como","mais","quando","muito","isso","este","essa","dele","dela","aqui","onde","agora","voce","quero","pode","vamos","tudo","tambem","ainda","sobre","fazer","depois","antes","preciso","obrigado","sim","entao"]),Ce=new Set(["ls","cd","cat","head","tail","pwd","echo","clear","which","whoami"]);function Fe(t){let n=new Set,e=new Set,r=[],s=0,o=0,i=0,a="";for(let c of t)c.type==="user"?gt(c,{files:n,commands:e,errors:r,firstUserPrompt:a,onText:f=>{a||(a=f),s+=f.length;let d=f.toLowerCase().split(/\s+/).filter(Boolean);i+=d.length,o+=d.filter(u=>Ie.has(u)).length}}):c.type==="assistant"&&Nt(c,{files:n,commands:e,errors:r});let l=St(n,e,r,a),E=At(o,i);return{sessionFacts:l,userFacts:E}}function gt(t,n){let e=t.message?.content;if(e){if(typeof e=="string"){n.onText(e);return}if(Array.isArray(e)){for(let r of e)if(r.type==="text"&&r.text)n.onText(r.text);else if(r.type==="tool_result"&&r.is_error&&r.content){let s=typeof r.content=="string"?r.content:JSON.stringify(r.content);s.length>10&&n.errors.push(Ue(s))}}}}function Nt(t,n){let e=t.message?.content;if(Array.isArray(e))for(let r of e){if(r.type!=="tool_use")continue;let s=r.input||{},o=r.name||"";if((o==="Edit"||o==="Write")&&s.file_path&&n.files.add(Lt(s.file_path)),o==="Bash"&&s.command){let i=yt(s.command);i&&!Ce.has(i)&&n.commands.add(s.command.length>60?s.command.slice(0,60):s.command)}}}function Lt(t){return t?t.split("/").slice(-2).join("/"):"unknown"}function yt(t){if(!t||typeof t!="string")return"";let n=t.trim(),e=n.split(/\s+/)[0];return e?e.replace(/^(sudo|npx|bunx)$/,"")||n.split(/\s+/)[1]||e:""}function Ue(t){let n=t.split(`
`)[0].trim();return n.length>120?`${n.slice(0,120)}...`:n}function St(t,n,e,r){let s=[];if(t.size>0){let o=[...t].slice(0,10).join(", ");s.push(`files: ${o}`)}if(n.size>0){let o=[...n].slice(0,5).join(", ");s.push(`commands: ${o}`)}if(e.length>0){let o=e.slice(0,3).join("; ");s.push(`errors: ${o}`)}if(r){let o=r.length>120?`${r.slice(0,120)}...`:r;s.push(`summary: ${o}`)}return s}function At(t,n){let e=[];return n>10&&t/n>.15&&e.push("idioma: pt-br"),e}Rt.exports={extractFacts:Fe,extractFromUserEntry:gt,extractFromAssistantEntry:Nt,extractFileName:Lt,extractBaseCommand:yt,buildSessionFacts:St,buildUserFacts:At}});var Ct=p((fn,It)=>{function ht(t){return t?String(t).split(`
`)[0].trim().replace(/["'].*?["']/g,'"X"').replace(/`.*?`/g,"`X`").replace(/\d+/g,"N").substring(0,100):""}function Dt(t){let n=5381;for(let e=0;e<t.length;e++)n=(n<<5)+n+t.charCodeAt(e)>>>0;return n.toString(36)}var Me={build:["build","compile","esbuild","webpack","tsc","syntax error"],test:["test","vitest","jest","expect","assert","spec"],lint:["lint","eslint","biome","prettier","format"],runtime:["typeerror","referenceerror","rangeerror","syntaxerror","cannot read","undefined is not"],integration:["fetch","network","timeout","econnrefused","api"],security:["csrf","xss","injection","unauthorized","forbidden","cors"],database:["sqlite","postgres","sql","column","table","migration","constraint"]};function j(t){if(!t)return"general";let n=t.toLowerCase();for(let[e,r]of Object.entries(Me))if(r.some(s=>n.includes(s)))return e;return"general"}function we(t,n,e,r=null){let s=ht(e);if(!s)return;let o=Dt(s),i=j(e),a=t.prepare("SELECT * FROM gotchas_tracking WHERE container_tag = ? AND pattern_hash = ?").get(n,o);if(a){let l=JSON.parse(a.samples),E=String(e).split(`
`)[0].trim(),c=l.length<5&&!l.includes(E)?[...l,E]:l,f=JSON.parse(a.related_files),d=r&&!f.includes(r)?[...f,r]:f,u=a.count+1,_=u>=3&&!a.promoted;t.prepare(`UPDATE gotchas_tracking
       SET count = ?, samples = ?, related_files = ?, category = ?,
           last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`).run(u,JSON.stringify(c),JSON.stringify(d),i,a.id),_&&(t.prepare("UPDATE gotchas_tracking SET promoted = 1 WHERE id = ?").run(a.id),t.prepare(`INSERT OR IGNORE INTO profile_facts (container_tag, fact_type, fact_text, confidence)
         VALUES (?, 'gotcha', ?, 1.0)`).run(n,`[${i}] ${s} (seen ${u}x)`))}else{let l=String(e).split(`
`)[0].trim(),E=JSON.stringify([l]),c=r?JSON.stringify([r]):"[]";t.prepare(`INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, related_files)
       VALUES (?, ?, ?, ?, 1, ?, ?)`).run(n,o,s,i,E,c)}}function xe(t,n,e=""){let r=t.prepare(`SELECT * FROM gotchas_tracking
       WHERE container_tag = ? AND promoted = 1
       ORDER BY last_seen DESC`).all(n);if(r.length===0)return"";let s=j(e),i=(e||"").toLowerCase().split(/\s+/).filter(Boolean),a=r.map(c=>{let f=0;c.category===s&&s!=="general"&&(f+=3);for(let u of i)c.normalized_pattern.toLowerCase().includes(u)&&(f+=1);let d=JSON.parse(c.related_files);for(let u of i)d.some(_=>_.toLowerCase().includes(u))&&(f+=2);return{...c,score:f}});return a.sort((c,f)=>f.score-c.score),`## Known Gotchas
${a.slice(0,5).map(c=>{let f=JSON.parse(c.related_files),d=f.length>0?` (files: ${f.join(", ")})`:"";return`- **[Gotcha: ${c.category}]** ${c.normalized_pattern} \u2014 seen ${c.count}x${d}`}).join(`
`)}`}It.exports={normalizeErrorPattern:ht,djb2Hash:Dt,detectCategory:j,trackError:we,getRelevantGotchas:xe}});var Mt=p((En,Ut)=>{var Xe=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function Ft(t){if(!t)return null;let n=String(t).trim();return n?n.toLowerCase().replace(/\s+/g,"-"):null}function be(t,n,e,r,s){let o=Ft(r);if(!o)return;let i=t.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(n,e,o);i?t.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(i.invocation_count+1,s,i.id):t.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(n,e,o,s)}function He(t,n,e=10){return t.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(n,e)}function ve(t){return!t||t.length===0?"":`## Agent Usage
${t.map(e=>{let r=e.sessions_used===1?"session":"sessions";return`- **${e.agent_name}**: ${e.total_invocations}x (${e.sessions_used} ${r})`}).join(`
`)}`}Ut.exports={normalizeAgentName:Ft,trackAgentInvocation:be,getAgentStats:He,formatAgentStats:ve,KNOWN_AGENTS:Xe}});var{getContainerTag:je,getProjectName:ke,getUserContainerTag:Ye}=M(),{loadSettings:$e,debugLog:R}=w(),{readStdin:Ge,writeOutput:k}=P(),{saveIncrementalTurns:Be,getSessionTracking:We}=v(),{readNewEntries:qe}=v(),{extractFacts:ze}=Ot(),{trackError:Pe}=Ct(),{trackAgentInvocation:Je}=Mt(),{getDb:wt}=C(),{LocalMindClient:Ze}=X();async function Ke(){let t=$e();try{let n=await Ge(),e=n.cwd||process.cwd(),r=n.session_id,s=n.transcript_path;if(R(t,"Stop",{sessionId:r,transcriptPath:s}),!s||!r){R(t,"Missing transcript path or session id"),k({continue:!0});return}let o=Be({sessionId:r,transcriptPath:s,cwd:e});R(t,"Final save",o);let i=We(r),a=je(e),l=ke(e),{entries:E}=qe(s,0);if(E.length>0){let c=ze(E),f=new Ze;for(let u of c.sessionFacts)f.addProfileFact(a,"dynamic",u);f.pruneOldDynamicFacts(a,20);let d=c.sessionFacts.filter(u=>u.startsWith("errors:"));for(let u of d){let _=u.replace("errors: ","").split("; ");for(let T of _)T.trim()&&Pe(wt(),a,T.trim())}if(c.userFacts.length>0){let u=Ye();for(let _ of c.userFacts)f.addProfileFact(u,"static",_)}for(let u of E){if(u.type!=="assistant")continue;let _=u.message?.content;if(Array.isArray(_)){for(let T of _)if(T.type==="tool_use"&&T.name==="Task"){let Y=T.input?.subagent_type;Y&&Je(wt(),a,r,Y,(T.input?.description||"").slice(0,200)||null)}}}R(t,"Facts extracted",{session:c.sessionFacts.length,user:c.userFacts.length})}k({continue:!0})}catch(n){R(t,"Error",{error:n.message}),console.error(`LocalMind: ${n.message}`),k({continue:!0})}}Ke().catch(t=>{console.error(`LocalMind fatal: ${t.message}`),process.exit(1)});
