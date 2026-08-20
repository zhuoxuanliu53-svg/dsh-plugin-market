# dsh-plugin-market

DeepSeek Harness 的可视化插件市场：发现、搜索、安装与管理三种形态的 DSH 插件。

![version](https://img.shields.io/badge/version-4.0.0-2ea44f) ![license](https://img.shields.io/badge/license-MIT-8ca1af) ![type](https://img.shields.io/badge/type-DSH%20bundle%20plugin-4c6ef5)

`dsh-plugin-market` 是一个 DSH bundle 插件，从 curated 清单 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 聚合 bundle 插件，并通过 GitHub Topic `dsh-plugin` 做形态识别以发现 skill 与 preset。提供浏览、搜索、排序、关注、安装 / 更新 / 卸载、自动更新、热禁用 / 启用、一键重启，以及纯文本名单的导出与导入。

## 插件形态

DSH 插件分三种形态，安装方式各不相同。市场按标签页区分：

| 形态 | 识别标记 | 安装方式 |
| --- | --- | --- |
| Bundle | `package.json` 带 `dsh` 元数据 | `dsh plugin add <spec>`（npm / `github:` / scoped / monorepo `#path:`） |
| Skill | 根目录 `SKILL.md` | 复制到 `<DSH_HOME>/skills/<name>/` |
| Preset | 根目录 `agent.cordis.yml` | 复制到 `<DSH_HOME>/.agent-presets/<id>/` |

不属于以上三种形态的仓库进入隐藏的「其他」桶——默认不展示，只有点开「其他」标签或明确搜索时才出现。

## 功能

### 浏览与发现

- curated bundle 清单（1721 个审核插件、21 个分类、双语描述）+ 基于 topic 的 skill / preset 形态识别
- 关键词搜索（名称 / 描述 / 标签）
- 8 种排序：星标 ↑↓、Fork、更新时间、发布时间 ↑↓、名称、有更新优先
- 标签筛选、只看关注、只看已安装
- 形态标签页：插件 / 技能 / 预设 / 其他（懒加载）

### 安装与管理

- 一键安装、更新、卸载、更新全部
- 每插件独立的自动更新开关
- 市场自身一键自我更新（设置 → 插件市场 → 更新市场）
- 热禁用 / 启用：写 profile 补丁层，HMR 生效，无需重启
- 全新安装 bundle 或市场更新后一键重启（skill / preset 落盘即生效，无需重启）

### 安全

- 装后校验（可加载入口 / dsh 元数据 / loader id 冲突），失败自动回滚
- 安装源白名单（仅限清单已识别条目）
- 变更接口同源校验；重启接口 loopback + origin 校验
- 宿主基础设施行保护

### 分享

- 纯文本名单导出（一行一条，可直接发评论区）与导入
- 可选 GitHub token（仅存本机 profile，绝不提交或导出）

## 安装

```sh
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market
```

安装后刷新页面，在 设置 → 插件市场 打开。

## 数据源

| 源 | 地址 | 定位 | 缓存 | 许可 |
| --- | --- | --- | --- | --- |
| curated 清单 | `https://awesome-dsh-plugin.com/plugins.json` | bundle 插件（已审核，优先展示） | ETag / 304 | [CC0-1.0](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| GitHub topic | `api.github.com/search/repositories?q=topic:dsh-plugin` | skill / preset / 其他 发现（形态识别，star 前 200） | 1 小时 TTL | GitHub 公开仓库 |

- curated 清单即 [awesome-dsh-plugin](https://awesome-dsh-plugin.com)，以 CC0-1.0（公共领域奉献）发布，可自由使用含商业用途；也可用 `DSHM_REGISTRY_URL` 覆盖。
- GitHub topic 不做原始展示：每个仓库先做形态识别，只展示 bundle / skill / preset，其余进入隐藏的「其他」桶。

## 数据

| 路径 | 内容 |
| --- | --- |
| `<DSH_HOME>/profiles/<profile>/.dsh-plugin-market/state.json` | 关注名单、安装记录、可选 token |
| `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` | 热禁用 / 启用状态 |
| `<DSH_HOME>/skills/<name>/` | 已安装的 skill |
| `<DSH_HOME>/.agent-presets/<id>/` | 已安装的 preset |

数据仅保存在本地 profile。

## 语言

- [README.md](./README.md) — English

## 开发

见 [DEVELOPMENT.md](./DEVELOPMENT.md)，涵盖架构、数据流与发布流程。

## License

[MIT](./LICENSE)
