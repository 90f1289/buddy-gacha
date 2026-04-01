#!/usr/bin/env bun
// ══════════════════════════════════════════════════════════
// buddy.js — Claude Code Buddy 重刷工具
// 必須用 Bun 執行（Bun.hash 與 Claude Code 二進位檔一致）
// 版本：1.0.0 | 適用 Claude Code 2.1.89+
// ══════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── 常數（從 Claude Code 二進位檔逆向取得）──────────────────

const SALT = "friend-2026-401";
const CONFIG_PATH = join(homedir(), ".claude.json");
const BACKUP_PATH = join(homedir(), ".claude.json.buddy-bak");

const SPECIES = [
  "duck","goose","blob","cat","dragon","octopus","owl","penguin",
  "turtle","snail","ghost","axolotl","capybara","cactus","robot",
  "rabbit","mushroom","chonk",
];

const RARITY_ORDER = ["common","uncommon","rare","epic","legendary"];
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const EYES = ["·","✦","×","◉","@","°"];
const HATS = ["none","crown","tophat","propeller","halo","wizard","beanie","tinyduck"];
const STAT_NAMES = ["DEBUGGING","PATIENCE","CHAOS","WISDOM","SNARK"];
const BASE_STATS = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 };

// ── 核心演算法（與 Claude Code 完全一致）─────────────────────

function hashStr(s) {
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn);
}

function splitmix32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 1831565813) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function getRarity(rng) {
  let r = rng() * 100;
  for (const k of RARITY_ORDER) {
    r -= RARITY_WEIGHTS[k];
    if (r < 0) return k;
  }
  return "common";
}

function generateBones(userID) {
  const rng = splitmix32(hashStr(userID + SALT));
  const rarity = getRarity(rng);
  const species = pickFrom(rng, SPECIES);
  const eye = pickFrom(rng, EYES);
  const hat = rarity === "common" ? "none" : pickFrom(rng, HATS);
  const shiny = rng() < 0.01;

  const base = BASE_STATS[rarity];
  const primary = pickFrom(rng, STAT_NAMES);
  let secondary = pickFrom(rng, STAT_NAMES);
  while (secondary === primary) secondary = pickFrom(rng, STAT_NAMES);

  const stats = {};
  for (const name of STAT_NAMES) {
    if (name === primary)
      stats[name] = Math.min(100, base + 50 + Math.floor(rng() * 30));
    else if (name === secondary)
      stats[name] = Math.max(1, base - 10 + Math.floor(rng() * 15));
    else stats[name] = base + Math.floor(rng() * 40);
  }

  const total = Object.values(stats).reduce((a, v) => a + v, 0);
  const minStat = Math.min(...Object.values(stats));

  return { rarity, species, eye, hat, shiny, stats, total, minStat, primary, secondary };
}

// ── 設定檔操作 ──────────────────────────────────────────────

function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`❌ 找不到 ${CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

function getCurrentSeed() {
  const config = readConfig();
  return config.oauthAccount?.accountUuid ?? config.userID ?? "anon";
}

// ── 顯示工具 ────────────────────────────────────────────────

const RARITY_COLORS = {
  common: "\x1b[37m",     // 白
  uncommon: "\x1b[32m",   // 綠
  rare: "\x1b[34m",       // 藍
  epic: "\x1b[35m",       // 紫
  legendary: "\x1b[33m",  // 金
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function formatBones(b, userID) {
  const color = RARITY_COLORS[b.rarity] || "";
  const stars = "★".repeat(RARITY_ORDER.indexOf(b.rarity) + 1);
  const lines = [];

  lines.push(`${color}${BOLD}${stars} ${b.rarity.toUpperCase()}${b.shiny ? " ✦ SHINY ✦" : ""} ${b.species.toUpperCase()}${RESET}`);
  lines.push(`  眼睛: ${b.eye}  帽子: ${b.hat}`);
  lines.push(`  主屬性: ${b.primary} ★  弱屬性: ${b.secondary} ▽`);

  for (const name of STAT_NAMES) {
    const val = b.stats[name];
    const bar = "█".repeat(Math.floor(val / 5)) + "░".repeat(20 - Math.floor(val / 5));
    const tag = name === b.primary ? " ★" : name === b.secondary ? " ▽" : "";
    lines.push(`  ${name.padEnd(10)} ${bar} ${val}${tag}`);
  }
  lines.push(`  ${"TOTAL".padEnd(10)} ${"".padEnd(20)} ${BOLD}${b.total}/500${RESET}`);

  if (userID) lines.push(`  ${DIM}userID: ${userID}${RESET}`);
  return lines.join("\n");
}

// ── 子命令 ──────────────────────────────────────────────────

function cmdInfo() {
  const config = readConfig();
  const seed = config.oauthAccount?.accountUuid ?? config.userID ?? "anon";
  const seedSource = config.oauthAccount?.accountUuid
    ? "oauthAccount.accountUuid"
    : config.userID
      ? "userID"
      : "anon (fallback)";

  console.log(`\n${BOLD}設定檔欄位${RESET}`);
  console.log(`  userID:       ${config.userID ?? DIM + "(無)" + RESET}`);
  if (config.oauthAccount?.accountUuid)
    console.log(`  accountUuid:  ${config.oauthAccount.accountUuid}`);
  if (config.oauthAccount?._accountUuid_backup)
    console.log(`  accountUuid:  ${DIM}${config.oauthAccount._accountUuid_backup} (已隱藏)${RESET}`);
  console.log(`\n${BOLD}實際使用的種子${RESET}`);
  console.log(`  來源: ${seedSource}`);
  console.log(`  值:   ${seed}\n`);

  const bones = generateBones(seed);
  console.log(formatBones(bones));

  if (config.companion) {
    console.log(`\n${BOLD}靈魂${RESET}`);
    console.log(`  名字: ${config.companion.name}`);
    console.log(`  個性: ${config.companion.personality}`);
    console.log(`  孵化: ${new Date(config.companion.hatchedAt).toLocaleString()}`);
  }
  console.log();
}

function cmdSearch(opts) {
  const {
    species = null,
    rarity = null,
    shiny = null,
    hat = null,
    eye = null,
    minTotal = 0,
    topN = 10,
    max = 50_000_000,
  } = opts;

  // 顯示搜尋條件
  const filters = [];
  if (rarity) filters.push(`稀有度=${rarity}`);
  if (species) filters.push(`物種=${species}`);
  if (shiny !== null) filters.push(shiny ? "閃光" : "非閃光");
  if (hat) filters.push(`帽子=${hat}`);
  if (eye) filters.push(`眼睛=${eye}`);
  if (minTotal > 0) filters.push(`總和≥${minTotal}`);

  console.log(`\n🎯 搜尋條件: ${filters.join(", ") || "無限制（全部）"}`);
  console.log(`🔍 搜尋量: ${(max / 1e6).toFixed(0)}M | 保留 Top ${topN}\n`);

  const top = [];
  let found = 0;
  const startTime = Date.now();

  for (let i = 0; i < max; i++) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const b = generateBones(id);

    if (species && b.species !== species) continue;
    if (rarity && b.rarity !== rarity) continue;
    if (shiny !== null && b.shiny !== shiny) continue;
    if (hat && b.hat !== hat) continue;
    if (eye && b.eye !== eye) continue;
    if (b.total < minTotal) continue;

    found++;

    if (top.length < topN || b.total > top[top.length - 1].total) {
      top.push({ ...b, userID: id });
      top.sort((a, c) => c.total - a.total);
      if (top.length > topN) top.pop();
    }

    if ((i + 1) % 5_000_000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000) / 1e6).toFixed(2);
      console.log(`  ... ${((i + 1) / 1e6).toFixed(0)}M | ${elapsed}s | ${rate}M/s | 命中 ${found} | 最高 ${top[0]?.total ?? "-"}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 完成: ${(max / 1e6).toFixed(0)}M 次, ${elapsed}s, 命中 ${found}\n`);

  if (top.length === 0) {
    console.log("❌ 未找到符合條件的結果。試著放寬條件或增加 --max。\n");
    return;
  }

  console.log(`═══ Top ${top.length} 排行榜 ═══\n`);
  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    console.log(`${BOLD}#${i + 1}${RESET}`);
    console.log(formatBones(t, t.userID));
    console.log();
  }

  // 輸出可直接用於 apply 的指令
  console.log(`${DIM}套用方式: bun buddy.js apply <userID>${RESET}\n`);
}

function cmdApply(targetUserID) {
  if (!targetUserID) {
    console.error("❌ 用法: bun buddy.js apply <userID>");
    process.exit(1);
  }

  // 預覽
  const bones = generateBones(targetUserID);
  console.log(`\n${BOLD}即將套用的 Buddy:${RESET}`);
  console.log(formatBones(bones, targetUserID));
  console.log();

  // 備份
  if (!existsSync(BACKUP_PATH)) {
    copyFileSync(CONFIG_PATH, BACKUP_PATH);
    console.log(`📦 備份: ${BACKUP_PATH}`);
  } else {
    console.log(`📦 備份已存在，跳過 (${BACKUP_PATH})`);
  }

  const config = readConfig();

  // 記錄原始值以便還原
  const changes = [];

  // 1. 替換 userID
  const oldUserID = config.userID;
  config.userID = targetUserID;
  changes.push(`userID: ${oldUserID?.slice(0, 16)}... → ${targetUserID.slice(0, 16)}...`);

  // 2. 隱藏 accountUuid（如果存在）
  if (config.oauthAccount?.accountUuid) {
    config.oauthAccount._accountUuid_backup = config.oauthAccount.accountUuid;
    delete config.oauthAccount.accountUuid;
    changes.push("accountUuid: 已隱藏 (→ _accountUuid_backup)");
  }

  // 3. 備份並移除 companion（觸發重新孵化）
  if (config.companion) {
    config._companion_backup = config.companion;
    delete config.companion;
    changes.push(`companion: 已移除 "${config._companion_backup.name}" (→ _companion_backup)`);
  }

  writeConfig(config);

  console.log(`\n${BOLD}修改完成:${RESET}`);
  for (const c of changes) console.log(`  ✓ ${c}`);
  console.log(`\n👉 重啟 Claude Code 後輸入 /buddy 領取新寵物`);
  console.log(`👉 還原: bun buddy.js restore\n`);
}

function cmdRestore() {
  const config = readConfig();
  let restored = false;

  // 方式一：從設定檔內的備份欄位還原
  if (config.oauthAccount?._accountUuid_backup) {
    config.oauthAccount.accountUuid = config.oauthAccount._accountUuid_backup;
    delete config.oauthAccount._accountUuid_backup;
    restored = true;
    console.log("  ✓ accountUuid: 已還原");
  }

  if (config._companion_backup) {
    config.companion = config._companion_backup;
    delete config._companion_backup;
    restored = true;
    console.log(`  ✓ companion: 已還原 "${config.companion.name}"`);
  }

  // 方式二：如果有完整備份檔，還原 userID
  if (existsSync(BACKUP_PATH)) {
    const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf-8"));
    if (backup.userID && backup.userID !== config.userID) {
      config.userID = backup.userID;
      restored = true;
      console.log(`  ✓ userID: 已還原為 ${backup.userID.slice(0, 16)}...`);
    }
  }

  if (restored) {
    writeConfig(config);
    console.log("\n✅ 還原完成。重啟 Claude Code 後將回到原本的 Buddy。\n");
  } else {
    console.log("ℹ️  沒有找到需要還原的項目。\n");
  }
}

function cmdCheck(userID) {
  if (!userID) {
    console.error("❌ 用法: bun buddy.js check <userID>");
    process.exit(1);
  }
  console.log();
  console.log(formatBones(generateBones(userID), userID));
  console.log();
}

function cmdList() {
  console.log(`\n${BOLD}可用物種 (${SPECIES.length}):${RESET}`);
  console.log(`  ${SPECIES.join(", ")}\n`);
  console.log(`${BOLD}稀有度:${RESET}`);
  for (const r of RARITY_ORDER) {
    const color = RARITY_COLORS[r];
    console.log(`  ${color}${"★".repeat(RARITY_ORDER.indexOf(r) + 1).padEnd(6)}${r.padEnd(12)}${RARITY_WEIGHTS[r]}%${RESET}`);
  }
  console.log(`\n${BOLD}帽子 (${HATS.length}):${RESET} ${HATS.join(", ")}`);
  console.log(`${BOLD}眼睛 (${EYES.length}):${RESET} ${EYES.join("  ")}`);
  console.log(`${BOLD}閃光:${RESET}  1% 機率\n`);
}

// ── CLI 解析 ────────────────────────────────────────────────

function printHelp() {
  console.log(`
${BOLD}buddy.js${RESET} — Claude Code Buddy 重刷工具 (Bun only)

${BOLD}用法:${RESET}
  bun buddy.js <command> [options]

${BOLD}命令:${RESET}
  info                顯示目前的 Buddy 資訊
  list                列出所有可用的物種、稀有度、帽子、眼睛
  check <userID>      預覽指定 userID 會產生的 Buddy
  search [filters]    搜尋符合條件的 Buddy（見下方篩選選項）
  apply <userID>      將指定 userID 寫入設定檔（自動備份）
  restore             還原到修改前的 Buddy

${BOLD}搜尋篩選:${RESET}
  --species <name>    物種（如 capybara, dragon, axolotl）
  --rarity <level>    稀有度（common/uncommon/rare/epic/legendary）
  --shiny             只找閃光版
  --no-shiny          只找非閃光版
  --hat <name>        帽子（crown/tophat/propeller/halo/wizard/beanie/tinyduck）
  --eye <char>        眼睛（· ✦ × ◉ @ °）
  --min-total <n>     最低總和（如 400）
  --top <n>           保留前 N 名（預設 10）
  --max <n>           最大搜尋次數（預設 50000000）

${BOLD}範例:${RESET}
  bun buddy.js search --species capybara --rarity legendary --shiny
  bun buddy.js search --species dragon --rarity epic --hat crown --top 5
  bun buddy.js search --shiny --min-total 350 --max 100000000
  bun buddy.js apply 4c3464cecf0239efe90dd4347ed8df83...
  bun buddy.js restore
`);
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

switch (command) {
  case "info":
    cmdInfo();
    break;

  case "list":
    cmdList();
    break;

  case "check":
    cmdCheck(args[1]);
    break;

  case "search": {
    const opts = {};
    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case "--species":   opts.species = args[++i]; break;
        case "--rarity":    opts.rarity = args[++i]; break;
        case "--shiny":     opts.shiny = true; break;
        case "--no-shiny":  opts.shiny = false; break;
        case "--hat":       opts.hat = args[++i]; break;
        case "--eye":       opts.eye = args[++i]; break;
        case "--min-total": opts.minTotal = parseInt(args[++i]); break;
        case "--top":       opts.topN = parseInt(args[++i]); break;
        case "--max":       opts.max = parseInt(args[++i]); break;
        default:
          console.error(`❌ 未知選項: ${args[i]}`);
          process.exit(1);
      }
    }
    cmdSearch(opts);
    break;
  }

  case "apply":
    cmdApply(args[1]);
    break;

  case "restore":
    cmdRestore();
    break;

  default:
    console.error(`❌ 未知命令: ${command}\n`);
    printHelp();
    process.exit(1);
}
