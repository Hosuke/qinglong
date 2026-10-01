// 學梵：課表、字母、練習三視圖；以 hash 為路由，零依賴。
import { iastToSiddham, iastToDevanagari } from './vendor/siddham-core.js';

const view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sd = (ia) => iastToSiddham(ia) || '';
const dv = (ia) => iastToDevanagari(ia) || '';
const cbeta = (doc, lb) => /^[A-Za-z0-9]+$/.test(doc) && /^[0-9a-z]+$/.test(lb) ? `https://cbetaonline.dila.edu.tw/zh/${doc}_p${lb}` : '#';
let pending = null; // 練習之下一題計時；離頁即撤

// 進度只存本機；存取失敗則以記憶體代之
// 一旦寫入失敗即轉用記憶體，免讀到舊值
const store = {
  mem: {}, ok: true,
  get(k, d) {
    if (k in this.mem) return this.mem[k];
    if (!this.ok) return d;
    try {
      const v = localStorage.getItem('xue:' + k);
      if (v) this.mem[k] = JSON.parse(v); // 讀得即存記憶體，日後寫敗亦不失
      return v ? this.mem[k] : d;
    } catch { this.ok = false; return d; }
  },
  set(k, v) {
    this.mem[k] = v;
    if (this.ok) try { localStorage.setItem('xue:' + k, JSON.stringify(v)); } catch { this.ok = false; }
  },
};
const boxes = () => store.get('boxes', {});

let DATA;
const letters = () => DATA.groups.flatMap((g) => g.letters.map((l) => ({ ...l, group: g.id })));

const UNITS = [
  { n: '一', id: 'letters', title: '悉曇字母', desc: '五十字：十六摩多、三十四體文。字形、讀音與字門義。', ready: true },
  { n: '二', id: 'words', title: '常見之詞', desc: 'oṃ、namaḥ、svāhā、hūṃ、vajra……真言中反覆出現之詞，義與變格。' },
  { n: '三', id: 'conjuncts', title: '合字與連聲', desc: '輔音相疊如何書寫；詞與詞相遇時之音變。' },
  { n: '四', id: 'bija', title: '種字', desc: '一字攝一尊：a、vaṃ、hrīḥ、hūṃ、trāḥ、aḥ。' },
  { n: '五', id: 'decode', title: '讀懂漢字音寫', desc: '拿到寺院法本，如何還原其梵文。只為識讀，不為發音。' },
  { n: '六', id: 'read', title: '真言通讀', desc: '逐詞拆解常誦之真言：光明真言、五佛真言等。' },
];

function home() {
  const b = boxes(), all = letters();
  const known = all.filter((l) => (b[l.iast] ?? 1) >= 3).length;
  view.innerHTML = `
    <p class="eyebrow">青龍 · 學梵</p>
    <h1>從字母到真言</h1>
    <p class="lede">真言本是梵語。此課不以漢字注音，直從梵字入手：先識悉曇五十字與其正音，次學常見之詞，終能逐詞讀懂所誦之真言。</p>
    <ol class="units">${UNITS.map((u) => u.ready ? `
      <a class="unit" href="#/${u.id}">
        <span class="num">${u.n}</span>
        <div><h3>${u.title}</h3><p>${u.desc}</p>
          <div class="meter" title="已熟 ${known}/${all.length}"><i style="width:${(known / all.length) * 100}%"></i></div></div>
        <span class="state">已熟 ${known}/${all.length}</span>
      </a>` : `
      <li class="unit soon"><span class="num">${u.n}</span><div><h3>${u.title}</h3><p>${u.desc}</p></div><span class="state">籌備中</span></li>`).join('')}
    </ol>`;
}

function lettersView(selected) {
  const b = boxes();
  view.innerHTML = `
    <p class="eyebrow">第一課</p>
    <h1>悉曇字母</h1>
    <p class="lede">悉曇（siddhaṃ，「成就」）是唐代傳入之梵字，真言宗至今以之書寫種字與真言。下列五十字依不空所譯《瑜伽金剛頂經釋字母品》之次第——不空即駐錫大興善寺之三藏。點一字，看其讀法與字門義。</p>
    ${DATA.groups.map((g) => `
      <section class="group"><h2>${esc(g.title)}<small>${g.letters.length} 字</small></h2>
        <div class="grid">${g.letters.map((l) => `
          <button class="letter" data-ia="${esc(l.iast)}" aria-pressed="${l.iast === selected}">
            <span class="dot b${b[l.iast] ?? 1}" aria-hidden="true"></span>
            <span class="sd" lang="sa-Sidd">${sd(l.iast)}</span>
            <span class="ia" lang="sa-Latn">${esc(l.iast)}</span>
            <span class="ipa">/${esc(l.ipa)}/</span>
          </button>`).join('')}</div>
        ${g.letters.some((l) => l.iast === selected) ? detail(g.letters.find((l) => l.iast === selected)) : ''}
      </section>`).join('')}
    <p class="note">讀音以 IPA 為準。拼音只在音值嚴格相同處作對照（如 ka＝拼音 g、kha＝拼音 k）；漢字不作讀音依據——唐人以長安音記梵音，今以普通話讀之，相去已遠。</p>`;
  view.querySelectorAll('.letter').forEach((el) => el.addEventListener('click', () => {
    const ia = el.dataset.ia;
    location.hash = ia === selected ? '#/letters' : `#/letters/${encodeURIComponent(ia)}`;
  }));
  if (selected) view.querySelector('.detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function detail(l) {
  const src = DATA.source;
  return `<div class="detail">
    <div class="big"><span class="sd" lang="sa-Sidd">${sd(l.iast)}</span><span class="dv" lang="sa-Deva">${dv(l.iast)}</span></div>
    <div><span class="ia">${esc(l.iast)}</span><span class="ipa">/${esc(l.ipa)}/</span></div>
    <p class="how">${esc(l.how)}</p>
    <p class="gate">字門義：<b>${esc(l.gate)}</b></p>
    <p class="src">出《${esc(src.title)}》${esc(src.translator)}，此字譯作「${esc(l.zh)}」${l.zh_note ? esc(l.zh_note) : ''}・<a href="${esc(cbeta(src.doc, l.lb))}" target="_blank" rel="noopener">${esc(src.doc)} ${esc(l.lb)}</a></p>
  </div>`;
}

// 練習：萊特納三箱。答對升箱，答錯回第一箱；低箱者常出。
const MODES = {
  read: { label: '見字知音', ask: (l) => `<span class="sd" lang="sa-Sidd">${sd(l.iast)}</span>`, opt: (l) => `<span class="ia">${esc(l.iast)}</span>` },
  write: { label: '見轉寫識字', ask: (l) => `<span class="ia">${esc(l.iast)}</span>`, opt: (l) => `<span class="sd" lang="sa-Sidd">${sd(l.iast)}</span>` },
  gate: { label: '字門義', ask: (l) => `<span class="gate">${esc(l.gate)}</span>`, opt: (l) => `<span class="sd" lang="sa-Sidd">${sd(l.iast)}</span> <span class="ia">${esc(l.iast)}</span>` },
};

function pick(pool) {
  const b = boxes();
  const w = pool.map((l) => ({ 1: 6, 2: 3, 3: 1 }[b[l.iast] ?? 1]));
  let r = Math.random() * w.reduce((a, c) => a + c, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function distractors(target, all) {
  // 同部者先取：ka 之惑在 kha、ga，不在 ma
  const same = all.filter((l) => l.group === target.group && l.iast !== target.iast);
  const rest = all.filter((l) => l.group !== target.group);
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  return [...shuffle(same), ...shuffle(rest)].slice(0, 3);
}

function practice() {
  const all = letters();
  let mode = store.get('mode', 'read');
  let streak = { right: 0, total: 0 };
  const round = () => {
    clearTimeout(pending);
    const m = MODES[mode];
    const t = pick(all);
    const opts = [t, ...distractors(t, all)].map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    view.innerHTML = `
      <p class="eyebrow">練習</p><h1>字母</h1>
      <div class="drill">
        <div class="modes" role="group" aria-label="練習方式">${Object.entries(MODES).map(([k, v]) =>
          `<button data-mode="${k}" aria-pressed="${k === mode}">${v.label}</button>`).join('')}</div>
        <div class="prompt">${m.ask(t)}</div>
        <div class="choices">${opts.map((o) => `<button data-ia="${esc(o.iast)}">${m.opt(o)}</button>`).join('')}</div>
        <div class="feedback" aria-live="polite"></div>
        <div class="tally">本輪 ${streak.right}/${streak.total}</div>
      </div>`;
    view.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; store.set('mode', mode); round(); }));
    view.querySelectorAll('.choices button').forEach((btn) => btn.addEventListener('click', () => {
      const right = btn.dataset.ia === t.iast;
      const b = boxes();
      b[t.iast] = right ? Math.min(3, (b[t.iast] ?? 1) + 1) : 1;
      store.set('boxes', b);
      streak.total++; if (right) streak.right++;
      view.querySelectorAll('.choices button').forEach((x) => {
        x.disabled = true;
        if (x.dataset.ia === t.iast) x.classList.add('ok'); else if (x === btn) x.classList.add('bad');
      });
      view.querySelector('.feedback').innerHTML = `${right ? '是。' : '非也。'}<b lang="sa-Latn">${esc(t.iast)}</b> /${esc(t.ipa)}/ —— ${esc(t.how)}`;
      view.querySelector('.tally').textContent = `本輪 ${streak.right}/${streak.total}`;
      pending = setTimeout(round, right ? 1100 : 3200);
    }));
  };
  round();
}

function route() {
  clearTimeout(pending);
  const [, page, arg] = location.hash.split('/');
  document.querySelectorAll('.navlinks a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#/${page ?? ''}`));
  if (page === 'letters') lettersView(arg ? decodeURIComponent(arg) : null);
  else if (page === 'practice') practice();
  else home();
}

fetch('content/letters.json').then((r) => r.json()).then((d) => { DATA = d; addEventListener('hashchange', route); route(); })
  .catch((e) => { view.innerHTML = `<p>載入未成：${esc(e.message)}</p>`; });
