/* Real relationship stats: played time, anniversary, separate hearts, and sync rate. */

const LS_BOND_KEY = 'ls-bond-v1';
const LS_BOND_DEFAULT_START = '2026-06-03';
let __lsBondActiveAt = 0;

function lsBondTitle(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function lsBondSongKey(song) {
  if (song && song.id != null && String(song.id) !== '') return 'id:' + String(song.id);
  return 'title:' + lsBondTitle(song && song.title);
}

function lsBondEmpty() {
  return {
    version: 1,
    relationshipStart: LS_BOND_DEFAULT_START,
    listenSeconds: 0,
    likes: { user: {}, ai: {} },
    migratedLibrary: false,
    migratedChat: false,
  };
}

function lsBondKnownSongs() {
  const out = [];
  try {
    (window.__lsStore && window.__lsStore.library || []).forEach(function (x) {
      if (x && x.title) out.push({ id: x.songId, title: x.title, artist: x.artist || '' });
    });
  } catch (e) {}
  try {
    const lp = JSON.parse(localStorage.getItem('ls-lastplay') || 'null');
    (lp && lp.list || []).forEach(function (x) { if (x && x.title) out.push(x); });
  } catch (e) {}
  try { (window.LS_SONGS || []).forEach(function (x) { if (x && x.title) out.push(x); }); } catch (e) {}
  return out;
}

function lsBondRead() {
  let b;
  try { b = JSON.parse(localStorage.getItem(LS_BOND_KEY) || 'null'); } catch (e) { b = null; }
  if (!b || typeof b !== 'object') b = lsBondEmpty();
  b.version = 1;
  b.relationshipStart = /^\d{4}-\d{2}-\d{2}$/.test(String(b.relationshipStart || '')) ? b.relationshipStart : LS_BOND_DEFAULT_START;
  b.listenSeconds = Math.max(0, Number(b.listenSeconds) || 0);
  b.likes = b.likes && typeof b.likes === 'object' ? b.likes : {};
  b.likes.user = b.likes.user && typeof b.likes.user === 'object' ? b.likes.user : {};
  b.likes.ai = b.likes.ai && typeof b.likes.ai === 'object' ? b.likes.ai : {};

  let changed = false;
  // Migrate the existing local collection as explicit user hearts once.
  if (!b.migratedLibrary) {
    try {
      (window.__lsStore && window.__lsStore.library || []).forEach(function (x) {
        if (!x || !x.title) return;
        const song = { id: x.songId, title: x.title, artist: x.artist || '' };
        const key = lsBondSongKey(song);
        if (key !== 'title:') b.likes.user[key] = { id: String(x.songId || ''), title: x.title, artist: x.artist || '', ts: Number(x.last) || Date.now() };
      });
    } catch (e) {}
    b.migratedLibrary = true;
    changed = true;
  }

  // Migrate Elias heart events from the room timeline still stored on this device.
  if (!b.migratedChat) {
    try {
      const known = lsBondKnownSongs();
      const chat = JSON.parse(localStorage.getItem('ls-room-chat') || '[]');
      const aiName = String((window.LS_PEOPLE && window.LS_PEOPLE.yu && window.LS_PEOPLE.yu.name) || 'Elias');
      const userName = String((window.LS_PEOPLE && window.LS_PEOPLE.eve && window.LS_PEOPLE.eve.name) || 'You');
      (Array.isArray(chat) ? chat : []).forEach(function (msg) {
        const m = /^(.+?)\s+\u7ea2\u5fc3\u4e86\u300a(.+?)\u300b/.exec(String(msg && msg.t || ''));
        if (!m) return;
        const actor = m[1].trim();
        const isUser = actor === '\u6211' || actor === userName || actor === 'You';
        const isAI = actor === aiName || actor === 'Elias' || actor === 'AI' || !isUser;
        if (!isAI) return;
        const title = m[2].trim();
        const found = known.find(function (x) { return lsBondTitle(x.title) === lsBondTitle(title); }) || { title: title };
        const key = lsBondSongKey(found);
        if (key !== 'title:') b.likes.ai[key] = { id: String(found.id || ''), title: title, artist: found.artist || '', ts: Number(msg.ts) || Date.now() };
      });
    } catch (e) {}
    b.migratedChat = true;
    changed = true;
  }
  if (changed) { try { localStorage.setItem(LS_BOND_KEY, JSON.stringify(b)); } catch (e) {} }
  return b;
}

function lsBondEmit() {
  try { window.dispatchEvent(new CustomEvent('duetto:bond-stats')); } catch (e) {}
}

function lsBondSave(b) {
  try { localStorage.setItem(LS_BOND_KEY, JSON.stringify(b)); } catch (e) {}
  lsBondEmit();
  return b;
}

function lsBondSetLike(who, song, liked) {
  if (who !== 'ai' && who !== 'user') return;
  const b = lsBondRead();
  const key = lsBondSongKey(song);
  const alias = 'title:' + lsBondTitle(song && song.title);
  if (!key || key === 'title:') return;
  // Once a real song id is known, merge older title-only records for both people.
  if (key !== alias && alias !== 'title:') {
    ['user', 'ai'].forEach(function (role) {
      if (b.likes[role][alias]) {
        b.likes[role][key] = Object.assign({}, b.likes[role][alias], { id: String(song.id || '') });
        delete b.likes[role][alias];
      }
    });
  }
  if (liked) b.likes[who][key] = { id: String(song.id || ''), title: String(song.title || ''), artist: String(song.artist || ''), ts: Date.now() };
  else { delete b.likes[who][key]; if (alias !== key) delete b.likes[who][alias]; }
  lsBondSave(b);
}

function lsBondSetRelationshipStart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return;
  const b = lsBondRead();
  if (b.relationshipStart === value) return;
  b.relationshipStart = value;
  lsBondSave(b);
}

function lsBondCheckpoint() {
  if (!__lsBondActiveAt) return;
  const now = Date.now();
  const whole = Math.floor((now - __lsBondActiveAt) / 1000);
  if (whole < 1) return;
  const b = lsBondRead();
  b.listenSeconds += whole;
  __lsBondActiveAt += whole * 1000;
  lsBondSave(b);
}

function lsBondPlayback(active) {
  if (active) {
    if (!__lsBondActiveAt) { __lsBondActiveAt = Date.now(); lsBondEmit(); }
    return;
  }
  if (!__lsBondActiveAt) return;
  lsBondCheckpoint();
  __lsBondActiveAt = 0;
  lsBondEmit();
}

function lsBondDays(startValue) {
  const p = String(startValue || LS_BOND_DEFAULT_START).split('-').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(p[0], p[1] - 1, p[2]).getTime();
  return Math.max(0, Math.floor((today - start) / 86400000) + 1);
}

function lsBondStats() {
  const b = lsBondRead();
  const live = __lsBondActiveAt ? Math.max(0, Math.floor((Date.now() - __lsBondActiveAt) / 1000)) : 0;
  const seconds = Math.max(0, Math.floor(b.listenSeconds + live));
  const userKeys = Object.keys(b.likes.user);
  const aiKeys = Object.keys(b.likes.ai);
  const union = new Set(userKeys.concat(aiKeys));
  const common = userKeys.filter(function (k) { return !!b.likes.ai[k]; }).length;
  const totalMins = Math.floor(seconds / 60);
  const out = {
    relationshipStart: b.relationshipStart,
    daysTogether: lsBondDays(b.relationshipStart),
    listenSeconds: seconds,
    togetherHours: Math.floor(totalMins / 60),
    togetherMins: totalMins % 60,
    commonFavorites: common,
    userFavorites: userKeys.length,
    aiFavorites: aiKeys.length,
    syncRate: union.size ? Math.round(common / union.size * 100) : 0,
  };
  try {
    Object.assign(window.LS_STATS || {}, {
      togetherHours: out.togetherHours,
      togetherMins: out.togetherMins,
      daysTogether: out.daysTogether,
      syncRate: out.syncRate,
    });
  } catch (e) {}
  return out;
}

function lsBondElapsedText(stats) {
  const s = stats || lsBondStats();
  return s.togetherHours + ' \u5c0f\u65f6 ' + s.togetherMins + ' \u5206\u949f';
}

function lsUseBondStats() {
  const [, setRev] = React.useState(0);
  React.useEffect(function () {
    const refresh = function () { setRev(function (x) { return (x + 1) % 100000; }); };
    window.addEventListener('duetto:bond-stats', refresh);
    const timer = setInterval(refresh, 1000);
    return function () { window.removeEventListener('duetto:bond-stats', refresh); clearInterval(timer); };
  }, []);
  return lsBondStats();
}

Object.assign(window, {
  lsBondStats, lsBondElapsedText, lsBondSetLike, lsBondSetRelationshipStart,
  lsBondPlayback, lsBondCheckpoint, lsUseBondStats,
});
