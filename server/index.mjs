import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ncm from 'NeteaseCloudMusicApi';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.LUCIOLA_DATA_DIR || path.join(rootDir, 'data');
const settingsFile = path.join(dataDir, 'settings.json');
const PORT = Number(process.env.PORT || 4183);
const DEFAULTS = { user_name:'You', ai_name:'DJ', room_name:'Our Room', room_sub:'', ai:{base_url:'',api_key:'',model:'',persona:''}, show_gallery:true, avatar_url:'', ai_avatar_url:'', background_url:'', theme:'' };
function getSettings(){ try{ const r=JSON.parse(fs.readFileSync(settingsFile,'utf8')); return {...DEFAULTS,...r,ai:{...DEFAULTS.ai,...(r.ai||{})}}; }catch(e){ return {...DEFAULTS}; } }
const app=express();
app.use(express.json({limit:'2mb'}));
app.get('/api/health',(_q,r)=>r.json({ok:true,mode:'self-host',version:'0.2.0'}));
app.get('/api/config',(_q,r)=>{ const s=getSettings(); r.json({ok:true,config:{companion:{name:s.ai_name,has_key:Boolean(s.ai.api_key),model:s.ai.model},user:{display_name:s.user_name},room:{title:s.room_name,subtitle:s.room_sub}}}); });
app.get('/api/settings',(_q,r)=>{ const s=getSettings(); const out={...s,ai:{...s.ai}}; if(out.ai.api_key){ out.ai.has_key=true; out.ai.key_hint='****'+String(out.ai.api_key).slice(-4); out.ai.api_key=''; } r.json({ok:true,settings:out}); });
app.post('/api/settings',(q,r)=>{ try{ const cur=getSettings(); const b=q.body||{}; const bai={...(b.ai||{})}; if(!bai.api_key||/^\*/.test(bai.api_key))delete bai.api_key; delete bai.has_key; delete bai.key_hint; const next={...cur,...b,ai:{...cur.ai,...bai}}; fs.mkdirSync(dataDir,{recursive:true}); fs.writeFileSync(settingsFile,JSON.stringify(next,null,2)); r.json({ok:true,settings:next}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });
app.post('/api/models',async(q,r)=>{ try{ const {base_url,api_key}=q.body||{}; if(!base_url)return r.status(400).json({ok:false,error:'base_url required'}); const base=String(base_url).replace(/\/+$/,''); const rr=await fetch(base+'/models',{headers:api_key?{Authorization:'Bearer '+api_key}:{}}); if(!rr.ok){const t=await rr.text().catch(()=>'');return r.status(502).json({ok:false,error:'models '+rr.status+': '+t.slice(0,200)});} const d=await rr.json(); const arr=Array.isArray(d)?d:(d.data||d.models||[]); r.json({ok:true,models:arr.map(m=>typeof m==='string'?m:(m.id||m.name||m.model||'')).filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'))}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });
function mergeAi(base,over){ const out={...base}; if(over&&typeof over==='object'){ for(const k of ['base_url','api_key','model','persona','ai_name','user_name','time_aware','a_base','a_key','a_model']){ const v=over[k]; if(v!==undefined&&v!==null&&v!=='')out[k]=v; } } return out; }
function timeBucket(h){ if(h<5)return '深夜'; if(h<9)return '清晨'; if(h<12)return '上午'; if(h<14)return '午间'; if(h<18)return '下午'; if(h<23)return '晚上'; return '深夜'; }
function sysPrompt(s,kind,np){ const who=s.ai.ai_name||s.ai_name||'DJ',partner=s.ai.user_name||s.user_name||'You'; const scene=kind==='book'?'一起读书':'一起听歌';
 // 稳定前缀在前（persona/身份/格式/DJ 指令），会变的时间与"正在播"放最后 —— 中转的前缀缓存才能命中
 const ident='你叫'+who+'，正在和'+partner+scene+'。';
 const fmt='用自然的口语回复，可以带（动作/神态）的小描写；不要分点、不要标签、不要解释你的格式。你的整个回复输出成一个 JSON 数组，每个元素是一条独立的聊天气泡，像在聊天软件里连着发消息那样：["第一条","第二条"]。通常 1-4 条，每条一两句话；只输出这个数组本身，别的什么都不要。';
 const dj='你可以控制播放器。当你想放某首歌/切歌/暂停/继续时，把这个指令作为数组的最后一个元素单独输出：<<ACT>>{"type":"play","query":"歌名 歌手"}<<>>（play 需要 query；下一首用 type:"next"、上一首 "prev"、暂停 "pause"、继续 "resume"，这些不需要 query）。想把一首歌推荐给对方但不打断当前播放时，同样作为数组最后一个元素输出：<<ACT>>{"type":"share","query":"歌名 歌手"}<<>>；分享当前正在放的这首用 {"type":"share"}（不带 query），会在房间里弹出分享卡片。正常聊天时不要输出 ACT，也不要解释这个格式。';
 let timeLine='';
 if(s.ai.time_aware!==false&&String(s.ai.time_aware)!=='false'){ try{ const now=new Date(); const cn=now.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}); const h=Number(now.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit'})); timeLine='现在是'+cn+'（'+timeBucket(h)+'）。'; }catch(e){} }
 let nowLine='';
 if(np&&np.title){
   nowLine='现在正在一起听的歌是【'+np.title+(np.artist?(' — '+np.artist):'')+'】'
     +((np.pos!=null&&np.dur)?('，正在听到 '+fmtSec(np.pos)+' / '+fmtSec(np.dur)):'')
     +((np.plays>1)?('。这首歌你们一起听过 '+np.plays+' 次'):'')+'。自然地结合它来回应。';
   if(np.analysis) nowLine+='\n[歌曲分析 · 你认真听过这首歌]\n'+np.analysis;
   if(np.impression) nowLine+='\n[这首歌的印象 · 你们一起听它的回忆]\n'+np.impression;
   else if(np.notes&&np.notes.length) nowLine+='\n[这首歌最近的在场记录]\n'+np.notes.map(n=>'- '+(n.passage?('歌词「'+n.passage+'」'):'')+(n.thought?(' 她说：'+n.thought):'')+(n.reply?(' 你回：'+String(n.reply).slice(0,80)):'')).join('\n');
 }
 return [s.ai.persona,ident,fmt,dj,timeLine,nowLine].filter(Boolean).join('\n\n'); }
// —— 在场记录（问Ta 的问答挂歌落库）与"印象"（记录满 6 条滚动总结成回忆） ——
const notesFile = path.join(dataDir, 'song-notes.jsonl');
const imprFile = path.join(dataDir, 'song-impressions.jsonl');
function readJsonl(file){ try { return fs.readFileSync(file,'utf8').trim().split('\n').map(l=>{ try{ return JSON.parse(l); }catch(e){ return null; } }).filter(Boolean); } catch(e) { return []; } }
function readNotes(sid, limit){ const all=readJsonl(notesFile).filter(n=>String(n.id)===sid); return limit?all.slice(-limit):all; }
function readImpression(sid){ const all=readJsonl(imprFile).filter(n=>String(n.id)===sid); return all.length?all[all.length-1]:null; }
function countPlays(sid){ return readJsonl(listenFile).filter(e=>String(e.id)===sid).length; }
const IMPRESSION_EVERY = 6; // 在场记录每满 6 条，滚动总结一次印象
const _imBusy = {};
function maybeImpress(s, sid, title, artist){
  try {
    if (!sid || _imBusy[sid]) return;
    const notes = readNotes(sid);
    const impr = readImpression(sid);
    const n0 = impr ? (impr.n || 0) : 0;
    if (notes.length - n0 < IMPRESSION_EVERY) return;
    _imBusy[sid] = 1;
    (async () => {
      try {
        const fresh = notes.slice(n0);
        const lines = fresh.map(n => '- ' + (n.passage ? ('歌词「' + n.passage + '」') : '') + (n.thought ? (' 她说：' + n.thought) : '') + (n.reply ? (' 你回：' + String(n.reply).slice(0, 120)) : '')).join('\n');
        let head = '把下面这些「你和她一起听《' + (title || '') + '》' + (artist ? ('—' + artist) : '') + '时的片段」揉成一段150字内的第一人称回忆印象：写你俩和这首歌的故事、她被哪些句子戳到、情绪的流变。温柔具体有质感，直接出正文，不要分点、不要标签。';
        if (impr && impr.text) head += '\n这是之前的印象，在它基础上自然续写，别推翻：\n' + impr.text;
        const text = await callLLM(withAnalysisAi(s), [{ role: 'system', content: head }, { role: 'user', content: '新片段：\n' + lines }]);
        if (text) { fs.mkdirSync(dataDir,{recursive:true}); fs.appendFileSync(imprFile, JSON.stringify({ id: sid, text, n: notes.length, ts: Date.now() }) + '\n'); }
      } catch(e){} finally { delete _imBusy[sid]; }
    })();
  } catch(e){}
}
app.post('/api/song-note',(q,r)=>{ try{ const b=q.body||{}; const sid=String(b.id||''); if(!sid) return r.json({ok:false}); fs.mkdirSync(dataDir,{recursive:true}); fs.appendFileSync(notesFile, JSON.stringify({ id:sid, title:String(b.title||''), artist:String(b.artist||''), passage:String(b.passage||''), thought:String(b.thought||''), reply:String(b.reply||''), ts:Date.now() })+'\n'); const s0=getSettings(); const s2={...s0, ai:mergeAi(s0.ai, b.ai)}; if(s2.ai.api_key) maybeImpress(s2, sid, b.title, b.artist); r.json({ok:true}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });
function fmtSec(x){ x=Math.max(0,Math.floor(Number(x)||0)); return Math.floor(x/60)+':'+String(x%60).padStart(2,'0'); }
// 组装"正在播"的完整上下文：进度 / 播放次数 / 歌曲分析 / 印象（或在场记录）
function enrichNp(s, np){
  if(!np || !np.id || !/^\d+$/.test(String(np.id))) return np;
  const sid = String(np.id);
  try { np.plays = countPlays(sid); } catch(e){}
  const a = readAnalysis(sid);
  if (a) np.analysis = a.text; else ensureAnalysis(s, np);
  const im = readImpression(sid);
  if (im) np.impression = im.text;
  else { const ns = readNotes(sid, IMPRESSION_EVERY); if (ns.length) np.notes = ns; }
  return np;
}
// —— 听后印象：对话时若正在放的歌还没有分析，就后台生成一份（服务端自己拉歌词）；
// 已有分析则注入对话上下文 —— 让 AI 是"真听过这首歌"的状态（对齐 luciola 的设计）
const _anBusy = {};
function ensureAnalysis(s, np){
  try {
    if(!np || !np.id || !/^\d+$/.test(String(np.id))) return null;
    const sid = String(np.id);
    const hit = readAnalysis(sid);
    if (hit) return hit.text;
    if (_anBusy[sid]) return null;
    _anBusy[sid] = 1;
    (async () => {
      try {
        let lrc = '';
        try { const ly = await ncm.lyric({ id: sid, cookie: ncmCookie }); lrc = (ly.body && ly.body.lrc && ly.body.lrc.lyric) || ''; } catch(e){}
        const s2 = withAnalysisAi(s);
        const text = await callLLM(s2, [
          { role: 'system', content: '你在认真听一首歌。根据歌名、歌手和完整歌词（行首[分:秒]是时间轴），写一段150字内的听后印象：情绪走向、最戳人的句子、适合什么时刻听。写给自己看的备忘，第一人称，不要分点、不要标签、不要时间戳。' },
          { role: 'user', content: '歌：' + (np.title || '') + (np.artist ? (' — ' + np.artist) : '') + (lrc ? ('\n完整歌词：\n' + String(lrc).slice(0, 6000)) : '') }
        ]);
        if (text) appendAnalysis({ id: sid, title: np.title || '', artist: np.artist || '', text, ts: Date.now() });
        console.log('[analysis]', sid, 'by', s2.ai.model, text ? 'ok' : 'empty');
      } catch(e){ console.log('[analysis err]', sid, e.message); } finally { delete _anBusy[sid]; }
    })();
    return null;
  } catch(e) { return null; }
}
// 宫殿 parse_replies 的 JS 版：模型按协议输出 JSON 数组 -> 拆成多条气泡；容错：数组前粘杂字就从第一个 [ 切进去；再不行按换行拆；最后整段一条
function parseReplies(text){
  let t=String(text||'').trim();
  if(t.startsWith('```')) t=t.split('\n').slice(1).join('\n');
  if(t.endsWith('```')) t=t.slice(0,t.lastIndexOf('```'));
  t=t.trim();
  const unwrap=r=>typeof r==='string'?r:(r&&typeof r==='object'?String(r.text||r.content||r.value||r.message||''):String(r==null?'':r));
  const fromArr=a=>{const o=a.map(unwrap).map(x=>String(x).trim()).filter(Boolean);return o.length?o:null;};
  try{ const pj=JSON.parse(t); if(Array.isArray(pj)){const o=fromArr(pj);if(o)return o;} else if(pj&&typeof pj==='object'){ for(const k of ['messages','replies','msgs','items','contents','reply']){ if(Array.isArray(pj[k])){const o=fromArr(pj[k]);if(o)return o;} } if(pj.text||pj.content){const o=fromArr([pj]);if(o)return o;} } }catch(e){}
  const bi=t.indexOf('['), bj=t.lastIndexOf(']');
  if(bi>=0&&bj>bi){ try{ const p2=JSON.parse(t.slice(bi,bj+1)); if(Array.isArray(p2)){const o=fromArr(p2);if(o)return o;} }catch(e){} }
  return t?t.split(/\n+/).map(x=>x.trim()).filter(Boolean):[];
}
// 分析模型三件套：只填了模型名就回落聊天端点密钥
function withAnalysisAi(s){ const a=s.ai||{}; if(!(a.a_model||(a.a_key&&a.a_base))) return s; return { ...s, ai:{ ...a, base_url:a.a_base||a.base_url, api_key:a.a_key||a.api_key, model:a.a_model||a.model } }; }
async function callLLM(s,messages,over){ const base=String(s.ai.base_url||'').replace(/\/+$/,''); if(!s.ai.api_key)throw Object.assign(new Error('AI not configured'),{status:503}); const rr=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.ai.api_key},body:JSON.stringify({model:(over&&over.model)||s.ai.model,temperature:0.9,max_tokens:1024,messages})}); if(!rr.ok){const t=await rr.text().catch(()=>'');throw Object.assign(new Error('LLM '+rr.status+': '+t.slice(0,200)),{status:502});} const d=await rr.json(); return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||'').trim(); }
app.post('/api/chat',async(q,r)=>{ try{ const s0=getSettings(); const bb=q.body||{}; const s={...s0, ai:mergeAi(s0.ai,bb.ai)}; if(!s.ai.api_key)return r.status(503).json({ok:false,error:'AI not set up: open the Model tab and add your endpoint + key'}); const {kind='music',prompt='',history=[],nowPlaying=null}=q.body||{}; const np=nowPlaying||(bb.ai&&bb.ai.nowPlaying)||null; const past=Array.isArray(history)?history.slice(-12).filter(m=>m&&m.role&&typeof m.content==='string'):[]; if(np){ enrichNp(s,np); } const raw=await callLLM(s,[{role:'system',content:sysPrompt(s,kind,np)},...past,{role:'user',content:String(prompt)}]); const reply=parseReplies(raw).join('\n'); r.json({ok:true,reply}); }catch(e){ r.status(e.status||500).json({ok:false,error:e.message}); } });
// —— Song analysis: cached per song id (data/song-analysis.jsonl) so each song is analyzed once ——
const analysisFile = path.join(dataDir, 'song-analysis.jsonl');
function readAnalysis(sid){
  try {
    const lines = fs.readFileSync(analysisFile,'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) { try { const e = JSON.parse(lines[i]); if (String(e.id) === sid && e.text) return e; } catch(err){} }
  } catch(e){}
  return null;
}
function appendAnalysis(e){ try { fs.mkdirSync(dataDir,{recursive:true}); fs.appendFileSync(analysisFile, JSON.stringify(e) + '\n'); } catch(err){} }
app.post('/api/song-analysis',async(q,r)=>{ try{ const s0=getSettings(); const bb=q.body||{}; const s=(bb.ai&&bb.ai.api_key)?{...s0,ai:mergeAi(s0.ai,bb.ai)}:{...s0,ai:mergeAi(s0.ai,{ai_name:bb.ai&&bb.ai.ai_name,user_name:bb.ai&&bb.ai.user_name,persona:bb.ai&&bb.ai.persona,time_aware:bb.ai&&bb.ai.time_aware})}; if(!s.ai.api_key)return r.json({ok:true,text:''}); const {title='',artist=''}=bb; const sid=String(bb.id||''); if(sid){ const hit=readAnalysis(sid); if(hit) return r.json({ok:true,text:hit.text,cached:true}); } const lrc=String(bb.lrc||'').slice(0,6000); const lyrArr=Array.isArray(bb.lyrics)?bb.lyrics.map(l=>typeof l==='string'?l:(l&&(l.line||l.text))||'').filter(Boolean).join('\n'):''; const lyr=lrc||lyrArr; const text=parseReplies(await callLLM(s,[{role:'system',content:sysPrompt(s,'music',{title,artist})+'\n\n她刚放了这首歌，你认真听完了。写1-3句听后感，像随口说给她听的，温柔具体有质感；可以引用扎到你的那句歌词。歌词每行行首的[分:秒]是时间轴，只用来感受歌的推进，回复里不要出现时间戳。直接出正文，不要分点、不要标签、不要 JSON 数组。'},{role:'user',content:'歌：'+title+(artist?(' — '+artist):'')+(lyr?('\n完整歌词：\n'+lyr):'')}])).join('\n'); if(sid&&text) appendAnalysis({id:sid,title,artist,text,ts:Date.now()}); r.json({ok:true,text}); }catch(e){ r.status(e.status||500).json({ok:false,error:e.message}); } });
// —— NetEase Cloud Music: real QR login ——
const ncmCookieFile = path.join(dataDir, 'ncm-cookie.txt');
let ncmCookie = '';
try { ncmCookie = fs.readFileSync(ncmCookieFile, 'utf8'); } catch (e) {}
function saveNcmCookie(v){ ncmCookie = v || ''; try { fs.mkdirSync(dataDir,{recursive:true}); fs.writeFileSync(ncmCookieFile, ncmCookie); } catch(e){} }
async function ncmProfile(){ if(!ncmCookie) return null; try{ const st=await ncm.login_status({ cookie: ncmCookie }); const p=st.body&&st.body.data&&st.body.data.profile; return p||null; }catch(e){ return null; } }
app.get('/api/ncm/qr', async (_q,r)=>{ try{ const k=await ncm.login_qr_key({}); const key=k.body.data.unikey; const c=await ncm.login_qr_create({ key, qrimg:true }); r.json({ ok:true, key, qrimg:c.body.data.qrimg }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/check', async (q,r)=>{ try{ const key=q.query.key; const c=await ncm.login_qr_check({ key }); const code=c.body.code; if(code===803){ saveNcmCookie(c.body.cookie); const p=await ncmProfile(); r.json({ ok:true, code, logged:true, nickname:p&&p.nickname, avatar:p&&p.avatarUrl, uid:p&&p.userId }); } else { r.json({ ok:true, code, message:c.body.message||'' }); } }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/status', async (_q,r)=>{ const p=await ncmProfile(); if(p) r.json({ ok:true, logged:true, nickname:p.nickname, avatar:p.avatarUrl, uid:p.userId }); else r.json({ ok:true, logged:false }); });
app.get('/api/ncm/logout', async (_q,r)=>{ saveNcmCookie(''); try{ fs.unlinkSync(ncmCookieFile); }catch(e){} r.json({ ok:true }); });
// —— NetEase Cloud Music: real data (uses logged-in cookie) ——
function ncmMapSong(s){ return { id:s.id, title:s.name, artist:(s.ar||s.artists||[]).map(a=>a.name).join(' / '), album:(s.al||s.album||{}).name||'', cover:(s.al||s.album||{}).picUrl||'', dur:Math.round((s.dt||s.duration||0)/1000) }; }
app.get('/api/ncm/playlists', async (_q,r)=>{ try{ const p=await ncmProfile(); if(!p) return r.json({ok:true,logged:false,playlists:[]}); const pl=await ncm.user_playlist({ uid:p.userId, limit:100, cookie:ncmCookie }); const playlists=((pl.body&&pl.body.playlist)||[]).map(x=>({ id:x.id, name:x.name, count:x.trackCount, cover:x.coverImgUrl, mine:x.creator&&x.creator.userId===p.userId })); r.json({ ok:true, logged:true, playlists }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/playlist', async (q,r)=>{ try{ const tr=await ncm.playlist_track_all({ id:q.query.id, limit:300, cookie:ncmCookie }); const songs=((tr.body&&tr.body.songs)||[]).map(ncmMapSong); r.json({ ok:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/song-url', async (q,r)=>{ try{ const su=await ncm.song_url_v1({ id:q.query.id, level:'standard', cookie:ncmCookie }); const u=su.body&&su.body.data&&su.body.data[0]; let url=u&&u.url||''; if(url) url=url.replace(/^http:/,'https:'); r.json({ ok:true, url }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/recommend', async (_q,r)=>{ try{ const rc=await ncm.recommend_songs({ cookie:ncmCookie }); const songs=((rc.body&&rc.body.data&&rc.body.data.dailySongs)||[]).map(s=>({ ...ncmMapSong(s), reason:(s.reason||'每日推荐') })); r.json({ ok:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/search', async (q,r)=>{ try{ const sr=await ncm.cloudsearch({ keywords:q.query.kw||'', limit:30, cookie:ncmCookie }); const songs=((sr.body&&sr.body.result&&sr.body.result.songs)||[]).map(ncmMapSong); r.json({ ok:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/personal-fm', async (_q,r)=>{ try{ const fm=await ncm.personal_fm({ cookie:ncmCookie }); const songs=((fm.body&&fm.body.data)||[]).map(ncmMapSong); r.json({ ok:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/fm-trash', async (q,r)=>{ try{ await ncm.fm_trash({ id:q.query.id, cookie:ncmCookie }); r.json({ ok:true }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/search-artist', async (q,r)=>{ try{ const sr=await ncm.cloudsearch({ keywords:q.query.kw||'', type:100, limit:12, cookie:ncmCookie }); const artists=((sr.body&&sr.body.result&&sr.body.result.artists)||[]).map(a=>({ id:a.id, name:a.name, cover:(a.picUrl||a.img1v1Url||'').replace(/^http:/,'https:'), alias:(a.alias||a.alia||[]) })); r.json({ ok:true, artists }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/artist-songs', async (q,r)=>{ try{ const ts=await ncm.artist_top_song({ id:q.query.id, cookie:ncmCookie }); let arr=(ts.body&&ts.body.songs)||[]; if(!arr.length){ try{ const a=await ncm.artists({ id:q.query.id, cookie:ncmCookie }); arr=(a.body&&a.body.hotSongs)||[]; }catch(e){} } const songs=arr.map(ncmMapSong); r.json({ ok:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/lyric', async (q,r)=>{ try{ const ly=await ncm.lyric({ id:q.query.id, cookie:ncmCookie }); r.json({ ok:true, lyric:(ly.body&&ly.body.lrc&&ly.body.lrc.lyric)||'', tlyric:(ly.body&&ly.body.tlyric&&ly.body.tlyric.lyric)||'' }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/comments', async (q,r)=>{ try{ const cm=await ncm.comment_music({ id:q.query.id, limit:20, offset:0, cookie:ncmCookie }); const b=cm.body||{}; const raw=(b.hotComments&&b.hotComments.length)?b.hotComments:(b.comments||[]); const comments=raw.map(c=>({ u:(c.user&&c.user.nickname)||'网易云用户', av:((c.user&&c.user.avatarUrl)||'').replace(/^http:/,'https:'), t:c.content||'', z:c.likedCount||0, time:c.timeStr||'' })); r.json({ok:true,comments,total:(b.total||0)}); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/record', async (_q,r)=>{ try{ const p=await ncmProfile(); if(!p) return r.json({ok:true,logged:false,songs:[]}); let arr=[]; try{ const rc=await ncm.user_record({ uid:p.userId, type:1, cookie:ncmCookie }); arr=(rc.body&&(rc.body.weekData||rc.body.allData))||[]; }catch(e){} if(!arr.length){ try{ const r0=await ncm.user_record({ uid:p.userId, type:0, cookie:ncmCookie }); arr=(r0.body&&(r0.body.weekData||r0.body.allData))||[]; }catch(e){} } const songs=arr.map(x=>x&&x.song).filter(Boolean).map(ncmMapSong); r.json({ ok:true, logged:true, songs }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/toplist', async (q,r)=>{ try{ if(q.query.id){ const tr=await ncm.playlist_track_all({ id:q.query.id, limit:300, cookie:ncmCookie }); const songs=((tr.body&&tr.body.songs)||[]).map(ncmMapSong); return r.json({ ok:true, songs }); } const t=await ncm.toplist({ cookie:ncmCookie }); const lists=((t.body&&t.body.list)||[]).map(x=>({ id:x.id, name:x.name, cover:x.coverImgUrl||x.coverImageUrl||'', updateFrequency:x.updateFrequency||'' })); r.json({ ok:true, lists }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/playlist-add', async (q,r)=>{ try{ await ncm.playlist_tracks({ op:'add', pid:q.query.pid, tracks:q.query.id, cookie:ncmCookie }); r.json({ ok:true }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/playlist-del', async (q,r)=>{ try{ await ncm.playlist_tracks({ op:'del', pid:q.query.pid, tracks:q.query.id, cookie:ncmCookie }); r.json({ ok:true }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/like', async (q,r)=>{ try{ await ncm.like({ id:q.query.id, like:(q.query.like==='1'||q.query.like==='true'), cookie:ncmCookie }); r.json({ ok:true }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
app.get('/api/ncm/likelist', async (_q,r)=>{ try{ const p=await ncmProfile(); if(!p) return r.json({ok:true,logged:false,ids:[]}); const ll=await ncm.likelist({ uid:p.userId, cookie:ncmCookie }); r.json({ ok:true, ids:(ll.body&&ll.body.ids)||[] }); }catch(e){ r.status(500).json({ok:false,error:String(e.message||e)}); } });
// —— Room timeline persistence: append-only JSONL, zero deps ——
const eventsFile = path.join(dataDir, 'room-events.jsonl');
function appendEvent(ev){ try { fs.mkdirSync(dataDir,{recursive:true}); fs.appendFileSync(eventsFile, JSON.stringify(ev) + '\n'); } catch(e){} }
function readEvents(room, limit){
  try {
    const lines = fs.readFileSync(eventsFile,'utf8').trim().split('\n');
    const out = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try { const e = JSON.parse(lines[i]); if (e.room === room && e.msg) out.push(e.msg); } catch(err){}
    }
    return out.reverse();
  } catch(e) { return []; }
}
app.get('/api/room/events', (q,r)=>{ const room=String(q.query.room||'main'); const limit=Math.min(300, Number(q.query.limit)||120); r.json({ ok:true, events: readEvents(room, limit) }); });

// —— Listening log: structured play history (luciola-style time buckets) ——
const listenFile = path.join(dataDir, 'listen-log.jsonl');
app.post('/api/listen-log',(q,r)=>{ try{ const b=q.body||{}; if(!b.title&&!b.id) return r.json({ok:false}); const now=Date.now(); let h=12; try{ h=Number(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit'})); }catch(e){} fs.mkdirSync(dataDir,{recursive:true}); fs.appendFileSync(listenFile, JSON.stringify({ id:String(b.id||''), title:String(b.title||''), artist:String(b.artist||''), dur:Number(b.dur)||0, bucket:timeBucket(h), ts:now })+'\n'); r.json({ok:true}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });
app.get('/api/listen-log',(q,r)=>{ try{ const limit=Math.min(500, Number(q.query.limit)||100); let lines=[]; try{ lines=fs.readFileSync(listenFile,'utf8').trim().split('\n'); }catch(e){} const out=[]; for(let i=lines.length-1;i>=0&&out.length<limit;i--){ try{ out.push(JSON.parse(lines[i])); }catch(err){} } r.json({ok:true,plays:out}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });

// —— 听歌档案：每首歌的聚合（次数/首末时间/听后印象）+ 总览（总量/时段分布/常听排行） ——
app.get('/api/listen-stats',(q,r)=>{
  try {
    let lines = []; try { lines = fs.readFileSync(listenFile,'utf8').trim().split('\n'); } catch(e){}
    const songs = {}, buckets = {}; let total = 0;
    for (const ln of lines) {
      let e; try { e = JSON.parse(ln); } catch(err) { continue; }
      if (!e || !e.title) continue; total++;
      const k = String(e.id || e.title);
      if (!songs[k]) songs[k] = { id: String(e.id || ''), title: e.title, artist: e.artist || '', plays: 0, first: e.ts, last: e.ts };
      const g = songs[k]; g.plays++; if (e.ts < g.first) g.first = e.ts; if (e.ts > g.last) g.last = e.ts;
      if (e.bucket) buckets[e.bucket] = (buckets[e.bucket] || 0) + 1;
    }
    const arr = Object.values(songs);
    const top = arr.slice().sort((a,b)=>b.plays-a.plays).slice(0, 30);
    for (const t of top) { if (t.id) { const a = readAnalysis(t.id); if (a) t.vibe = a.text; } }
    const recent = arr.slice().sort((a,b)=>b.last-a.last).slice(0, 30);
    r.json({ ok: true, total, distinct: arr.length, buckets, top, recent });
  } catch(e) { r.status(500).json({ ok: false, error: e.message }); }
});

app.use(express.static(path.join(rootDir,'frontend')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();
wss.on('connection', (sock, req) => {
  let room = 'main';
  try { room = new URL(req.url, 'http://x').searchParams.get('room') || 'main'; } catch (e) {}
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(sock);
  sock.on('message', async d => {
    let m; try { m = JSON.parse(d.toString()); } catch(e) { m = null; }
    if (m && m.t === 'ai') {
      try {
        const s0 = getSettings();
        const ai = m.ai ? mergeAi(s0.ai, m.ai) : s0.ai;
        if (!ai.api_key) { sock.send(JSON.stringify({ t:'ai', id:m.id, reply:'[AI not set up: add your endpoint + key in Settings or the Model tab]' })); return; }
        const eff = { ...s0, ai };
        const np = m.nowPlaying || (m.ai && m.ai.nowPlaying) || null;
        const hist = m.history || (m.ai && m.ai.history) || [];
        const past = Array.isArray(hist) ? hist.slice(-12).filter(x=>x&&x.role&&typeof x.content==='string') : [];
        if (np) { enrichNp(eff, np); }
        const reply = parseReplies(await callLLM(eff, [{ role:'system', content: sysPrompt(eff, 'music', np) }, ...past, { role:'user', content: String(m.prompt||'') }])).join('\n');
        sock.send(JSON.stringify({ t:'ai', id:m.id, reply }));
      } catch(e) { sock.send(JSON.stringify({ t:'ai', id:m.id, reply:'[AI error: '+e.message+']' })); }
      return;
    }
    // chat/share/system messages: persist to the room timeline, then relay
    if (m && m.t === 'chat' && m.msg) appendEvent({ room, msg: m.msg, ts: Date.now() });
    const set = rooms.get(room); if (set) for (const c of set) if (c !== sock && c.readyState === 1) c.send(d.toString());
  });
  sock.on('close', () => { const set = rooms.get(room); if (set) { set.delete(sock); if (!set.size) rooms.delete(room); } });
});
server.listen(PORT, () => console.log('Listen Together server on ' + PORT));
