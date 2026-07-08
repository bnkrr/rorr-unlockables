import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { loadUnlockables, PROVENANCE_DIR, UNLOCKABLES_DIR } from "./load.mjs";

const USER_FACING_NOTES = [
  "Stage pool data shows where this monster can spawn, but exact spawn weights are not currently available.",
  "Monster Logs are random drops; expect to kill the target repeatedly.",
];

function reportRow(row) {
  return {
    filePath: row.filePath,
    id: row.id,
    en: row.text.en,
    zh: row.text["zh-Hans"],
    provenance: row.provenance,
  };
}

function patchForRow(row) {
  if (MANUAL_PATCHES[row.filePath]) return MANUAL_PATCHES[row.filePath];
  if (row.category === "monster_log") return monsterLogPatch(row);
  return acceptOnlyPatch();
}

function acceptOnlyPatch() {
  return { en: {}, zh: null };
}

function applyPatch(relativePath, patch) {
  const filePath = path.join(UNLOCKABLES_DIR, relativePath);
  const parsed = TOML.parse(fs.readFileSync(filePath, "utf8"));
  if (patch.en) {
    parsed.text.en = {
      ...parsed.text.en,
      ...patch.en,
    };
  }
  if (patch.zh) {
    parsed.text["zh-Hans"] = {
      ...parsed.text["zh-Hans"],
      ...patch.zh,
    };
  }
  fs.writeFileSync(filePath, `${TOML.stringify(parsed).trim()}\n`);
}

function markReviewed(relativePath, patch) {
  const filePath = path.join(PROVENANCE_DIR, relativePath);
  const parsed = TOML.parse(fs.readFileSync(filePath, "utf8"));
  parsed.text.en.guide = "manual_review:text.en.guide";
  parsed.review.en_guide = "accepted";
  if (patch.zh) {
    parsed.text["zh-Hans"].guide = "manual_review:text.en.guide";
    parsed.review.zh_guide = "accepted";
  }
  fs.writeFileSync(filePath, `${TOML.stringify(parsed).trim()}\n`);
}

function monsterLogPatch(row) {
  if (MANUAL_MONSTER_PATCHES[row.filePath]) return MANUAL_MONSTER_PATCHES[row.filePath](row);

  const parsed = parseMonsterLogSummary(row.text.en.summary);
  if (!parsed) return null;

  const monster = row.text.en.name;
  const zhMonster = term(row.text["zh-Hans"].name);
  const zhLocation = term(row.text["zh-Hans"].location || STAGE_TERMS[parsed.location] || parsed.location);
  const poolKind = parsed.poolKind === "boss" ? "boss" : "standard spawn";
  const zhPoolKind = parsed.poolKind === "boss" ? "首领" : "普通生成";
  const entries = `${parsed.entryCount} listed ${poolKind} entries`;
  const zhEntries = `${parsed.entryCount} 个${zhPoolKind}条目`;

  return {
    en: {
      summary: `Farm ${monster}'s Monster Log in ${parsed.location}. ${parsed.location} is the earliest recommended ${poolKind} farming location among the known spawn pools (${entries}). Known stage pools: ${parsed.pools}.`,
      location: parsed.location,
      notes: USER_FACING_NOTES,
    },
    zh: {
      summary: `推荐在${zhLocation}刷${zhMonster}的${term("怪物日志")}。在已知生成池中，${zhLocation}是最早推荐的${zhPoolKind}刷取地点（${zhEntries}）。已知关卡池：${translatePools(parsed.pools)}。`,
      location: unwrap(zhLocation),
      notes: [
        "关卡池数据能说明该怪物会在哪些地方生成，但目前没有精确的生成权重。",
        `${term("怪物日志")}是随机掉落，通常需要反复击杀目标。`,
      ],
    },
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
        .map((stage) => term(STAGE_TERMS[stage] || stage))
        .join("、");
      return stages ? `${kind}：${stages}` : kind;
    })
    .join("；");
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
  "Judgement": "审判",
  "Imp Shrine": "小恶魔神龛",
};

const MANUAL_PATCHES = {
  "artifacts/command.toml": {
    en: {
      steps: [
        "Route into Hive Cluster, Stage Variant #1, #2, or #3.",
        "Go to the top-right area of the stage. On Stage Variant #1, the artifact is in the top-right corner.",
        "Pick up the Artifact of Command.",
      ],
    },
    zh: {
      steps: [
        `进入${term("虫巢")}关卡变体 #1、#2 或 #3。`,
        "前往关卡右上区域。在关卡变体 #1 中，该神器位于右上角。",
        `拾取${term("神器：统率")}。`,
      ],
    },
  },
  "artifacts/dissonance.toml": {
    en: {
      steps: [
        "Collect the shard in Ancient Valley variants #4-#6: it is on the right side of the central mountain and can be reached by a hidden chain or rope at the top of the mountain.",
        "Collect the shard in Sunken Tombs Stage Variant #5.",
        "Collect the shard in Magma Barracks variants #4-#6; on Stage Variant #6, check near the top-right of the map.",
        "Collect the shard in Hive Cluster variants #1-#3; on Stage Variant #1, check the bottom-right area near the Bloated Survivor.",
        "After 4 total Artifact Shards are collected, Artifact of Dissonance unlocks.",
      ],
    },
    zh: {
      steps: [
        `收集${term("远古峡谷")}变体 #4-#6 的碎片：它位于中央山体右侧，可通过山顶隐藏的锁链或绳索抵达。`,
        `收集${term("沉没墓园")}关卡变体 #5 的碎片。`,
        `收集${term("熔岩要塞")}变体 #4-#6 的碎片；在关卡变体 #6 中，检查地图右上方附近。`,
        `收集${term("虫巢")}变体 #1-#3 的碎片；在关卡变体 #1 中，检查右下角${term("膨胀幸存者")}附近。`,
        `总计收集 4 个${term("神器碎片")}后，${term("神器：纷争")}会解锁。`,
      ],
    },
  },
  "artifacts/distortion.toml": {
    en: {
      steps: [
        "Route into Damp Caverns, Stage Variant #1, #2, or #3.",
        "Find the artifact button. On Stage Variant #2, the button is at the marked artifact-button location.",
        "Press the button.",
        "Go to the pedestal to the left of the button location and pick up the spawned artifact.",
      ],
    },
    zh: {
      steps: [
        `进入${term("潮湿洞窟")}关卡变体 #1、#2 或 #3。`,
        "寻找神器按钮。在关卡变体 #2 中，按钮位于已标出的神器按钮位置。",
        "按下按钮。",
        `前往按钮位置左侧的基座，拾取生成的${term("神器：扭曲")}。`,
      ],
    },
  },
  "artifacts/kin.toml": {
    en: {
      steps: [
        "Route into Dried Lake, Stage Variant #1, #2, or #3.",
        "Go to the far right side of the stage and find the breakable wall.",
        "Break the wall with a suitable Survivor skill. Hopoo Feather, Rusty Jetpack, or Photon Jetpack may be needed to reach it.",
        "Activate all three buttons in the puzzle room.",
        "Pick up the Artifact of Kin at the Artifact Portal.",
      ],
    },
    zh: {
      steps: [
        `进入${term("枯涸湖")}关卡变体 #1、#2 或 #3。`,
        "前往关卡最右侧，找到可破坏墙壁。",
        `用合适的${term("幸存者")}技能打破墙壁。可能需要${term("霍普羽毛")}、${term("生锈的喷气背包")}或${term("光子喷气背包")}才能抵达。`,
        "激活谜题房间中的全部三个按钮。",
        `在${term("神器传送门")}拾取${term("神器：亲族")}。`,
      ],
    },
  },
  "skins/pilot-pilot-skin-s.toml": {
    en: {
      summary: "Pilot's Napalm prism exists in game language data, but no public route is known. Treat it as currently unobtainable.",
      steps: [
        "Do not surface this as an actionable route recommendation.",
        "The Pilot wiki lists the matching fifth Pilot skin slot as Currently Unobtainable.",
        "Keep the language-pack challenge entry for completeness, but treat it as unavailable until a later game or wiki update exposes a route.",
      ],
      notes: [
        "The Pilot wiki page lists PilotPortrait5 as Currently Unobtainable.",
        "Public stage-prism pages currently document nine other Strange Prisms, none for Pilot/Napalm.",
        "Searches for Napalm currently point to community guides for the known prisms rather than a Pilot route.",
      ],
    },
    zh: {
      summary: `${term("领航员")}的${term("奇怪棱镜：凝固汽油")}存在于游戏语言数据中，但目前没有已知公开路线，应视为当前无法获得。`,
      steps: [
        "不要把它作为可执行路线推荐展示。",
        `${term("领航员")}wiki 将对应的第五个${term("领航员")}皮肤栏位列为当前无法获得。`,
        "保留语言包中的挑战条目以保证完整性，但在后续游戏或 wiki 更新公开路线前，应把它视为不可获得。",
      ],
      notes: [
        `${term("领航员")}wiki 页面将 PilotPortrait5 标为当前无法获得。`,
        `公开的关卡棱镜页面目前记录了另外 9 个${term("奇怪棱镜")}，没有${term("领航员")}/${term("凝固汽油")}路线。`,
        `${term("凝固汽油")}相关搜索目前主要指向已知棱镜的社区指南，而不是${term("领航员")}路线。`,
      ],
    },
  },
};

const MANUAL_MONSTER_PATCHES = {
  "monster-logs/lynx-tribe.toml": (row) => ({
    en: {
      summary: "Farm Lynx Tribe's Monster Log in Judgement. Current stage-pool sources do not list Lynx Tribe in regular stage pools, so Judgement is the actionable recommendation.",
      location: "Judgement",
      notes: USER_FACING_NOTES,
    },
    zh: {
      summary: `推荐在${term("审判")}刷${term(row.text["zh-Hans"].name)}的${term("怪物日志")}。当前关卡池来源没有把${term(row.text["zh-Hans"].name)}列入常规关卡池，因此${term("审判")}是可执行推荐。`,
      location: "审判",
      notes: [
        "关卡池数据能说明该怪物会在哪些地方生成，但目前没有精确的生成权重。",
        `${term("怪物日志")}是随机掉落，通常需要反复击杀目标。`,
      ],
    },
  }),
  "monster-logs/tiny-imp.toml": (row) => ({
    en: {
      summary: "Farm Tiny Imp's Monster Log by taking Imp Shrine fights. Imp Shrines spawn Tiny Imps and reward an item after they are killed.",
      location: "Imp Shrine",
      notes: USER_FACING_NOTES,
    },
    zh: {
      summary: `通过挑战${term("小恶魔神龛")}刷${term(row.text["zh-Hans"].name)}的${term("怪物日志")}。${term("小恶魔神龛")}会生成${term(row.text["zh-Hans"].name)}，击杀后奖励一个物品。`,
      location: "小恶魔神龛",
      notes: [
        "关卡池数据能说明该怪物会在哪些地方生成，但目前没有精确的生成权重。",
        `${term("怪物日志")}是随机掉落，通常需要反复击杀目标。`,
      ],
    },
  }),
};

const reportOnly = process.argv.includes("--report");
const includeAll = process.argv.includes("--all");
const rows = await loadUnlockables();
const reviewRows = includeAll ? rows : rows.filter((row) => row.provenance?.review?.en_guide !== "accepted");

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
  markReviewed(row.filePath, patch);
  changed += 1;
}

console.log(`Reviewed ${changed} English guides`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} rows without review patch:`);
  for (const filePath of skipped) console.log(`- ${filePath}`);
  process.exitCode = 1;
}
