// ZERO 纯前端引擎（静态试玩版）
// 把 server.js 的抽卡逻辑完整移植到浏览器：Web Crypto 做 HMAC/SHA-256，
// 状态存在 localStorage。api(path, body) 与后端版签名完全一致，前端代码零改动。
// 注意：试玩版的 serverSeed 在你自己的浏览器生成；正式上线时由服务端持有。

const WEIGHT_TOTAL = 1000000;
const BUYBACK_RATE = 0.9;
const START_BALANCE = 2000;
const TOPUP_AMOUNT = 2000;
const HISTORY_LIMIT = 200;
const STORE_KEY = 'zero-state-v2';

const PACKS_DATA = [
  {
    id: 'starter', name: '新手包', nameEn: 'STARTER PACK', price: 200, theme: 'red',
    desc: '剑盾 / 朱紫现代卡池，Alt Art 与 SAR 应有尽有。头奖：月亮伊布 Alt Art PSA 10。',
    guarantee: '大奖 PSA 10 · 含原卡',
    pool: [
      { id: 'st-moon10', name: '月亮伊布 Umbreon VMAX (Alt Art)', set: 'Evolving Skies 2021 #215/203', grade: 'PSA 10', value: 45000, weight: 300 },
      { id: 'st-ray10', name: '烈空坐 Rayquaza VMAX (Alt Art)', set: 'Evolving Skies 2021 #218/203', grade: 'PSA 10', value: 12000, weight: 900 },
      { id: 'st-lugia10', name: '洛奇亚 Lugia V (Alt Art)', set: 'Silver Tempest 2022 #186/195', grade: 'PSA 10', value: 7000, weight: 1800 },
      { id: 'st-gira9', name: '骑拉帝纳 Giratina V (Alt Art)', set: 'Lost Origin 2022 #186/196', grade: 'PSA 9', value: 2200, weight: 8000 },
      { id: 'st-zardsar10', name: '喷火龙 ex SAR', set: 'Obsidian Flames 2023 #223/197', grade: 'PSA 10', value: 1500, weight: 9000 },
      { id: 'st-pika9', name: '皮卡丘 VMAX (Promo)', set: 'SWSH Promo #SWSH062', grade: 'PSA 9', value: 700, weight: 18000 },
      { id: 'st-alt', name: '随机 Alt Art 原卡', set: 'SWSH/SV · Alt Art', grade: null, value: 500, weight: 30000,
        variants: ['冰伊布 Glaceon VMAX', '仙子伊布 Sylveon VMAX', '机擎王 Regidrago V', '雪暴马 Glastrier V'] },
      { id: 'st-sar', name: '随机 SAR/SIR 原卡', set: 'SV · Special Art Rare', grade: null, value: 240, weight: 60000,
        variants: ['米立龙 Miraidon ex SAR', '故勒顿 Koraidon ex SAR', '莉莉艾 Lillie SAR', '奇树 Iono SAR'] },
      { id: 'st-vex', name: '随机 V/ex 卡', set: 'SWSH/SV · Ultra Rare', grade: null, value: 120, weight: 190000,
        variants: ['路卡利欧 Lucario V', '甲贺忍蛙 Greninja ex', '沙奈朵 Gardevoir ex', '密勒顿 Miraidon ex'] },
      { id: 'st-common', name: '随机反闪/普卡', set: 'SWSH/SV · C/UC', grade: null, value: 35, weight: 682000,
        variants: ['新叶喵 Sprigatito', '呆火鳄 Fuecoco', '润水鸭 Quaxly', '布拨 Pawmi', '迷你芙 Smoliv', '可达鸭 Psyduck'] }
    ]
  },
  {
    id: 'silver', name: '白银包', nameEn: 'SILVER PACK', price: 500, theme: 'blue',
    desc: '1999–2000 初代复古卡池：Base Set / Jungle / Fossil / Team Rocket。头奖：初版喷火龙 PSA 10。',
    guarantee: '大奖 PSA 10 · 含原卡',
    pool: [
      { id: 'sv-zard10', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 10', value: 100000, weight: 600 },
      { id: 'sv-zard8', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 8', value: 15000, weight: 2500 },
      { id: 'sv-stoise9', name: '水箭龟 Blastoise', set: 'Base Set 1999 #2/102', grade: 'PSA 9', value: 9000, weight: 4500 },
      { id: 'sv-saur9', name: '妙蛙花 Venusaur', set: 'Base Set 1999 #15/102', grade: 'PSA 9', value: 7000, weight: 5500 },
      { id: 'sv-dzard9', name: '黑暗喷火龙 Dark Charizard', set: 'Team Rocket 2000 #4/82', grade: 'PSA 9', value: 3500, weight: 12000 },
      { id: 'sv-gyara9', name: '暴鲤龙 Gyarados', set: 'Base Set 1999 #6/102', grade: 'PSA 9', value: 1800, weight: 25000 },
      { id: 'sv-jolt8', name: '雷伊布 Jolteon', set: 'Jungle 1999 #4/64', grade: 'PSA 8', value: 900, weight: 40000 },
      { id: 'sv-lapras8', name: '拉普拉斯 Lapras', set: 'Fossil 1999 #10/62', grade: 'PSA 8', value: 600, weight: 60000 },
      { id: 'sv-holo', name: '随机初代闪卡', set: 'WotC 1999–2000 · Holo', grade: null, value: 350, weight: 120000,
        variants: ['风速狗 Arcanine', '胡地 Alakazam', '快龙 Dragonite', '耿鬼 Gengar', '雷丘 Raichu', '梦幻 Mew (Promo)', '袋兽 Kangaskhan'] },
      { id: 'sv-rare', name: '随机初代稀有卡', set: 'WotC 1999–2000 · Rare', grade: null, value: 130, weight: 300000,
        variants: ['皮可西 Clefable', '大食花 Victreebel', '九尾 Ninetales', '椰蛋树 Exeggutor', '嘎啦嘎啦 Marowak'] },
      { id: 'sv-common', name: '随机初代普卡', set: 'WotC 1999–2000 · C/UC', grade: null, value: 30, weight: 429900,
        variants: ['皮卡丘 Pikachu', '小火龙 Charmander', '杰尼龟 Squirtle', '妙蛙种子 Bulbasaur', '鲤鱼王 Magikarp', '波波 Pidgey', '喵喵 Meowth', '卡拉卡拉 Cubone'] }
    ]
  },
  {
    id: 'gold', name: '黄金包', nameEn: 'GOLD PACK', price: 1000, theme: 'gold',
    desc: '每一抽必得评级卡砖（slab）。头奖：闪光喷火龙 Neo Destiny PSA 10。',
    guarantee: '每抽必得 PSA 8+',
    pool: [
      { id: 'g-shining10', name: '闪光喷火龙 Shining Charizard', set: 'Neo Destiny 2001 #107/105', grade: 'PSA 10', value: 300000, weight: 100 },
      { id: 'g-goldstar9', name: '月亮伊布 Umbreon (Gold Star)', set: 'POP Series 5 2007 #17/17', grade: 'PSA 9', value: 60000, weight: 400 },
      { id: 'g-moon10', name: '月亮伊布 Umbreon VMAX (Alt Art)', set: 'Evolving Skies 2021 #215/203', grade: 'PSA 10', value: 45000, weight: 600 },
      { id: 'g-zard9', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 9', value: 35000, weight: 900 },
      { id: 'g-gira10', name: '骑拉帝纳 Giratina V (Alt Art)', set: 'Lost Origin 2022 #186/196', grade: 'PSA 10', value: 4500, weight: 20000 },
      { id: 'g-zardupc10', name: '喷火龙 V (UPC Promo)', set: 'SWSH Promo #SWSH260', grade: 'PSA 10', value: 3500, weight: 30000 },
      { id: 'g-hot10', name: '随机热门现代卡', set: '2021–2025 · Modern', grade: 'PSA 10', value: 1400, weight: 150000,
        variants: ['长毛巨魔 Annihilape ex', '帕底亚三御三家 SAR', '伊布家族 Promo', '梦幻 Mew ex SIR'] },
      { id: 'g-mid9', name: '随机现代卡', set: '2021–2025 · Modern', grade: 'PSA 9', value: 700, weight: 350000,
        variants: ['洗翠 Hisuian 系列', '宝可梦 GO 联动卡', '25 周年 Promo', 'VSTAR 宇宙精选'] },
      { id: 'g-floor', name: '随机评级卡砖', set: '混合年代 · Slab', grade: 'PSA 8/9', value: 320, weight: 448000,
        variants: ['剑盾 V 卡砖', '朱紫 ex 卡砖', 'XY 时代闪卡砖', '日月 GX 卡砖'] }
    ]
  },
  {
    id: 'diamond', name: '钻石包', nameEn: 'DIAMOND PACK', price: 2000, theme: 'purple',
    desc: '殿堂级卡池，每一抽必得 PSA 9 以上卡砖。头奖：初版无阴影喷火龙 PSA 9。',
    guarantee: '每抽必得 PSA 9+',
    pool: [
      { id: 'd-zard1st9', name: '初版喷火龙 Charizard (1st Ed.)', set: 'Base Set 1st Edition 1999 #4/102', grade: 'PSA 9', value: 600000, weight: 60 },
      { id: 'd-lugia10', name: '洛奇亚 Lugia', set: 'Neo Genesis 2000 #9/111', grade: 'PSA 10', value: 150000, weight: 300 },
      { id: 'd-goldstar10', name: '月亮伊布 Umbreon (Gold Star)', set: 'POP Series 5 2007 #17/17', grade: 'PSA 10', value: 90000, weight: 800 },
      { id: 'd-zard10', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 10', value: 100000, weight: 700 },
      { id: 'd-moon10', name: '月亮伊布 Umbreon VMAX (Alt Art)', set: 'Evolving Skies 2021 #215/203', grade: 'PSA 10', value: 45000, weight: 3000 },
      { id: 'd-ray10', name: '烈空坐 Rayquaza VMAX (Alt Art)', set: 'Evolving Skies 2021 #218/203', grade: 'PSA 10', value: 12000, weight: 20000 },
      { id: 'd-gira10', name: '骑拉帝纳 Giratina V (Alt Art)', set: 'Lost Origin 2022 #186/196', grade: 'PSA 10', value: 4500, weight: 80000 },
      { id: 'd-hot10', name: '随机热门现代卡', set: '2021–2025 · Modern', grade: 'PSA 10', value: 1400, weight: 300000,
        variants: ['长毛巨魔 Annihilape ex', '帕底亚三御三家 SAR', '伊布家族 Promo', '梦幻 Mew ex SIR'] },
      { id: 'd-floor9', name: '随机现代卡', set: '2021–2025 · Modern', grade: 'PSA 9', value: 800, weight: 595140,
        variants: ['洗翠 Hisuian 系列', '宝可梦 GO 联动卡', '25 周年 Promo', 'VSTAR 宇宙精选', 'Alt Art 精选'] }
    ]
  }
];

// 启动校验：概率总和必须精确 100%
for (const pk of PACKS_DATA) {
  const sum = pk.pool.reduce((s, c) => s + c.weight, 0);
  if (sum !== WEIGHT_TOTAL) throw new Error(`卡包 ${pk.id} 概率总和错误: ${sum}`);
}

// ---------- Web Crypto 工具 ----------
const _enc = new TextEncoder();
function _hex(buf) { return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function sha256hex(str) { return _hex(await crypto.subtle.digest('SHA-256', _enc.encode(str))); }
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', _enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return _hex(await crypto.subtle.sign('HMAC', k, _enc.encode(msg)));
}
function randHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}
function randInt(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}

// ---------- 引擎状态 ----------
let ST = null;

async function freshSeeds() {
  const serverSeed = randHex(32);
  return { serverSeed, serverSeedHash: await sha256hex(serverSeed), clientSeed: randHex(4), nonce: 0 };
}

async function ensureEngine() {
  if (ST) return;
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.seeds && Array.isArray(s.inventory)) { ST = s; return; }
  } catch (e) { /* 无存档或已损坏 */ }
  ST = {
    balance: START_BALANCE, inventory: [], history: [],
    stats: { opened: 0, spent: 0, recovered: 0, topups: 0 },
    seeds: await freshSeeds(), revealedSeeds: []
  };
  persist();
}

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch (e) { /* 隐私模式等场景忽略 */ }
}

// ---------- 抽卡核心（与 server.js 逻辑一致） ----------
async function rollAt(serverSeed, clientSeed, nonce) {
  const h = await hmacHex(serverSeed, `${clientSeed}:${nonce}`);
  return parseInt(h.slice(0, 8), 16) / 0x100000000;
}

function pickCard(pack, roll) {
  let threshold = roll * WEIGHT_TOTAL;
  for (const card of pack.pool) {
    threshold -= card.weight;
    if (threshold < 0) return card;
  }
  return pack.pool[pack.pool.length - 1];
}

function tierOf(value, price) {
  const x = value / price;
  if (x >= 50) return 'grail';
  if (x >= 10) return 'legendary';
  if (x >= 3) return 'epic';
  if (x >= 1) return 'rare';
  if (x >= 0.4) return 'uncommon';
  return 'common';
}

async function openOne(pack) {
  const seeds = ST.seeds;
  const nonce = seeds.nonce;
  const roll = await rollAt(seeds.serverSeed, seeds.clientSeed, nonce);
  seeds.nonce += 1;
  const card = pickCard(pack, roll);
  const displayName = card.variants ? card.variants[randInt(card.variants.length)] : card.name;
  return {
    uid: randHex(8), packId: pack.id, packName: pack.name,
    cardId: card.id, name: displayName, poolName: card.name,
    set: card.set, grade: card.grade, value: card.value,
    tier: tierOf(card.value, pack.price), status: 'owned', at: Date.now(),
    proof: {
      serverSeedHash: seeds.serverSeedHash, clientSeed: seeds.clientSeed,
      nonce, roll: Number(roll.toFixed(10))
    }
  };
}

function packPublicView(pack) {
  const ev = pack.pool.reduce((s, c) => s + (c.value * c.weight) / WEIGHT_TOTAL, 0);
  return {
    id: pack.id, name: pack.name, nameEn: pack.nameEn, price: pack.price,
    theme: pack.theme, desc: pack.desc, guarantee: pack.guarantee || null,
    ev: Math.round(ev * 10) / 10,
    rtp: Math.round((ev / pack.price) * 1000) / 10,
    pool: pack.pool.map((c) => ({
      id: c.id, name: c.name, set: c.set, grade: c.grade, value: c.value,
      odds: c.weight / WEIGHT_TOTAL, tier: tierOf(c.value, pack.price)
    }))
  };
}

function publicState() {
  return {
    balance: ST.balance, inventory: ST.inventory, history: ST.history.slice(0, 60),
    stats: ST.stats,
    fairness: {
      serverSeedHash: ST.seeds.serverSeedHash, clientSeed: ST.seeds.clientSeed,
      nonce: ST.seeds.nonce, revealedSeeds: ST.revealedSeeds.slice(-10)
    },
    buybackRate: BUYBACK_RATE
  };
}

// ---------- 本地 api()：与后端版签名一致 ----------
async function api(path, body) {
  await ensureEngine();
  const [route, query] = path.split('?');
  const params = new URLSearchParams(query || '');

  if (route === '/api/state') return publicState();
  if (route === '/api/packs') return PACKS_DATA.map(packPublicView);

  if (route === '/api/verify') {
    const serverSeed = params.get('serverSeed') || '';
    const clientSeed = params.get('clientSeed') || '';
    const nonce = parseInt(params.get('nonce') || '0', 10);
    if (!serverSeed || !clientSeed || Number.isNaN(nonce)) throw new Error('参数缺失：serverSeed / clientSeed / nonce');
    return {
      serverSeedHash: await sha256hex(serverSeed),
      roll: Number((await rollAt(serverSeed, clientSeed, nonce)).toFixed(10))
    };
  }

  if (route === '/api/open') {
    const pack = PACKS_DATA.find((p) => p.id === body.packId);
    if (!pack) throw new Error('卡包不存在');
    const count = Math.min(10, Math.max(1, parseInt(body.count, 10) || 1));
    const cost = pack.price * count;
    if (ST.balance < cost) throw new Error(`余额不足：需要 ${cost} 币，当前 ${ST.balance} 币`);
    ST.balance -= cost;
    ST.stats.spent += cost;
    ST.stats.opened += count;
    const items = [];
    for (let i = 0; i < count; i++) {
      const item = await openOne(pack);
      items.push(item);
      ST.inventory.unshift(item);
      ST.history.unshift({
        uid: item.uid, name: item.name, grade: item.grade, set: item.set,
        value: item.value, tier: item.tier, packName: pack.name, at: item.at, proof: item.proof
      });
    }
    ST.history = ST.history.slice(0, HISTORY_LIMIT);
    persist();
    return { items, balance: ST.balance };
  }

  if (route === '/api/sell') {
    const uids = Array.isArray(body.uids) ? body.uids : [body.uid];
    let credit = 0;
    const sold = [];
    for (const uid of uids) {
      const idx = ST.inventory.findIndex((i) => i.uid === uid && i.status === 'owned');
      if (idx === -1) continue;
      const [item] = ST.inventory.splice(idx, 1);
      credit += Math.floor(item.value * BUYBACK_RATE);
      sold.push(item.uid);
    }
    if (!sold.length) throw new Error('没有可回收的卡');
    ST.balance += credit;
    ST.stats.recovered += credit;
    persist();
    return { credit, sold, balance: ST.balance };
  }

  if (route === '/api/sell-floor') {
    const floorTiers = new Set(['common', 'uncommon']);
    let credit = 0, count = 0;
    ST.inventory = ST.inventory.filter((i) => {
      if (i.status === 'owned' && floorTiers.has(i.tier)) {
        credit += Math.floor(i.value * BUYBACK_RATE);
        count += 1;
        return false;
      }
      return true;
    });
    if (!count) throw new Error('没有低档卡可回收');
    ST.balance += credit;
    ST.stats.recovered += credit;
    persist();
    return { credit, count, balance: ST.balance };
  }

  if (route === '/api/ship') {
    const item = ST.inventory.find((i) => i.uid === body.uid && i.status === 'owned');
    if (!item) throw new Error('找不到该卡或已申请发货');
    item.status = 'shipped';
    persist();
    return { item };
  }

  if (route === '/api/topup') {
    const amount = Math.min(5000, Math.max(1, parseInt(body && body.amount, 10) || TOPUP_AMOUNT));
    ST.balance += amount;
    ST.stats.topups += 1;
    persist();
    return { balance: ST.balance, added: amount };
  }

  if (route === '/api/client-seed') {
    const seed = String(body.clientSeed || '').trim();
    if (!/^[\w-]{1,64}$/.test(seed)) throw new Error('客户端种子只能是 1–64 位字母数字');
    ST.seeds.clientSeed = seed;
    persist();
    return { clientSeed: seed };
  }

  if (route === '/api/rotate-seed') {
    const old = ST.seeds;
    ST.revealedSeeds.push({
      serverSeed: old.serverSeed, serverSeedHash: old.serverSeedHash,
      clientSeed: old.clientSeed, lastNonce: old.nonce - 1, revealedAt: Date.now()
    });
    ST.seeds = await freshSeeds();
    persist();
    return {
      revealed: ST.revealedSeeds[ST.revealedSeeds.length - 1],
      serverSeedHash: ST.seeds.serverSeedHash, clientSeed: ST.seeds.clientSeed
    };
  }

  if (route === '/api/reset') {
    ST = null;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
    await ensureEngine();
    return publicState();
  }

  throw new Error('unknown api: ' + route);
}
