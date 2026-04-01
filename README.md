<p align="center"><img src="docs/cover.png" width="100%"></p>

<h1 align="center">buddy-gacha</h1>

<p align="center">
<strong>Reverse-engineered the Claude Code <code>/buddy</code> pet system.<br>
Brute-force the multiverse until you find the one where you got a Legendary Shiny Capybara.</strong>
</p>

<p align="center">
<a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000" alt="Bun"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
<a href="https://docs.anthropic.com/en/docs/claude-code"><img src="https://img.shields.io/badge/Claude_Code-2.1.89+-6c47ff.svg" alt="Claude Code"></a>
<a href="https://github.com/kcchien/buddy-gacha/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center"><em>Because your CLI companion deserves to be legendary.</em></p>

<p align="center"><a href="README.zh-TW.md">繁體中文</a> · English</p>

---

## What is this?

Claude Code `2.1.89` shipped a `/buddy` command on April 1, 2026 — a virtual pet that lives beside your terminal input. Cute ASCII art, five stats, 18 species, rarity tiers from Common to Legendary.

The catch? **Your pet is deterministically generated from your user ID.** Same user, same pet, forever. No rerolls. No gacha. No mercy.

Unless you understand the algorithm.

**buddy-gacha** reverse-engineers the companion generation pipeline — hash function, PRNG, attribute rolls — and lets you brute-force search across millions of candidate user IDs to find exactly the pet you want. Then it surgically edits your config to make it yours.

## How It Works

The companion system uses a two-layer architecture:

```
                    ┌─────────────────────────────────────────┐
                    │            ~/.claude.json                │
                    ├─────────────────────────────────────────┤
  BONES            │  userID ─┬─ + SALT("friend-2026-401")   │
  (deterministic,  │          ├─► Bun.hash() ──► uint32       │
   computed at     │          ├─► SplitMix32 PRNG seed        │
   runtime)        │          ├─► rarity (weighted)           │
                    │          ├─► species (1 of 18)           │
                    │          ├─► eyes, hat, shiny            │
                    │          └─► stats[5] (PRNG sequence)    │
                    ├─────────────────────────────────────────┤
  SOUL             │  companion.name ─── LLM-generated        │
  (generated once, │  companion.personality                    │
   persisted)      │  companion.hatchedAt                      │
                    └─────────────────────────────────────────┘
```

The bones are **never stored** — they're recomputed from `hash(userID + SALT)` every time. The soul (name + personality) is generated once by the LLM and cached.

**Our attack vector:** replace the `userID` with one that hashes into the pet we want. The system trusts whatever `userID` is in the local config file. No server-side validation.

### The Algorithm (deobfuscated from the binary)

```
1. Input:     userID (or OAuth accountUuid)
2. Concat:    userID + "friend-2026-401"
3. Hash:      Bun.hash() → uint32        ← NOT the same as Node.js FNV-1a!
4. Seed:      SplitMix32(hash)
5. Generate:  consume PRNG in fixed order:
              ├─ rarity   (weighted: 60/25/10/4/1)
              ├─ species   (uniform: 1/18)
              ├─ eyes      (uniform: 1/6)
              ├─ hat       (common=none, else uniform: 1/8)
              ├─ shiny     (p < 0.01)
              └─ stats[5]  (primary↑ secondary↓ others~)
```

> [!WARNING]
> **Must run with Bun, not Node.js.** The binary uses `Bun.hash()` (wyhash). Node.js falls back to FNV-1a. Same input → different hash → different pet. Your beautifully brute-forced Legendary Shiny Dragon will turn into a Common Snail.

## Quick Start

```bash
# Check your current buddy
bun buddy.js info

# Find a Legendary Shiny Capybara (searches 50M candidates)
bun buddy.js search --species capybara --rarity legendary --shiny

# Preview what a specific userID would generate
bun buddy.js check <userID>

# Apply it (auto-backup, handles OAuth)
bun buddy.js apply <userID>

# Regret everything? Restore your original
bun buddy.js restore
```

## Installation

```bash
# You need Bun (not Node.js — this is non-negotiable)
curl -fsSL https://bun.sh/install | bash

# Clone and run
git clone https://github.com/kcchien/buddy-gacha.git
cd buddy-gacha
bun buddy.js info
```

Zero dependencies. Single file. No `npm install`.

## Commands

### `info` — Show current buddy

```
$ bun buddy.js info

設定檔欄位
  userID:       bfec587be398...
  accountUuid:  ca3ccdfd-081f-... (hidden)

實際使用的種子
  Source: userID
  Value:  bfec587be398...

★★★★★ LEGENDARY ✦ SHINY ✦ CAPYBARA
  Eyes: ◉  Hat: propeller
  Primary: PATIENCE ★  Weak: WISDOM ▽
  DEBUGGING  █████████████████░░░ 88
  PATIENCE   ████████████████████ 100 ★
  CHAOS      █████████████████░░░ 89
  WISDOM     ██████████░░░░░░░░░░ 53 ▽
  SNARK      █████████████████░░░ 89
  TOTAL                           419/500
```

### `list` — Show all species, rarities, hats, and eyes

```
$ bun buddy.js list

Species (18): duck, goose, blob, cat, dragon, octopus, owl, penguin,
              turtle, snail, ghost, axolotl, capybara, cactus, robot,
              rabbit, mushroom, chonk

Rarity:
  ★      common       60%
  ★★     uncommon     25%
  ★★★    rare         10%
  ★★★★   epic          4%
  ★★★★★  legendary     1%

Hats (8):  none, crown, tophat, propeller, halo, wizard, beanie, tinyduck
Eyes (6):  ·  ✦  ×  ◉  @  °
Shiny:     1% chance
```

### `search` — Brute-force your dream pet

```bash
# The holy grail
bun buddy.js search --species capybara --rarity legendary --shiny

# Epic dragon with a crown
bun buddy.js search --species dragon --rarity epic --hat crown

# Any shiny with 400+ total stats
bun buddy.js search --shiny --min-total 400 --max 100000000

# Just find me a cute axolotl
bun buddy.js search --species axolotl --rarity rare --top 5
```

### `check` — Preview a userID without applying

```bash
bun buddy.js check 4c3464cecf0239efe90dd4347ed8df83d551653702f9486ae7f5d7fe5124997d
```

### `apply` — Write the chosen userID to config

```bash
bun buddy.js apply <userID>
```

This command:
1. **Backs up** `~/.claude.json` → `~/.claude.json.buddy-bak` (first time only)
2. **Replaces** `userID` with your chosen seed
3. **Hides** `accountUuid` (renames to `_accountUuid_backup`) so the system falls back to `userID`
4. **Removes** `companion` (renamed to `_companion_backup`) to trigger soul re-generation

### `restore` — Undo everything

```bash
bun buddy.js restore
```

Restores `userID`, `accountUuid`, and `companion` from the backup fields.

## Search Filters

| Flag | Description | Example |
|------|-------------|---------|
| `--species <name>` | Filter by species | `--species capybara` |
| `--rarity <level>` | Filter by rarity tier | `--rarity legendary` |
| `--shiny` | Shiny only | `--shiny` |
| `--no-shiny` | Non-shiny only | `--no-shiny` |
| `--hat <name>` | Filter by hat | `--hat crown` |
| `--eye <char>` | Filter by eye style | `--eye ◉` |
| `--min-total <n>` | Minimum stat total | `--min-total 400` |
| `--top <n>` | Keep top N results (default: 10) | `--top 5` |
| `--max <n>` | Max search iterations (default: 50M) | `--max 100000000` |

### `--species` values

| Value | | Value | | Value |
|-------|-|-------|-|-------|
| `duck` | | `goose` | | `blob` |
| `cat` | | `dragon` | | `octopus` |
| `owl` | | `penguin` | | `turtle` |
| `snail` | | `ghost` | | `axolotl` |
| `capybara` | | `cactus` | | `robot` |
| `rabbit` | | `mushroom` | | `chonk` |

### `--rarity` values

| Value | Drop rate |
|-------|-----------|
| `common` | 60% |
| `uncommon` | 25% |
| `rare` | 10% |
| `epic` | 4% |
| `legendary` | 1% |

### `--hat` values

| Value | Note |
|-------|------|
| `none` | Common-rarity pets always get this |
| `crown` | 👑 |
| `tophat` | 🎩 |
| `propeller` | Helicopter beanie |
| `halo` | Angel ring |
| `wizard` | 🧙 |
| `beanie` | Knit cap |
| `tinyduck` | A tiny duck on top. Yes, really. |

### `--eye` values

| Value | Char |
|-------|------|
| `·` | Dot |
| `✦` | Sparkle |
| `×` | Cross |
| `◉` | Bullseye |
| `@` | At |
| `°` | Degree |

## The Math

### Probability Table

| Target | Probability | Expected searches |
|--------|------------|-------------------|
| Specific species | 1/18 (5.6%) | ~18 |
| Legendary | 1/100 (1%) | ~100 |
| Shiny | 1/100 (1%) | ~100 |
| Legendary + specific species | 1/1,800 | ~1,800 |
| Legendary + shiny | 1/10,000 | ~10,000 |
| **Legendary shiny + specific species** | **1/180,000** | **~180,000** |
| Legendary shiny + species + specific hat | 1/1,440,000 | ~1,440,000 |

### Stat Ranges by Rarity

| Rarity | Base | Primary ★ | Weak ▽ | Others | Theoretical Max Total |
|--------|------|-----------|--------|--------|-----------------------|
| Common | 5 | 55–85 | 1–10 | 5–44 | 217 |
| Uncommon | 15 | 65–95 | 5–20 | 15–54 | 257 |
| Rare | 25 | 75–100 | 15–30 | 25–64 | 292 |
| Epic | 35 | 85–100 | 25–40 | 35–74 | 322 |
| **Legendary** | **50** | **100** | **40–54** | **50–89** | **421** |

> Our best roll after 150M searches: **419/500** — two points from the theoretical ceiling.

### PRNG Consumption Order

The SplitMix32 PRNG is consumed in this **exact, fixed order**. This means attributes are coupled — you can't change rarity without changing everything downstream.

```
Call 1:  rarity        (weighted roll)
Call 2:  species       (uniform 1/18)
Call 3:  eyes          (uniform 1/6)
Call 4:  hat           (skipped if common; else uniform 1/8)  ← shifts all subsequent calls
Call 5:  shiny         (threshold < 0.01)
Call 6:  primary stat  (which stat gets boosted)
Call 7:  secondary stat (which stat gets weakened, rerolled if same as primary)
Call 8+: stat values   (5 values, formula depends on primary/secondary designation)
Call N:  inspiration seed
```

Note: Common-rarity pets skip Call 4 (hat is always "none"), which means the PRNG sequence shifts — a Common pet's shiny roll uses a different random number than an Uncommon pet's shiny roll, even with the same seed.

## OAuth Users

If you're logged in with OAuth, the system uses `oauthAccount.accountUuid` as the seed instead of `userID`. The `apply` command handles this automatically by renaming `accountUuid` to `_accountUuid_backup`.

**When does `accountUuid` come back?**
- `claude login` — re-authentication writes it back
- Major version updates — may refresh account info
- Regular restarts — usually safe, no server round-trip

If it does come back, just `apply` again. Or keep a one-liner handy:

```bash
# Quick fix if accountUuid sneaks back
sed -i '' 's/"accountUuid"/"_accountUuid_backup"/' ~/.claude.json
```

## Species Gallery

ASCII art extracted from [source](https://github.com/777genius/claude-code-source-code-full/blob/main/src/buddy/sprites.ts). Eyes shown as `·` (default). Each species has 3 animation frames; frame 0 shown here.

```
  duck              goose             blob              cat
    __                (·>             .----.            /\_/\
  <(· )___            ||            ( ·  · )          ( ·   ·)
   (  ._>           _(__)_          (      )          (  ω  )
    `--´             ^^^^            `----´           (")_(")

  dragon            octopus           owl              penguin
  /^\  /^\           .----.          /\  /\            .---.
 <  ·  ·  >        ( ·  · )        ((·)(·))           (·>·)
 (   ~~   )        (______)        (  ><  )          /(   )\
  `-vvvv-´         /\/\/\/\         `----´            `---´

  turtle            snail            ghost             axolotl
   _,--._          ·    .--.         .----.          }~(______)~{
  ( ·  · )          \  ( @ )        / ·  · \         }~(· .. ·)~{
 /[______]\          \_`--´         |      |          ( .--. )
  ``    ``         ~~~~~~~          ~`~``~`~          (_/  \_)

  capybara          cactus           robot             rabbit
  n______n        n  ____  n        .[||].            (\__/)
 ( ·    · )       | |·  ·| |      [ ·  · ]          ( ·  · )
 (   oo   )       |_|    |_|      [ ==== ]         =(  ..  )=
  `------´          |    |         `------´          (")__(")

  mushroom          chonk
 .-o-OO-o-.        /\    /\
(__________)      ( ·    · )
   |·  ·|         (   ..   )
   |____|          `------´
```

### Hats

```
  crown      tophat     propeller    halo       wizard     beanie     tinyduck
  \^^^/      [___]        -+-       (   )       /^\        (___)       ,>
```

## Compatibility

- **Claude Code**: 2.1.89+ (tested). Future versions may change the SALT or algorithm.
- **Runtime**: Bun 1.0+ required. Node.js will produce incorrect results.
- **Platform**: macOS, Linux, Windows (WSL). Anywhere `~/.claude.json` exists.

## Disclaimer

This tool modifies `~/.claude.json`. It creates a backup before making changes. Use at your own risk. The companion system is an Easter egg — Anthropic could change or remove it at any time.

This project is not affiliated with Anthropic. It's just a nerd who wanted a better capybara.

## License

[MIT](LICENSE) — Do whatever you want. Roll responsibly.

---

<div align="center">

*Built by reverse-engineering a binary at 2 AM because the RNG gave me a Common Snail.*

**If this helped you get your dream buddy, star the repo.** ⭐

</div>
