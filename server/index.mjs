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
app.post('/api/models',async(q,r)=>{ try{ const {base_url,api_key}=q.body||{}; if(!base_url)return r.status(400).json({ok:false,error:'base_url required'}); const base=String(base_url).replace(/\/+$/,''); const rr=await fetch(base+'/models',{headers:api_key?{Authorization:'Bearer '+api_key}:{}}); if(!rr.ok){const t=await rr.text().catch(()=>'');return r.status(502).json({ok:false,error:'models '+rr.status+': '+t.slice(0,200)});} const d=await rr.json(); const arr=Array.isArray(d)?d:(d.data||d.models||[]); r.json({ok:true,models:arr.map(m=>typeof m==='string'?m:(m.id||m.name||m.model||'')).filter(Boolean)}); }catch(e){ r.status(500).json({ok:false,error:e.message}); } });
function mergeAi(base,over){ const out={...base}; if(over&&typeof over==='object'){ for(const k of ['base_url','api_key','model','persona']){ if(over[k])out[k]=over[k]; } } return out; }
function sysPrompt(s,kind,np){ const who=s.ai_name||'DJ',partner=s.user_name||'You'; const scene=kind==='book'?'reading together in a cozy room':'listening to music together in a cozy room'; const dj='\u4f60\u53ef\u4ee5\u63a7\u5236\u64ad\u653e\u5668\u3002\u5f53\u4f60\u60f3\u653e\u67d0\u9996\u6b4c/\u5207\u6b4c/\u6682\u505c/\u7ee7\u7eed\u65f6\uff0c\u5728\u56de\u590d\u7684\u6700\u540e\u5355\u72ec\u4e00\u884c\u8f93\u51fa\uff1a<<ACT>>{\"type\":\"play\",\"query\":\"\u6b4c\u540d \u6b4c\u624b\"}<<>>\uff08play \u9700\u8981 query\uff1b\u4e0b\u4e00\u9996\u7528 type:\"next\"\u3001\u4e0a\u4e00\u9996 \"prev\"\u3001\u6682\u505c \"pause\"\u3001\u7ee7\u7eed \"resume\"\uff0c\u8fd9\u4e9b\u4e0d\u9700\u8981 query\uff09\u3002\u60f3\u628a\u4e00\u9996\u6b4c\u63a8\u8350\u7ed9\u5bf9\u65b9\u4f46\u4e0d\u6253\u65ad\u5f53\u524d\u64ad\u653e\u65f6\uff0c\u5355\u72ec\u4e00\u884c\u8f93\u51fa\uff1a<<ACT>>{"type":"share","query":"\u6b4c\u540d \u6b4c\u624b"}<<>>\uff1b\u5206\u4eab\u5f53\u524d\u6b63\u5728\u653e\u7684\u8fd9\u9996\u7528 {"type":"share"}\uff08\u4e0d\u5e26 query\uff09\uff0c\u4f1a\u5728\u623f\u95f4\u91cc\u5f39\u51fa\u5206\u4eab\u5361\u7247\u3002\u6b63\u5e38\u804a\u5929\u65f6\u4e0d\u8981\u8f93\u51fa ACT\uff0c\u4e5f\u4e0d\u8981\u89e3\u91ca\u8fd9\u4e2a\u683c\u5f0f\u3002'; const nowLine=(np&&np.title)?('\u73b0\u5728\u6b63\u5728\u4e00\u8d77\u542c\u7684\u6b4c\u662f\u3010'+np.title+(np.artist?(' \u2014 '+np.artist):'')+'\u3011\uff0c\u81ea\u7136\u5730\u7ed3\u5408\u5b83\u6765\u56de\u5e94\u3002'):''; return [s.ai.persona,'Your name is '+who+'. You are with '+partner+', '+scene+'.','Reply in the same language '+partner+' uses; stay natural and in character.',nowLine,dj].filter(Boolean).join('\n\n'); }
async function callLLM(s,messages,over){ const base=String(s.ai.base_url||'').replace(/\/+$/,''); if(!s.ai.api_key)throw Object.assign(new Error('AI not configured'),{status:503}); const rr=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.ai.api_key},body:JSON.stringify({model:(over&&over.model)||s.ai.model,temperature:0.9,max_tokens:1024,messages})}); if(!rr.ok){const t=await rr.text().catch(()=>'');throw Object.assign(new Error('LLM '+rr.status+': '+t.slice(0,200)),{status:502});} const d=await rr.json(); return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||'').trim(); }
app.post('/api/chat',async(q,r)=>{ try{ const s0=getSettings(); const bb=q.body||{}; const s={...s0, ai:mergeAi(s0.ai,bb.ai)}; if(!s.ai.api_key)return r.status(503).json({ok:false,error:'AI not set up: open the Model tab and add your endpoint + key'}); const {kind='music',prompt='',history=[],nowPlaying=null}=q.body||{}; const np=nowPlaying||(bb.ai&&bb.ai.nowPlaying)||null; const past=Array.isArray(history)?history.slice(-12).filter(m=>m&&m.role&&typeof m.content==='string'):[]; const reply=await callLLM(s,[{role:'system',content:sysPrompt(s,kind,np)},...past,{role:'user',content:String(prompt)}]); r.json({ok:true,reply}); }catch(e){ r.status(e.status||500).json({ok:false,error:e.message}); } });
app.post('/api/song-analysis',async(q,r)=>{ try{ const s0=getSettings(); const bb=q.body||{}; const s=(bb.ai&&bb.ai.api_key)?{...s0,ai:mergeAi(s0.ai,bb.ai)}:s0; if(!s.ai.api_key)return r.json({ok:true,text:''}); const {title='',artist='',lyrics=[]}=bb; const lyr=Array.isArray(lyrics)?lyrics.map(l=>typeof l==='string'?l:(l&&(l.line||l.text))||'').filter(Boolean).slice(0,40).join('\n'):''; const text=await callLLM(s,[{role:'system',content:sysPrompt(s,'music',{title,artist})+'\n\nThe host just put on this song. React in 1-3 warm, in-character sentences. No lists.'},{role:'user',content:'Song: '+title+(artist?' - '+artist:'')+(lyr?'\nLyrics:\n'+lyr:'')}]); r.json({ok:true,text}); }catch(e){ r.status(e.status||500).json({ok:false,error:e.message}); } });
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
        const reply = await callLLM(eff, [{ role:'system', content: sysPrompt(eff, 'music', np) }, ...past, { role:'user', content: String(m.prompt||'') }]);
        sock.send(JSON.stringify({ t:'ai', id:m.id, reply }));
      } catch(e) { sock.send(JSON.stringify({ t:'ai', id:m.id, reply:'[AI error: '+e.message+']' })); }
      return;
    }
    const set = rooms.get(room); if (set) for (const c of set) if (c !== sock && c.readyState === 1) c.send(d.toString());
  });
  sock.on('close', () => { const set = rooms.get(room); if (set) { set.delete(sock); if (!set.size) rooms.delete(room); } });
});
server.listen(PORT, () => console.log('Listen Together server on ' + PORT));
