/* 本機狀態：設定、檔案（出生資料）、自訂模板、解讀紀錄。全部存在 localStorage。 */

const K = {
  settings: 'xj.settings',
  profiles: 'xj.profiles',
  current: 'xj.current',
  templates: 'xj.templates',
  records: 'xj.records',
  drafts: 'xj.drafts',
  candidates: 'xj.candidates',
  qianSets: 'xj.qiansets',
};

const DEFAULT_SETTINGS = {
  // 外觀
  theme: 'system',            // system | dark | light
  fontScale: 1,
  density: 'normal',          // compact | normal | roomy
  // 動態
  motion: 'full',             // off | light | full
  swipeNav: true,
  haptics: true,
  pointerGlow: true,
  // 命理參數
  tzOffset: 8,                // 小時
  city: '台北',
  lat: 25.0330,
  lon: 121.5654,
  trueSolarTime: false,       // 真太陽時校正
  lateZiRule: 'next',         // next=晚子時算隔天 | same=不換日
  wageWaiRule: 'classic',     // classic | simple（外格算法）
  numeralRule: true,          // 一～十依數值計筆畫
  // 提示詞預設
  promptLang: '繁體中文',
  promptTone: '溫和但直接',
  promptDepth: '中等',
  promptFormat: 'Markdown 小標＋條列',
  promptDisclaimer: true,
  promptPrefix: '',
  promptSuffix: '',
  // 內部：上次看過的版號
  seenVersion: null,
  qianSetId: 'xuanjian60',
  qianNeed: 1,               // 擲筊確認需要幾個聖筊（1 或 3）
  qianVertical: false,       // 籤詩直書（部分字型缺垂直度量，預設關閉）
  dayPurpose: 'open',        // 擇日預設事項
  compassNorthUp: true,      // 方位盤上北（手機指南針畫法）；false 為傳統上南
  zhaiSit: '',               // 住宅坐向（八卦方位名，空字串為未設定）
  register: 'bai',           // 語調：bai 白話文 / wen 文言文
  homeCards: {},             // 首頁各區塊開關（空物件＝全部顯示）
  homeTiles: [],             // 首頁工具區要放哪幾個、順序（空陣列＝全部）
  scoreColor: true,          // 分數環用色階（0 紅 → 100 綠）；關閉則維持純黑白
  chartEffects: 'full',      // 命盤特效：off 關閉 / subtle 輕量 / full 完整
  onboarded: false,          // 新手教學看過了沒
};

const listeners = new Set();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch { return structuredClone(fallback); }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const store = {
  get settings() { return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) }; },
  setSettings(patch) {
    const next = { ...this.settings, ...patch };
    write(K.settings, next);
    applyChrome(next);
    emit('settings', next);
    return next;
  },
  resetSettings() { write(K.settings, {}); applyChrome(this.settings); emit('settings', this.settings); },

  get profiles() { return read(K.profiles, []); },
  set profiles(v) { write(K.profiles, v); emit('profiles', v); },
  get currentId() { return read(K.current, null); },
  set currentId(v) { write(K.current, v); emit('profiles', this.profiles); },
  get current() {
    const list = this.profiles;
    return list.find(p => p.id === this.currentId) || list[0] || null;
  },
  saveProfile(p) {
    const list = this.profiles;
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = p; else list.push(p);
    this.profiles = list;
    if (!this.currentId) this.currentId = p.id;
    return p;
  },
  removeProfile(id) {
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.currentId === id) this.currentId = this.profiles[0]?.id || null;
  },

  get templates() { return read(K.templates, []); },
  set templates(v) { write(K.templates, v); emit('templates', v); },
  saveTemplate(t) {
    const list = this.templates;
    const i = list.findIndex(x => x.id === t.id);
    if (i >= 0) list[i] = t; else list.unshift(t);
    this.templates = list;
    return t;
  },
  removeTemplate(id) { this.templates = this.templates.filter(t => t.id !== id); },

  get records() { return read(K.records, []); },
  set records(v) { write(K.records, v); emit('records', v); },
  addRecord(r) { this.records = [r, ...this.records].slice(0, 300); return r; },
  removeRecord(id) { this.records = this.records.filter(r => r.id !== id); },
  updateRecord(id, patch) {
    this.records = this.records.map(r => (r.id === id ? { ...r, ...patch } : r));
    return this.records.find(r => r.id === id);
  },
  /** 所有用過的標籤，依出現次數排序 */
  get allTags() {
    const n = {};
    for (const r of this.records) for (const t of (r.tags || [])) n[t] = (n[t] || 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  },
  /** 所有填過的模型名 */
  get allModels() {
    return [...new Set(this.records.map(r => r.model).filter(Boolean))];
  },

  get candidates() { return read(K.candidates, []); },
  set candidates(v) { write(K.candidates, v); emit('candidates', v); },
  addCandidate(c) { this.candidates = [c, ...this.candidates.filter(x => x.full !== c.full)].slice(0, 60); return c; },
  removeCandidate(id) { this.candidates = this.candidates.filter(c => c.id !== id); },

  get qianSets() { return read(K.qianSets, []); },
  set qianSets(v) { write(K.qianSets, v); emit('qianSets', v); },
  addQianSet(set) { this.qianSets = [set, ...this.qianSets.filter(s => s.id !== set.id)].slice(0, 12); return set; },
  removeQianSet(id) { this.qianSets = this.qianSets.filter(s => s.id !== id); },

  get drafts() { return read(K.drafts, {}); },
  setDraft(key, value) { const d = this.drafts; d[key] = value; write(K.drafts, d); },

  exportAll() {
    return {
      app: 'xuanjian', version: 1, exportedAt: new Date().toISOString(),
      settings: this.settings, profiles: this.profiles, currentId: this.currentId,
      templates: this.templates, records: this.records, candidates: this.candidates,
      qianSets: this.qianSets,
    };
  },
  importAll(data, { merge = false } = {}) {
    if (!data || data.app !== 'xuanjian') throw new Error('檔案格式不符');
    if (data.settings) write(K.settings, data.settings);
    if (data.profiles) write(K.profiles, merge ? dedupe([...this.profiles, ...data.profiles]) : data.profiles);
    if (data.templates) write(K.templates, merge ? dedupe([...this.templates, ...data.templates]) : data.templates);
    if (data.records) write(K.records, merge ? dedupe([...this.records, ...data.records]) : data.records);
    if (data.candidates) write(K.candidates, merge ? dedupe([...this.candidates, ...data.candidates]) : data.candidates);
    if (data.qianSets) write(K.qianSets, merge ? dedupe([...this.qianSets, ...data.qianSets]) : data.qianSets);
    if (data.currentId) write(K.current, data.currentId);
    applyChrome(this.settings);
    emit('all', null);
  },
  clearAll() { Object.values(K).forEach(k => localStorage.removeItem(k)); applyChrome(this.settings); emit('all', null); },
};

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(x => (x && !seen.has(x.id)) && seen.add(x.id));
}

export function onStore(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind, payload) { listeners.forEach(fn => fn(kind, payload)); }

/** 把設定套用到 <html> 上 */
export function applyChrome(s = store.settings) {
  const root = document.documentElement;
  const dark = s.theme === 'system'
    ? matchMedia('(prefers-color-scheme: dark)').matches
    : s.theme === 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.motion = s.motion;
  root.dataset.density = s.density;
  root.style.setProperty('--font-scale', s.fontScale);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a0a0a' : '#ffffff');
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export { DEFAULT_SETTINGS };
