/* 快速搜尋：⌘K／Ctrl+K 或吸頂列的放大鏡。
   搜功能頁、提示詞模板、解讀紀錄與出生檔案，打字就能直接跳過去。 */
import { html, raw, $, $$, sheet, fmtDate } from './ui.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { isPrivate, nameOf } from './privacy.js';

const norm = (s) => String(s || '').toLowerCase();

function buildIndex(NAV) {
  const items = NAV.map(n => ({
    kind: '功能', icon: n.icon, title: n.t, sub: n.eyebrow, href: `#${n.p}`,
    hay: norm(`${n.t} ${n.eyebrow} ${n.p}`),
  }));
  for (const p of store.profiles) {
    const name = nameOf(p);
    // 保密檔案連搜尋結果都不露出生日，也不讓生日當搜尋關鍵字
    items.push({
      kind: '檔案', icon: 'profile', title: name,
      sub: isPrivate(p) ? '保密' : `${p.birth.y}-${String(p.birth.m).padStart(2, '0')}-${String(p.birth.d).padStart(2, '0')}　${p.city || ''}`,
      href: '#/profile',
      hay: norm(isPrivate(p) ? `${name} ${p.label || ''}` : `${name} ${p.label} ${p.city} ${p.birth.y}`),
    });
  }
  for (const r of store.records.slice(0, 80)) {
    items.push({
      kind: '紀錄', icon: 'records', title: r.templateName || '解讀',
      sub: `${r.who || ''}${r.model ? '　' + r.model : ''}　${fmtDate(r.createdAt)}`,
      href: `#/records?id=${r.id}`,
      hay: norm(`${r.templateName} ${r.who} ${r.model} ${(r.tags || []).join(' ')} ${r.content}`),
    });
  }
  return items;
}

/** 開啟快速搜尋；templates 由呼叫端傳進來，避免這裡再去 import 提示詞模組 */
export async function openPalette(NAV) {
  const { BUILTIN } = await import('./prompt/templates.js');
  const items = [
    ...buildIndex(NAV),
    ...[...store.templates, ...BUILTIN].map(t => ({
      kind: '模板', icon: t.icon || 'prompt', title: t.name, sub: t.desc || t.category,
      href: `#/prompt?t=${t.id}`, hay: norm(`${t.name} ${t.desc} ${t.category}`),
    })),
  ];

  const row = (it, i) => html`
    <button class="pal__row press" data-href="${it.href}" data-i="${i}" role="option">
      ${raw(icon(it.icon))}
      <span class="pal__txt"><b>${it.title}</b><small>${it.sub || ''}</small></span>
      <span class="pal__kind">${it.kind}</span>
    </button>`;

  const close = sheet({
    title: '快速搜尋',
    body: html`
      <div data-noswipe>
        <div class="field"><input class="input" id="pal-q" type="search" placeholder="打字搜功能、模板、紀錄、檔案⋯⋯" autocomplete="off"></div>
        <div class="pal" id="pal-list" role="listbox" aria-label="搜尋結果">
          ${items.slice(0, 40).map(row)}
        </div>
        <p class="hint" style="margin-top:var(--sp-3)">↑↓ 選擇，Enter 前往，Esc 關閉。桌機可按 ⌘K／Ctrl+K 叫出來。</p>
      </div>`,
    onMount(root) {
      const input = $('#pal-q', root);
      const list = $('#pal-list', root);
      let shown = items.slice(0, 40);
      let cursor = 0;

      const mark = () => $$('.pal__row', list).forEach((el, i) => {
        el.setAttribute('aria-selected', String(i === cursor));
        if (i === cursor) el.scrollIntoView({ block: 'nearest' });
      });
      const draw = () => {
        const q = norm(input.value.trim());
        shown = (q ? items.filter(it => it.hay.includes(q)) : items).slice(0, 40);
        list.innerHTML = shown.length
          ? shown.map(row).join('')
          : `<p class="hint" style="padding:var(--sp-4)">沒有符合的項目。</p>`;
        cursor = 0;
        bind();
        mark();
      };
      const go = (href) => { close(); setTimeout(() => { location.hash = href.replace(/^#/, ''); }, 80); };
      const bind = () => $$('.pal__row', list).forEach(el =>
        el.addEventListener('click', () => go(el.dataset.href)));

      bind(); mark();
      input.addEventListener('input', draw);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, shown.length - 1); mark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); mark(); }
        else if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); go(shown[cursor].href); }
      });
      setTimeout(() => input.focus(), 120);
    },
  });
}
