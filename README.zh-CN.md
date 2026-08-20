# dsh-plugin-market

DeepSeek Harness 的可视化插件市场：聚合、搜索、安装与管理 DSH 插件。

![version](https://img.shields.io/badge/version-3.0.0-2ea44f) ![license](https://img.shields.io/badge/license-MIT-8ca1af) ![type](https://img.shields.io/badge/type-DSH%20bundle%20plugin-4c6ef5)

`dsh-plugin-market` 是一个 DSH bundle 插件，从 curated registry 与 GitHub Topic `dsh-plugin` 聚合插件，提供浏览、搜索、排序、关注、安装、更新、卸载、自动更新、热禁用，以及插件名单（组合包）的导出与导入。

## 功能

### 浏览与发现

- 双源聚合：curated registry（已审核）与 GitHub Topic（社区），徽标区分，审核优先
- 关键词搜索（名称 / 描述 / 标签）
- 8 种排序：星标 ↑↓、Fork、更新时间、发布时间 ↑↓、名称、有更新优先
- 标签筛选、只看关注、只看已安装

### 安装与管理

- 一键安装、更新、卸载、更新全部
- 每插件独立的自动更新开关
- 热禁用 / 启用：写 profile 补丁层，HMR 生效，无需重启

### 安全

- 装后校验（可加载入口 / dsh 元数据 / loader id 冲突），失败自动回滚
- 安装源白名单
- 变更接口同源校验
- 宿主基础设施行保护

### 分享

- 组合包导出 / 导入（关注 + 已安装 + 自动更新开关）
- 可选 GitHub token（仅存本机 profile）

## 安装

```sh
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market
```

安装后刷新页面，在 设置 → 插件市场 打开。

## 数据源

| 源 | 地址 | 定位 | 缓存 | 徽标 |
| --- | --- | --- | --- | --- |
| curated | 可配置（`DSHM_REGISTRY_URL`） | 审核过的精选插件，优先展示 | ETag / 304 | 已审核 |
| github-topic | `api.github.com/search/repositories?q=topic:dsh-plugin` | 社区插件 | 30 分钟 TTL | 社区 |

- 去重键：repo `fullName`（小写），curated 优先。
- curated 源默认使用占位地址，可通过 `DSHM_REGISTRY_URL` 指向自建清单（JSON 格式见 `src/entities.js`）。

## 数据

| 路径 | 内容 |
| --- | --- |
| `<DSH_HOME>/profiles/<profile>/.dsh-plugin-market/state.json` | 关注名单、安装记录、可选 token |
| `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` | 热禁用 / 启用状态 |

数据仅保存在本地 profile。

## 文档

- [DEVELOPMENT.md](./DEVELOPMENT.md) — 架构与开发说明
- [README.md](./README.md) — English

## License

[MIT](./LICENSE)
