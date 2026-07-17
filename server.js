// ZERO RIPS — 线上评级卡抽卡平台 MVP
// 零依赖：node server.js 即可运行（Node 18+）。
// 抽卡采用可验证公平（provably fair）方案：
//   roll = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`) 前 8 位十六进制 / 2^32
// 服务端在开包前公示 sha256(serverSeed)，轮换种子后公开旧 serverSeed 供玩家复验。

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PACKS, WEIGHT_TOTAL } = require('./data');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const BUYBACK_RATE = 0.9; // 回收价 = 标价 * 90%
const START_BALANCE = 2000;
const TOPUP_AMOUNT = 2000;
const HISTORY_LIMIT = 200;

// ---------- 启动校验：每个卡包概率总和必须精确等于 100% ----------
for (const pack of PACKS) {
  const sum = pack.pool.reduce((s, c) => s + c.weight, 0);
  if (sum !== WEIGHT_TOTAL) {
    throw new Error(`卡包 ${pack.id} 概率总和错误: ${sum} != ${WEIGHT_TOTAL}`);
  }
}

// ---------- 状态 ----------
function freshSeeds() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  return {
    serverSeed,
    serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    clientSeed: crypto.randomBytes(4).toString('hex'),
    nonce: 0
  };
}

function freshState() {
  return {
    balance: START_BALANCE,
    inventory: [],
    history: [],
    stats: { opened: 0, spent: 0, recovered: 0, topups: 0 },
    seeds: freshSeeds(),
    revealedSeeds: [] // 轮换后公开的历史种子，供复验
  };
}

let state = loadState();

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s && s.seeds && Array.isArray(s.inventory)) return s;
  } catch (_) { /* 首次运行或文件损坏，用新状态 */ }
  return freshState();
}

let saveTimer = null;
function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch (e) {
      console.error('保存状态失败:', e.message);
    }
  }, 100);
}

// ---------- 抽卡核心 ----------
function rollAt(serverSeed, clientSeed, nonce) {
  const hex = crypto.createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex')
    .slice(0, 8);
  return parseInt(hex, 16) / 0x100000000; // [0, 1)
}

function pickCard(pack, roll) {
  let threshold = roll * WEIGHT_TOTAL;
  for (const card of pack.pool) {
    threshold -= card.weight;
    if (threshold < 0) return card;
  }
  return pack.pool[pack.pool.length - 1];
}

// 奖品档位：按价值/包价倍数划分（前端用来配色和特效）
function tierOf(value, price) {
  const x = value / price;
  if (x >= 50) return 'grail';
  if (x >= 10) return 'legendary';
  if (x >= 3) return 'epic';
  if (x >= 1) return 'rare';
  if (x >= 0.4) return 'uncommon';
  return 'common';
}

function openOne(pack) {
  const { seeds } = state;
  const nonce = seeds.nonce;
  const roll = rollAt(seeds.serverSeed, seeds.clientSeed, nonce);
  seeds.nonce += 1;

  const card = pickCard(pack, roll);
  const displayName = card.variants
    ? card.variants[crypto.randomInt(card.variants.length)]
    : card.name;

  const item = {
    uid: crypto.randomBytes(8).toString('hex'),
    packId: pack.id,
    packName: pack.name,
    cardId: card.id,
    name: displayName,
    poolName: card.name,
    set: card.set,
    grade: card.grade,
    value: card.value,
    tier: tierOf(card.value, pack.price),
    status: 'owned', // owned | shipped
    at: Date.now(),
    proof: {
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce,
      roll: Number(roll.toFixed(10))
    }
  };
  return item;
}

function packPublicView(pack) {
  const ev = pack.pool.reduce((s, c) => s + (c.value * c.weight) / WEIGHT_TOTAL, 0);
  return {
    id: pack.id,
    name: pack.name,
    nameEn: pack.nameEn,
    price: pack.price,
    theme: pack.theme,
    desc: pack.desc,
    ev: Math.round(ev * 10) / 10,
    rtp: Math.round((ev / pack.price) * 1000) / 10, // 百分比
    pool: pack.pool.map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set,
      grade: c.grade,
      value: c.value,
      odds: c.weight / WEIGHT_TOTAL,
      tier: tierOf(c.value, pack.price)
    }))
  };
}

function publicState() {
  return {
    balance: state.balance,
    inventory: state.inventory,
    history: state.history.slice(0, 60),
    stats: state.stats,
    fairness: {
      serverSeedHash: state.seeds.serverSeedHash,
      clientSeed: state.seeds.clientSeed,
      nonce: state.seeds.nonce,
      revealedSeeds: state.revealedSeeds.slice(-10)
    },
    buybackRate: BUYBACK_RATE
  };
}

// ---------- HTTP 工具 ----------
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------- API 路由 ----------
async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/state') return sendJson(res, 200, publicState());

  if (route === 'GET /api/packs') return sendJson(res, 200, PACKS.map(packPublicView));

  if (route === 'GET /api/verify') {
    const serverSeed = url.searchParams.get('serverSeed') || '';
    const clientSeed = url.searchParams.get('clientSeed') || '';
    const nonce = parseInt(url.searchParams.get('nonce') || '0', 10);
    if (!serverSeed || !clientSeed || Number.isNaN(nonce)) {
      return sendJson(res, 400, { error: '参数缺失：serverSeed / clientSeed / nonce' });
    }
    const roll = rollAt(serverSeed, clientSeed, nonce);
    return sendJson(res, 200, {
      serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      roll: Number(roll.toFixed(10))
    });
  }

  if (route === 'POST /api/open') {
    const body = await readBody(req);
    const pack = PACKS.find((p) => p.id === body.packId);
    if (!pack) return sendJson(res, 400, { error: '卡包不存在' });
    const count = body.count === 10 ? 10 : 1;
    const cost = pack.price * count;
    if (state.balance < cost) {
      return sendJson(res, 400, { error: `余额不足：需要 ${cost} 币，当前 ${state.balance} 币` });
    }
    state.balance -= cost;
    state.stats.spent += cost;
    state.stats.opened += count;

    const items = [];
    for (let i = 0; i < count; i++) {
      const item = openOne(pack);
      items.push(item);
      state.inventory.unshift(item);
      state.history.unshift({
        uid: item.uid, name: item.name, grade: item.grade, set: item.set,
        value: item.value, tier: item.tier, packName: pack.name, at: item.at,
        proof: item.proof
      });
    }
    state.history = state.history.slice(0, HISTORY_LIMIT);
    saveState();
    return sendJson(res, 200, { items, balance: state.balance });
  }

  if (route === 'POST /api/sell') {
    const body = await readBody(req);
    const uids = Array.isArray(body.uids) ? body.uids : [body.uid];
    let credit = 0;
    const sold = [];
    for (const uid of uids) {
      const idx = state.inventory.findIndex((i) => i.uid === uid && i.status === 'owned');
      if (idx === -1) continue;
      const [item] = state.inventory.splice(idx, 1);
      credit += Math.floor(item.value * BUYBACK_RATE);
      sold.push(item.uid);
    }
    if (!sold.length) return sendJson(res, 400, { error: '没有可回收的卡' });
    state.balance += credit;
    state.stats.recovered += credit;
    saveState();
    return sendJson(res, 200, { credit, sold, balance: state.balance });
  }

  if (route === 'POST /api/sell-floor') {
    // 一键回收所有低档卡（common / uncommon）
    const floorTiers = new Set(['common', 'uncommon']);
    const uids = state.inventory
      .filter((i) => i.status === 'owned' && floorTiers.has(i.tier))
      .map((i) => i.uid);
    if (!uids.length) return sendJson(res, 400, { error: '没有低档卡可回收' });
    let credit = 0;
    state.inventory = state.inventory.filter((i) => {
      if (uids.includes(i.uid)) {
        credit += Math.floor(i.value * BUYBACK_RATE);
        return false;
      }
      return true;
    });
    state.balance += credit;
    state.stats.recovered += credit;
    saveState();
    return sendJson(res, 200, { credit, count: uids.length, balance: state.balance });
  }

  if (route === 'POST /api/ship') {
    const body = await readBody(req);
    const item = state.inventory.find((i) => i.uid === body.uid && i.status === 'owned');
    if (!item) return sendJson(res, 400, { error: '找不到该卡或已申请发货' });
    item.status = 'shipped';
    saveState();
    return sendJson(res, 200, { item });
  }

  if (route === 'POST /api/topup') {
    state.balance += TOPUP_AMOUNT;
    state.stats.topups += 1;
    saveState();
    return sendJson(res, 200, { balance: state.balance, added: TOPUP_AMOUNT });
  }

  if (route === 'POST /api/client-seed') {
    const body = await readBody(req);
    const seed = String(body.clientSeed || '').trim();
    if (!/^[\w-]{1,64}$/.test(seed)) {
      return sendJson(res, 400, { error: '客户端种子只能是 1–64 位字母数字' });
    }
    state.seeds.clientSeed = seed;
    saveState();
    return sendJson(res, 200, { clientSeed: seed });
  }

  if (route === 'POST /api/rotate-seed') {
    const old = state.seeds;
    state.revealedSeeds.push({
      serverSeed: old.serverSeed,
      serverSeedHash: old.serverSeedHash,
      clientSeed: old.clientSeed,
      lastNonce: old.nonce - 1,
      revealedAt: Date.now()
    });
    state.seeds = freshSeeds();
    saveState();
    return sendJson(res, 200, {
      revealed: state.revealedSeeds[state.revealedSeeds.length - 1],
      serverSeedHash: state.seeds.serverSeedHash,
      clientSeed: state.seeds.clientSeed
    });
  }

  if (route === 'POST /api/reset') {
    state = freshState();
    saveState();
    return sendJson(res, 200, publicState());
  }

  return sendJson(res, 404, { error: 'unknown api' });
}

// ---------- 服务器 ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => sendJson(res, 500, { error: e.message }));
  } else {
    serveStatic(res, url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(`ZERO RIPS 已启动: http://localhost:${PORT}`);
  console.log(`余额 ${state.balance} 币 | 已开 ${state.stats.opened} 包 | 种子哈希 ${state.seeds.serverSeedHash.slice(0, 16)}…`);
});
