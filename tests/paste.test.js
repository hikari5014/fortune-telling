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

test('去外部 LLM 的按鈕：開新分頁、不外洩來源網址，而且誠實標示帶不帶得動', () => {
  store.setDraft('pending', { t: 'iching', name: '解卦', text: 'x'.repeat(40), q: '', at: 1 });
  const out = String(view.render({}));
  const btns = [...out.matchAll(/data-llm="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(btns, ['chatgpt', 'gemini', 'claude', 'perplexity']);
  // 短提示詞：三家帶得動、Gemini 帶不動 —— 按鈕上就要寫清楚
  // （只數按鈕裡的 <small>，上面說明文字也提到同一句話）
  assert.equal(out.split('<small>直接帶過去</small>').length - 1, 3);
  assert.equal(out.split('<small>開起來自己貼</small>').length - 1, 1);
  // 用 window.open 而不是 <a>，因為要先算「這次帶不帶得動」
  const paste = readFileSync('src/views/paste.js', 'utf8');
  assert.match(paste, /openLLM\(p\.text, b\.dataset\.llm\)/);
  assert.match(readFileSync('src/llm.js', 'utf8'), /'noopener,noreferrer'/);
});

test('提示詞太長就不塞進網址 —— 寧可少一個便利，也不要給人切一半的提示詞', async () => {
  const { plan } = await import('../src/llm.js');
  const short = plan('今天運勢如何', 'chatgpt');
  assert.equal(short.carried, true);
  const long = plan('字'.repeat(1200), 'chatgpt');
  assert.equal(long.carried, false);
  assert.ok(long.url.length < 60, '太長的時候應該只開首頁');
  // Gemini 沒有官方的網址參數，任何長度都帶不動
  assert.equal(plan('短', 'gemini').carried, false);
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
