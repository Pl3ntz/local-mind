#!/usr/bin/env node
var _=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var L=_((Gt,v)=>{var Oe=require("better-sqlite3"),g=require("node:fs"),D=require("node:path"),G=require("node:os"),I=D.join(G.homedir(),".local-mind"),H=D.join(G.homedir(),".local-memory"),b=D.join(I,"memory.db"),p=null;function Ie(e){g.existsSync(e)||g.mkdirSync(e,{recursive:!0,mode:448})}function De(){if(!g.existsSync(I)&&g.existsSync(H))try{g.renameSync(H,I)}catch{}}function he(e=b){if(p)return p;let t=e===":memory:";t||(De(),Ie(D.dirname(e)));let n=new Oe(e);if(n.pragma("journal_mode = WAL"),n.pragma("foreign_keys = ON"),n.pragma("busy_timeout = 5000"),Y(n),!t)try{g.chmodSync(e,384)}catch{}return p=n,n}function Y(e){e.exec(`
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
  `),Me(e),Ce(e),ye(e)}function ye(e){let t=["ALTER TABLE sessions ADD COLUMN last_byte_offset INTEGER DEFAULT 0","ALTER TABLE profile_facts ADD COLUMN confidence REAL DEFAULT 1.0","ALTER TABLE profile_facts ADD COLUMN reinforced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"];for(let n of t)try{e.exec(n)}catch{}try{e.exec("CREATE INDEX IF NOT EXISTS idx_profile_reinforced ON profile_facts(container_tag, reinforced_at)")}catch{}try{let n=e.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='profile_facts'").get();n&&n.sql&&!n.sql.includes("'gotcha'")&&e.transaction(()=>{e.exec(`
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
        `)})()}catch{}}function Ce(e){e.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='findings_ai'").get()||e.exec(`
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
  `)}function Ue(){p&&(p.close(),p=null)}v.exports={getDb:he,closeDb:Ue,runMigrations:Y,DEFAULT_DB_PATH:b,DEFAULT_DB_DIR:I}});var B=_((bt,k)=>{var Fe=[/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,/\uFEFF/g,/[\uFFF0-\uFFFF]/g];function xe(e,t=1e5){if(!e||typeof e!="string")return"";let n=e;for(let r of Fe)n=n.replace(r,"");return n.length>t&&(n=n.slice(0,t)),n}function Xe(e,t=1,n=1e5){return e.length<t?{valid:!1,reason:`content below minimum length (${t})`}:e.length>n?{valid:!1,reason:`content exceeds maximum length (${n})`}:{valid:!0}}function we(e){return!e||typeof e!="string"?{valid:!1,reason:"tag is empty"}:e.length>100?{valid:!1,reason:"tag exceeds 100 characters"}:/^[a-zA-Z0-9_-]+$/.test(e)?/^[-_]|[-_]$/.test(e)?{valid:!1,reason:"tag must not start or end with - or _"}:{valid:!0}:{valid:!1,reason:"tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)"}}function He(e){if(!e||typeof e!="object")return{};let t={},n=0;for(let[r,i]of Object.entries(e)){if(n>=50)break;r.length>128||/[^\w.-]/.test(r)||(typeof i=="string"?(t[r]=i.slice(0,1024),n++):(typeof i=="number"&&Number.isFinite(i)||typeof i=="boolean")&&(t[r]=i,n++))}return t}k.exports={sanitizeContent:xe,validateContentLength:Xe,validateContainerTag:we,sanitizeMetadata:He}});var W=_((Yt,q)=>{function $(e){if(!e)return .5;let t=(Date.now()-new Date(e).getTime())/864e5;return t<0?1:Math.exp(-.15*t)}function Ge(e){if(!e||e.length===0)return[];let t=Math.max(...e.map(n=>Math.abs(n.rank||0)));return e.map(n=>{let r=t>0?Math.abs(n.rank||0)/t:0,i=$(n.updated_at||n.created_at),s=r*.7+i*.3;return{...n,relevance:r,recency:i,score:s}}).sort((n,r)=>r.score-n.score)}function j(e,t){if(!t)return e;let n=(Date.now()-new Date(t).getTime())/864e5;return n<0?e:e*Math.exp(-.1*n)}function be(e,t){let r=e.prepare("SELECT id, confidence, reinforced_at FROM profile_facts WHERE container_tag = ?").all(t).filter(i=>j(i.confidence,i.reinforced_at)<.3).map(i=>i.id);if(r.length>0){let i=r.map(()=>"?").join(",");e.prepare(`DELETE FROM profile_facts WHERE id IN (${i})`).run(...r)}return r.length}var P={CRITICAL:.02,HIGH:.05,MEDIUM:.1,LOW:.15,INFO:.2};function Ye(e,t,n){if(!t)return e;let r=(Date.now()-new Date(t).getTime())/864e5;if(r<0)return e;let i=P[n]||.1;return e*Math.exp(-i*r)}function ve(e){return 1+.1*Math.min(e||0,5)}q.exports={recencyWeight:$,scoredResults:Ge,decayedConfidence:j,pruneDecayedFacts:be,findingDecayedConfidence:Ye,recallBoost:ve,DECAY_LAMBDA:.15,FACT_DECAY_LAMBDA:.1,BM25_WEIGHT:.7,RECENCY_WEIGHT:.3,CONFIDENCE_PRUNE_THRESHOLD:.3,FINDING_DECAY_BY_SEVERITY:P}});var Z=_((kt,z)=>{var{getDb:ke,closeDb:vt}=L(),{sanitizeContent:K,sanitizeMetadata:Be,validateContainerTag:$e,validateContentLength:je}=B(),{scoredResults:Pe,pruneDecayedFacts:qe,decayedConfidence:We,CONFIDENCE_PRUNE_THRESHOLD:Ke}=W(),ze="claudecode_default",U=class{constructor(t,n){this.containerTag=t||ze,this.dbPath=n}_getDb(){return ke(this.dbPath)}async addMemory(t,n,r={},i=null){let s=this._getDb(),a=n||this.containerTag;$e(a);let o=K(t);je(o);let c=Be({source:"local-mind",...r}),l=c.project||null,d=c.type||"session_turn",E=JSON.stringify(c);if(i){let T=s.prepare("SELECT id FROM memories WHERE custom_id = ?").get(i);if(T)return s.prepare(`UPDATE memories
           SET content = ?, container_tag = ?, project_name = ?,
               memory_type = ?, metadata = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE custom_id = ?`).run(o,a,l,d,E,i),{id:T.id,status:"updated",containerTag:a}}return{id:s.prepare(`INSERT INTO memories (content, container_tag, project_name, memory_type, session_id, custom_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(o,a,l,d,c.session_id||null,i,E).lastInsertRowid,status:"created",containerTag:a}}async search(t,n,r={}){let i=this._getDb(),s=n||this.containerTag,a=r.limit||10,o=K(t).replace(/['"]/g,"").trim();if(!o)return{results:[],total:0};let c=o.split(/\s+/).filter(Boolean).map(l=>`"${l}"`).join(" OR ");try{let l=a*2,d=i.prepare(`SELECT m.id, m.content, m.container_tag, m.project_name,
                  m.metadata, m.created_at, m.updated_at, rank
           FROM memories_fts f
           JOIN memories m ON m.id = f.rowid
           WHERE memories_fts MATCH ?
             AND m.container_tag = ?
           ORDER BY rank
           LIMIT ?`).all(c,s,l),E=Pe(d);return{results:E.slice(0,a).map(T=>({id:T.id,memory:T.content,content:T.content,similarity:T.score,relevance:T.relevance,recency:T.recency,containerTag:T.container_tag,title:T.project_name,createdAt:T.created_at,updatedAt:T.updated_at})),total:E.length}}catch{return{results:[],total:0}}}async getProfile(t,n){let r=this._getDb(),i=t||this.containerTag,s=r.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY updated_at DESC`).all(i).map(c=>c.fact_text),a=r.prepare(`SELECT fact_text, confidence, reinforced_at FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'dynamic'
         ORDER BY updated_at DESC`).all(i).filter(c=>We(c.confidence,c.reinforced_at)>=Ke).map(c=>c.fact_text),o=n?await this.search(n,i,{limit:10}):{results:[],total:0};return{profile:{static:s,dynamic:a},searchResults:o.results.length>0?o:void 0}}async listMemories(t,n=20){let r=this._getDb(),i=t||this.containerTag;return{memories:r.prepare(`SELECT * FROM memories
         WHERE container_tag = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`).all(i,n)}}async deleteMemory(t){this._getDb().prepare("DELETE FROM memories WHERE id = ?").run(t)}addProfileFact(t,n,r,i=1){let s=this._getDb(),a=t||this.containerTag;s.prepare(`INSERT INTO profile_facts (container_tag, fact_type, fact_text, confidence, reinforced_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(container_tag, fact_type, fact_text)
       DO UPDATE SET
         confidence = MIN(confidence + 0.2, 1.0),
         reinforced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`).run(a,n,r,i)}pruneOldDynamicFacts(t,n=20){let r=this._getDb(),i=t||this.containerTag;r.prepare(`DELETE FROM profile_facts WHERE id NOT IN (
        SELECT id FROM profile_facts
        WHERE container_tag = ? AND fact_type = 'dynamic'
        ORDER BY reinforced_at DESC LIMIT ?
      ) AND container_tag = ? AND fact_type = 'dynamic'`).run(i,n,i)}pruneDecayed(t){let n=this._getDb(),r=t||this.containerTag;return qe(n,r)}};z.exports={LocalMindClient:U}});var Q=_((Bt,V)=>{var{execSync:J}=require("node:child_process"),Ze=require("node:crypto");function h(e){return Ze.createHash("sha256").update(e).digest("hex").slice(0,16)}function F(e){try{return J("git rev-parse --show-toplevel",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim()||null}catch{return null}}function Je(e){let n=F(e)||e;return`claudecode_project_${h(n)}`}function Ve(e){return(F(e)||e).split("/").pop()||"unknown"}function Qe(){try{let t=J("git config user.email",{encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();if(t)return`claudecode_user_${h(t)}`}catch{}let e=process.env.USER||process.env.USERNAME||"anonymous";return`claudecode_user_${h(e)}`}V.exports={sha256:h,getGitRoot:F,getContainerTag:Je,getProjectName:Ve,getUserContainerTag:Qe}});var re=_(($t,ne)=>{var A=require("node:fs"),ee=require("node:path"),et=require("node:os"),y=process.env.LOCAL_MIND_DIR||process.env.LOCAL_MEMORY_DIR||ee.join(et.homedir(),".local-mind"),R=ee.join(y,"settings.json"),te={skipTools:["Read","Glob","Grep","TodoWrite","AskUserQuestion"],captureTools:["Edit","Write","Bash","Task"],maxProfileItems:5,debug:!1,injectProfile:!0};function tt(){A.existsSync(y)||A.mkdirSync(y,{recursive:!0,mode:448})}function nt(){let e={...te};try{if(A.existsSync(R)){let n=A.readFileSync(R,"utf-8");e={...e,...JSON.parse(n)}}}catch(n){console.error(`Settings: Failed to load ${R}: ${n.message}`)}let t=process.env.LOCAL_MIND_SKIP_TOOLS||process.env.LOCAL_MEMORY_SKIP_TOOLS;return t&&(e={...e,skipTools:t.split(",").map(n=>n.trim())}),(process.env.LOCAL_MIND_DEBUG==="true"||process.env.LOCAL_MEMORY_DEBUG==="true")&&(e={...e,debug:!0}),e}function rt(e){tt();let t={...e};A.writeFileSync(R,JSON.stringify(t,null,2),{mode:384})}function it(e,t){return t.skipTools.includes(e)?!1:t.captureTools&&t.captureTools.length>0?t.captureTools.includes(e):!0}function ot(e,t,n){if(e.debug){let r=new Date().toISOString();console.error(n?`[${r}] ${t}: ${JSON.stringify(n)}`:`[${r}] ${t}`)}}ne.exports={SETTINGS_DIR:y,SETTINGS_FILE:R,DEFAULT_SETTINGS:te,loadSettings:nt,saveSettings:rt,shouldCaptureTool:it,debugLog:ot}});var oe=_((jt,ie)=>{async function st(){return new Promise((e,t)=>{let n="";process.stdin.setEncoding("utf8"),process.stdin.on("data",r=>{n+=r}),process.stdin.on("end",()=>{try{e(n.trim()?JSON.parse(n):{})}catch(r){t(new Error(`Failed to parse stdin JSON: ${r.message}`))}}),process.stdin.on("error",t),process.stdin.isTTY&&e({})})}function S(e){console.log(JSON.stringify(e))}function at(e=null){S(e?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:e}}:{continue:!0,suppressOutput:!0})}function ct(e){console.error(`LocalMind: ${e}`),S({continue:!0,suppressOutput:!0})}function Et(e,t){S({hookSpecificOutput:{hookEventName:e,additionalContext:t}})}ie.exports={readStdin:st,writeOutput:S,outputSuccess:at,outputError:ct,outputWithContext:Et}});var Ee=_((Pt,ce)=>{function se(e){try{let t=new Date(e),n=new Date,r=(n.getTime()-t.getTime())/1e3,i=r/60,s=r/3600,a=r/86400;if(i<30)return"just now";if(i<60)return`${Math.floor(i)}mins ago`;if(s<24)return`${Math.floor(s)}hrs ago`;if(a<7)return`${Math.floor(a)}d ago`;let o=t.toLocaleString("en",{month:"short"});return t.getFullYear()===n.getFullYear()?`${t.getDate()} ${o}`:`${t.getDate()} ${o}, ${t.getFullYear()}`}catch{return""}}function ae(e,t,n){let r=new Set,i=e.filter(o=>r.has(o)?!1:(r.add(o),!0)),s=t.filter(o=>r.has(o)?!1:(r.add(o),!0)),a=n.filter(o=>{let c=o.memory??"";return!c||r.has(c)?!1:(r.add(c),!0)});return{static:i,dynamic:s,searchResults:a}}function Tt(e,t=!0,n=!1,r=10){if(!e)return null;let i=e.profile?.static||[],s=e.profile?.dynamic||[],a=e.searchResults?.results||[],o=ae(t?i:[],t?s:[],n?a:[]),c=o.static.slice(0,r),l=o.dynamic.slice(0,r),d=o.searchResults.slice(0,r);if(c.length===0&&l.length===0&&d.length===0)return null;let E=[];if(c.length>0&&E.push(`## User Profile (Persistent)
`+c.map(f=>`- ${f}`).join(`
`)),l.length>0&&E.push(`## Recent Context
`+l.map(f=>`- ${f}`).join(`
`)),d.length>0){let C=d.map(N=>{let M=N.memory??"",Ae=M.length>500?`${M.slice(0,500)}...`:M,w=N.updatedAt?se(N.updatedAt):"",Se=N.similarity!=null?`[${N.similarity.toFixed(2)}]`:"";return`- ${w?`[${w}] `:""}${Ae} ${Se}`.trim()});E.push(`## Relevant Memories (scored)
`+C.join(`
`))}return`<local-mind-context>
The following is recalled context about the user. Reference it only when relevant to the conversation.

${E.join(`

`)}

Use these memories naturally when relevant \u2014 including indirect connections \u2014 but don't force them into every response or make assumptions beyond what's stated.
</local-mind-context>`}ce.exports={formatContext:Tt,formatRelativeTime:se,deduplicateMemories:ae}});var de=_((qt,Te)=>{var dt=require("node:fs"),m={FRESH:{minPct:60,maxResults:3,includeGotchas:!1,includeSearch:!1},MODERATE:{minPct:30,maxResults:8,includeGotchas:!0,includeSearch:!0},DEPLETED:{minPct:10,maxResults:12,includeGotchas:!0,includeSearch:!0},CRITICAL:{minPct:0,maxResults:15,includeGotchas:!0,includeSearch:!0}},lt=250,ut=2e5;function ft(e){if(!e||typeof e!="string")return{...m.MODERATE,bracket:"MODERATE"};try{let r=dt.statSync(e).size/1024*lt,i=Math.max(0,100-r/ut*100);return i>=60?{...m.FRESH,bracket:"FRESH"}:i>=30?{...m.MODERATE,bracket:"MODERATE"}:i>=10?{...m.DEPLETED,bracket:"DEPLETED"}:{...m.CRITICAL,bracket:"CRITICAL"}}catch{return{...m.MODERATE,bracket:"MODERATE"}}}Te.exports={estimateContextBracket:ft,BRACKETS:m}});var _e=_((Wt,fe)=>{function le(e){return e?String(e).split(`
`)[0].trim().replace(/["'].*?["']/g,'"X"').replace(/`.*?`/g,"`X`").replace(/\d+/g,"N").substring(0,100):""}function ue(e){let t=5381;for(let n=0;n<e.length;n++)t=(t<<5)+t+e.charCodeAt(n)>>>0;return t.toString(36)}var _t={build:["build","compile","esbuild","webpack","tsc","syntax error"],test:["test","vitest","jest","expect","assert","spec"],lint:["lint","eslint","biome","prettier","format"],runtime:["typeerror","referenceerror","rangeerror","syntaxerror","cannot read","undefined is not"],integration:["fetch","network","timeout","econnrefused","api"],security:["csrf","xss","injection","unauthorized","forbidden","cors"],database:["sqlite","postgres","sql","column","table","migration","constraint"]};function x(e){if(!e)return"general";let t=e.toLowerCase();for(let[n,r]of Object.entries(_t))if(r.some(i=>t.includes(i)))return n;return"general"}function mt(e,t,n,r=null){let i=le(n);if(!i)return;let s=ue(i),a=x(n),o=e.prepare("SELECT * FROM gotchas_tracking WHERE container_tag = ? AND pattern_hash = ?").get(t,s);if(o){let c=JSON.parse(o.samples),l=String(n).split(`
`)[0].trim(),d=c.length<5&&!c.includes(l)?[...c,l]:c,E=JSON.parse(o.related_files),u=r&&!E.includes(r)?[...E,r]:E,T=o.count+1,f=T>=3&&!o.promoted;e.prepare(`UPDATE gotchas_tracking
       SET count = ?, samples = ?, related_files = ?, category = ?,
           last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`).run(T,JSON.stringify(d),JSON.stringify(u),a,o.id),f&&(e.prepare("UPDATE gotchas_tracking SET promoted = 1 WHERE id = ?").run(o.id),e.prepare(`INSERT OR IGNORE INTO profile_facts (container_tag, fact_type, fact_text, confidence)
         VALUES (?, 'gotcha', ?, 1.0)`).run(t,`[${a}] ${i} (seen ${T}x)`))}else{let c=String(n).split(`
`)[0].trim(),l=JSON.stringify([c]),d=r?JSON.stringify([r]):"[]";e.prepare(`INSERT INTO gotchas_tracking (container_tag, pattern_hash, normalized_pattern, category, count, samples, related_files)
       VALUES (?, ?, ?, ?, 1, ?, ?)`).run(t,s,i,a,l,d)}}function gt(e,t,n=""){let r=e.prepare(`SELECT * FROM gotchas_tracking
       WHERE container_tag = ? AND promoted = 1
       ORDER BY last_seen DESC`).all(t);if(r.length===0)return"";let i=x(n),a=(n||"").toLowerCase().split(/\s+/).filter(Boolean),o=r.map(d=>{let E=0;d.category===i&&i!=="general"&&(E+=3);for(let T of a)d.normalized_pattern.toLowerCase().includes(T)&&(E+=1);let u=JSON.parse(d.related_files);for(let T of a)u.some(f=>f.toLowerCase().includes(T))&&(E+=2);return{...d,score:E}});return o.sort((d,E)=>E.score-d.score),`## Known Gotchas
${o.slice(0,5).map(d=>{let E=JSON.parse(d.related_files),u=E.length>0?` (files: ${E.join(", ")})`:"";return`- **[Gotcha: ${d.category}]** ${d.normalized_pattern} \u2014 seen ${d.count}x${u}`}).join(`
`)}`}fe.exports={normalizeErrorPattern:le,djb2Hash:ue,detectCategory:x,trackError:mt,getRelevantGotchas:gt}});var pe=_((Kt,ge)=>{var pt=new Set(["staff-engineer","architect","planner","security-reviewer","code-reviewer","ux-reviewer","tdd-guide","e2e-runner","incident-responder","performance-optimizer","database-specialist","devops-specialist","build-error-resolver","refactor-cleaner","doc-updater","explore","general-purpose","bash","plan"]);function me(e){if(!e)return null;let t=String(e).trim();return t?t.toLowerCase().replace(/\s+/g,"-"):null}function Nt(e,t,n,r,i){let s=me(r);if(!s)return;let a=e.prepare("SELECT id, invocation_count FROM agent_usage WHERE container_tag = ? AND session_id = ? AND agent_name = ?").get(t,n,s);a?e.prepare("UPDATE agent_usage SET invocation_count = ?, task_summary = ? WHERE id = ?").run(a.invocation_count+1,i,a.id):e.prepare("INSERT INTO agent_usage (container_tag, session_id, agent_name, invocation_count, task_summary) VALUES (?, ?, ?, 1, ?)").run(t,n,s,i)}function Lt(e,t,n=10){return e.prepare(`SELECT
        agent_name,
        SUM(invocation_count) AS total_invocations,
        COUNT(DISTINCT session_id) AS sessions_used,
        MAX(created_at) AS last_used
       FROM agent_usage
       WHERE container_tag = ?
       GROUP BY agent_name
       ORDER BY total_invocations DESC
       LIMIT ?`).all(t,n)}function Rt(e){return!e||e.length===0?"":`## Agent Usage
${e.map(n=>{let r=n.sessions_used===1?"session":"sessions";return`- **${n.agent_name}**: ${n.total_invocations}x (${n.sessions_used} ${r})`}).join(`
`)}`}ge.exports={normalizeAgentName:me,trackAgentInvocation:Nt,getAgentStats:Lt,formatAgentStats:Rt,KNOWN_AGENTS:pt}});var{execSync:Ne}=require("node:child_process"),At=require("node:path"),{LocalMindClient:St}=Z(),{getContainerTag:Ot,getProjectName:It,getUserContainerTag:Dt}=Q(),{loadSettings:ht,debugLog:O}=re(),{readStdin:yt,writeOutput:X}=oe(),{formatContext:Ct}=Ee(),{estimateContextBracket:Mt}=de(),{getRelevantGotchas:Ut}=_e(),{getAgentStats:Ft,formatAgentStats:xt}=pe();function Le(e,t){let n=[t];if(!e||!At.isAbsolute(e))return n.join(" ");try{let r=Ne("git branch --show-current",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"]}).trim();r&&!["main","master"].includes(r)&&n.push(r)}catch{}try{let r=Ne("git diff --name-only HEAD~3 HEAD 2>/dev/null | head -5",{cwd:e,encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:3e3}).trim();if(r){let i=r.split(`
`).map(s=>s.split("/").pop()).filter(Boolean);n.push(...i)}}catch{}return n.join(" ")}function Re(){try{let{getDb:e}=L(),t=e(),n=Dt();return t.prepare(`SELECT fact_text FROM profile_facts
         WHERE container_tag = ? AND fact_type = 'static'
         ORDER BY reinforced_at DESC LIMIT 5`).all(n).map(r=>r.fact_text)}catch{return[]}}async function Xt(){let e=ht();try{let t=await yt(),n=t.cwd||process.cwd(),r=Ot(n),i=It(n);O(e,"SessionStart",{cwd:n,containerTag:r,projectName:i});let s=Le(n,i);O(e,"Contextual query",{query:s});let o=await new St(r).getProfile(r,s).catch(()=>null);if(o){let u=Re();if(u.length>0){let T=new Set(o.profile.static),f=u.filter(C=>!T.has(C));o.profile.static=[...f,...o.profile.static]}}let c=t.transcript_path,l=Mt(c);O(e,"Context bracket",{bracket:l.bracket,maxResults:l.maxResults});let d=Ct(o,e.injectProfile,l.includeSearch,l.maxResults);if(!d){X({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-mind-context>
No previous memories found for this project.
Memories will be saved as you work.
</local-mind-context>`}});return}let E=d;if(l.includeGotchas)try{let{getDb:u}=L(),T=Ut(u(),r,s);T&&(E=E.replace("</local-mind-context>",`
${T}
</local-mind-context>`))}catch{}if(l.includeGotchas)try{let{getDb:u}=L(),T=Ft(u(),r,8),f=xt(T);f&&(E=E.replace("</local-mind-context>",`
${f}
</local-mind-context>`))}catch{}O(e,"Context generated",{length:E.length,bracket:l.bracket}),X({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:E}})}catch(t){O(e,"Error",{error:t.message}),console.error(`LocalMind: ${t.message}`),X({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:`<local-mind-status>
Failed to load memories. Session will continue without memory context.
</local-mind-status>`}})}}module.exports={buildContextualQuery:Le,getUserFacts:Re};Xt().catch(e=>{console.error(`LocalMind fatal: ${e.message}`),process.exit(1)});
