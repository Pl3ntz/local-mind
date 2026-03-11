#!/usr/bin/env node
var m=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var R=m((Ft,Y)=>{var Se=require("better-sqlite3"),p=require("node:fs"),D=require("node:path"),H=require("node:os"),O=D.join(H.homedir(),".local-mind"),b=D.join(H.homedir(),".local-memory"),k=D.join(O,"memory.db"),g=null;function he(e){p.existsSync(e)||p.mkdirSync(e,{recursive:!0,mode:448})}function Oe(){if(!p.existsSync(O)&&p.existsSync(b))try{p.renameSync(b,O)}catch{}}function De(e=k){if(g)return g;let t=e===":memory:";t||(Oe(),he(D.dirname(e)));let n=new Se(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),v(n),!t)try{p.chmodSync(e,384)}catch{}return g=n,n}function v(e){e.exec(`
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
  `),Ie(e),ye(e)}function ye(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function Ie(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='memories_ai'").get()||e.exec(`
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
  `)}function Ce(){g&&(g.close(),g=null)}Y.exports={getDb:De,closeDb:Ce,runMigrations:v,DEFAULT_DB_PATH:k,DEFAULT_DB_DIR:O}});var $=m((Ut,G)=>{var Me=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function Fe(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let r of Me)n=n.replace(r,"");return n.length>t&&(n=n.slice(0,t)),n}function Ue(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function xe(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function we(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[r,o]of Object.entries(e)){if(n>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof o=="string"?(t[r]=o.slice(0,1024),n++):(typeof o=="number"&&Number.isFinite(o)||typeof o=="boolean")&&(t[r]=o,n++))}return t}G.exports={sanitizeContent:Fe,validateContentLength:Ue,validateContainerTag:xe,sanitizeMetadata:we}});var q=m((xt,P)=>{function B(e){if(!e)return .5;let t=(Date.now()-new Date(e).getTime())/864e5;return t<0?1:Math.exp(-.15*t)}function Xe(e){if(!e||e.length===0)return[];let t=Math.max(...e.map(n=>Math.abs(n.rank||0)));return e.map(n=>{let r=t>0?Math.abs(n.rank||0)/t:0,o=B(n.updated_at||n.created_at),i=r*.7+o*.3;return{...n,relevance:r,recency:o,score:i}}).sort((n,r)=>r.score-n.score)}function j(e,t){if(!t)return e;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?e:e*Math.exp(-.1*n)}function be(e,t){let r=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(t).filter(o=>j(o.confidence,o.reinforced_at)<.3).map(o=>o.id);if(r.length>0){let o=r.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${o})`).run(...r)}return r.length}P.exports={recencyWeight:B,scoredResults:Xe,decayedConfidence:j,pruneDecayedFacts:be,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3}});var K=m((Xt,z)=>{var{getDb:He,closeDb:wt}=R(),{sanitizeContent:W,sanitizeMetadata:ke,validateContainerTag:ve,validateContentLength:Ye}=$(),{scoredResults:Ge,pruneDecayedFacts:$e}=q(),Be="claudecode_default",F=class{constructor(t,n){this.containerTag=t||Be,this.dbPath=n}_getDb(){return He(this.dbPath)}async addMemory(t,n,r={},o=null){let i=this._getDb(),a=n||this.containerTag;ve(a);let s=W(t);Ye(s);let l=ke({source:"local-mind",...r}),d=l.project||null,u=l.type||"session_turn",c=JSON.stringify(l);if(o){let E=i.prepare("SELECT id FROM memories WHERE custom_id = ?").get(o);if(E)return i.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(s,a,d,u,c,o),{id:E.id,status:"updated",containerTag:a}}return{id:i.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(s,a,d,u,l.session_id||null,o,c).lastInsertRowid,status:"created",containerTag:a}}async search(t,n,r={}){let o=this._getDb(),i=n||this.containerTag,a=r.limit||10,s=W(t).replace(/['"]/g,"").trim();if(!s)return{results:[],total:0};let l=s.split(/\s+/).filter(Boolean).map(d=>`"${d}"`).join(" OR ");try{let d=a*2,u=o.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(l,i,d),c=Ge(u);return{results:c.slice(0,a).map(E=>({id:E.id,memory:E.content,content:E.content,similarity:E.score,relevance:E.relevance,recency:E.recency,containerTag:E.container_tag,title:E.project_name,createdAt:E.created_at,updatedAt:E.updated_at})),total:c.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let r=this._getDb(),o=t||this.containerTag,i=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(o).map(l=>l.fact_text),a=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(o).map(l=>l.fact_text),s=n?await this.search(n,o,{limit:10}):{results:[],total:0};return{profile:{static:i,dynamic:a},searchResults:s.results.length>0?s:void 0}}async listMemories(t,n=20){let r=this._getDb(),o=t||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(o,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}addProfileFact(t,n,r,o=1){let i=this._getDb(),a=t||this.containerTag;i.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(a,n,r,o)}pruneOldDynamicFacts(t,n=20){let r=this._getDb(),o=t||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(o,n,o)}pruneDecayed(t){let n=this._getDb(),r=t||this.containerTag;return $e(n,r)}};z.exports={LocalMindClient:F}});var V=m((bt,Z)=>{var{execSync:J}=require("node:child_process"),je=require("node:crypto");function y(e){return je.createHash("sha256").update(e).digest("hex").slice(0,16)}function U(e){try{return J("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Pe(e){let n=U(e)||e;return`claudecode_project_${y(n)}`}function qe(e){return(U(e)||e).split("/").pop()||"unknown"}function We(){try{let t=J("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${y(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${y(e)}`}Z.exports={sha256:y,getGitRoot:U,getContainerTag:Pe,getProjectName:qe,getUserContainerTag:We}});var ne=m((Ht,te)=>{var A=require("node:fs"),Q=require("node:path"),ze=require("node:os"),I=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||Q.join(ze.homedir(),".local-mind"),L=Q.join(I,"settings.json"),ee={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function Ke(){A.existsSync(I)||A.mkdirSync(I,{recursive:!0,mode:448})}function Je(){let e={...ee};try{if(A.existsSync(L)){let n=A.readFileSync(L,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${L}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function Ze(e){Ke();let t={...e};A.writeFileSync(L,JSON.stringify(t,null,2),{mode:384})}function Ve(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function Qe(e,t,n){if(e.debug){let r=new Date().toISOString();console.error(n?`[${r}] ${t}: ${JSON.stringify(n)}`:`[${r}] ${t}`)}}te.exports={SETTINGS_DIR:I,SETTINGS_FILE:L,DEFAULT_SETTINGS:ee,loadSettings:Je,saveSettings:Ze,shouldCaptureTool:Ve,debugLog:Qe}});var oe=m((kt,re)=>{async function et(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{n+=r}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(r){t(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function S(e){console.log(JSON.stringify(e))}function tt(e=null){S(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function nt(e){console.error(`LocalMind: ${e}`),S({continue:!0,suppressOutput:!0})}function rt(e,t){S({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}re.exports={readStdin:et,writeOutput:S,outputSuccess:tt,outputError:nt,outputWithContext:rt}});var ce=m((vt,ae)=>{function se(e){try{let t=new Date(e),n=new Date,r=(n.getTime()-t.getTime())/1e3,o=r/60,i=r/3600,a=r/86400;if(o<30)return"just now";if(o<60)return`${Math.floor(o)}mins ago`;if(i<24)return`${Math.floor(i)}hrs ago`;if(a<7)return`${Math.floor(a)}d ago`;let s=t.toLocaleString("en",{month:"short"});return t.getFullYear()===n.getFullYear()?`${t.getDate()} ${s}`:`${t.getDate()} ${s}, ${t.getFullYear()}`}catch{return""}}function ie(e,t,n){let r=new Set,o=e.filter(s=>r.has(s)?!1:(r.add(s),!0)),i=t.filter(s=>r.has(s)?!1:(r.add(s),!0)),a=n.filter(s=>{let l=s.memory??"";return!l||r.has(l)?!1:(r.add(l),!0)});return{static:o,dynamic:i,searchResults:a}}function ot(e,t=!0,n=!1,r=10){if(!e)return null;let o=e.profile?.static||[],i=e.profile?.dynamic||[],a=e.searchResults?.results||[],s=ie(t?o:[],t?i:[],n?a:[]),l=s.static.slice(0,r),d=s.dynamic.slice(0,r),u=s.searchResults.slice(0,r);if(l.length===0&&d.length===0&&u.length===0)return null;let c=[];if(l.length>0&&c.push(`## User Profile (Persistent)
`+l.map(T=>`- ${T}`).join(`
`)),d.length>0&&c.push(`## Recent Context
`+d.map(T=>`- ${T}`).join(`
`)),u.length>0){let C=u.map(N=>{let M=N.memory??"",Le=M.length>500?`${M.slice(0,500)}...`:M,X=N.updatedAt?se(N.updatedAt):"",Ae=N.similarity!=null?`[${N.similarity.toFixed(2)}]`:"";return`- ${X?`[${X}] `:""}${Le} ${Ae}`.trim()});c.push(`## Relevant Memories (scored)
`+C.join(`
`))}return`<local-mind-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${c.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-mind-context>`}ae.exports={formatContext:ot,formatRelativeTime:se,deduplicateMemories:ie}});var le=m((Yt,Ee)=>{var st=require("node:fs"),_={FRESH:{minPct:60,maxResults:3,includeGotchas:!1,includeSearch:!1},MODERATE:{minPct:30,maxResults:8,includeGotchas:!0,includeSearch:!0},DEPLETED:{minPct:10,maxResults:12,includeGotchas:!0,includeSearch:!0},CRITICAL:{minPct:0,maxResults:15,includeGotchas:!0,includeSearch:!0}},it=250,at=2e5;function ct(e){if(!e||typeof e!="string")return{..._.MODERATE,bracket:"MODERATE"};try{let r=st.statSync(e).size/1024*it,o=Math.max(0,100-r/at*100);return o>=60?{..._.FRESH,bracket:"FRESH"}:o>=30?{..._.MODERATE,bracket:"MODERATE"}:o>=10?{..._.DEPLETED,bracket:"DEPLETED"}:{..._.CRITICAL,bracket:"CRITICAL"}}catch{return{..._.MODERATE,bracket:"MODERATE"}}}Ee.exports={estimateContextBracket:ct,BRACKETS:_}});var Te=m((Gt,fe)=>{function ue(e){return e?String(e).split(`
`)[0].trim().replace(/["'].*?["']/g,'"X"').replace(/`.*?`/g,"`X`").replace(/\d+/g,"N").substring(0,100):""}function de(e){let t=5381;for(let n=0;n<e.length;n++)t=(t<<5)+t+e.charCodeAt(n)>>>0;return t.toString(36)}var Et={build:["build","compile","esbuild","webpack","tsc","syntax error"],test:["test","vitest","jest","expect","assert","spec"],lint:["lint","eslint","biome","prettier","format"],runtime:["typeerror","referenceerror","rangeerror","syntaxerror","cannot read","undefined is not"],integration:["fetch","network","timeout","econnrefused","api"],security:["csrf","xss","injection","unauthorized","forbidden","cors"],database:["sqlite","postgres","sql","column","table","migration","constraint"]};function x(e){if(!e)return"general";let t=e.toLowerCase();for(let[n,r]of Object.entries(Et))if(r.some(o=>t.includes(o)))return n;return"general"}function lt(e,t,n,r=null){let o=ue(n);if(!o)return;let i=de(o),a=x(n),s=e.prepare("SELECT * FROM gotchas_tracking WHERE container_tag = ? AND pattern_hash = ?").get(t,i);if(s){let l=JSON.parse(s.samples),d=String(n).split(`
`)[0].trim(),u=l.length<5&&!l.includes(d)?[...l,d]:l,c=JSON.parse(s.related_files),f=r&&!c.includes(r)?[...c,r]:c,E=s.count+1,T=E>=3&&!s.promoted;e.prepare(`UPDATE gotchas_tracking
       SET count = ?, samples = ?, related_files = ?, category = ?,
           last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`).run(E,JSON.stringify(u),JSON.stringify(f),a,s.id),T&&(e.prepare("UPDATE gotchas_tracking SET promoted = 1 WHERE id = ?").run(s.id),e.prepare(`INSERT OR IGNORE INTO profile_facts (container_tag, fact_type, fact_text, confidence)
         VALUES (?, 'gotcha', ?, 1.0)`).run(t,`[${a}] ${o} (seen ${E}x)`))}else{let l=String(n).split(`
`)[0].trim(),d=JSON.stringify([l]),u=r?JSON.stringify([r]):"[]";e.prepare(`INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, related_files)
       VALUES (?, ?, ?, ?, 1, ?, ?)`).run(t,i,o,a,d,u)}}function ut(e,t,n=""){let r=e.prepare(`SELECT * FROM gotchas_tracking
       WHERE container_tag = ? AND promoted = 1
       ORDER BY last_seen DESC`).all(t);if(r.length===0)return"";let o=x(n),a=(n||"").toLowerCase().split(/\s+/).filter(Boolean),s=r.map(u=>{let c=0;u.category===o&&o!=="general"&&(c+=3);for(let E of a)u.normalized_pattern.toLowerCase().includes(E)&&(c+=1);let f=JSON.parse(u.related_files);for(let E of a)f.some(T=>T.toLowerCase().includes(E))&&(c+=2);return{...u,score:c}});return s.sort((u,c)=>c.score-u.score),`## Known Gotchas
${s.slice(0,5).map(u=>{let c=JSON.parse(u.related_files),f=c.length>0?` (files: ${c.join(", ")})`:"";return`- **[Gotcha: ${u.category}]** ${u.normalized_pattern} \u2014 seen ${u.count}x${f}`}).join(`
`)}`}fe.exports={normalizeErrorPattern:ue,djb2Hash:de,detectCategory:x,trackError:lt,getRelevantGotchas:ut}});var pe=m(($t,_e)=>{var dt=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function me(e){if(!e)return null;let t=String(e).trim();return t?t.toLowerCase().replace(/\s+/g,"-"):null}function ft(e,t,n,r,o){let i=me(r);if(!i)return;let a=e.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(t,n,i);a?e.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(a.invocation_count+1,o,a.id):e.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(t,n,i,o)}function Tt(e,t,n=10){return e.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(t,n)}function mt(e){return!e||e.length===0?"":`## Agent Usage
${e.map(n=>{let r=n.sessions_used===1?"session":"sessions";return`- **${n.agent_name}**: ${n.total_invocations}x (${n.sessions_used} ${r})`}).join(`
`)}`}_e.exports={normalizeAgentName:me,trackAgentInvocation:ft,getAgentStats:Tt,formatAgentStats:mt,KNOWN_AGENTS:dt}});var{execSync:ge}=require("node:child_process"),_t=require("node:path"),{LocalMindClient:pt}=K(),{getContainerTag:gt,getProjectName:Nt,getUserContainerTag:Rt}=V(),{loadSettings:Lt,debugLog:h}=ne(),{readStdin:At,writeOutput:w}=oe(),{formatContext:St}=ce(),{estimateContextBracket:ht}=le(),{getRelevantGotchas:Ot}=Te(),{getAgentStats:Dt,formatAgentStats:yt}=pe();function Ne(e,t){let n=[t];if(!e||!_t.isAbsolute(e))return n.join(" ");try{let r=ge("git branch --show-current",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();r&&!["main","master"].includes(r)&&n.push(r)}catch{}try{let r=ge("git diff --name-only HEAD~3 HEAD 2>/dev/null | head -5",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:3e3}).trim();if(r){let o=r.split(`
`).map(i=>i.split("/").pop()).filter(Boolean);n.push(...o)}}catch{}return n.join(" ")}function Re(){try{let{getDb:e}=R(),t=e(),n=Rt();return t.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY reinforced_at DESC LIMIT 5`).all(n).map(r=>r.fact_text)}catch{return[]}}async function It(){let e=Lt();try{let t=await At(),n=t.cwd||process.cwd(),r=gt(n),o=Nt(n);h(e,"SessionStart",{cwd:n,containerTag:r,projectName:o});let i=Ne(n,o);h(e,"Contextual query",{query:i});let s=await new pt(r).getProfile(r,i).catch(()=>null);if(s){let f=Re();if(f.length>0){let E=new Set(s.profile.static),T=f.filter(C=>!E.has(C));s.profile.static=[...T,...s.profile.static]}}let l=t.transcript_path,d=ht(l);h(e,"Context bracket",{bracket:d.bracket,maxResults:d.maxResults});let u=St(s,e.injectProfile,d.includeSearch,d.maxResults);if(!u){w({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-mind-context>
No previous memories found for this project.
Memories will be saved as you work.
</local-mind-context>`}});return}let c=u;if(d.includeGotchas)try{let{getDb:f}=R(),E=Ot(f(),r,i);E&&(c=c.replace("</local-mind-context>",`
${E}
</local-mind-context>`))}catch{}if(d.includeGotchas)try{let{getDb:f}=R(),E=Dt(f(),r,8),T=yt(E);T&&(c=c.replace("</local-mind-context>",`
${T}
</local-mind-context>`))}catch{}h(e,"Context generated",{length:c.length,bracket:d.bracket}),w({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:c}})}catch(t){h(e,"Error",{error:t.message}),console.error(`LocalMind: ${t.message}`),w({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-mind-status>
Failed to load memories. Session will continue without memory context.
</local-mind-status>`}})}}module.exports={buildContextualQuery:Ne,getUserFacts:Re};It().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
