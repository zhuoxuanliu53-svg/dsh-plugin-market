# 🔌 dsh-plugin-market

> 给 [DeepSeek Harness](https://github.com/deepseek-ai) 装一个**可视化插件市场**——逛一逛、搜一搜、点一下，装好。

![version](https://img.shields.io/badge/version-3.0.0-2ea44f) ![license](https://img.shields.io/badge/license-MIT-8ca1af) ![type](https://img.shields.io/badge/type-DSH%20bundle%20plugin-4c6ef5) ![runtime](https://img.shields.io/badge/runtime-Node.js-333)

一个跑在 DSH 里的**正式 bundle 插件**（npm 包 + `cordis.patch.yml`）。它从两个来源聚合插件，把「找插件 → 装插件 → 管插件」做成一个网页界面：

- 找：搜索、排序、标签筛选、关注；
- 装：一键安装、更新、卸载、更新全部、自动更新；
- 管：热禁用/启用（免重启）、装后校验（失败自动回滚）；
- 分享：插件名单（组合包）导出/导入，一键复刻他人配置。

因为它是 bundle 插件，跑在完整 Node 环境里——自己用 undici 抓数据、spawn `dsh plugin` 装包、读写 profile 补丁层，**不依赖宿主的 web provider 配置**，任何 profile 装上就能用。

---

## 功能

### 🔍 发现

| 能力 | 说明 |
| --- | --- |
| 双源聚合 | curated registry（**已审核**）+ GitHub Topic `dsh-plugin`（**社区**），UI 用徽标区分，审核通过的排前面 |
| 搜索 | 关键词匹配名称 / 描述 / 标签 |
| 排序 | 8 种：星标 ↑↓、Fork、更新时间、发布时间 ↑↓、名称、**有更新优先** |
| 筛选 | 带计数的标签 chips、只看关注、只看已安装 |

### 📦 管理

| 能力 | 说明 |
| --- | --- |
| 一键安装 | 自动选择 npm 包或 `github:owner/repo`，装完出现在已安装列表 |
| 更新 / 卸载 / 更新全部 | 一条命令的事，无需记 CLI 参数 |
| 自动更新 | 每插件独立开关，按需批量刷新 |
| 热禁用 / 启用 | 写 profile 的 `cordis.patch.yml`（官方补丁层），DSH 的 HMR 秒级生效，**不用重启** |

### 🛡️ 安全

| 能力 | 说明 |
| --- | --- |
| 装后校验 | 装完检查可加载入口、dsh 元数据、loader id 冲突，**失败自动卸载并报因**，杜绝「下次 boot 起不来」 |
| 安装白名单 | 只安装 registry 里真实存在的插件，拒绝任意输入 |
| 同源防护 | 所有变更接口做同源校验 |
| 基础设施保护 | 热禁用拒绝操作宿主基础设施行 |

### 👥 分享

| 能力 | 说明 |
| --- | --- |
| 组合包导出 | 把「关注 + 已安装 + 自动更新开关」导出成一个 JSON 名单 |
| 组合包导入 | 粘贴名单 → 预览 → 一键复刻，含自动更新与关注状态 |
| GitHub Token | 可选 PAT 提限（10 → 30 次/分），只存本机 profile，不进导出、不上传 |

---

## 快速开始

**前置**：已安装 [DeepSeek Harness](https://github.com/deepseek-ai) 及其 `dsh` CLI，Node ≥ 18。

```sh
# 从 GitHub 安装
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market

# 或本地 checkout
dsh plugin --profile web add ./plugin-market
```

刷新页面 → 设置 → **插件市场**，就能看到市场页。

### 基本操作

1. **浏览**：默认按星标排序，点标签 chip 或输入关键词筛选。
2. **安装**：点卡片上的「安装」，等命令跑完即出现在「已安装」。
3. **关注**：点「关注」，之后用「只看关注」过滤。
4. **热禁用**：对已安装插件点「停用」，约 1 秒后生效（无需重启）。
5. **分享配置**：点「导出名单」把 JSON 发给别人，对方「导入名单」即可复刻。

---

## 数据源

| 源 | 地址 | 定位 | 缓存 | 徽标 |
| --- | --- | --- | --- | --- |
| curated（主） | 可配置（见下） | 审核过的精选插件，**优先展示** | 每次打开 + ETag/304 | 「已审核」 |
| github-topic（辅） | `api.github.com/search/repositories?q=topic:dsh-plugin` | 社区全部带 `dsh-plugin` 标签的仓库 | 30 分钟 TTL + 限流保护 | 「社区」 |

- **去重**：按 repo `fullName`（小写），curated 优先；curated 缺失时市场自动只显示社区源。
- **限流**：GitHub 未认证 10 次/分；市场用 30 分钟缓存缓解，填 token 提限到 30 次/分。
- **curated 源可插拔**：默认指向一个占位地址，你可以通过环境变量指向自己的精选清单（JSON 格式见 `src/entities.js` 的 `fromCurated`）：

  ```sh
  DSHM_REGISTRY_URL=https://your-host/plugins.json
  ```

---

## 状态与数据

| 路径 | 内容 |
| --- | --- |
| `<DSH_HOME>/profiles/<profile>/.dsh-plugin-market/state.json` | 关注名单、安装记录（自动更新开关 / 安装时间 / 真实包名）、可选 GitHub token |
| `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` | 热禁用/启用的行（官方补丁层机制，跨重启存续） |

所有数据只存在你自己的 profile 里，不上传任何地方。

---

## 架构

纯 JS、无构建。Host 是 Node ESM（Go 哲学：显式 `Result<T>` 错误返回 + 单一职责 + 组合优于继承；ECS：`PluginEntry` 纯数据实体 + 数据/行为分离），Client 是手写 `__ModuleLoader__` factory（React，无 JSX/TS）。

```
sources/*  →  entities  →  routes  →  client (React UI)
  (curated)                │
  (github)                 ├─ installer (spawn dsh + 装后校验)
                           ├─ hot       (补丁层 禁用/启用)
                           ├─ manifest  (组合包 导出/导入)
                           └─ state/profile (持久化)
```

详见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

---

## 已知限制

- 安装经 `dsh plugin` 转发 pnpm；git 插件被 pnpm ≥ 10 拦截 `prepare` 脚本时，装后校验会识别并给出可操作的提示。
- GitHub topic 源未认证限流 10 次/分（填 token 提限到 30 次/分）。
- 本机无法出网时，列表会显示清晰的网络错误而非空列表。

## License

[MIT](./LICENSE) © zhuoxuanliu53
