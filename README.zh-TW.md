<p align="center"><img src="docs/cover.png" width="100%"></p>

<h1 align="center">buddy-gacha</h1>

<p align="center">
<strong>逆向工程 Claude Code 的 <code>/buddy</code> 寵物系統。<br>
暴力搜尋平行宇宙，直到找到那個你抽到傳說閃光卡皮巴拉的世界線。</strong>
</p>

<p align="center">
<a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000" alt="Bun"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
<a href="https://docs.anthropic.com/en/docs/claude-code"><img src="https://img.shields.io/badge/Claude_Code-2.1.89+-6c47ff.svg" alt="Claude Code"></a>
<a href="https://github.com/kcchien/buddy-gacha/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center"><em>因為你的終端機寵物值得是傳說等級。</em></p>

<p align="center"><a href="README.md">English</a> · 繁體中文</p>

---

## 這是什麼？

Claude Code `2.1.89` 在 2026 年愚人節上線了 `/buddy` 指令——一隻住在你終端機輸入框旁邊的虛擬寵物。有 ASCII 點陣圖、五種屬性、18 個物種、從普通到傳說五個稀有度。

問題來了：**你的寵物是從你的 user ID 確定性生成的。** 同一個人，同一隻寵物，永遠。不能重抽。不能轉蛋。沒有慈悲。

除非你搞懂演算法。

**buddy-gacha** 把整個寵物生成流程逆向拆開——雜湊函式、虛擬亂數產生器、屬性骰值——然後讓你暴力搜尋幾千萬個候選 user ID，精確找到你想要的那隻寵物。最後幫你動手術改設定檔，讓系統認為那隻就是你的。

## 運作原理

寵物系統是雙層架構：

```
                    ┌─────────────────────────────────────────┐
                    │            ~/.claude.json                │
                    ├─────────────────────────────────────────┤
  骨架              │  userID ─┬─ + 鹽值("friend-2026-401")   │
  （確定性計算，    │          ├─► Bun.hash() ──► uint32       │
   不儲存）        │          ├─► SplitMix32 虛擬亂數種子     │
                    │          ├─► 稀有度（加權隨機）          │
                    │          ├─► 物種（18 選 1）             │
                    │          ├─► 眼睛、帽子、閃光            │
                    │          └─► 五項屬性值                  │
                    ├─────────────────────────────────────────┤
  靈魂              │  companion.name ─── 語言模型生成          │
  （生成一次，      │  companion.personality                    │
   寫入設定檔）    │  companion.hatchedAt                      │
                    └─────────────────────────────────────────┘
```

骨架**從不儲存**——每次啟動時從 `hash(userID + 鹽值)` 即時算出。靈魂（名字和個性描述）由語言模型在第一次 `/buddy` 時生成，之後快取在設定檔裡。

**攻擊向量：** 把 `userID` 換成一個會雜湊出我們要的寵物的值。系統信任本機設定檔裡的 `userID`，不會跟伺服器驗證。

### 演算法（從編譯後的二進位檔反混淆取得）

```
1. 輸入：    userID（或 OAuth 的 accountUuid）
2. 串接：    userID + "friend-2026-401"
3. 雜湊：    Bun.hash() → uint32        ← 跟 Node.js 的 FNV-1a 結果不同！
4. 播種：    SplitMix32(雜湊值)
5. 生成：    依固定順序消耗亂數：
             ├─ 稀有度（加權：60/25/10/4/1）
             ├─ 物種  （均勻：1/18）
             ├─ 眼睛  （均勻：1/6）
             ├─ 帽子  （普通級=無帽，其餘均勻：1/8）
             ├─ 閃光  （p < 0.01）
             └─ 屬性值（主屬性↑ 弱屬性↓ 其餘～）
```

> [!WARNING]
> **必須用 Bun 跑，不能用 Node.js。** Claude Code 用的是 `Bun.hash()`（底層 wyhash），Node.js 會退化成 FNV-1a。同樣的輸入 → 不同的雜湊 → 不同的寵物。你辛苦刷出來的傳說閃光龍，開出來會變成一隻普通蝸牛。

## 快速開始

```bash
# 看看你現在的寵物
bun buddy.js info

# 刷一隻傳說閃光卡皮巴拉（預設搜尋 5000 萬次）
bun buddy.js search --species capybara --rarity legendary --shiny

# 預覽某個 userID 會生出什麼寵物
bun buddy.js check <userID>

# 套用（自動備份，自動處理 OAuth）
bun buddy.js apply <userID>

# 後悔了？一鍵還原
bun buddy.js restore
```

## 安裝

```bash
# 你需要 Bun（不是 Node.js——這點沒得商量）
curl -fsSL https://bun.sh/install | bash

# 拉下來直接跑
git clone https://github.com/kcchien/buddy-gacha.git
cd buddy-gacha
bun buddy.js info
```

零依賴。單一檔案。不用 `npm install`。

## 指令

### `info` — 顯示目前的寵物資訊

```
$ bun buddy.js info

設定檔欄位
  userID:       bfec587be398...
  accountUuid:  ca3ccdfd-081f-... (已隱藏)

實際使用的種子
  來源: userID
  值:   bfec587be398...

★★★★★ LEGENDARY ✦ SHINY ✦ CAPYBARA
  眼睛: ◉  帽子: propeller
  主屬性: PATIENCE ★  弱屬性: WISDOM ▽
  DEBUGGING  █████████████████░░░ 88
  PATIENCE   ████████████████████ 100 ★
  CHAOS      █████████████████░░░ 89
  WISDOM     ██████████░░░░░░░░░░ 53 ▽
  SNARK      █████████████████░░░ 89
  TOTAL                           419/500
```

### `list` — 列出所有物種、稀有度、帽子、眼睛

```
$ bun buddy.js list

物種 (18): duck, goose, blob, cat, dragon, octopus, owl, penguin,
           turtle, snail, ghost, axolotl, capybara, cactus, robot,
           rabbit, mushroom, chonk

稀有度:
  ★      common（普通）    60%
  ★★     uncommon（不常見）25%
  ★★★    rare（稀有）      10%
  ★★★★   epic（史詩）       4%
  ★★★★★  legendary（傳說）  1%

帽子 (8):  none, crown, tophat, propeller, halo, wizard, beanie, tinyduck
眼睛 (6):  ·  ✦  ×  ◉  @  °
閃光:      1% 機率
```

### `search` — 暴力搜尋你的夢幻寵物

```bash
# 大家都想要的那隻
bun buddy.js search --species capybara --rarity legendary --shiny

# 戴皇冠的史詩龍
bun buddy.js search --species dragon --rarity epic --hat crown

# 任意閃光寵物，總和 400 以上
bun buddy.js search --shiny --min-total 400 --max 100000000

# 就想要一隻可愛的六角恐龍
bun buddy.js search --species axolotl --rarity rare --top 5
```

### `check` — 預覽某個 userID，不寫入

```bash
bun buddy.js check 4c3464cecf0239efe90dd4347ed8df83d551653702f9486ae7f5d7fe5124997d
```

### `apply` — 把選好的 userID 寫入設定檔

```bash
bun buddy.js apply <userID>
```

這個指令會：
1. **備份** `~/.claude.json` → `~/.claude.json.buddy-bak`（只在第一次備份）
2. **替換** `userID` 為你選的種子值
3. **隱藏** `accountUuid`（改名為 `_accountUuid_backup`，讓系統改用 `userID`）
4. **移除** `companion`（改名為 `_companion_backup`，觸發重新孵化）

### `restore` — 全部還原

```bash
bun buddy.js restore
```

從備份欄位還原 `userID`、`accountUuid` 和 `companion`。

## 搜尋篩選參數

| 參數 | 說明 | 範例 |
|------|------|------|
| `--species <名稱>` | 指定物種 | `--species capybara` |
| `--rarity <等級>` | 指定稀有度 | `--rarity legendary` |
| `--shiny` | 只找閃光版 | `--shiny` |
| `--no-shiny` | 只找非閃光版 | `--no-shiny` |
| `--hat <名稱>` | 指定帽子 | `--hat crown` |
| `--eye <符號>` | 指定眼睛樣式 | `--eye ◉` |
| `--min-total <數值>` | 最低屬性總和 | `--min-total 400` |
| `--top <數量>` | 保留前 N 名（預設 10） | `--top 5` |
| `--max <次數>` | 最大搜尋次數（預設 5000 萬） | `--max 100000000` |

### `--species` 物種清單

| 值 | 中文 | | 值 | 中文 | | 值 | 中文 |
|---|---|-|---|---|-|---|---|
| `duck` | 鴨子 | | `goose` | 鵝 | | `blob` | 軟泥怪 |
| `cat` | 貓 | | `dragon` | 龍 | | `octopus` | 章魚 |
| `owl` | 貓頭鷹 | | `penguin` | 企鵝 | | `turtle` | 烏龜 |
| `snail` | 蝸牛 | | `ghost` | 幽靈 | | `axolotl` | 六角恐龍 |
| `capybara` | 水豚 | | `cactus` | 仙人掌 | | `robot` | 機器人 |
| `rabbit` | 兔子 | | `mushroom` | 蘑菇 | | `chonk` | 胖球 |

### `--rarity` 稀有度

| 值 | 中文 | 掉落率 |
|---|------|-------|
| `common` | 普通 | 60% |
| `uncommon` | 不常見 | 25% |
| `rare` | 稀有 | 10% |
| `epic` | 史詩 | 4% |
| `legendary` | 傳說 | 1% |

### `--hat` 帽子

| 值 | 說明 |
|---|------|
| `none` | 無帽（普通級固定是這個） |
| `crown` | 皇冠 👑 |
| `tophat` | 紳士高帽 🎩 |
| `propeller` | 螺旋槳帽（竹蜻蜓那種） |
| `halo` | 天使光環 |
| `wizard` | 巫師帽 🧙 |
| `beanie` | 毛線帽 |
| `tinyduck` | 頭上頂一隻小鴨。對，真的。 |

### `--eye` 眼睛

| 值 | 長相 |
|---|------|
| `·` | 小圓點 |
| `✦` | 閃亮亮 |
| `×` | 叉叉眼 |
| `◉` | 大圓眼 |
| `@` | AT 眼 |
| `°` | 度度眼 |

## 機率計算

### 各組合的期望搜尋次數

| 目標 | 機率 | 大約要搜幾次 |
|------|------|-------------|
| 指定物種 | 1/18（5.6%） | 18 次 |
| 傳說級 | 1/100（1%） | 100 次 |
| 閃光 | 1/100（1%） | 100 次 |
| 傳說 + 指定物種 | 1/1,800 | 1,800 次 |
| 傳說 + 閃光 | 1/10,000 | 1 萬次 |
| **傳說閃光 + 指定物種** | **1/180,000** | **18 萬次** |
| 傳說閃光 + 物種 + 指定帽子 | 1/1,440,000 | 144 萬次 |

Bun 每秒可以跑大約 80 萬次，所以最難的組合也只需要幾秒鐘。

### 各稀有度的屬性範圍

| 稀有度 | 基礎值 | 主屬性 ★ | 弱屬性 ▽ | 其餘 | 理論最大總和 |
|--------|--------|----------|----------|------|-------------|
| 普通 | 5 | 55–85 | 1–10 | 5–44 | 217 |
| 不常見 | 15 | 65–95 | 5–20 | 15–54 | 257 |
| 稀有 | 25 | 75–100 | 15–30 | 25–64 | 292 |
| 史詩 | 35 | 85–100 | 25–40 | 35–74 | 322 |
| **傳說** | **50** | **100** | **40–54** | **50–89** | **421** |

> 我們搜了 1.5 億次，刷出來的最強個體是 **419/500**——離理論天花板只差 2 點。

### 亂數消耗順序

SplitMix32 虛擬亂數產生器的呼叫順序是**固定的**。屬性之間互相耦合——改了稀有度，後面全部屬性都會連動改變。

```
呼叫 1: 稀有度      （加權骰值）
呼叫 2: 物種        （均勻 1/18）
呼叫 3: 眼睛        （均勻 1/6）
呼叫 4: 帽子        （普通級跳過；其餘均勻 1/8）← 會影響後面所有呼叫的偏移
呼叫 5: 閃光        （門檻 < 0.01）
呼叫 6: 主屬性      （哪一項被加成）
呼叫 7: 弱屬性      （哪一項被削弱，跟主屬性重複會重骰）
呼叫 8+: 各項數值   （5 個值，公式依主/弱指定而不同）
呼叫 N: 靈感種子
```

重點：普通級寵物跳過呼叫 4（帽子固定為 none），所以後面的亂數序列會整體偏移——同一個種子，普通級和其他等級的閃光判定用的是不同的亂數。

## OAuth 使用者注意

如果你是用 OAuth 登入的，系統會優先用 `oauthAccount.accountUuid` 當種子，而不是 `userID`。`apply` 指令會自動處理這件事，把 `accountUuid` 改名為 `_accountUuid_backup`。

**什麼時候 `accountUuid` 會跑回來？**
- 執行 `claude login` 重新登入——會重寫帳號資訊
- 大版本更新——可能會刷新帳號欄位
- 一般重啟——通常不會，不會去伺服器拉資料

如果真的被補回來，再 `apply` 一次就好。或者存一行快速修復指令：

```bash
# accountUuid 偷跑回來的急救指令
sed -i '' 's/"accountUuid"/"_accountUuid_backup"/' ~/.claude.json
```

## 物種圖鑑

ASCII art 取自[原始碼](https://github.com/777genius/claude-code-source-code-full/blob/main/src/buddy/sprites.ts)。眼睛以 `·` 顯示。每個物種有 3 個動畫幀，這裡顯示第 0 幀。

```
  duck 鴨子         goose 鵝          blob 軟泥怪       cat 貓
    __                (·>             .----.            /\_/\
  <(· )___            ||            ( ·  · )          ( ·   ·)
   (  ._>           _(__)_          (      )          (  ω  )
    `--´             ^^^^            `----´           (")_(")

  dragon 龍         octopus 章魚      owl 貓頭鷹        penguin 企鵝
  /^\  /^\           .----.          /\  /\            .---.
 <  ·  ·  >        ( ·  · )        ((·)(·))           (·>·)
 (   ~~   )        (______)        (  ><  )          /(   )\
  `-vvvv-´         /\/\/\/\         `----´            `---´

  turtle 烏龜       snail 蝸牛       ghost 幽靈        axolotl 六角恐龍
   _,--._          ·    .--.         .----.          }~(______)~{
  ( ·  · )          \  ( @ )        / ·  · \         }~(· .. ·)~{
 /[______]\          \_`--´         |      |          ( .--. )
  ``    ``         ~~~~~~~          ~`~``~`~          (_/  \_)

  capybara 水豚     cactus 仙人掌    robot 機器人      rabbit 兔子
  n______n        n  ____  n        .[||].            (\__/)
 ( ·    · )       | |·  ·| |      [ ·  · ]          ( ·  · )
 (   oo   )       |_|    |_|      [ ==== ]         =(  ..  )=
  `------´          |    |         `------´          (")__(")

  mushroom 蘑菇     chonk 胖球
 .-o-OO-o-.        /\    /\
(__________)      ( ·    · )
   |·  ·|         (   ..   )
   |____|          `------´
```

### 帽子

```
  crown    tophat   propeller   halo     wizard   beanie   tinyduck
  皇冠     高帽      螺旋槳     光環      巫師帽    毛線帽    小鴨
  \^^^/    [___]      -+-      (   )     /^\      (___)      ,>
```

## 相容性

- **Claude Code**：2.1.89 以上（已測試）。未來版本可能會改鹽值或演算法。
- **執行環境**：Bun 1.0 以上。用 Node.js 跑會得到錯誤結果。
- **平台**：macOS、Linux、Windows（WSL）。只要有 `~/.claude.json` 的地方都能用。

## 免責聲明

這個工具會修改 `~/.claude.json`。它會在修改前自動建立備份。風險自負。寵物系統是 Anthropic 的愚人節彩蛋——他們隨時可能改掉或拿掉。

本專案與 Anthropic 無關。只是一個想要更好的水豚的工程師。

## 授權

[MIT](LICENSE) — 愛怎麼用就怎麼用。刷寵物請適量。

---

<div align="center">

<em>因為系統發了一隻普通蝸牛給我，所以我凌晨兩點逆向了整個二進位檔。</em>

<strong>如果這工具幫你刷到了夢幻寵物，給個星星吧。</strong> ⭐

</div>
