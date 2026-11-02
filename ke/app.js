// 功課：入門一問 → 本機解密 → 次第、行持、經文、記錄。零依賴。
import { decrypt, normalizeAnswer } from './gate.js';
import { iastToSiddham } from '../xue/js/vendor/siddham-core.js';

const view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sd = (iast) => iast.split(/\s+/).map((w) => iastToSiddham(w.replace(/[-'’]/g, '')) || w).join(' ');

// 本機存取：失敗則退記憶體
const mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem('ke:' + k); return v ? JSON.parse(v) : d; } catch { return k in mem ? mem[k] : d; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem('ke:' + k, JSON.stringify(v)); } catch {} },
  del(k) { delete mem[k]; try { localStorage.removeItem('ke:' + k); } catch {} },
};

let KE, TX; // 解密後之次第與經文庫
const player = new Audio();

/* ── 入門一問 ── */
async function unlock(answer, remember) {
  const enc = await (await fetch('data.enc', { cache: 'no-store' })).json();
  const plain = await decrypt(answer, enc); // 答錯則 reject
  KE = plain.ke; TX = plain.texts;
  if (remember) store.set('answer', normalizeAnswer(answer)); else store.del('answer');
  document.getElementById('nav').hidden = false;
  addEventListener('hashchange', route);
  route();
}

function bindGate() {
  const form = document.getElementById('gate-form');
  const msg = document.getElementById('gate-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true; msg.textContent = '';
    try { await unlock(form.answer.value, form.remember.checked); }
    catch { msg.textContent = '答案未合，請再思之。'; btn.disabled = false; form.answer.select(); }
  });
  const saved = store.get('answer', null);
  if (saved) unlock(saved, true).catch(() => store.del('answer'));
  else form.answer.focus();
}

/* ── 進度 ── */
const logs = () => store.get('logs', []);
const timeName = (id) => KE.times.find((t) => t.id === id)?.name ?? '不限時段';
const doneCount = (prog, time) => logs().filter((l) => l.prog === prog && (time === 'any' || l.time === time)).length;
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0); // 解密資料之數值一律歸數
const progTotal = (p) => Object.values(p.sessions).reduce((a, b) => a + num(b), 0);
const progDone = (p) => Object.entries(p.sessions).reduce((a, [t, n]) => a + Math.min(num(n), doneCount(p.id, t)), 0);
const findProg = (id) => { for (const s of KE.stages) for (const p of s.programs) if (p.id === id) return [s, p]; return []; };

function overview() {
  const order = KE.stages.map((s) => s.title).join(' → ');
  view.innerHTML = `
    <p class="eyebrow">四度加行</p><h1>${esc(KE.title)}</h1>
    <p class="order">修法之序：${esc(order)}。點時段即開始一堂。</p>
    ${KE.stages.map((s) => {
      const done = s.programs.reduce((a, p) => a + progDone(p), 0);
      const total = num(s.total) || 1;
      return `<section class="stage"><h3>${esc(s.title)}</h3><span class="meta">已修 ${done} / ${total} 堂</span>
        <div class="bar"><i style="width:${Math.min(100, (done / total) * 100)}%"></i></div>
        ${s.programs.map((p) => `<div class="prog"><span class="name">${esc(p.title)}</span><span class="meta">${progDone(p)} / ${progTotal(p)}</span>
          <div class="slots">${Object.entries(p.sessions).map(([t, n]) => {
            const need = num(n), c = Math.min(need, doneCount(p.id, t));
            return `<a class="slot${c >= need ? ' done' : ''}" href="#/run/${encodeURIComponent(p.id)}/${encodeURIComponent(t)}">${esc(timeName(t))}<b>${c}/${need}</b></a>`;
          }).join('')}</div></div>`).join('')}
      </section>`;
    }).join('')}`;
}

/* ── 一堂之行持 ── */
const runKey = (prog, time) => `run:${prog}:${time}`;

function mantraBlock(ref) {
  const m = TX[ref];
  if (!m) return '';
  if (m.missing) return `<p class="missing">${esc(m.title || ref)}：${esc(m.missing)}</p>`;
  if (m.kind === 'mantra') {
    const inner = `<div class="sd" lang="sa-Sidd">${esc(sd(m.iast))}</div>
      <div class="ia" lang="sa-Latn">${esc(m.iast)}</div>${m.zh ? `<div class="zh">${esc(m.zh)}</div>` : ''}`;
    // 長咒（如尊勝）摺疊，免一堂之頁過長
    const long = m.iast.length > 200;
    return `<div class="mantra"><span class="mn">${esc(m.title || '')}</span>${m.audio ? `<button class="play" data-src="${esc(m.audio)}">▶ 聆</button>` : ''}
      ${long ? `<details><summary>展開咒文</summary>${inner}</details>` : inner}</div>`;
  }
  return `<a class="textlink" href="#/text/${esc(ref)}">讀《${esc(m.title || ref)}》全文 →</a>`;
}

function counterBlock(key, targets, refs, state) {
  return targets.map(num).map((n, i) => {
    const k = `${key}:${i}`; const c = state.counts?.[k] ?? 0;
    const label = refs && refs.length > 1 ? `${esc(TX[refs[i]]?.title || '')} ` : '';
    return `<div class="counter" data-k="${esc(k)}" data-n="${n}">
      <button class="big" type="button">一遍</button>
      <span class="num">${label}<span class="c">${num(c)}</span><small> / ${n}</small></span>
      <button class="minor" data-d="-1" type="button">退一</button>${n >= 100 ? '<button class="minor" data-d="10" type="button">＋十</button>' : ''}</div>`;
  }).join('');
}

function altCounter(key, opts, state) {
  const pick = state.alt?.[key] ?? opts[0];
  const os = opts.map(num), p = num(pick);
  return `<div class="alt" data-key="${esc(key)}">遍數：${os.map((o) => `<button type="button" class="minor${o === p ? ' sel' : ''}" data-o="${o}">${o}</button>`).join(' ')}</div>`
    + counterBlock(`${key}:alt${p}`, [p], [], state);
}

function run(progId, time) {
  const [stage, p] = findProg(progId);
  if (!p) return overview();
  const key = runKey(progId, time);
  const state = store.get(key, { checked: [], counts: {}, started: Date.now() });
  const steps = p.steps;
  const real = steps.filter((s) => s.kind !== 'rubric').length;
  const html = steps.map((s, i) => {
    const done = state.checked.includes(i);
    const refs = s.ref || [];
    const body = [
      ...refs.map(mantraBlock),
      // 無所指而有多數者為「擇一」（如禮拜 108 或 21 遍）
      s.n ? (refs.length || s.n.length === 1
        ? counterBlock(`${key}:${i}`, s.n, refs, state)
        : altCounter(`${key}:${i}`, s.n, state)) : '',
    ].join('');
    return `<li class="step ${esc(s.kind)}${done ? ' done' : ''}" data-i="${i}">
      <div class="row"><span class="st">${esc(s.t)}${s.note ? `<span class="note">${esc(s.note)}</span>` : ''}</span>
      ${s.kind === 'rubric' ? '' : `<button class="tick" type="button" aria-label="完成此步" aria-pressed="${done}">${done ? '✓' : ''}</button>`}</div>
      ${body ? `<div class="body">${body}</div>` : ''}</li>`;
  }).join('');
  const nDone = state.checked.length;
  view.innerHTML = `
    <div class="run-head"><p class="eyebrow">${esc(stage.title)} · ${esc(timeName(time))}</p>
      <h1>${esc(p.title)}</h1><span class="progress">${nDone} / ${real} 步</span></div>
    ${p.optional ? `<p class="optional">${esc(p.optional)}</p>` : ''}
    <ol class="steps">${html}</ol>
    <div class="finish"><button type="button" id="finish">本堂圓滿　記錄</button>
      ${nDone < real ? `<p class="warn">尚有 ${real - nDone} 步未勾；仍可記錄。</p>` : ''}
      <button type="button" class="minor" id="reset" style="background:transparent;color:var(--ink-3);border:1px solid var(--rule)">清空本堂勾選</button></div>`;

  const save = () => store.set(key, state);
  view.querySelectorAll('.tick').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.closest('.step').dataset.i);
    state.checked = state.checked.includes(i) ? state.checked.filter((x) => x !== i) : [...state.checked, i];
    save(); run(progId, time);
  }));
  view.querySelectorAll('.counter').forEach((el) => {
    const k = el.dataset.k, n = Number(el.dataset.n), out = el.querySelector('.c');
    const bump = (d) => { state.counts[k] = Math.max(0, Math.min(n, (state.counts[k] ?? 0) + d)); out.textContent = state.counts[k]; save();
      if (state.counts[k] >= n && navigator.vibrate) navigator.vibrate(60); };
    el.querySelector('.big').addEventListener('click', () => bump(1));
    el.querySelectorAll('.minor').forEach((m) => m.addEventListener('click', () => bump(Number(m.dataset.d))));
  });
  view.querySelectorAll('.alt').forEach((el) => el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    state.alt = { ...(state.alt || {}), [el.dataset.key]: Number(b.dataset.o) }; save(); run(progId, time);
  })));
  bindPlay();
  document.getElementById('finish').addEventListener('click', () => {
    const minutes = Math.round((Date.now() - (state.started || Date.now())) / 60000);
    const all = logs();
    all.push({ id: Date.now(), stage: stage.id, prog: p.id, time, date: new Date().toISOString(), minutes, steps: `${state.checked.length}/${real}` });
    store.set('logs', all); store.del(key);
    location.hash = '#/log';
  });
  document.getElementById('reset').addEventListener('click', () => { store.del(key); run(progId, time); });
}

function bindPlay() {
  view.querySelectorAll('.play').forEach((b) => b.addEventListener('click', () => {
    const on = b.classList.contains('on');
    player.pause();
    view.querySelectorAll('.play.on').forEach((x) => { x.classList.remove('on'); x.textContent = '▶ 聆'; });
    if (on) return;
    const reset = () => { b.classList.remove('on'); b.textContent = '▶ 聆'; };
    player.src = b.dataset.src; player.onended = reset; player.onerror = reset;
    b.classList.add('on'); b.textContent = '■ 止';
    player.play().catch(reset);
  }));
}

/* ── 經文 ── */
function text(ref) {
  const t = TX[ref];
  if (!t) return overview();
  const body = t.missing ? `<p class="missing">${esc(t.missing)}</p>`
    : t.kind === 'mantra' ? mantraBlock(ref)
    : (t.body || []).map((p) => `<p class="${p.dharani ? 'dh' : ''}">${esc(p.text ?? p)}</p>`).join('');
  view.innerHTML = `<p class="eyebrow">經文</p><h1>${esc(t.title || ref)}</h1>
    <div class="text">${body}</div>${t.source ? `<p class="src">出處：${esc(typeof t.source === 'string' ? t.source : JSON.stringify(t.source))}</p>` : ''}
    <p><a href="javascript:history.back()">← 返回</a></p>`;
  bindPlay();
}

/* ── 記錄 ── */
function logView() {
  const all = logs().slice().reverse();
  const name = (id) => findProg(id)[1]?.title ?? id;
  view.innerHTML = `<p class="eyebrow">功課本</p><h1>修法記錄</h1>
    ${all.length ? `<table class="log"><thead><tr><th>日期</th><th>功課</th><th>時段</th><th>時長</th><th></th></tr></thead><tbody>
      ${all.map((l) => `<tr><td>${esc(new Date(l.date).toLocaleString('zh-Hant', { dateStyle: 'short', timeStyle: 'short' }))}</td>
        <td>${esc(name(l.prog))}</td><td>${esc(timeName(l.time))}</td><td>${num(l.minutes) ? num(l.minutes) + ' 分' : '—'}</td>
        <td class="x"><button data-id="${esc(l.id)}" aria-label="刪除此條">✕</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">尚無記錄。修畢一堂，點「本堂圓滿　記錄」即入此處。</p>'}
    <p class="lede" style="margin-top:1rem">記錄只存於本機瀏覽器；換機或清除瀏覽資料即失，請兼記於紙本功課本。</p>`;
  view.querySelectorAll('td.x button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '確刪？'; return; }
    store.set('logs', logs().filter((l) => String(l.id) !== b.dataset.id)); logView();
  }));
}

function notes() {
  view.innerHTML = `<p class="eyebrow">要點</p><h1>修法須知</h1>
    <h2>時段</h2><ul class="notes">${KE.times.map((t) => `<li>${esc(t.name)}：${esc(t.range)}</li>`).join('')}</ul>
    <h2>須知</h2><ul class="notes">${KE.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <p class="lede">${esc(KE.source)}</p>`;
}

function route() {
  player.pause();
  const [, page, a, b] = location.hash.split('/');
  document.querySelectorAll('.navlinks a').forEach((x) => x.toggleAttribute('aria-current', x.getAttribute('href') === `#/${page ?? ''}`));
  if (page === 'run') run(decodeURIComponent(a || ''), decodeURIComponent(b || ''));
  else if (page === 'text') text(decodeURIComponent(a || ''));
  else if (page === 'log') logView();
  else if (page === 'notes') notes();
  else overview();
  scrollTo(0, 0);
}

bindGate();
