/* 求籤：搖籤筒抽籤號、擲筊請示，三聖筊為準 */
import { BUILTIN_SET, LUCK_SCORE, LUCK_ORDER, normalizeSet, SET_SCHEMA } from '../data/qian.js';

/** 擲筊：兩塊筊，平面為陽、凸面為陰
 *  一平一凸＝聖筊（允）／兩平＝笑筊（問題不清）／兩凸＝陰筊（不允） */
export function castJiao(rand = Math.random) {
  const a = rand() < 0.5, b = rand() < 0.5;       // true = 平面（陽）
  const flat = Number(a) + Number(b);
  const kind = flat === 1 ? '聖筊' : flat === 2 ? '笑筊' : '陰筊';
  return {
    faces: [a ? '平' : '凸', b ? '平' : '凸'],
    kind, ok: kind === '聖筊',
    text: kind === '聖筊' ? '允杯：可以'
        : kind === '笑筊' ? '笑杯：問題還不夠清楚，或時機未到'
        : '陰杯：不允，換個問法或改日再問',
  };
}

/** 搖出一支籤 */
export function shakeQian(set = BUILTIN_SET, rand = Math.random) {
  const i = Math.floor(rand() * set.poems.length);
  return set.poems[i];
}

/** 完整求籤：搖籤 → 擲筊確認（預設一聖筊即可，可要求連得三聖筊） */
export function divine(set = BUILTIN_SET, { need = 1, maxTries = 80, rand = Math.random } = {}) {
  const rounds = [];
  let poem = shakeQian(set, rand);
  let streak = 0;
  for (let i = 0; i < maxTries; i++) {
    const cast = castJiao(rand);
    rounds.push({ poem: poem.n, ...cast });
    if (cast.ok) {
      streak++;
      if (streak >= need) return { poem, rounds, confirmed: true, set };
    } else {
      streak = 0;
      poem = shakeQian(set, rand);          // 不允就重新搖一支
    }
  }
  return { poem, rounds, confirmed: false, set };
}

export function luckScore(luck) { return LUCK_SCORE[luck] ?? 55; }

/** 純文字，供提示詞使用 */
export function toText(result, question = '') {
  const p = result.poem;
  return [
    question ? `問題：${question}` : '',
    `籤詩集：${result.set.name}（${result.set.source}）`,
    `第 ${p.n} 首　${p.gz}籤　${p.luck}`,
    '',
    ...p.lines,
    '',
    p.gist ? `白話要旨：${p.gist}` : '',
    `擲筊過程：${result.rounds.map(r => r.kind).join('、')}${result.confirmed ? '（已得三聖筊）' : '（未得三聖筊，僅供參考）'}`,
  ].filter(x => x !== '').join('\n');
}

export { BUILTIN_SET, LUCK_ORDER, LUCK_SCORE, normalizeSet, SET_SCHEMA };
