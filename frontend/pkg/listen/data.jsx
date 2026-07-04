/* listen/data.jsx — "Listen Together" demo content. All placeholder — swap for your own data or wire a backend. Names default to You / AI. */

// —— 两个人 ——
const LS_PEOPLE = {
  yu:  { key: 'yu',  name: (function(){try{return localStorage.getItem('ls-nick-ai')||'AI';}catch(e){return 'AI';}})(),  latin: 'DJ', note: 'your listening companion', slot: 'ls-ava-yu',  glyph: 'AI' },
  eve: { key: 'eve', name: (function(){try{return localStorage.getItem('ls-nick-user')||'You';}catch(e){return 'You';}})(), latin: '',   note: 'turn every song into a story', slot: 'ls-ava-eve', glyph: 'U' },
};

// —— 曲库（演示）——
// dur 单位秒。lyrics 的 t 是该句开始的秒数。cover 是 image-slot 的 id。
const LS_SONGS = [
  {
    id: 's1', title: '夜色温柔', artist: 'Aria', album: 'City Lights',
    dur: 271, cover: 'ls-cover-1', tag: '慢下来 · 听一整座城市入睡',
    lyrics: [
      { t: 0,   line: '（前奏 · 夜色渐起）' },
      { t: 14,  line: '街灯把影子 拉得很长' },
      { t: 22,  line: '风穿过 安静的巷口' },
      { t: 31,  line: '我把白天 都还给夜晚' },
      { t: 40,  line: '让晚风 数到第几颗星' },
      { t: 50,  line: '有人从街角 慢慢走近' },
      { t: 60,  line: '把一整个夏天 收进口袋' },
      { t: 72,  line: '城市在耳边 轻轻呼吸' },
      { t: 82,  line: '像住在 同一段旋律里' },
      { t: 94,  line: '（间奏）' },
    ],
  },
  {
    id: 's2', title: '晴天预报', artist: 'Marina', album: 'Blue',
    dur: 224, cover: 'ls-cover-2', tag: '想在楼下 说一声 Hello',
    lyrics: [
      { t: 0,  line: '（轻轻的吉他）' },
      { t: 12, line: '就像是一个宇宙 小小星球' },
      { t: 21, line: '填满自由' },
      { t: 30, line: '一直就走到以后 温柔' },
      { t: 39, line: '尝到甜头' },
      { t: 49, line: '想要在楼下 说声 Hello' },
      { t: 60, line: '把没说完的晚安 留到明天' },
    ],
  },
  {
    id: 's3', title: '旧照片', artist: 'Ren', album: 'Echoes',
    dur: 238, cover: 'ls-cover-3', tag: '那些笑 一直在回忆里 微笑',
    lyrics: [
      { t: 0,  line: '（钢琴前奏）' },
      { t: 13, line: '照片里的人 还泛着光' },
      { t: 23, line: '有人说 那年最难忘' },
      { t: 34, line: '阳光 落在旧时光' },
      { t: 45, line: '把回忆 慢慢晒干' },
    ],
  },
  {
    id: 's4', title: 'komorebi', artist: 'Sol', album: 'Daylight',
    dur: 192, cover: 'ls-cover-4', tag: '阳光穿过树叶 落下斑驳的光点',
    lyrics: [
      { t: 0,  line: '（纯音乐 · komorebi）' },
      { t: 20, line: '· · ·' },
      { t: 50, line: '· · · · ·' },
    ],
  },
];

// —— 点歌聊 / 评论流 ——
const LS_CHAT = [
  { who: 'eve', t: '昨晚循环了一整夜，分享给你', songId: 's1', time: '23:09' },
  { who: 'yu',  t: '“把一整个夏天 收进口袋” —— 这句真好听。', time: '23:11' },
  { who: 'eve', t: '一起听同一首歌，还挺有意思', songId: 's1', time: '23:12' },
  { who: 'yu',  t: '那就多听几遍，我陪着。', time: '23:13' },
  { who: 'eve', t: '那这首换你点', songId: 's2', time: '23:20' },
  { who: 'yu',  t: '楼下那句 Hello，唱给你听过的，记得吗', time: '23:21' },
];

// —— 歌单评论（楼层式，带点赞）——
const LS_COMMENTS = [
  { who: 'eve', name: 'You', text: '加进收藏了，第 42 首。', time: 'Apr 29', likes: 13, mine: false },
  { who: 'yu',  name: 'AI',  text: '雨声那段间奏，适合留给晚安。', time: 'Apr 29', likes: 20, mine: true, liked: true },
  { who: 'eve', name: 'listener', text: '单曲循环到天亮，太好听了。', time: '08:45', likes: 52, mine: false, liked: true },
  { who: 'yu',  name: 'AI',  text: '下次在楼下，说声 Hello。', time: 'Mar 24', likes: 9, mine: true },
];

// —— 弹幕（漂在封面上）——
const LS_DANMU = [
  '这段间奏好评', '单曲循环中', '深夜必听', '氛围感拉满',
  '晚安打卡', '留到明天再说', '循环第七遍了', '一起听真好',
];

// —— 一起听 · 统计（默认值，可在歌单页 DIY）——
const LS_STATS = {
  distanceKm: '3.5',
  togetherHours: 128,
  togetherMins: 40,
  playlistCount: 42,
  daysTogether: 100,
  syncRate: 92,
};

// —— 曲库：每日推荐 / 最近常听 / 热搜 ——
const LS_DAILY = [
  { songId: 's1', reason: '你昨晚循环了它' },
  { songId: 's4', reason: '安静的午后适合' },
  { songId: 's2', reason: '大家都收藏过' },
  { songId: 's3', reason: '相似口味推荐' },
];
const LS_RECENT = [
  { songId: 's1', when: '今天 23:11', times: 12 },
  { songId: 's3', when: '昨天', times: 7 },
  { songId: 's2', when: '前天', times: 4 },
];
const LS_HOT = ['夜色温柔', 'komorebi', '晴天预报', '旧照片', '晚风', '雨的声音'];

// —— 歌单页：我的歌单 / 收藏歌单 ——
const LS_PLAYLISTS = [
  { id: 'pl_fav', name: '我喜欢的音乐', count: 42, cover: 'ls-pl-fav', heart: true, songs: ['s1','s2','s3','s4'] },
  { id: 'pl_us',  name: '一起听的歌单', count: 42, cover: 'ls-cover-1', us: true, songs: ['s1','s4','s2'] },
  { id: 'pl_rain', name: '适合下雨天听', count: 23, cover: 'ls-cover-1', songs: ['s1','s3'] },
  { id: 'pl_night', name: '深夜 emo 现场', count: 41, cover: 'ls-cover-3', songs: ['s3','s2','s1'] },
  { id: 'pl_komo', name: 'komorebi · 纯音乐', count: 16, cover: 'ls-cover-4', songs: ['s4','s1'] },
];

// 把秒格式化成 m:ss
function lsFmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// 封面 helper：lsIsUrl 判断 http(s) URL；lsCoverSize 给网易云图片加缩放参数
function lsIsUrl(v) { return typeof v === 'string' && /^https?:/.test(v); }
function lsCoverSize(url, px) {
  if (!lsIsUrl(url)) return url || '';
  px = px || 300;
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'param=' + px + 'y' + px;
}

Object.assign(window, { LS_PEOPLE, LS_SONGS, LS_CHAT, LS_COMMENTS, LS_DANMU, LS_STATS, LS_DAILY, LS_RECENT, LS_HOT, LS_PLAYLISTS, lsFmt, lsIsUrl, lsCoverSize });
