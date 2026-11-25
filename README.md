# 回声阵（Echo Array）

翻牌记忆 × 手牌干扰的 2–4 人卡牌博弈，game-hub 工作区游戏（uni-app Vue 3 + Vite + Vitest + WebSocket）。

## 玩法

- 54 张牌：52 花色牌 + 小王 + 大王；12 张背面朝上排成 3×4 回声阵，每人 4 张手牌，其余为抽牌堆。
- 回合三选一：
  - **翻牌配对**：翻开两张背面牌，点数相同收走，不同盖回；王牌不可配对。
  - **手牌干扰**：打出普通手牌替换阵中已翻开的牌，原牌背面进空位，破坏他人记忆；每人每局限 3 次（可在设置 1–5 次）。
  - **王牌行动**：小王暗中窥视一张背面牌；大王不看原牌直接强换。
- 回合末补手牌至 4 张、分批补阵面；阵空且抽牌堆耗尽后结算，收集牌张最多者胜（同点按配对对数破平）。
- 单机：真人 1 名 + AI 补足 2/3/4 人；AI 分简单 / 普通 / 困难三档，按记忆准确率与干扰频率调难度。
- 联网：创建 / 快速匹配 / 房间号加入，座位、准备、房主踢人、提醒准备、断线 60s 宽限与 AI 托管、重连恢复。

## 功能一览

- **对局**：翻牌配对、手牌替换干扰、小王窥视、大王强换、跳过回合、补给与结算。
- **牌面皮肤**：象牙经典 / 暗夜墨玉 / 青花瓷韵 / 糖果亮色，纯本地偏好，不影响规则。
- **音频**：翻牌 / 配对 / 失败 / 干扰 / 窥视 / 强换 / 回合 / 胜负操作音；循环 BGM；关键事件中文播报（H5 speechSynthesis）；静音持久化。
- **教学引导**：首局分步高亮（翻牌 → 干扰 → 王牌 → 补给结算），可跳过，完成后不再弹出。
- **战绩**：单机 / 联网分别统计局数、胜场、胜率、总收集；近 10 局收集张数条形图；逐局历史可展开查看名次与明细。
- **持久化**：设置、静音、皮肤、战绩、历史（上限 50 条），key 前缀 `echoarray_`。

## 目录

- `src/core/`：纯 JS 核心（cards / rules / game / ai / settings / skins），不依赖 Vue 与 uni API，可单测。
- `src/composables/`：useGame 单机局、useNetGame 联网局、useSound、useGuide、history 持久化。
- `src/components/`：ArrayCard / HandCard / SeatBadge / SettleList。
- `src/pages/`：index 菜单、game 对局桌、settings 设置、lobby 大厅、room 房间、roomlist 房间列表。
- `src/utils/`：net WebSocket 封装、config 服务器地址。
- `server/`：rooms 房间管理、index 入口、port 端口；`server.bundle.mjs` 为 esbuild 打包的自包含产物。
- `tests/`：Vitest 核心逻辑用例（44 个）。
- `docs/需求文档.md`、`docs/技术方案.md`：规则细化、需求与架构设计。

## 开发

```bash
npm run dev:h5        # H5 开发（vite 热更新）
npm test              # Vitest 核心测试（44 个）
npm run build:h5      # → dist/build/h5
npm run build:server  # → server/server.bundle.mjs（自包含，零依赖）
node server/server.bundle.mjs   # 启动联机服务器（PORT 环境变量 > config.json > 3006）
```

> 依赖集中在工作区根 `node_modules`，项目目录内无需 `npm install`（根目录无 `package.json`，`npm run -w` 不可用）。

## 端口

页面与 WebSocket 同端口 **3006**（`config.json` 的 `wsPort`）；服务器同端口托管 H5 静态产物。

## 架构要点

- core 状态机纯函数：行动返回 `{ ok, reason? }`，非法动作不改状态；随机数可注入种子复现。
- 单机与联网共用同一套视图契约：`useGame` 本地驱动，`useNetGame` 由服务器 `game.state` 推送驱动。
- 服务器权威：房间成员、轮次判定、AI 托管与断线宽限在 `server/rooms.js`；core 直接复用 `src/core`。
- 视图脱敏：`viewOf` 不泄露他人手牌与 AI 记忆；联网按座位下发私有视图。
