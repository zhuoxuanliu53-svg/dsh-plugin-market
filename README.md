# 插件市场（dsh-plugin-market）

一个跑在 DeepSeek Harness 里的**可视化插件市场**——逛一逛，搜一搜，点一下装好。

它是**正式 bundle 插件**（npm 包 + `cordis.patch.yml`），通过 `dsh plugin add` 装入 profile，跑在完整 Node 环境里：自己用 undici 抓数据、spawn `dsh plugin` 装包、读写 profile 补丁层——不依赖宿主的 web provider 配置，"别人也能用"。

## 功能一览

- **双源数据**：主源 [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com) 的 curated registry（已审核，ETag 校验），辅源 GitHub Topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)（低频缓存 + 可选 PAT 提限）。UI 用「已审核 / 社区」徽标区分。
- **搜索与排序**：名称/描述/标签关键词搜索；8 种排序（星标、Fork、更新时间、发布时间、名称、有更新优先）；带计数的标签筛选；只看关注 / 只看已安装。
- **关注跟踪**：关注/取关，持久化。
- **安装管理**：一键安装、更新、卸载、更新全部、每插件自动更新开关。
- **热禁用/启用**：写 profile 的 `cordis.patch.yml`（官方补丁层），DSH 的 HMR 约 1 秒内生效，无需重启。
- **装后校验**：装完检查可加载入口 / dsh 元数据 / loader id 冲突，失败自动卸载并报因，防止"下次 boot 起不来"。
- **组合包（名单）导出/导入**：一键复刻他人配置。
- **GitHub Token**：可选 PAT 提限（10→30 次/分），只存本机 profile。

## 安装

```sh
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market
# 或本地 checkout：
dsh plugin --profile web add ./plugin-market
```

安装后刷新页面，设置 →「插件市场」即可看到市场页。

## 数据源

| 源 | URL | 定位 | 刷新 | 徽标 |
| --- | --- | --- | --- | --- |
| curated（主） | `awesome-dsh-plugin.com/plugins.json` | 已审核 | 每次打开 + ETag/304 | 「已审核」 |
| github-topic（辅） | `api.github.com/search/repositories?q=topic:dsh-plugin` | 社区补充 | 30 分钟缓存 + 限流保护 | 「社区」 |

去重键：repo fullName（小写），curated 优先。

## 状态文件

- `<profile>/.dsh-plugin-market/state.json`：关注名单、安装记录（含自动更新开关、安装时间、真实包名）、可选 GitHub token。
- `<profile>/cordis.patch.yml`：热禁用/启用的行（官方机制，跨重启存续）。

## 已知限制

- 安装走 `dsh plugin` 转发 pnpm；git 插件被 pnpm≥10 拦截 `prepare` 脚本时，装后校验会识别并给出可操作提示。
- GitHub topic 源未认证限流 10 次/分；市场用 30 分钟缓存缓解，填 token 可提限到 30 次/分。
- 本机若无法出网（如 schannel 缺 TLS 凭据），列表会显示清晰的网络错误而非空列表。

## 开发

见 [DEVELOPMENT.md](./DEVELOPMENT.md)。架构遵循 Go 哲学（显式接口、组合优于继承、错误显式返回）+ ECS（数据/状态与行为分离），纯 JS 无构建。

## License

MIT
