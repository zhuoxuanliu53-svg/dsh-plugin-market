# 插件市场（dsh-plugin-market）

从 **GitHub Topic `dsh-plugin`**（<https://github.com/topics/dsh-plugin>）发现、排序、搜索、关注、安装、更新、卸载 DSH 插件的**动态 Cordis 插件**。支持导出/导入**插件名单（组合包）**，一键复刻他人配置。

## 功能一览

- **数据源**：GitHub Search API `q=topic:dsh-plugin`（≤2 页 / 200 仓库），10 分钟缓存 + 单飞防并发。**双模式抓取**：优先走宿主 `ctx.web`（官方 fetch provider），当接缝检测到"无可用 provider"时自动降级用 shell（curl / Invoke-WebRequest）抓取固定源，装上即用、不依赖宿主配置。
- **排序**（7 种 + 有更新优先）：发布时间↓/↑、星标↓/↑、Fork↓、最近更新、名称 A–Z、有更新优先。
- **搜索与筛选**：名称关键词（匹配名称/描述/标签）、带计数的标签 chips、只看关注、只看已安装。
- **关注跟踪**：关注/取关，持久化到工作区 `.dsh-plugin-market/state.json`。
- **安装管理**：
  - 安装：`dsh plugin --profile web add github:<仓库>`
  - 更新：`dsh plugin --profile web update <仓库名>`
  - 卸载：`dsh plugin --profile web remove <仓库名>`
  - 更新全部、每插件**自动更新开关**（市场刷新时对开启项自动执行更新，6 小时节流）
  - 已安装徽标、有更新徽标（pushed_at > installedAt 启发式）
- **名单导出 / 导入（组合包）**：
  - 导出：生成 JSON manifest（插件 + 关注 + 自动更新 + 可直接执行的 `commands` 序列），写入工作区 `plugin-market-manifest.json` 并在 UI 展示文本。
  - 导入：粘贴 JSON → 预览（数量/仓库/命令）→ 应用（批量安装并恢复关注与自动更新）。
- **UI 双落点**：
  - 运行卡片面板：`tool.view.cordis`（key `self`）— 紧凑模式（前 8 条 + 引导）。
  - 设置页：`settings.plugins.tab`（id `plugin-market`，标签"插件市场"）— 完整页面。
- 样式全部使用 DSW 主题 token（`--dsw-alias-*`），与 Web GUI 观感一致。

## 目录结构

```
plugin-market/
├── src/
│   ├── host.js      # Host 半区（= cordis_define code.host）
│   └── client.js    # Client 半区（= cordis_define code.client）
├── package.json     # 轻量元数据（private，非可安装 bundle）
├── .gitignore
├── README.md        # 本文档
└── DEVELOPMENT.md   # 开发文档（架构 / RPC 契约 / 失败模式 / 扩展）
```

## 在 DSH 中部署（动态插件）

动态插件为**进程内/会话内**临时物：DSH 进程重启后插件会消失，但源码保存在本仓库，随时可重建。重建步骤：

1. 读取 `src/host.js` 与 `src/client.js` 的完整内容（从文件首行 `return {` 到末尾 `}`）；
2. 调用 `cordis_define`（新插件，`code.host` / `code.client` 分别填入两文件内容，命名"插件市场"）；
3. 调用 `cordis_run` 激活；若返回 `awaiting-approval`，在 UI 批准该 Client Package 后继续；
4. 激活后：对话中 `tool.view.cordis` 卡片出现紧凑市场；**设置 → 插件 → 插件市场**为完整页面。

## 运行时状态文件

| 文件 | 位置 | 说明 |
| --- | --- | --- |
| `state.json` | 工作区根 `.dsh-plugin-market/state.json` | 关注列表 + 已安装（含自动更新开关） |
| `plugin-market-manifest.json` | 工作区根 | 导出的插件名单（组合包） |

两者都在仓库之外，不进入版本库（避免个人状态混入源码）。

## 已知环境限制

- **无外网 / shell 两条通道都失败**：市场列表显示"数据源请求失败"错误态并带"重试"（计划内降级）；有网络的机器上即可正常加载。
- **关于 `ctx.web`**：默认 `pnpm dsh web` 的官方 host 组合因 SSRF 安全考量**未装配 fetch provider**，`ctx.web` 空有服务、无可用 provider → `web.fetch()` 抛 `WEB_PROVIDER_UNAVAILABLE`。本插件据此**自动降级 shell 抓取**（仅访问 GitHub 固定 API，风险面受控），不影响列表加载。若想在宿主层面启用标准的 `ctx.web.fetch()`（让任意插件受益），可在宿主组合 / `$DSH_HOME/cordis.patch.yml` 装配 `@deepseek-ai/dsh-web-fetch-http`，装配后本插件会自动回到 web 通道。
- **无 `dsh` CLI / shell 服务**：安装/更新/卸载返回 `requires-manual`（`failed`）并展示可复制的完整命令，不崩溃、不假写已安装状态。
- **`fs` 不可用**：关注/已安装状态仅本次运行有效（内存），UI 无持久化提示。
- "有更新"为启发式（GitHub `pushed_at` 与安装时间比较），不代表发布新版本；权威更新请以 `dsh plugin update` 结果为准。
