import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { loadUnlockables, PROVENANCE_DIR, UNLOCKABLES_DIR } from "./load.mjs";

function reportRow(row) {
  return {
    filePath: row.filePath,
    id: row.id,
    name: row.text["zh-Hans"].name,
    en: row.text.en,
    zh: row.text["zh-Hans"],
    provenance: row.provenance,
  };
}

function patchForRow(row) {
  if (MANUAL_PATCHES[row.filePath]) return MANUAL_PATCHES[row.filePath];
  if (row.category === "monster_log") return monsterLogPatch(row);
  return null;
}

function applyPatch(relativePath, patch) {
  const filePath = path.join(UNLOCKABLES_DIR, relativePath);
  const parsed = TOML.parse(fs.readFileSync(filePath, "utf8"));
  parsed.text["zh-Hans"] = {
    ...parsed.text["zh-Hans"],
    ...patch,
  };
  fs.writeFileSync(filePath, `${TOML.stringify(parsed).trim()}\n`);
}

function markReviewed(relativePath) {
  const filePath = path.join(PROVENANCE_DIR, relativePath);
  const parsed = TOML.parse(fs.readFileSync(filePath, "utf8"));
  parsed.text["zh-Hans"].guide = "manual_review:text.en.guide";
  parsed.review.zh_guide = "accepted";
  fs.writeFileSync(filePath, `${TOML.stringify(parsed).trim()}\n`);
}

function monsterLogPatch(row) {
  const parsed = parseMonsterLogSummary(row.text.en.summary);
  if (!parsed) return null;
  const monster = term(row.text["zh-Hans"].name);
  const location = stageTerm(row.text.en.location || parsed.location);
  const poolKind = parsed.poolKind === "boss" ? "首领" : "普通生成";
  const entries = parsed.entryCount ? `（列出 ${parsed.entryCount} 个${poolKind}条目）` : "";
  return {
    summary: `推荐在${location}刷${monster}的${term("怪物日志")}。根据缓存的关卡表，${location}是匹配${poolKind}池中最小的推荐地点${entries}。已知 wiki 关卡池：${translatePools(parsed.pools)}。`,
    location: unwrap(location),
    notes: [
      "缓存的 wiki/游戏语言数据列出了关卡池，但没有精确的怪物生成权重。",
      "只读扫描游戏的 external data/stages/*.rorlvl 文件只找到布局对象，没有找到通用 Director 怪物卡权重。",
      "data.win 字符串能看到 Director/MonsterCard 脚本名，但还没有解码出逐怪物权重表。",
      `缓存的 wiki/游戏语言数据不包含${term("怪物日志")}掉落率。`,
    ],
  };
}

function parseMonsterLogSummary(summary) {
  const match = summary.match(/^Farm the Monster Log at (.+?)\. .+? is the smallest matching (standard|boss) pool in the cached stage tables \((\d+) listed .*? entries\)\. Known wiki stage pools: (.+)\.$/);
  if (!match) return null;
  return {
    location: match[1],
    poolKind: match[2],
    entryCount: Number(match[3]),
    pools: match[4],
  };
}

function translatePools(value) {
  return value
    .split(";")
    .map((part) => {
      const [rawKind, rawStages] = part.split(":").map((piece) => piece.trim());
      const kind = rawKind === "boss" ? "首领" : rawKind === "standard spawn" ? "普通生成" : rawKind === "after looping" ? "循环后" : rawKind;
      const stages = (rawStages || "")
        .split(",")
        .map((stage) => stage.trim())
        .filter(Boolean)
        .map(stageTerm)
        .join("、");
      return stages ? `${kind}：${stages}` : kind;
    })
    .join("；");
}

function stageTerm(value) {
  return term(STAGE_TERMS[value] || value);
}

function term(value) {
  return `<${value}>`;
}

function unwrap(value) {
  return String(value).replace(/^<|>$/g, "");
}

const STAGE_TERMS = {
  "Desolate Forest": "荒凉森林",
  "Dried Lake": "枯涸湖",
  "Damp Caverns": "潮湿洞窟",
  "Sky Meadow": "空中草原",
  "Ancient Valley": "远古峡谷",
  "Sunken Tombs": "沉没墓园",
  "Magma Barracks": "熔岩要塞",
  "Hive Cluster": "虫巢",
  "Temple of the Elders": "长老神殿",
  "Risk of Rain": "暴雨滂沱",
  "Boar Beach": "野猪滩",
  "Imp Shrine": "小恶魔神龛",
};

const MANUAL_PATCHES = {
  "artifacts/cognation.toml": {
    summary: `在${term("荒凉森林")}激活两个按钮，击败生成的${term("亵渎石傀儡")}，然后拾取${term("神器：相性")}。`,
    location: "见鬼了",
    steps: [
      `使用现代规则集进入${term("荒凉森林")}关卡变体 #4。`,
      "在关卡右侧寻找隐藏藤蔓。",
      "激活两个谜题按钮。",
      `击败生成的${term("亵渎石傀儡")}。`,
      `在${term("神器传送门")}拾取${term("神器：相性")}。`,
    ],
  },
  "artifacts/command.toml": {
    summary: `在${term("虫巢")}找到并拾取${term("神器：统率")}。`,
    location: "虫巢之中",
    steps: [
      `进入${term("虫巢")}关卡变体 #1、#2 或 #3。`,
      "前往关卡右上区域。缓存的 wiki 图片文字指出，关卡变体 #1 的右上角有该神器。",
      `拾取${term("神器：统率")}。`,
    ],
  },
  "artifacts/dissonance.toml": {
    summary: `找到 4 个隐藏的${term("神器碎片")}以解锁${term("神器：纷争")}。`,
    location: "观光",
    steps: [
      `收集${term("远古峡谷")}变体 #4-#6 的碎片：它位于中央山体右侧，可通过山顶隐藏的锁链或绳索抵达。`,
      `收集${term("沉没墓园")}关卡变体 #5 的碎片。`,
      `收集${term("熔岩要塞")}变体 #4-#6 的碎片：缓存的 wiki 注记指出它在关卡变体 #6 地图右上方附近。`,
      `收集${term("虫巢")}变体 #1-#3 的碎片：缓存的 wiki 注记指向关卡变体 #1 右下角的${term("膨胀幸存者")}。`,
      `总计收集 4 个${term("神器碎片")}后，${term("神器：纷争")}会解锁。`,
    ],
  },
  "artifacts/distortion.toml": {
    summary: `按下${term("潮湿洞窟")}中的隐藏按钮，使${term("神器：扭曲")}出现在附近基座上。`,
    location: "蘑菇之间",
    steps: [
      `进入${term("潮湿洞窟")}关卡变体 #1、#2 或 #3。`,
      "寻找神器按钮。缓存的 wiki 图片文字特别标出了关卡变体 #2 的按钮位置。",
      "按下按钮。",
      `前往按钮位置左侧的基座，拾取生成的${term("神器：扭曲")}。`,
    ],
  },
  "artifacts/enigma.toml": {
    summary: `利用${term("沉没墓园")}右下方隐藏洞穴路线，抵达并拾取${term("神器：谜团")}。`,
    location: "淹没之下",
    steps: [
      `进入${term("沉没墓园")}关卡变体 #1、#2 或 #3。`,
      "前往地图右下角，找到通往小洞穴的下落入口。",
      "沿洞穴路线向右前进。",
      "利用隐藏喷泉的冲力抵达隧道。",
      `沿隧道走到尽头并拾取${term("神器：谜团")}。`,
    ],
  },
  "artifacts/glass.toml": {
    summary: `完成${term("远古峡谷")}中的隐藏限时按钮挑战，使${term("神器：玻璃")}生成。`,
    location: "桥下",
    steps: [
      `进入${term("远古峡谷")}关卡变体 #1、#2 或 #3。`,
      "前往地图左侧，寻找藏在墙壁或绳索后的洞穴。",
      "进入平台跳跃挑战区域。",
      "在 15 秒内击中挑战区域内分布的 5 个按钮。",
      `拾取生成的${term("神器：玻璃")}。`,
    ],
  },
  "artifacts/honor.toml": {
    summary: `在${term("荒凉森林")}找到并拾取${term("神器：荣耀")}。`,
    location: "森林之中",
    steps: [
      `进入${term("荒凉森林")}关卡变体 #1、#2 或 #3。`,
      "在关卡变体 #3 中，检查地图左上侧、瀑布右侧的位置。",
      "寻找地面上的蓝色树根，并从那里进入隐藏路径抵达神器。",
      "拾取神器物件。",
    ],
  },
  "artifacts/kin.toml": {
    summary: `打破${term("枯涸湖")}的隐藏区域入口，并激活三个按钮以显露${term("神器：亲族")}。`,
    location: "干燥之地",
    steps: [
      `进入${term("枯涸湖")}关卡变体 #1、#2 或 #3。`,
      "前往关卡最右侧，找到可破坏墙壁。",
      `用合适的${term("幸存者")}技能打破墙壁。缓存的 wiki 注记称，抵达这里可能需要${term("霍普羽毛")}、${term("生锈的喷气背包")}或${term("光子喷气背包")}。`,
      "激活谜题房间中的全部三个按钮。",
      `在${term("神器传送门")}拾取${term("神器：亲族")}。`,
    ],
  },
  "artifacts/mountain.toml": {
    summary: `在至少 15 个${term("天命试炼")}中取得金牌，以解锁${term("神器：威望")}。`,
    location: "负重前行",
    steps: [
      `打开${term("天命试炼")}。`,
      "反复完成试炼并取得金牌，直到至少 15 个试炼达到金牌。",
      `返回神器/挑战列表，确认${term("神器：威望")}已解锁。`,
    ],
  },
  "artifacts/origin.toml": {
    summary: `启用九个基础神器并击杀${term("天命")}，以解锁${term("神器：起源")}。`,
    location: "万花筒",
    steps: [
      `解锁${term("神器：荣耀")}、${term("神器：亲族")}、${term("神器：扭曲")}、${term("神器：玻璃")}、${term("神器：恶意")}、${term("神器：谜团")}、${term("神器：牺牲")}、${term("神器：统率")}和${term("神器：精神")}。`,
      "开启一局游戏，并启用上述九个神器。",
      `抵达${term("暴雨滂沱")}。`,
      `击杀${term("天命")}。`,
      `大厅中的所有玩家都会解锁${term("神器：起源")}。`,
    ],
  },
  "artifacts/sacrifice.toml": {
    summary: `射击${term("熔岩要塞")}中藏在墙后的三个按钮，以解锁${term("神器：牺牲")}。`,
    location: "核心附近",
    steps: [
      `使用任意规则集进入${term("熔岩要塞")}关卡变体 #1、#2 或 #3。`,
      "在整个关卡中搜索藏在墙后的三个按钮。",
      `射击全部三个隐藏按钮。${term("飞天利莫里亚人")}也能击中按钮，可帮助无法穿墙攻击的角色。`,
      `按钮目标完成后，拾取${term("神器：牺牲")}。`,
    ],
  },
  "artifacts/spirit.toml": {
    summary: `完成${term("长老神殿")}下方的跑酷路线，以获得${term("神器：精神")}。`,
    location: "神殿之下",
    steps: [
      `进入${term("长老神殿")}关卡变体 #1、#2 或 #3。`,
      "前往地图右侧下方。",
      "进入跑酷路线。",
      `抵达路线尽头并拾取${term("神器：精神")}。`,
    ],
  },
  "artifacts/spite.toml": {
    summary: `利用${term("祖人")}敌人砸开${term("空中草原")}的裂缝，然后完成隐藏障碍路线。`,
    location: "草原之中",
    steps: [
      `进入${term("空中草原")}关卡变体 #1、#2 或 #3。`,
      "在关卡中央附近寻找地面上的小裂缝。",
      `把${term("祖人")}敌人引到裂缝处，让它反复砸击直到裂缝破开。`,
      "进入地图下方新打开的洞口。",
      `完成隐藏障碍路线并拾取${term("神器：恶意")}。`,
    ],
  },
  "artifacts/temporary.toml": {
    summary: `在 16 分钟前抵达${term("长老神殿")}，并在${term("神器：须臾")}消失前拾取它。`,
    location: "熵",
    steps: [
      `进入任意变体的${term("长老神殿")}。`,
      "在本局时间经过 16 分钟前抵达该关卡。",
      `在${term("神器：须臾")}消失前拾取它。`,
      `如果在 16 分钟后才抵达${term("长老神殿")}，该神器不会出现。`,
    ],
  },
  "items/dead-mans-foot.toml": {
    summary: `在${term("虫巢")}找到并调查${term("膨胀幸存者")}尸体，以解锁${term("死人之脚")}。`,
    steps: [
      `进入${term("虫巢")}。`,
      "搜索地图右侧的中下部区域。",
      "出现提示时，调查靠近墙边的尸体。",
    ],
  },
  "items/mu-construct.toml": {
    summary: `穿过${term("荒凉森林")}关卡变体 #4 的隐藏路径，找到${term("Mu构造体")}。`,
    steps: [
      `进入${term("荒凉森林")}关卡变体 #4。`,
      "前往左侧，找到覆盖大块绿色苔藓的洞穴。",
      "从洞穴左侧出去，利用喷泉弹向黄色藤蔓，然后向上爬一段。",
      `向右跳进隐藏墙洞，沿长隐藏路径前进直到找到${term("Mu构造体")}。`,
    ],
  },
  "items/the-toxin.toml": {
    summary: `在最终${term("暴雨滂沱")}关卡的储藏室中找到${term("非法货物")}，以解锁${term("毒素")}。`,
    steps: [
      `前往最终关${term("暴雨滂沱")}。`,
      "从金色容器、敌人或防爆门区域获取钥匙卡。",
      `在遭遇${term("天命")}前，前往飞船最右侧的储藏室。`,
      `使用钥匙卡，然后反复调查/打开架子上的黑色隐藏箱，直到找到${term("毒素")}。`,
    ],
  },
  "monster-logs/lynx-tribe.toml": {
    summary: `在包含猞猁弓手、斥候和猎手的${term("审判")}波次中刷${term("猞猁部落")}的${term("怪物日志")}。缓存的普通关卡页面没有把${term("猞猁部落")}列入常规关卡池。`,
    location: "审判",
    notes: [
      "缓存的 wiki/游戏语言数据列出了关卡池，但没有精确的怪物生成权重。",
      "只读扫描游戏的 external data/stages/*.rorlvl 文件只找到布局对象，没有找到通用 Director 怪物卡权重。",
      "data.win 字符串能看到 Director/MonsterCard 脚本名，但还没有解码出逐怪物权重表。",
      `缓存的 wiki/游戏语言数据不包含${term("怪物日志")}掉落率。`,
    ],
  },
  "monster-logs/tiny-imp.toml": {
    summary: `通过挑战${term("小恶魔神龛")}刷${term("小不点小恶魔")}的${term("怪物日志")}；缓存的互动对象页面说明，${term("小恶魔神龛")}会生成${term("小不点小恶魔")}，击杀后奖励一个物品。`,
    location: "小恶魔神龛",
    notes: [
      "缓存的 wiki/游戏语言数据列出了关卡池，但没有精确的怪物生成权重。",
      "只读扫描游戏的 external data/stages/*.rorlvl 文件只找到布局对象，没有找到通用 Director 怪物卡权重。",
      "data.win 字符串能看到 Director/MonsterCard 脚本名，但还没有解码出逐怪物权重表。",
      `缓存的 wiki/游戏语言数据不包含${term("怪物日志")}掉落率。`,
    ],
  },
  "secret-stages/boar-beach.toml": {
    summary: `从${term("远古峡谷")}关卡变体 #2 左上方的围栏进入${term("野猪滩")}。`,
    location: `从${term("远古峡谷")}关卡变体 #2 进入的隐藏关卡`,
    steps: [
      `进入${term("远古峡谷")}关卡变体 #2。`,
      "前往关卡左上方的围栏。",
      `在围栏处按上方向键进入${term("野猪滩")}。`,
      `进入${term("野猪滩")}后，如果想顺路寻找日志或${term("呛鼻毒师")}的${term("奇怪棱镜：黑曜石")}，立刻向左走。`,
    ],
  },
  "skins/acrid-acrid-skin-s.toml": {
    summary: `在${term("暴雨滂沱")}关卡变体 #2 找到${term("呛鼻毒师")}的${term("奇怪棱镜：钙")}。`,
    location: "钙",
    steps: [
      `前往${term("暴雨滂沱")}关卡变体 #2。`,
      "前往与关卡日志相同的隐藏位置。",
      "到达日志位置后继续向左，进入隐藏房间。",
      `在隐藏房间中收集${term("奇怪棱镜：钙")}。`,
    ],
  },
  "skins/acrid-acrid-skin-s2.toml": {
    summary: `从${term("远古峡谷")}关卡变体 #2 抵达${term("野猪滩")}，再通过平台路线前往${term("呛鼻毒师")}的${term("奇怪棱镜：黑曜石")}。`,
    location: "黑曜石",
    steps: [
      `进入${term("远古峡谷")}关卡变体 #2。`,
      `前往关卡左上方的围栏，按上方向键进入${term("野猪滩")}。`,
      `进入${term("野猪滩")}后立刻向左走。`,
      "沿隐藏绳索向下爬，到达隐藏平台。",
      "继续沿平台向右前进。",
      `收集${term("奇怪棱镜：黑曜石")}。`,
    ],
  },
  "skins/arti-arti-skin-s.toml": {
    summary: `在${term("枯涸湖")}关卡变体 #3 找到${term("工匠")}的${term("奇怪棱镜：静滞")}。`,
    location: "静滞",
    steps: [
      `进入${term("枯涸湖")}关卡变体 #3。`,
      "前往关卡最左上方、钓鱼骷髅旁的位置。",
      "贴着墙体下落到边界外。",
      "立刻落回边界内，降到下方平台。",
      `沿隐藏平台继续向右并搜索，直到找到${term("奇怪棱镜：静滞")}。`,
    ],
  },
  "skins/bandit-bandit-skin-s.toml": {
    summary: `在${term("教程")}中找到${term("潜行者")}的${term("奇怪棱镜：阻滞")}。`,
    location: "阻滞",
    steps: [
      `打开${term("教程")}。`,
      "沿最左侧藤蔓向下爬。",
      "走到关卡右侧。",
      `收集${term("奇怪棱镜：阻滞")}。`,
    ],
  },
  "skins/commando-commando-skin-s.toml": {
    summary: `在${term("荒凉森林")}关卡变体 #3 找到${term("指挥官")}的${term("奇怪棱镜：硫化铁")}。`,
    location: "硫化铁",
    steps: [
      `进入${term("荒凉森林")}关卡变体 #3。`,
      "前往地图最左侧。",
      "找到地面上的蓝色树根。",
      "从树根处向下爬，抵达小凹室。",
      `收集${term("奇怪棱镜：硫化铁")}。`,
    ],
  },
  "skins/drifter-drifter-skin-s.toml": {
    summary: `在${term("远古峡谷")}关卡变体 #2 找到${term("漂泊者")}的${term("奇怪棱镜：花粉")}。`,
    location: "花粉",
    steps: [
      `进入${term("远古峡谷")}关卡变体 #2。`,
      "前往关卡中央附近。",
      `到达带有${term("利莫里亚人")}雪人的高台。`,
      `互动或靠近以获得${term("奇怪棱镜：花粉")}。`,
    ],
  },
  "skins/huntress-huntress-skin-s.toml": {
    summary: `在${term("熔岩要塞")}关卡变体 #2 找到${term("女猎人")}的${term("奇怪棱镜：灭绝")}。`,
    location: "灭绝",
    steps: [
      `进入${term("熔岩要塞")}关卡变体 #2。`,
      "前往地图最右侧。",
      "在岩浆下方的地板中找到绳索。",
      `沿绳索向下爬，到达有${term("利莫里亚人")}雕像的房间。`,
      `收集${term("奇怪棱镜：灭绝")}。同一房间也可以通过通往环境日志 #2 的隧道抵达。`,
    ],
  },
  "skins/loader-loader-skin-s.toml": {
    summary: `在${term("空中草原")}关卡变体 #2 完成${term("神器：恶意")}障碍路线后，找到${term("装卸工")}的${term("奇怪棱镜：星云")}。`,
    location: "星云",
    steps: [
      `进入${term("空中草原")}关卡变体 #2。`,
      `开启并完成通往${term("神器：恶意")}的障碍路线。`,
      "完成路线后继续向左并向上前进。",
      `收集${term("奇怪棱镜：星云")}。`,
    ],
  },
  "skins/mercenary-mercenary-skin-s.toml": {
    summary: `在${term("暴雨滂沱")}关卡变体 #2 找到${term("雇佣兵")}的${term("奇怪棱镜：恶意")}。`,
    location: "恶意",
    steps: [
      `前往${term("暴雨滂沱")}关卡变体 #2。`,
      "穿过小屋墙上的洞。",
      "从悬崖跳下，进入崖壁中的洞穴。",
      "穿过洞穴和派对区域。",
      "向上跳入隐藏隧道。",
      `继续穿过隧道，直到在最后一根柱子上找到${term("奇怪棱镜：恶意")}。`,
    ],
  },
  "skins/pilot-pilot-skin-s.toml": {
    summary: `${term("领航员")}的${term("奇怪棱镜：凝固汽油")}存在于游戏语言数据中，但在当前公开游戏/wiki 数据集中仍无法获得。`,
    location: "凝固汽油",
    steps: [
      "不要把它作为可执行路线推荐展示。",
      `缓存的${term("领航员")}wiki 数据把对应的第五个${term("领航员")}皮肤栏位列为当前无法获得。`,
      "保留语言包中的挑战条目以保证完整性，但在后续游戏/wiki 更新公开路线前，应把它视为不可获得。",
    ],
    notes: [
      `缓存的${term("领航员")}wiki 页面将 PilotPortrait5 标为当前无法获得。`,
      "已在 2026-07-02 刷新缓存的关卡页面并重新解析关卡棱镜章节；只找到 9 个棱镜章节，没有发现领航员/凝固汽油。",
      "wiki.gg Special:Search 搜索 Napalm 没有结果。",
      "Google 对精确短语的搜索结果主要指向包含 9 个已知棱镜的社区指南，而不是 Napalm。",
      "data.win 字符串扫描找到了 oStrangePrism/oSpawnPrism 和领航员 sprite，但没有发现 Napalm 或领航员专属棱镜路线字符串。",
    ],
  },
  "survivors/hand.toml": {
    summary: `在最终${term("暴雨滂沱")}关卡找到损坏的机器人清洁工货柜，以解锁${term("韩-迪")}。`,
    steps: [
      `前往最终关${term("暴雨滂沱")}。`,
      "探索货舱/防爆门区域，直到找到损坏的货舱门区域。",
      "寻找堆叠的粉色货柜，以及其中明显损坏或破开的那个。",
      `与该货柜互动，为之后的游戏解锁${term("韩-迪")}。`,
    ],
  },
};

const reportOnly = process.argv.includes("--report");
const includeAll = process.argv.includes("--all");
const rows = await loadUnlockables();
const reviewRows = includeAll ? rows : rows.filter((row) => row.provenance?.review?.zh_guide === "needs_human_review");

if (reportOnly) {
  console.log(JSON.stringify(reviewRows.map(reportRow), null, 2));
  process.exit(0);
}

let changed = 0;
const skipped = [];

for (const row of reviewRows) {
  const patch = patchForRow(row);
  if (!patch) {
    skipped.push(row.filePath);
    continue;
  }
  applyPatch(row.filePath, patch);
  markReviewed(row.filePath);
  changed += 1;
}

console.log(`Reviewed ${changed} zh-Hans guide translations`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} rows without review patch:`);
  for (const filePath of skipped) console.log(`- ${filePath}`);
  process.exitCode = 1;
}
