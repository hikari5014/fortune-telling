/* 貼回頁：一鍵複製之後落地的地方 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM } from './_dom.js';
installDOM();

const { store } = await import('../src/store.js');
const view = (await import('../src/views/paste.js')).default;

test('沒複製過東西時給得出去處，而不是一片空白', () => {
  store.setDraft('pending', null);
  const out = String(view.render({}));
  assert.match(out, /class="empty/);
  assert.match(out, /#\/prompt/);
});

test('複製過之後，該有的都在', () => {
  store.setDraft('pending', { t: 'iching', name: '解卦', text: '這是提示詞', q: '要換工作嗎', at: Date.now() });
  const out = String(view.render({}));
  assert.ok(out.includes('解卦'), '看不出是哪個模板');
  assert.ok(out.includes('這是提示詞'), '複製的內容沒有給人核對的機會');
  assert.ok(out.includes('要換工作嗎'), '問過的問題不見了');
  for (const id of ['id="recopy"', 'id="paste-back"', 'id="rec-model"', 'id="save-rec"']) {
    assert.ok(out.includes(id), `少了 ${id}`);
    assert.equal(out.split(id).length - 1, 1, `${id} 出現了不只一次`);
  }
});

test('去外部 LLM 的連結開新分頁，而且不外洩來源網址', () => {
  store.setDraft('pending', { t: 'iching', name: '解卦', text: 'x', q: '', at: 1 });
  const out = String(view.render({}));
  const links = [...out.matchAll(/<a[^>]+href="(https:[^"]+)"[^>]*>/g)];
  assert.ok(links.length >= 3, '外部 LLM 的捷徑不見了');
  for (const [tag] of links) {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  }
});

test('「改一下再問」要真的進得了產生器，不會又被攔回來', () => {
  store.setDraft('pending', { t: 'iching', name: '解卦', text: 'x', q: '', at: 1 });
  // askPrompt 只放行沒有模板、或明講 studio=1 的連結
  assert.match(String(view.render({})), /#\/prompt\?t=iching&studio=1/);
  const shared = readFileSync('src/views/_shared.js', 'utf8');
  assert.match(shared, /q\.studio/);
});

test('離線外殼裡有這一頁，不然裝成 App 之後按下去是白的', () => {
  const sw = readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes('./src/views/paste.js'));
  assert.ok(sw.includes('./src/prompt/quick.js'));
});
