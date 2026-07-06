export function createZhHansTranslator(rows) {
  const replacements = buildReplacements(rows);

  return {
    text(value) {
      return translateText(value, replacements);
    },
    list(values) {
      return Array.isArray(values) ? values.map((value) => translateText(value, replacements)) : [];
    },
  };
}

function buildReplacements(rows) {
  const pairs = [
    ["Risk of Rain Returns", "雨中冒险 回归"],
    ["Risk of Rain", "暴雨"],
    ["Providence Trials", "天命试炼"],
    ["Providence Trial", "天命试炼"],
    ["Strange Prism", "奇怪棱镜"],
    ["Artifact Shards", "神器碎片"],
    ["Artifact Shard", "神器碎片"],
    ["Artifact Portal", "神器传送门"],
    ["Divine Teleporter", "神圣传送器"],
    ["Stage Variant", "关卡变体"],
    ["Final stage", "最终关"],
    ["Modern ruleset", "现代规则集"],
    ["Classic ruleset", "经典规则集"],
    ["Any Ruleset", "任意规则集"],
    ["Currently Unobtainable", "当前无法获得"],
    ["Monster Log", "怪物日志"],
    ["Environment Log", "环境日志"],
    ["Desecrated Rock Golem", "亵渎石傀儡"],
    ["Rock Golem", "石傀儡"],
    ["Bloated Survivor", "膨胀幸存者"],
    ["Illegal Shipment", "非法货物"],
    ["storage room", "储藏室"],
    ["obstacle course", "障碍路线"],
    ["hidden vine", "隐藏藤蔓"],
    ["elevated platform", "高台"],
    ["middle-to-lower area", "中下部区域"],
    ["right side", "右侧"],
    ["left side", "左侧"],
    ["central mountain", "中央山体"],
    ["vine", "藤蔓"],
    ["corpse", "尸体"],
    ["wall", "墙壁"],
    ["prompt appears", "出现提示"],
    ["snowman", "雪人"],
    ["Pollen", "花粉"],
    ["Stasis", "静滞"],
    ["Extinction", "灭绝"],
    ["Nebula", "星云"],
    ["Snare", "阻滞"],
    ["Pyrite", "黄铁矿"],
    ["Obsidian", "黑曜石"],
    ["Calcium", "钙质"],
    ["prism", "棱镜"],
    ["route", "路线"],
    ["cove", "小洞穴"],
    ["Boar Beach", "野猪海滩"],
    ["Desolate Forest", "荒芜森林"],
    ["Dried Lake", "干涸湖泊"],
    ["Damp Caverns", "潮湿洞穴"],
    ["Sky Meadow", "空中草原"],
    ["Ancient Valley", "远古峡谷"],
    ["Sunken Tombs", "沉没陵墓"],
    ["Magma Barracks", "熔岩兵营"],
    ["Hive Cluster", "蜂巢集群"],
    ["Temple of the Elders", "长老神殿"],
    ["Judgement", "审判"],
    ["Tutorial", "教程"],
    ["Imp Shrine", "小恶魔神龛"],
    ["Commando", "突击队员"],
    ["Huntress", "女猎手"],
    ["Enforcer", "执法者"],
    ["Bandit", "盗匪"],
    ["HAN-D", "韩-迪"],
    ["Engineer", "工程师"],
    ["Sniper", "狙击手"],
    ["Acrid", "呛鼻毒师"],
    ["Mercenary", "雇佣兵"],
    ["Loader", "装卸工"],
    ["CHEF", "厨师"],
    ["Pilot", "飞行员"],
    ["Artificer", "工匠"],
    ["Drifter", "流浪者"],
    ["Miner", "矿工"],
    ["Robomando", "机械突击队员"],
  ];

  for (const row of rows) {
    const en = row.display?.nameEn;
    const zh = row.display?.name;
    if (!en || !zh || en === zh) continue;
    pairs.push([en, zh]);
    if (row.category === "artifact") pairs.push([`Artifact of ${en}`, `神器：${zh}`]);
    if (row.category === "skin" && en.startsWith("Strange Prism: ")) {
      pairs.push([en, `奇怪棱镜：${zh.replace(/^奇怪棱镜：/, "")}`]);
    }
  }

  return pairs
    .filter(([from]) => from)
    .sort((a, b) => b[0].length - a[0].length);
}

function translateText(value, replacements) {
  if (value == null || value === "") return null;
  let out = String(value).trim();
  if (!out) return "";
  if (/[\u3400-\u9fff]/.test(out)) return out;

  out = out.replace(/^([^:]+):\s+(.+)$/, (_, subject, rest) => `${replaceTerms(subject, replacements)}：${translateClause(rest, replacements)}`);
  if (!/[\u3400-\u9fff]/.test(out)) out = translateClause(out, replacements);
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\s*([，。；：、])\s*/g, "$1");
  out = out.replace(/([。！？])\.+$/g, "$1");
  return out;
}

function translateClause(value, replacements) {
  let out = replaceTerms(value, replacements);

  const phraseRules = [
    [/\bRoute into\b/gi, "进入"],
    [/\bFind and pick up\b/gi, "找到并拾取"],
    [/\bFind and inspect\b/gi, "找到并调查"],
    [/\bFind\b/gi, "找到"],
    [/\bpick up\b/gi, "拾取"],
    [/\bCollect\b/gi, "收集"],
    [/\bComplete\b/gi, "完成"],
    [/\bActivate\b/gi, "激活"],
    [/\bPress\b/gi, "按下"],
    [/\bDefeat\b/gi, "击败"],
    [/\bKill\b/gi, "击杀"],
    [/\bBeat\b/gi, "通关"],
    [/\bSurvive\b/gi, "存活"],
    [/\bReach\b/gi, "到达"],
    [/\bGo near\b/gi, "前往附近"],
    [/\bGo to\b/gi, "前往"],
    [/\bUse\b/gi, "使用"],
    [/\bInteract\/approach\b/gi, "互动或靠近"],
    [/\bInteract with\b/gi, "与其互动"],
    [/\bSearch\b/gi, "搜索"],
    [/\bExplore\b/gi, "探索"],
    [/\bInspect\b/gi, "调查"],
    [/\bLook for\b/gi, "寻找"],
    [/\bContinue\b/gi, "继续"],
    [/\bFollow\b/gi, "沿着"],
    [/\bUnlock\b/gi, "解锁"],
    [/\bObtain\b/gi, "获得"],
    [/\bHave\b/gi, "拥有"],
    [/\bGet\b/gi, "获得"],
    [/\bReset\b/gi, "重置"],
    [/\bDodge\b/gi, "躲避"],
    [/\bSpread\b/gi, "扩散"],
    [/\bCook\b/gi, "烹饪"],
    [/\bShatter\b/gi, "粉碎"],
    [/\bDestroy\b/gi, "摧毁"],
    [/\bRace\b/gi, "竞速"],
    [/\bGlide\b/gi, "滑翔"],
    [/\bFire\b/gi, "发射"],
    [/\bDefend\b/gi, "防守"],
    [/\bStay close\b/gi, "保持近身"],
    [/\bUtilize\b/gi, "利用"],
    [/\busing\b/g, "使用"],
    [/\butilizing\b/g, "利用"],
    [/\breceive\b/gi, "获得"],
    [/\bappears\b/gi, "出现"],
    [/\bto unlock\b/g, "以解锁"],
    [/\bto reveal\b/g, "以显露"],
    [/\bto spawn\b/g, "以生成"],
    [/\bthen\b/g, "然后"],
    [/\band\b/g, "并"],
    [/\bor\b/g, "或"],
    [/\bto\b/g, "以"],
    [/\bwhen\b/g, "当"],
    [/\bof\b/g, "的"],
    [/\bas\b/g, "作为"],
    [/\bwithout\b/g, "不"],
    [/\bwith\b/g, "带有"],
    [/\bin\b/g, "在"],
    [/\bon\b/g, "在"],
    [/\bnear\b/g, "在附近"],
    [/\baround\b/g, "在周围"],
    [/\bat\b/g, "在"],
    [/\bfrom\b/g, "从"],
    [/\bthrough\b/g, "穿过"],
    [/\bafter\b/g, "在之后"],
    [/\bbefore\b/g, "在之前"],
    [/\bhidden\b/g, "隐藏的"],
    [/\bbottom-right\b/g, "右下方"],
    [/\btop-right\b/g, "右上方"],
    [/\btop-left\b/g, "左上方"],
    [/\bbottom-left\b/g, "左下方"],
    [/\bright side\b/g, "右侧"],
    [/\bleft side\b/g, "左侧"],
    [/\bcenter\b/g, "中央"],
    [/\bupper-left\b/g, "左上方"],
    [/\blower area\b/g, "较低区域"],
    [/\bthe map\b/g, "地图"],
    [/\bthe stage\b/g, "关卡"],
    [/\bthe run\b/g, "本局"],
    [/\bthe player\b/g, "玩家"],
    [/\bplayers\b/g, "玩家"],
    [/\benemies\b/g, "敌人"],
    [/\benemy\b/g, "敌人"],
    [/\bboss\b/g, "首领"],
    [/\bbuttons\b/g, "按钮"],
    [/\bbutton\b/g, "按钮"],
    [/\bboth\b/g, "两个"],
    [/\btwo\b/g, "两个"],
    [/\bone\b/g, "一个"],
    [/\bpuzzle\b/g, "谜题"],
    [/\bspawned\b/g, "生成的"],
    [/\bgolden\b/g, "金色"],
    [/\bchest\b/g, "宝箱"],
    [/\blethal attacks\b/g, "致命攻击"],
    [/\blethal\b/g, "致命"],
    [/\battacks\b/g, "攻击"],
    [/\battack\b/g, "攻击"],
    [/\bshrine\b/g, "神龛"],
    [/\bteleporter\b/g, "传送器"],
    [/\bdrone\b/g, "无人机"],
    [/\bdrones\b/g, "无人机"],
    [/\bitem\b/g, "物品"],
    [/\bitems\b/g, "物品"],
    [/\bequipment\b/g, "主动装备"],
    [/\bgold\b/g, "金币"],
    [/\bdamage\b/g, "伤害"],
    [/\bhealth\b/g, "生命值"],
    [/\bminutes\b/g, "分钟"],
    [/\bminute\b/g, "分钟"],
    [/\bmeters\b/g, "米"],
    [/\bmeter\b/g, "米"],
    [/\bfeet\b/g, "英尺"],
    [/\bcooldown\b/g, "冷却"],
    [/\bcooldowns\b/g, "冷却"],
    [/\bvariant #(\d+)/gi, "第 $1 变体"],
    [/\bvariants #([\d, #orand]+)/gi, "第 $1 变体"],
    [/\bStage Variant #(\d+)/g, "关卡第 $1 变体"],
    [/\bStage Variants #([\d, #orand]+)/g, "关卡第 $1 变体"],
    [/\bStage (\d+) pool\b/g, "第 $1 关池"],
    [/\bStage (\d+)\b/g, "第 $1 关"],
    [/\b#(\d+)/g, "第 $1"],
    [/\bthe\b/gi, ""],
    [/\ba\b/gi, ""],
    [/\ban\b/gi, ""],
    [/'s\b/g, "的"],
  ];

  for (const [pattern, replacement] of phraseRules) out = out.replace(pattern, replacement);

  out = out
    .replace(/ ,/g, "，")
    .replace(/,/g, "，")
    .replace(/;/g, "；")
    .replace(/:/g, "：")
    .replace(/\.$/, "。")
    .replace(/\?/g, "？")
    .replace(/!/g, "！");

  if (!/[。！？]$/.test(out) && /[\u3400-\u9fff]/.test(out)) out += "。";
  return out;
}

function replaceTerms(value, replacements) {
  let out = String(value);
  for (const [from, to] of replacements) {
    out = out.replace(new RegExp(escapeRegExp(from), "g"), to);
  }
  return out;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
