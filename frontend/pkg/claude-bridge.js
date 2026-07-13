(function(){
  var API=window.__LS_API||'/api';
  // 取当前在放的歌：优先显式传入，其次全局 __lsNowPlaying / ncmSong
  function nowPlaying(opts){
    if(opts&&opts.nowPlaying)return opts.nowPlaying;
    var g=window.__lsNowPlaying;
    if(g&&g.title){ var o={title:g.title,artist:g.artist||'',id:g.id||''}; try{ var au=window.__lsAudioEl; if(au&&au.duration&&isFinite(au.duration)){ o.pos=Math.floor(au.currentTime||0); o.dur=Math.floor(au.duration); if(/^https?:/.test(String(au.src||'')))o.url=au.src; } }catch(e){} try{ if(window.__lsCurLyric) o.cur_lyric=String(window.__lsCurLyric).slice(0,80); }catch(e){} return o; }
    var n=window.ncmSong;
    if(n&&n.title)return {title:n.title,artist:n.artist||''};
    return null;
  }
  function historyOf(opts){
    var h=(opts&&opts.history);
    return Array.isArray(h)?h:null;
  }
  // Duetto 只保留歌曲分析模型；陪聊统一由 Meow Diary 后端的同一个小克接管。
  function aiConfig(){
    var mm=(window.__lsStore&&window.__lsStore.model)||{};
    var ai={};
    try{ai.time_aware=localStorage.getItem('ls-room-timeaware')!=='0';}catch(e){}
    try{if(localStorage.getItem('ls-room-replymode')==='stream')ai.reply_mode='stream';}catch(e){}
    // 分析模型三件套：只用于真正听歌和生成听感，不参与陪聊。
    try{var ma=(mm.analysis||{});if(ma.endpoint)ai.a_base=ma.endpoint;if(ma.key)ai.a_key=ma.key;if(ma.name)ai.a_model=ma.name;}catch(e){}
    return ai;
  }
  function fetchComplete(prompt, ai, np, history){
    var body={kind:'music',prompt:String(prompt||''),ai:ai,client_time:new Date().toLocaleString('zh-CN',{hour12:false})};
    if(np)body.nowPlaying=np;
    if(history)body.history=history;
    if(ai&&ai.quote)body.quote=ai.quote;
    return fetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json();})
      .then(function(d){ if(d&&d.ok){ try{window.__lsLastThink=String(d.think||'');}catch(e){} return d.reply||''; } return '[共同聊天服务暂时不可用]'; })
      .catch(function(e){ return '[AI error: '+(e&&e.message||e)+']'; });
  }
  function complete(prompt, opts){
    var ai=aiConfig();
    var np=nowPlaying(opts);
    var history=historyOf(opts);
    if(opts&&opts.noNote)ai.no_note=1;
    if(opts&&opts.quote)ai.quote=String(opts.quote);
    // 陪聊固定走 HTTP 共同后端，确保对话被写入主页共享记忆；WS 仅负责房间同步。
    return fetchComplete(prompt, ai, np, history);
  }
  window.claude={ complete: complete, ask: complete };
  window.__lsAiConfig=aiConfig;
})();
