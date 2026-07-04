/* listen/app.jsx — 「一起听歌」根。
   底栏：此刻(播放) · 歌单(资料) · 曲库(搜索+日推+FM) · 一起听(档案+歌库+设置)。
   播放页：黑胶/卡片封面切换、滑动切纯歌词、队列、播放方式、问 Ta、详情抽屉。 */

const { useState: aUseState, useEffect: aUseEffect } = React;

const LS_SKINS = [
  { id: 'yuebai',   name: '月白',     po: 'cool cream',   bg: '#efece7', ac: '#b29a6e' },
  { id: 'komorebi', name: '木漏れ日', po: 'sage light',   bg: '#eaede2', ac: '#8a9a6b' },
  { id: 'shiliu',   name: '石榴',     po: 'misty violet', bg: '#f0f1fa', ac: '#8f93c9' },
  { id: 'rongyi',   name: '绒翼',     po: 'soft rose',    bg: '#f5eef0', ac: '#c08c9b' },
  { id: 'jilan',    name: '霁蓝',     po: 'misty blue',   bg: '#e9eef4', ac: '#7d9ac6' },
];

var lsAudioEl = window.__lsAudioEl || (window.__lsAudioEl = new Audio());
var LS_DEMO_SRC = ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3','https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'];
function LSApp() {
  const [skin, setSkin] = aUseState(() => localStorage.getItem('ls-skin') || 'yuebai');
  const [customAc, setCustomAc] = aUseState(() => localStorage.getItem('ls-skin-custom') || '#c99bb0');
  const [customVars, setCustomVars] = aUseState(() => { try { return JSON.parse(localStorage.getItem('ls-skin-diy') || '{}'); } catch (e) { return {}; } });
  const [darkMode, setDarkMode] = aUseState(() => { try { return localStorage.getItem('ls-dark') === '1'; } catch (e) { return false; } });
  const [view, setView] = aUseState('player');         // player | playlist | browse | together
  const [idx, setIdx]   = aUseState(0);
  const [playing, setPlaying] = aUseState(false);
  const [cur, setCur]   = aUseState(31);
  const [loved, setLoved] = aUseState(true);
  const [coverMode, setCoverMode] = aUseState(() => localStorage.getItem('ls-cover') || 'vinyl');
  const [playMode, setPlayMode] = aUseState(() => localStorage.getItem('ls-playmode') || 'loop');
  const [skinOpen, setSkinOpen] = aUseState(false);
  const [togetherTab, setTogetherTab] = aUseState('archive');  // archive | library | model
  // A–F
  const [store] = aUseState(() => { const s = lsLoadStore(); window.__lsStore = s; return s; });
  const [, setTick] = aUseState(0);
  const bump = () => setTick(t => t + 1);
  const [drawerIdx, setDrawerIdx] = aUseState(null);
  const [ask, setAsk] = aUseState(null);
  const [modelOpen, setModelOpen] = aUseState(false);
  const [queueOpen, setQueueOpen] = aUseState(false);
  const [fmOpen, setFmOpen] = aUseState(false);
  const [commentsIdx, setCommentsIdx] = aUseState(null);
  const [commentsSong, setCommentsSong] = aUseState(null);
  const [savePickerSong, setSavePickerSong] = aUseState(null);
  window.__lsSavePicker = (s) => setSavePickerSong(s);
  const [wallOn, setWallOn] = aUseState(() => localStorage.getItem('ls-wall') === '1');
  const [wallVeil, setWallVeil] = aUseState(() => Number(localStorage.getItem('ls-wall-veil') || 0.4));
  const [wallBlur, setWallBlur] = aUseState(() => Number(localStorage.getItem('ls-wall-blur') || 0));
  const [cardVeil, setCardVeil] = aUseState(() => Number(localStorage.getItem('ls-card-veil') || 0));
  const [cardBlur, setCardBlur] = aUseState(() => Number(localStorage.getItem('ls-card-blur') || 0));
  const [navVeil, setNavVeil] = aUseState(() => { const v = localStorage.getItem('ls-nav-veil'); return v == null ? 0.7 : Number(v); });
  const [navBlur, setNavBlur] = aUseState(() => { const v = localStorage.getItem('ls-nav-blur'); return v == null ? 14 : Number(v); });
  const [openPl, setOpenPl] = aUseState(null);
  const [roomOpen, setRoomOpen] = aUseState(false);
  const [roomTab, setRoomTab] = aUseState('chat');
  const [ncmSong, setNcmSong] = aUseState(null);
  const [ncmLyric, setNcmLyric] = aUseState('');
  const [ncmQueue, setNcmQueue] = aUseState(null);
  const [ncmDrawerSong, setNcmDrawerSong] = aUseState(null);

  aUseEffect(() => { localStorage.setItem('ls-skin', skin); }, [skin]);
  aUseEffect(() => { localStorage.setItem('ls-cover', coverMode); }, [coverMode]);
  aUseEffect(() => { localStorage.setItem('ls-wall', wallOn ? '1' : '0'); }, [wallOn]);
  aUseEffect(() => { localStorage.setItem('ls-wall-veil', wallVeil); }, [wallVeil]);
  aUseEffect(() => { localStorage.setItem('ls-wall-blur', wallBlur); }, [wallBlur]);
  aUseEffect(() => { localStorage.setItem('ls-card-veil', cardVeil); }, [cardVeil]);
  aUseEffect(() => { localStorage.setItem('ls-card-blur', cardBlur); }, [cardBlur]);
  aUseEffect(() => { localStorage.setItem('ls-nav-veil', navVeil); }, [navVeil]);
  aUseEffect(() => { localStorage.setItem('ls-nav-blur', navBlur); }, [navBlur]);
  aUseEffect(() => { localStorage.setItem('ls-playmode', playMode); }, [playMode]);

  const cyclePlayMode = () => setPlayMode(m => m === 'loop' ? 'one' : m === 'one' ? 'shuffle' : 'loop');
  const libHas = (songId) => (window.__lsStore.library || []).some(x => x.songId === songId);
  const addToLib = (song) => {
    const s = window.__lsStore;
    if (!s.library.some(x => x.songId === song.id)) {
      s.library.unshift({ songId: song.id, title: song.title, artist: song.artist, cover: song.cover, pinned: false, notes: 0, last: '刚刚' });
      lsSaveStore(s); bump();
    }
  };
  const openSongById = (songId) => { const i = LS_SONGS.findIndex(s => s.id === songId); if (i >= 0) { setIdx(i); setDrawerIdx(i); } };
  const playSong = (song) => { setNcmSong(null); setNcmQueue(null); const i = LS_SONGS.findIndex(s => s.id === song.id); if (i >= 0) { setIdx(i); setCur(0); setPlaying(true); setView('player'); } };
  const loadNcm = (s) => {
    const base = window.__LS_API || '/api';
    setNcmLyric(''); setLoved(false);
    // 本地链接歌（用户在"本地"里自己添加的直链）：直接播，不走网易云
    if (s && s.url) { lsAudioEl.src = s.url; lsAudioEl.play().catch(function(){}); return; }
    // 预取命中：上一首快放完时已把这首的 URL 取好，切歌零 fetch —— 后台（锁屏）续播不断
    const pf = window.__lsPrefetch;
    if (pf && String(pf.id) === String(s.id) && pf.url) {
      lsAudioEl.src = pf.url; lsAudioEl.play().catch(function(){});
      window.__lsPrefetch = null;
      fetch(base + '/ncm/lyric?id=' + s.id).then(r => r.json()).then(l => { window.__lsTLyric = (l && l.tlyric) || ''; setNcmLyric((l && l.lyric) || ''); }).catch(function(){});
      return;
    }
    fetch(base + '/ncm/song-url?id=' + s.id).then(r => r.json()).then(d => { if (d && d.url) { lsAudioEl.src = d.url; lsAudioEl.play().catch(function(){}); } }).catch(function(){});
    fetch(base + '/ncm/lyric?id=' + s.id).then(r => r.json()).then(l => { window.__lsTLyric = (l && l.tlyric) || ''; setNcmLyric((l && l.lyric) || ''); }).catch(function(){});
  };
  // 快放完时预取下一首的播放地址（顺序模式），ended 后台切歌不再依赖临时 fetch
  aUseEffect(() => {
    if (!ncmQueue || !ncmQueue.list || ncmQueue.list.length < 2 || playMode === 'one') return;
    const curSong = ncmQueue.list[ncmQueue.idx];
    const d = (curSong && curSong.dur) || 0;
    if (!d || cur < d - 25) return;
    const ni = (ncmQueue.idx + 1) % ncmQueue.list.length;
    const nxt = ncmQueue.list[ni];
    if (!nxt || (window.__lsPrefetch && String(window.__lsPrefetch.id) === String(nxt.id))) return;
    window.__lsPrefetch = { id: nxt.id, url: nxt.url || null };
    if (nxt.url) return;
    const base = window.__LS_API || '/api';
    fetch(base + '/ncm/song-url?id=' + nxt.id).then(r => r.json()).then(d2 => {
      if (d2 && d2.url && window.__lsPrefetch && String(window.__lsPrefetch.id) === String(nxt.id)) window.__lsPrefetch.url = d2.url;
    }).catch(function(){});
  }, [cur, ncmQueue, playMode]);
  window.__lsPlayNcm = (song, list, i0) => {
    var lst = (list && list.length) ? list : [song];
    var i = (list && list.length) ? lst.findIndex(function(x){ return x.id === song.id; }) : 0;
    if (i < 0) i = 0;
    setNcmQueue({ list: lst, idx: i });
    setNcmSong(lst[i]); setCur(0); setView('player'); setPlaying(true);
    loadNcm(lst[i]);
  };
  const playNcmIdx = (i) => {
    var q = ncmQueue; if (!q) return;
    var ni = ((i % q.list.length) + q.list.length) % q.list.length;
    setNcmQueue({ ...q, idx: ni });
    setNcmSong(q.list[ni]); setCur(0); setPlaying(true);
    loadNcm(q.list[ni]);
  };
  // AI DJ 执行器：AI 回复里的 <<ACT>>{...}<<>> 经这里落到播放器
  window.__lsRunAction = (act) => {
    try {
      if (!act || !act.type) return;
      // 标记操作者：房间状态卡片据此显示对应昵称（AI 点歌/切歌 vs 用户手点）
      window.__lsActor = { who: 'ai', t: Date.now() };
      var base = window.__LS_API || '/api';
      if (act.type === 'play') {
        fetch(base + '/ncm/search?kw=' + encodeURIComponent(act.query || ''))
          .then(function(r){ return r.json(); })
          .then(function(d){
            var songs = (d && d.songs) || [];
            if (songs.length && window.__lsPlayNcm) window.__lsPlayNcm(songs[0], songs, 0);
          }).catch(function(){});
      } else if (act.type === 'next') {
        if (ncmQueue) playNcmIdx(ncmQueue.idx + 1);
      } else if (act.type === 'prev') {
        if (ncmQueue) playNcmIdx(ncmQueue.idx - 1);
      } else if (act.type === 'pause') {
        setPlaying(false);
      } else if (act.type === 'resume') {
        setPlaying(true);
      } else if (act.type === 'share') {
        // AI 分享歌曲：带 query 就搜出来贴卡片（不打断播放），不带就分享当前这首
        if (act.query) {
          fetch(base + '/ncm/search?kw=' + encodeURIComponent(act.query))
            .then(function(r){ return r.json(); })
            .then(function(d){ var s = d && d.songs && d.songs[0]; if (s && window.__lsRoomShare) window.__lsRoomShare('ai', s); }).catch(function(){});
        } else if (window.__lsRoomShare) window.__lsRoomShare('ai');
      }
    } catch (e) {}
  };

  // 打开真实歌详情抽屉（其它文件调用）
  window.__lsOpenNcmSong = (song) => { if (song) setNcmDrawerSong(song); };
  // 把 songs 追加到当前队列末尾（不打断当前播放）
  window.__lsQueueAppend = (songs) => {
    var add = (songs && songs.length) ? songs : (songs ? [songs] : []);
    if (!add.length) return;
    setNcmQueue(q => q ? { ...q, list: [...q.list, ...add] } : { list: add, idx: 0 });
  };

  // 播放模拟
  aUseEffect(() => { if (ncmSong) return; var s = LS_SONGS[idx]; var src = (s && s.src) || LS_DEMO_SRC[idx % LS_DEMO_SRC.length]; if (lsAudioEl.src !== src) lsAudioEl.src = src; }, [idx, ncmSong]);
  // 暴露"当前在放的歌"给 AI 桥（claude-bridge 读 window.__lsNowPlaying 拼进提示词）
  aUseEffect(() => {
    var cur = (ncmQueue && ncmQueue.list && ncmQueue.list.length) ? ncmQueue.list[ncmQueue.idx] : (ncmSong || LS_SONGS[idx]);
    window.__lsNowPlaying = (cur && cur.title) ? { title: cur.title, artist: cur.artist || '' } : null;
  }, [ncmSong, ncmQueue, idx]);
  aUseEffect(() => { if (playing) lsAudioEl.play().catch(function(){}); else lsAudioEl.pause(); }, [playing, idx]);
  window.__lsEv = { playMode: playMode, ncmQueue: ncmQueue, playNcmIdx: playNcmIdx, loadNcm: loadNcm };
  aUseEffect(() => {
    var onT = function(){ setCur(Math.floor(lsAudioEl.currentTime || 0)); };
    var onE = function(){
      var e = window.__lsEv || {};
      if (e.ncmQueue) {
        // 单曲循环：原地回到 0 重播，不重新请求 URL —— 后台（iOS 锁屏）时 fetch 会被挂起导致停播
        if (e.playMode === 'one') { try { lsAudioEl.currentTime = 0; lsAudioEl.play().catch(function(){}); } catch(er){} }
        else if (e.playNcmIdx) { e.playNcmIdx(e.playMode === 'shuffle' ? Math.floor(Math.random()*e.ncmQueue.list.length) : e.ncmQueue.idx + 1); }
      } else {
        setIdx(function(i){ return (e.playMode) === 'shuffle' ? Math.floor(Math.random()*LS_SONGS.length) : (i+1)%LS_SONGS.length; }); setCur(0);
      }
    };
    lsAudioEl.addEventListener('timeupdate', onT); lsAudioEl.addEventListener('ended', onE);
    return function(){ lsAudioEl.removeEventListener('timeupdate', onT); lsAudioEl.removeEventListener('ended', onE); };
  }, []);
  // rAF □□: □□□□□□□ audio □□□□□ cur□□□ timeupdate □□□□□□□□□□
  aUseEffect(function(){
    if (!playing) return;
    var raf, last = -1;
    var tick = function(){ if (!lsAudioEl.paused) { var s = Math.floor(lsAudioEl.currentTime || 0); if (s !== last) { last = s; setCur(s); } } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return function(){ if (raf) cancelAnimationFrame(raf); };
  }, [playing]);

  // 记住上次播放：mount 恢复（暂停态，不自动播，等用户点播放）
  aUseEffect(() => {
    try {
      var raw = localStorage.getItem('ls-lastplay'); if (!raw) return;
      var lp = JSON.parse(raw);
      if (lp && lp.list && lp.list.length) {
        var i = Math.max(0, Math.min(lp.list.length - 1, lp.idx || 0));
        setNcmQueue({ list: lp.list, idx: i });
        setNcmSong(lp.list[i]); setCur(lp.cur || 0); setPlaying(false);
        var base = window.__LS_API || '/api';
        if (lp.list[i].url) { lsAudioEl.src = lp.list[i].url; if (lp.cur) { try { lsAudioEl.currentTime = lp.cur; } catch(e){} } return; }
        fetch(base + '/ncm/lyric?id=' + lp.list[i].id).then(function(r){ return r.json(); }).then(function(l){ { window.__lsTLyric = (l && l.tlyric) || ''; setNcmLyric((l && l.lyric) || ''); }; }).catch(function(){});
        fetch(base + '/ncm/song-url?id=' + lp.list[i].id)
          .then(function(r){ return r.json(); })
          .then(function(d){ if (d && d.url) { lsAudioEl.src = d.url; if (lp.cur) { var sk = function(){ try { lsAudioEl.currentTime = lp.cur; } catch(e){} if (Math.abs((lsAudioEl.currentTime||0) - lp.cur) < 1.5) { lsAudioEl.removeEventListener('loadedmetadata', sk); lsAudioEl.removeEventListener('canplay', sk); } }; lsAudioEl.addEventListener('loadedmetadata', sk); lsAudioEl.addEventListener('canplay', sk); try { lsAudioEl.load(); } catch(e){} } } })
          .catch(function(){});
      }
    } catch (e) {}
  }, []);
  // 记住上次播放：队列变化即存 + 每 5s 存进度
  aUseEffect(() => {
    if (!ncmQueue || !ncmQueue.list || !ncmQueue.list.length) return;
    var save = function(){ try { localStorage.setItem('ls-lastplay', JSON.stringify({ list: ncmQueue.list, idx: ncmQueue.idx, cur: Math.floor(lsAudioEl.currentTime || 0) })); } catch (e) {} };
    save();
    var t = setInterval(save, 5000);
    return function(){ clearInterval(t); };
  }, [ncmQueue]);

  aUseEffect(() => {
    window.__lsApplyRemote = function(m){
      window.__lsSyncApplying = true;
      if (m.idx != null) setIdx(m.idx);
      if (m.action === 'play') setPlaying(true);
      else if (m.action === 'pause') setPlaying(false);
      if (m.action === 'seek' && m.val != null) { try { lsAudioEl.currentTime = m.val; } catch(e){} }
      setTimeout(function(){ window.__lsSyncApplying = false; }, 250);
    };
  }, []);
  aUseEffect(() => {
    if (window.__lsSyncApplying) return;
    if (window.__LS_SYNC && window.__LS_SYNC.send) window.__LS_SYNC.send({ action: playing ? 'play' : 'pause', idx: idx, time: lsAudioEl.currentTime || 0 });
  }, [playing, idx]);
  // MediaSession（灵动岛/锁屏/系统媒体控制）——显示封面·歌名·歌手，非网页链接
  aUseEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    var ms = navigator.mediaSession;
    var song = ncmSong || LS_SONGS[idx];
    if (song && typeof MediaMetadata !== 'undefined') {
      try {
        var cov = String((song && song.cover) || '');
        var isUrl = /^(https?:|blob:|data:|\/)/.test(cov);
        ms.metadata = new MediaMetadata({
          title: song.title || '',
          artist: song.artist || '',
          album: song.album || '一起听',
          artwork: isUrl ? [{ src: cov, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
      } catch (e) {}
    }
    try { ms.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
    var H = function (name, fn) { try { ms.setActionHandler(name, fn); } catch (e) {} };
    H('play', function () { setPlaying(true); });
    H('pause', function () { setPlaying(false); });
    H('nexttrack', function () { if (ncmQueue) playNcmIdx(ncmQueue.idx + 1); else { setIdx(function (i) { return (i + 1) % LS_SONGS.length; }); setCur(0); } });
    H('previoustrack', function () { if (ncmQueue) playNcmIdx(ncmQueue.idx - 1); else { setIdx(function (i) { return (i - 1 + LS_SONGS.length) % LS_SONGS.length; }); setCur(0); } });
    H('seekto', function (d) { try { if (d && d.seekTime != null) { lsAudioEl.currentTime = d.seekTime; setCur(Math.floor(d.seekTime)); } } catch (e) {} });
  }, [ncmSong, playing, idx, ncmQueue]);
  const skinObj = LS_SKINS.find(s => s.id === skin) || LS_SKINS[0];
  const titles = { player: '此刻', playlist: '歌单', browse: '曲库', together: '一起听' };
  const kickers = { player: '正在一起听', playlist: '资料 · 歌单', browse: '搜索 · 日推 · 私人FM', together: '听歌档案 · 歌库 · 设置' };

  return (
    <div className={'ls-app ls-skin-' + skin + (wallOn ? ' has-wall' : '') + (wallOn && (wallBlur || 0) <= 0 ? ' no-blur' : '')} style={{ '--ls-wall-veil': wallVeil, '--ls-wall-blur': wallBlur + 'px', '--ls-card-veil': cardVeil, '--ls-card-blur': cardBlur, '--ls-nav-a': navVeil, '--ls-nav-blur': navBlur + 'px', ...(skin === 'custom' ? Object.assign({ '--ls-bg': customAc, '--ls-amb': customAc }, customVars.accent ? { '--ls-gold': customVars.accent, '--ls-eve': customVars.accent } : {}, customVars.panel ? { '--ls-panel': customVars.panel, '--ls-panel2': customVars.panel } : {}, customVars.ink ? { '--ls-ink': customVars.ink } : {}, customVars.line ? { '--ls-line': customVars.line, '--ls-line-soft': customVars.line } : {}, customVars.lyric ? { '--ls-lyric-dim': customVars.lyric } : {}) : {}), ...(darkMode ? { '--ls-bg': '#17171b', '--ls-bg2': '#1f1f25', '--ls-panel': '#26262e', '--ls-panel2': '#2e2e37', '--ls-ink': '#f0eef2', '--ls-ink-dim': '#b0aab8', '--ls-ink-faint': '#7a7585', '--ls-line': '#3a3a44', '--ls-line-soft': '#33333c', '--ls-amb': '#17171b', '--ls-shadow': 'rgba(0,0,0,.5)' } : {}) }}>
      <div className="ls-wall"><image-slot id="ls-wallpaper" shape="rect" cap="3000" placeholder="拖入你们的背景"></image-slot></div>
      <div className="ls-grain"></div>
      <div className="ls-col">
        {/* 顶栏 */}
        <div className="ls-top">
          <div className="ls-top-title">
            <div className="ls-top-kicker">{kickers[view]}</div>
            <div className="ls-top-h">{titles[view]}</div>
          </div>
          <button className="ls-skinbtn" onClick={() => setSkinOpen(true)}>
            <span className="sw"></span>{skinObj.name}
          </button>
        </div>

        {/* 视图 */}
        {view === 'player' && (
          <LSPlayerView {...{ idx, setIdx, playing, setPlaying, cur, setCur, loved, setLoved, coverMode, setCoverMode, playMode, cyclePlayMode, ncmSong, ncmLyric, ncmQueue, playNcmIdx }}
            onOpenDrawer={(i) => { if (ncmSong) setNcmDrawerSong(ncmSong); else setDrawerIdx(i); }}
            onPickLyric={(line) => setAsk({ song: LS_SONGS[idx], passage: line })}
            onOpenQueue={() => setQueueOpen(true)}
            onOpenComments={(s) => setCommentsSong(s)}
            onEnterRoom={() => setRoomOpen(true)} />
        )}
        {view === 'playlist' && <LSPlaylistView onPlay={playSong} onOpenSong={(s) => setNcmDrawerSong(s)} openPl={openPl} setOpenPl={setOpenPl} wallOn={wallOn} setWallOn={setWallOn} wallVeil={wallVeil} setWallVeil={setWallVeil} wallBlur={wallBlur} setWallBlur={setWallBlur} cardVeil={cardVeil} setCardVeil={setCardVeil} cardBlur={cardBlur} setCardBlur={setCardBlur} navVeil={navVeil} setNavVeil={setNavVeil} navBlur={navBlur} setNavBlur={setNavBlur} skin={skin} setSkin={setSkin} customAc={customAc} setCustomAc={setCustomAc} customVars={customVars} setCustomVars={setCustomVars} darkMode={darkMode} setDarkMode={setDarkMode} />}
        {view === 'browse' && <LSBrowseView onPlay={playSong} onOpenSong={(s) => setNcmDrawerSong(s)} onOpenFM={() => setFmOpen(true)} />}
        {view === 'together' && (
          <div className="ls-together">
            <div className="ls-seg ls-tog-seg">
              {[['archive', '听歌档案'], ['model', '模型设置']].map(([k, l]) => (
                <button key={k} className={togetherTab === k ? 'on' : ''} onClick={() => setTogetherTab(k)}>{l}</button>
              ))}
            </div>
            {togetherTab === 'archive' && <LSArchiveView onOpenSong={openSongById} />}
            {togetherTab === 'model' && <LSModelInline bump={bump} />}
          </div>
        )}

        {/* 底栏 */}
        <div className="ls-nav">
          <button className={view === 'player' ? 'on' : ''} onClick={() => setView('player')}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>
            <span className="lb">此刻</span>
          </button>
          <button className={view === 'playlist' ? 'on' : ''} onClick={() => setView('playlist')}>
            <svg viewBox="0 0 24 24"><path d="M4 6h11M4 12h11M4 18h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="18" cy="16" r="3"/><path d="M21 16V7l-3 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="lb">歌单</span>
          </button>
          <button className={view === 'browse' ? 'on' : ''} onClick={() => setView('browse')}>
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <span className="lb">曲库</span>
          </button>
          <button className={view === 'together' ? 'on' : ''} onClick={() => setView('together')}>
            <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.6 2 5 5.4 5c2 0 3.3 1.1 4.1 2.3C10.3 6.1 11.6 5 13.6 5 17 5 18.6 8.6 17 11.8 14.5 16.4 12 21 12 21z"/></svg>
            <span className="lb">一起听</span>
          </button>
        </div>
      </div>

      {/* A 详情抽屉 */}
      {drawerIdx !== null && (
        <LSSongDrawer song={LS_SONGS[drawerIdx]} ncmId={ncmSong && ncmSong.id} loved={loved} onToggleLove={() => setLoved(l => !l)}
          inLibrary={libHas(LS_SONGS[drawerIdx].id)} onAddLibrary={() => addToLib(LS_SONGS[drawerIdx])}
          onAskAI={(s, line) => { setDrawerIdx(null); setAsk({ song: s, passage: line || s.tag }); }}
          onClose={() => setDrawerIdx(null)} />
      )}
      {/* A' 真实歌详情抽屉（网易云等真实歌，features 用 ncmSong 显示） */}
      {ncmDrawerSong && (
        <LSSongDrawer song={ncmDrawerSong} ncmSong={ncmDrawerSong} ncmId={ncmDrawerSong.id} loved={loved} onToggleLove={() => setLoved(l => !l)}
          inLibrary={libHas(ncmDrawerSong.id)} onAddLibrary={() => addToLib(ncmDrawerSong)}
          onAskAI={(sg, line) => { setNcmDrawerSong(null); setAsk({ song: sg, passage: line || (sg && sg.tag) || (sg && sg.title) }); }}
          onClose={() => setNcmDrawerSong(null)} />
      )}
      {/* B 问 Ta */}
      {ask && <LSAskBar song={ask.song} passage={ask.passage} onClear={() => { setAsk(null); bump(); }} onSaved={bump} />}
      {/* 队列 */}
      {queueOpen && <LSQueueSheet idx={idx} setIdx={(i) => { setIdx(i); setCur(0); setPlaying(true); }} ncmQueue={ncmQueue} playNcmIdx={playNcmIdx} playMode={playMode} cyclePlayMode={cyclePlayMode} onClose={() => setQueueOpen(false)} />}
      {/* 评论 · 全屏 */}
      {commentsSong && <LSCommentsFull song={commentsSong} onClose={() => setCommentsSong(null)} />}
      {savePickerSong && <LSSavePicker song={savePickerSong} onClose={() => setSavePickerSong(null)} />}
      {/* 私人 FM 抽屉 */}
      {fmOpen && (
        <div className="ls-sheet-mask" onClick={() => setFmOpen(false)}>
          <div className="ls-fm-sheet" onClick={e => e.stopPropagation()}>
            <div className="ls-queue-grip"></div>
            <LSFMView onOpenSong={(it) => {}} bump={bump} />
          </div>
        </div>
      )}
      {/* E 模型设置弹层（保留，供其它入口）*/}
      {roomOpen && (
        <div className="ls-room-mask" onClick={() => setRoomOpen(false)}>
          <div className="ls-room-wrap" onClick={e => e.stopPropagation()}>
            {/* 房间背景：弹层最底层，铺到顶栏后面（顶栏磨砂才有内容可磨）；显隐由房间设置的开关控制 */}
            <div className="ls-room-wallbg" aria-hidden="true" style={{ display: 'none' }}><image-slot id="ls-room-bg" cap="3000" shape="rect" placeholder=""></image-slot></div>
            <div className="ls-room-head">
              <button className="ls-room-back" onClick={() => setRoomOpen(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
              <div className="ls-room-title">{(window.LS_PEOPLE && window.LS_PEOPLE.yu && window.LS_PEOPLE.yu.name) || 'AI'}</div>
              <button className="ls-room-gear" onClick={() => { if (window.__lsOpenRoomSet) window.__lsOpenRoomSet(); }} aria-label="房间设置"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button>
            </div>
            <LSChatView tab={roomTab} setTab={setRoomTab} idx={idx} setIdx={setIdx} playing={playing} setPlaying={setPlaying} ncmSong={ncmSong} ncmQueue={ncmQueue} playNcmIdx={playNcmIdx} cyclePlayMode={cyclePlayMode} playMode={playMode} loved={loved} setLoved={setLoved} cur={cur} addToLib={addToLib} ncmLyric={ncmLyric} />
          </div>
        </div>
      )}

      {/* 换肤 */}
      {skinOpen && (
        <div className="ls-skinsheet-mask" onClick={() => setSkinOpen(false)}>
          <div className="ls-skinsheet" onClick={e => e.stopPropagation()}>
            <h3>换一种光</h3>
            <div className="sub">Four moods · same us</div>
            <div className="ls-skingrid">
              {LS_SKINS.map(s => (
                <button key={s.id} className={'ls-skincard' + (s.id === skin ? ' on' : '')} onClick={() => { setSkin(s.id); setSkinOpen(false); }}>
                  <div className="sw" style={{ background: s.bg }}><i style={{ background: s.ac }}></i></div>
                  <div className="nm"><b>{s.name}</b><i>{s.po}</i></div>
                </button>
              ))}
            </div>
            <div className="ls-wall-row">
              <div className="ls-wall-prev"><image-slot id="ls-wallpaper" shape="rounded" radius="12" cap="3000" placeholder="拖图"></image-slot></div>
              <div className="tx"><b>自定义背景</b><i>拖一张你们的照片当壁纸</i></div>
              <button className={'ls-wall-tg' + (wallOn ? ' on' : '')} onClick={() => setWallOn(v => !v)}></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ls-root')).render(<LSApp />);
