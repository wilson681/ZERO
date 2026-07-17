// ZERO RIPS 前端逻辑
const $ = (sel) => document.querySelector(sel);

const TIER_LABEL = {
  common: '普通', uncommon: '优良', rare: '稀有',
  epic: '史诗', legendary: '传说', grail: '圣杯'
};
const TIER_COLOR = {
  common: 'var(--tier-common)', uncommon: 'var(--tier-uncommon)', rare: 'var(--tier-rare)',
  epic: 'var(--tier-epic)', legendary: 'var(--tier-legendary)', grail: 'var(--tier-grail)'
};
const THEME_COLOR = { amber: '#f5c542', violet: '#a78bfa', cyan: '#22d3ee' };
const EMOJI = ['🔥', '💧', '⚡', '🌿', '🌙', '⭐', '🐉', '👻', '❄️', '🌊'];

let packs = [];
let state = null;
let lastPackId = null;

// ---------- 工具 ----------
async function api(path, opts) {
  const res = await fetch(path, opts && {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function fmt(n) { return n.toLocaleString('zh-CN'); }

function emojiFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return EMOJI[h % EMOJI.length];
}

function oddsText(p) {
  const pct = p * 100;
  if (pct >= 1) return pct.toFixed(pct >= 10 ? 1 : 2) + '%';
  if (pct >= 0.01) return pct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
  return pct.toExponential(2) + '%';
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function setBalance(n) {
  state.balance = n;
  $('#balanceNum').textContent = fmt(n);
  const chip = $('#balanceChip');
  chip.classList.remove('bump');
  void chip.offsetWidth;
  chip.classList.add('bump');
}

// ---------- 卡片 DOM ----------
function cardEl(item, delay = 0) {
  const div = document.createElement('div');
  div.className = `tcard tier-${item.tier}`;
  const face = document.createElement('div');
  face.className = 'face';
  if (delay) div.style.animationDelay = `${delay}ms`;

  if (item.grade) {
    const label = document.createElement('div');
    label.className = 'slab-label';
    label.innerHTML = `<span>${item.grade.split(' ')[0]}</span><span class="g">${item.grade.split(' ')[1] || ''}</span>`;
    face.appendChild(label);
  }
  const art = document.createElement('div');
  art.className = 'tcard-art';
  art.textContent = emojiFor(item.name);
  const name = document.createElement('div');
  name.className = 'tcard-name';
  name.textContent = item.name;
  const set = document.createElement('div');
  set.className = 'tcard-set';
  set.textContent = item.set + (item.grade ? '' : ' · 原卡');
  const value = document.createElement('div');
  value.className = 'tcard-value';
  value.textContent = `◉ ${fmt(item.value)} · ${TIER_LABEL[item.tier]}`;
  face.append(art, name, set, value);
  div.appendChild(face);
  return div;
}

// ---------- ZERO 锡箔卡包 ----------
const BLADE_SVG = `
<svg width="76" height="62" viewBox="0 0 76 62" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bladeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef2f8"/>
      <stop offset=".55" stop-color="#aeb9cc"/>
      <stop offset="1" stop-color="#7e8aa0"/>
    </linearGradient>
  </defs>
  <polygon points="8,56 40,56 40,38 22,38" fill="url(#bladeGrad)" stroke="#5d6880" stroke-width="1"/>
  <line x1="13" y1="52.5" x2="36" y2="52.5" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.5"/>
  <rect x="36" y="30" width="36" height="20" rx="5" fill="#39476b" stroke="#5d6f9e" stroke-width="1.5"/>
  <rect x="43" y="35" width="17" height="10" rx="3" fill="#232c48"/>
  <circle cx="66" cy="40" r="2" fill="#8fa2cf"/>
</svg>`;

function foilPackEl(pack, { mini = false, interactive = false } = {}) {
  const el = document.createElement('div');
  el.className = 'foilpack' + (mini ? ' mini' : '');
  el.style.setProperty('--pc', THEME_COLOR[pack.theme] || '#f5c542');
  el.innerHTML = `
    <div class="fp-cardout"><div class="fp-cardback">Z</div></div>
    <div class="fp-body">
      <div class="fp-logo">ZERO</div>
      <div class="fp-series">${pack.name}</div>
      <div class="fp-sub">${pack.nameEn.toUpperCase()} · TCG MYSTERY PACK</div>
      <div class="fp-badge">◉ ${fmt(pack.price)} / 抽</div>
      <div class="fp-sheen"></div>
      <div class="fp-crimp fp-crimp-bottom"></div>
    </div>
    <div class="fp-strip">
      <div class="fp-crimp"></div>
      <div class="fp-foil"></div>
    </div>
    ${interactive ? `
    <div class="fp-guide"></div>
    <div class="fp-slit"></div>
    <div class="fp-blade">${BLADE_SVG}</div>
    <div class="fp-cutzone"></div>` : ''}`;
  return el;
}

// 刀切交互：progress 单调递增，划满即触发 onDone（只触发一次）
function setupCutter(packEl, onDone) {
  const blade = packEl.querySelector('.fp-blade');
  const slit = packEl.querySelector('.fp-slit');
  const zone = packEl.querySelector('.fp-cutzone');
  const INSET = 10;
  let progress = 0, dragging = false, done = false;

  function apply() {
    const w = packEl.clientWidth - INSET * 2;
    slit.style.width = `${progress * w}px`;
    blade.style.left = `${INSET + progress * w}px`;
  }
  function finish() {
    done = true;
    dragging = false;
    zone.style.pointerEvents = 'none';
    blade.classList.remove('active');
    packEl.classList.add('cutdone');
    onDone();
  }
  function advance(p) {
    if (done) return;
    // 只允许向前推进，且单次事件最多前进 20%，防止直接点右端瞬开
    if (p > progress) progress = Math.min(p, progress + 0.2);
    apply();
    if (progress >= 0.99) finish();
  }

  zone.addEventListener('pointerdown', (e) => {
    if (done) return;
    dragging = true;
    blade.classList.add('active');
    zone.setPointerCapture(e.pointerId);
  });
  zone.addEventListener('pointermove', (e) => {
    if (!dragging || done) return;
    const r = packEl.getBoundingClientRect();
    advance((e.clientX - r.left - INSET) / (r.width - INSET * 2));
  });
  const stop = () => { dragging = false; blade.classList.remove('active'); };
  zone.addEventListener('pointerup', stop);
  zone.addEventListener('pointercancel', stop);
  apply();

  return {
    autoCut() {
      if (done) return;
      const start = progress;
      const t0 = performance.now();
      const tick = (t) => {
        if (done) return;
        const k = Math.min(1, (t - t0) / 550);
        progress = start + (1 - start) * k;
        apply();
        if (progress >= 0.99) { finish(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    get done() { return done; }
  };
}

// ---------- 卡包商店 ----------
function renderPacks() {
  const grid = $('#packGrid');
  grid.innerHTML = '';
  for (const pack of packs) {
    const color = THEME_COLOR[pack.theme] || '#f5c542';
    const jackpot = pack.pool.reduce((a, b) => (b.value > a.value ? b : a));
    const el = document.createElement('div');
    el.className = 'pack-card';
    el.style.setProperty('--pack-color', color);
    el.innerHTML = `
      <div class="pack-art"></div>
      <div class="pack-title"><h2>${pack.name}</h2><span class="en">${pack.nameEn}</span></div>
      <div class="pack-desc">${pack.desc}</div>
      <div class="pack-jackpot">🏆 头奖：${jackpot.name} ${jackpot.grade || ''} · ◉ ${fmt(jackpot.value)}（${oddsText(jackpot.odds)}）</div>
      <button class="odds-link">查看完整概率公示 · RTP ${pack.rtp}%</button>
      <div class="pack-footer">
        <div class="pack-price">◉ ${fmt(pack.price)}<small> /次</small></div>
        <button class="btn btn-dim open10">开 10 次</button>
        <button class="btn btn-gold open1">开 1 次</button>
      </div>`;
    el.querySelector('.pack-art').appendChild(foilPackEl(pack, { mini: true }));
    el.querySelector('.odds-link').onclick = () => showOdds(pack);
    el.querySelector('.open1').onclick = () => openPack(pack, 1);
    el.querySelector('.open10').onclick = () => openPack(pack, 10);
    grid.appendChild(el);
  }
}

function showOdds(pack) {
  $('#oddsTitle').textContent = `${pack.name} · 概率公示`;
  $('#oddsMeta').textContent =
    `单价 ◉ ${fmt(pack.price)} ｜ 期望回报 ◉ ${fmt(pack.ev)}（RTP ${pack.rtp}%）｜ 回收价 = 标价 × ${Math.round((state?.buybackRate ?? 0.9) * 100)}%`;
  const body = $('#oddsBody');
  body.innerHTML = '';
  for (const c of pack.pool) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="tier-dot" style="background:${TIER_COLOR[c.tier]}"></span>${c.name}<br><small style="color:var(--dim)">${c.set}</small></td>
      <td>${c.grade || '原卡'}</td>
      <td class="odds-num">◉ ${fmt(c.value)}</td>
      <td class="odds-num">${oddsText(c.odds)}</td>`;
    body.appendChild(tr);
  }
  $('#oddsOverlay').hidden = false;
}

// ---------- 开包：刀切锡箔卡包 ----------
let opening = false;
async function openPack(pack, count) {
  if (opening) return;
  const cost = pack.price * count;
  if (state.balance < cost) {
    toast(`余额不足：需要 ◉ ${fmt(cost)}，先点右上角"模拟充值"`);
    return;
  }
  opening = true;
  lastPackId = { pack, count };

  const overlay = $('#revealOverlay');
  const stage = $('#cutStage');
  const holder = $('#packHolder');
  const revealArea = $('#revealArea');
  const actions = $('#revealActions');

  overlay.hidden = false;
  $('#overlayBg').classList.remove('bigwin');
  revealArea.hidden = true;
  revealArea.innerHTML = '';
  actions.hidden = true;
  stage.hidden = false;
  stage.classList.remove('done');
  holder.innerHTML = '';
  $('#cutHint').textContent = count === 10
    ? '🔪 按住刀片，从左向右划开卡包 · 十连'
    : '🔪 按住刀片，从左向右划开卡包';
  $('#cancelCutBtn').hidden = false;

  const packEl = foilPackEl(pack, { interactive: true });
  holder.appendChild(packEl);

  const cutter = setupCutter(packEl, async () => {
    // 划满的瞬间才真正下注开包
    $('#cancelCutBtn').hidden = true;
    let data;
    try {
      data = await api('/api/open', { packId: pack.id, count });
    } catch (e) {
      overlay.hidden = true;
      opening = false;
      toast(e.message);
      return;
    }
    setBalance(data.balance);

    // 顶条掉落 → 卡从包里滑出 → 舞台淡出 → 翻牌
    setTimeout(() => packEl.classList.add('opened'), 420);
    setTimeout(() => stage.classList.add('done'), 1400);
    setTimeout(() => {
      stage.hidden = true;
      showResults(pack, count, data);
    }, 1700);
  });

  $('#autoCutBtn').onclick = () => cutter.autoCut();
  $('#cancelCutBtn').onclick = () => {
    if (cutter.done) return; // 已下注就不能反悔了
    overlay.hidden = true;
    opening = false;
  };
}

function showResults(pack, count, data) {
  const revealArea = $('#revealArea');
  revealArea.hidden = false;

  const best = data.items.reduce((a, b) => (b.value > a.value ? b : a));
  const isBigWin = best.tier === 'legendary' || best.tier === 'grail';
  if (isBigWin) {
    $('#overlayBg').classList.add('bigwin');
    const banner = document.createElement('div');
    banner.className = 'bigwin-banner';
    banner.style.flexBasis = '100%';
    banner.textContent = best.tier === 'grail' ? '🎉 圣 杯 降 临 ！' : '✨ 传 说 大 奖 ！';
    revealArea.appendChild(banner);
  }
  data.items.forEach((item, i) => revealArea.appendChild(cardEl(item, i * 140)));

  const total = data.items.reduce((s, i) => s + i.value, 0);
  $('#revealTotal').innerHTML =
    `本次花费 ◉ ${fmt(pack.price * count)} ｜ 抽中总价值 <b>◉ ${fmt(total)}</b>`;
  $('#revealActions').hidden = false;
  refreshStateSoft();
}

$('#againBtn').onclick = () => {
  if (!lastPackId) return;
  opening = false;
  openPack(lastPackId.pack, lastPackId.count);
};
$('#closeRevealBtn').onclick = () => {
  $('#revealOverlay').hidden = true;
  opening = false;
};

// ---------- 卡库 ----------
function renderInventory() {
  const grid = $('#invGrid');
  grid.innerHTML = '';
  const inv = state.inventory;
  $('#invCount').textContent = inv.length;
  $('#invEmpty').style.display = inv.length ? 'none' : 'block';

  const owned = inv.filter(i => i.status === 'owned');
  const totalValue = owned.reduce((s, i) => s + i.value, 0);
  $('#invSummary').innerHTML =
    `持有 ${owned.length} 张 ｜ 总标价 <b>◉ ${fmt(totalValue)}</b> ｜ 全部回收可得 ◉ ${fmt(Math.floor(totalValue * state.buybackRate))}`;

  for (const item of inv) {
    const wrap = document.createElement('div');
    wrap.className = 'inv-item';
    wrap.appendChild(cardEl(item));
    if (item.status === 'shipped') {
      const tag = document.createElement('div');
      tag.className = 'shipped-tag';
      tag.textContent = '📦 已申请发货';
      wrap.appendChild(tag);
    } else {
      const actions = document.createElement('div');
      actions.className = 'inv-actions';
      const sellBtn = document.createElement('button');
      sellBtn.className = 'btn btn-dim';
      sellBtn.textContent = `回收 ◉${fmt(Math.floor(item.value * state.buybackRate))}`;
      sellBtn.onclick = async () => {
        try {
          const r = await api('/api/sell', { uid: item.uid });
          setBalance(r.balance);
          toast(`回收成功 +◉ ${fmt(r.credit)}`);
          refreshStateSoft();
        } catch (e) { toast(e.message); }
      };
      const shipBtn = document.createElement('button');
      shipBtn.className = 'btn btn-dim';
      shipBtn.textContent = '发货';
      shipBtn.onclick = async () => {
        try {
          await api('/api/ship', { uid: item.uid });
          toast('已登记发货（演示环境不会真的寄出 🙂）');
          refreshStateSoft();
        } catch (e) { toast(e.message); }
      };
      actions.append(sellBtn, shipBtn);
      wrap.appendChild(actions);
    }
    grid.appendChild(wrap);
  }
}

$('#sellFloorBtn').onclick = async () => {
  try {
    const r = await api('/api/sell-floor', {});
    setBalance(r.balance);
    toast(`已回收 ${r.count} 张低档卡 +◉ ${fmt(r.credit)}`);
    refreshStateSoft();
  } catch (e) { toast(e.message); }
};

// ---------- 记录 & 走马灯 ----------
function renderHistory() {
  const body = $('#historyBody');
  body.innerHTML = '';
  $('#histEmpty').style.display = state.history.length ? 'none' : 'block';
  for (const h of state.history) {
    const tr = document.createElement('tr');
    const t = new Date(h.at);
    tr.innerHTML = `
      <td>${t.toLocaleTimeString('zh-CN')}</td>
      <td>${h.packName}</td>
      <td><span class="tier-dot" style="background:${TIER_COLOR[h.tier]}"></span>${h.name}</td>
      <td>${h.grade || '原卡'}</td>
      <td class="odds-num">◉ ${fmt(h.value)}</td>
      <td><code>#${h.proof.nonce} / ${h.proof.roll}</code></td>`;
    body.appendChild(tr);
  }
}

function renderTicker() {
  const hits = state.history.filter(h => ['epic', 'legendary', 'grail'].includes(h.tier)).slice(0, 12);
  const ticker = $('#ticker');
  if (!hits.length) { ticker.hidden = true; return; }
  ticker.hidden = false;
  $('#tickerInner').innerHTML = hits
    .map(h => `<span class="ticker-item">🎊 恭喜抽中 <b>${h.name} ${h.grade || ''}</b>（◉ ${fmt(h.value)}）</span>`)
    .join('');
}

// ---------- 公平性 ----------
function renderFairness() {
  const f = state.fairness;
  $('#fairHash').textContent = f.serverSeedHash;
  $('#fairNonce').textContent = f.nonce;
  const input = $('#clientSeedInput');
  if (document.activeElement !== input) input.value = f.clientSeed;
  const list = $('#revealedList');
  list.innerHTML = f.revealedSeeds.length ? '' : '<div class="revealed-item">还没有公开过的种子。轮换一次即可公开当前种子。</div>';
  for (const r of [...f.revealedSeeds].reverse()) {
    const div = document.createElement('div');
    div.className = 'revealed-item';
    div.innerHTML =
      `serverSeed: <code>${r.serverSeed}</code><br>` +
      `sha256: ${r.serverSeedHash}<br>` +
      `clientSeed: ${r.clientSeed} ｜ 覆盖 nonce 0–${Math.max(r.lastNonce, 0)}`;
    list.appendChild(div);
  }
}

$('#setSeedBtn').onclick = async () => {
  try {
    await api('/api/client-seed', { clientSeed: $('#clientSeedInput').value });
    toast('客户端种子已更新');
    refreshStateSoft();
  } catch (e) { toast(e.message); }
};

$('#rotateBtn').onclick = async () => {
  try {
    await api('/api/rotate-seed', {});
    toast('种子已轮换，旧种子已公开可复验');
    refreshStateSoft();
  } catch (e) { toast(e.message); }
};

$('#verifyBtn').onclick = async () => {
  const out = $('#verifyOut');
  try {
    const q = new URLSearchParams({
      serverSeed: $('#vSeed').value.trim(),
      clientSeed: $('#vClient').value.trim(),
      nonce: $('#vNonce').value.trim() || '0'
    });
    const r = await api(`/api/verify?${q}`);
    out.hidden = false;
    out.textContent = `sha256(serverSeed) = ${r.serverSeedHash}\nroll = ${r.roll}\n\n对照「开奖记录」里同一 nonce 的 roll，一致即证明未被操纵。`;
  } catch (e) {
    out.hidden = false;
    out.textContent = '验证失败：' + e.message;
  }
};

// ---------- 顶栏 & 标签页 ----------
$('#topupBtn').onclick = async () => {
  const r = await api('/api/topup', {});
  setBalance(r.balance);
  toast(`充值成功 +◉ ${fmt(r.added)}（演示币，不花真钱）`);
};

document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  };
});

document.querySelectorAll('[data-close-odds]').forEach(el => {
  el.onclick = () => { $('#oddsOverlay').hidden = true; };
});

// ---------- 初始化 ----------
async function refreshStateSoft() {
  state = await api('/api/state');
  $('#balanceNum').textContent = fmt(state.balance);
  renderInventory();
  renderHistory();
  renderTicker();
  renderFairness();
}

async function init() {
  [packs, state] = await Promise.all([api('/api/packs'), api('/api/state')]);
  $('#balanceNum').textContent = fmt(state.balance);
  renderPacks();
  renderInventory();
  renderHistory();
  renderTicker();
  renderFairness();
}

init().catch(e => toast('初始化失败：' + e.message));
