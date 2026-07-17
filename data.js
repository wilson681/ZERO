// 卡包与卡池定义。
// weight 以百万分之一为单位，每个卡包的 weight 总和必须等于 1,000,000（服务端启动时校验）。
// value 为平台标定的市场价（币），回收价 = value * BUYBACK_RATE。
// grade 为 null 表示未评级原卡（raw card）。
// variants 存在时，抽中该条目会随机取一个名字作为展示（同价位的"随机卡"池）。

const WEIGHT_TOTAL = 1000000;

const PACKS = [
  {
    id: 'vintage',
    name: '复古经典包',
    nameEn: 'Vintage Classic',
    price: 200,
    theme: 'amber',
    desc: '1999–2000 初代卡池：Base Set / Jungle / Fossil / Team Rocket。头奖：初版喷火龙 PSA 10。',
    pool: [
      { id: 'v-zard10', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 10', value: 100000, weight: 200 },
      { id: 'v-zard8', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 8', value: 15000, weight: 800 },
      { id: 'v-stoise9', name: '水箭龟 Blastoise', set: 'Base Set 1999 #2/102', grade: 'PSA 9', value: 9000, weight: 1500 },
      { id: 'v-saur9', name: '妙蛙花 Venusaur', set: 'Base Set 1999 #15/102', grade: 'PSA 9', value: 7000, weight: 2000 },
      { id: 'v-dzard9', name: '黑暗喷火龙 Dark Charizard', set: 'Team Rocket 2000 #4/82', grade: 'PSA 9', value: 3500, weight: 4000 },
      { id: 'v-gyara9', name: '暴鲤龙 Gyarados', set: 'Base Set 1999 #6/102', grade: 'PSA 9', value: 1800, weight: 8000 },
      { id: 'v-jolt8', name: '雷伊布 Jolteon', set: 'Jungle 1999 #4/64', grade: 'PSA 8', value: 900, weight: 15000 },
      { id: 'v-lapras8', name: '拉普拉斯 Lapras', set: 'Fossil 1999 #10/62', grade: 'PSA 8', value: 600, weight: 20000 },
      {
        id: 'v-holo', name: '随机初代闪卡', set: 'WotC 1999–2000 · Holo', grade: null, value: 350, weight: 48500,
        variants: ['风速狗 Arcanine', '胡地 Alakazam', '快龙 Dragonite', '耿鬼 Gengar', '雷丘 Raichu', '梦幻 Mew (Promo)', '袋兽 Kangaskhan']
      },
      {
        id: 'v-rare', name: '随机初代稀有卡', set: 'WotC 1999–2000 · Rare', grade: null, value: 120, weight: 150000,
        variants: ['皮可西 Clefable', '大食花 Victreebel', '九尾 Ninetales', '椰蛋树 Exeggutor', '嘎啦嘎啦 Marowak']
      },
      {
        id: 'v-common', name: '随机初代普卡', set: 'WotC 1999–2000 · C/UC', grade: null, value: 25, weight: 750000,
        variants: ['皮卡丘 Pikachu', '小火龙 Charmander', '杰尼龟 Squirtle', '妙蛙种子 Bulbasaur', '鲤鱼王 Magikarp', '波波 Pidgey', '喵喵 Meowth', '卡拉卡拉 Cubone']
      }
    ]
  },
  {
    id: 'modern',
    name: '现代大奖包',
    nameEn: 'Modern Hits',
    price: 200,
    theme: 'violet',
    desc: '剑盾 / 朱紫时代卡池：Alt Art、SAR 应有尽有。头奖：月亮伊布 Alt Art PSA 10。',
    pool: [
      { id: 'm-moon10', name: '月亮伊布 Umbreon VMAX (Alt Art)', set: 'Evolving Skies 2021 #215/203', grade: 'PSA 10', value: 45000, weight: 300 },
      { id: 'm-ray10', name: '烈空坐 Rayquaza VMAX (Alt Art)', set: 'Evolving Skies 2021 #218/203', grade: 'PSA 10', value: 12000, weight: 900 },
      { id: 'm-lugia10', name: '洛奇亚 Lugia V (Alt Art)', set: 'Silver Tempest 2022 #186/195', grade: 'PSA 10', value: 7000, weight: 1800 },
      { id: 'm-gira9', name: '骑拉帝纳 Giratina V (Alt Art)', set: 'Lost Origin 2022 #186/196', grade: 'PSA 9', value: 2200, weight: 8000 },
      { id: 'm-zardsar10', name: '喷火龙 ex SAR', set: 'Obsidian Flames 2023 #223/197', grade: 'PSA 10', value: 1500, weight: 9000 },
      { id: 'm-pika9', name: '皮卡丘 VMAX (Promo)', set: 'SWSH Promo #SWSH062', grade: 'PSA 9', value: 700, weight: 18000 },
      {
        id: 'm-alt', name: '随机 Alt Art 原卡', set: 'SWSH/SV · Alt Art', grade: null, value: 500, weight: 30000,
        variants: ['冰伊布 Glaceon VMAX', '仙子伊布 Sylveon VMAX', '机擎王 Regidrago V', '雪暴马 Glastrier V']
      },
      {
        id: 'm-sar', name: '随机 SAR/SIR 原卡', set: 'SV · Special Art Rare', grade: null, value: 240, weight: 60000,
        variants: ['米立龙 Miraidon ex SAR', '故勒顿 Koraidon ex SAR', '莉莉艾 Lillie SAR', '奇树 Iono SAR']
      },
      {
        id: 'm-vex', name: '随机 V/ex 卡', set: 'SWSH/SV · Ultra Rare', grade: null, value: 120, weight: 190000,
        variants: ['路卡利欧 Lucario V', '甲贺忍蛙 Greninja ex', '沙奈朵 Gardevoir ex', '密勒顿 Miraidon ex']
      },
      {
        id: 'm-common', name: '随机反闪/普卡', set: 'SWSH/SV · C/UC', grade: null, value: 35, weight: 682000,
        variants: ['新叶喵 Sprigatito', '呆火鳄 Fuecoco', '润水鸭 Quaxly', '布拨 Pawmi', '迷你芙 Smoliv', '可达鸭 Psyduck']
      }
    ]
  },
  {
    id: 'premium',
    name: '全鉴定至尊包',
    nameEn: 'All-Slab Premium',
    price: 1000,
    theme: 'cyan',
    desc: '每一抽必得评级卡砖（slab）。头奖：闪光喷火龙 Neo Destiny PSA 10。',
    pool: [
      { id: 'p-shining10', name: '闪光喷火龙 Shining Charizard', set: 'Neo Destiny 2001 #107/105', grade: 'PSA 10', value: 300000, weight: 100 },
      { id: 'p-goldstar9', name: '月亮伊布 Umbreon (Gold Star)', set: 'POP Series 5 2007 #17/17', grade: 'PSA 9', value: 60000, weight: 400 },
      { id: 'p-moon10', name: '月亮伊布 Umbreon VMAX (Alt Art)', set: 'Evolving Skies 2021 #215/203', grade: 'PSA 10', value: 45000, weight: 600 },
      { id: 'p-zard9', name: '喷火龙 Charizard', set: 'Base Set 1999 #4/102', grade: 'PSA 9', value: 35000, weight: 900 },
      { id: 'p-gira10', name: '骑拉帝纳 Giratina V (Alt Art)', set: 'Lost Origin 2022 #186/196', grade: 'PSA 10', value: 4500, weight: 20000 },
      { id: 'p-zardupc10', name: '喷火龙 V (UPC Promo)', set: 'SWSH Promo #SWSH260', grade: 'PSA 10', value: 3500, weight: 30000 },
      {
        id: 'p-hot10', name: '随机热门现代卡', set: '2021–2025 · Modern', grade: 'PSA 10', value: 1400, weight: 150000,
        variants: ['长毛巨魔 Annihilape ex', '帕底亚三御三家 SAR', '伊布家族 Promo', '梦幻 Mew ex SIR']
      },
      {
        id: 'p-mid9', name: '随机现代卡', set: '2021–2025 · Modern', grade: 'PSA 9', value: 700, weight: 350000,
        variants: ['洗翠 Hisuian 系列', '宝可梦 GO 联动卡', '25 周年 Promo', 'VSTAR 宇宙精选']
      },
      {
        id: 'p-floor', name: '随机评级卡砖', set: '混合年代 · Slab', grade: 'PSA 8/9', value: 320, weight: 448000,
        variants: ['剑盾 V 卡砖', '朱紫 ex 卡砖', 'XY 时代闪卡砖', '日月 GX 卡砖']
      }
    ]
  }
];

module.exports = { PACKS, WEIGHT_TOTAL };
