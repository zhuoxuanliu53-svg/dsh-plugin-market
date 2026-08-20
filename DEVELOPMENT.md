# 开发文档

本文描述 `dsh-plugin-market` 的架构、数据流与发布流程。

## 架构

`dsh-plugin-market` 是一个 DSH **bundle** 插件（纯 JavaScript，无构建步骤）。它包含两个半边：

| 半边 | 文件 | 运行时 | 职责 |
| --- | --- | --- | --- |
| Host | `src/index.js` | DSH Node.js 进程 | 数据源、安装 / 卸载 / 更新、自我重启、名单导出 / 导入 |
| Client | `client/client.js` | 浏览器（web profile） | 设置 → 插件市场 界面：标签页、搜索、排序、操作 |

Host 在 web server 上注册一组 `/pm/*` 的 `GET`/`POST` 端点，Client 通过 `fetch` 调用。变更类端点要求同源 `Origin` 头；重启端点额外要求回环地址。

## 目录结构

```
src/
  index.js            Host 入口 —— 装配 webServer/loader、解析 profile、启动服务器
  routes.js           HTTP 端点、安装分发、状态持久化
  shape.js            仓库形态识别（bundle / skill / preset / other）
  entities.js         curated/GitHub 映射、分桶合并与去重
  installer.js        dsh CLI 封装：安装 / 更新 / 卸载、spec 解析
  install-skill.js    skill 安装器（克隆 → 定位 SKILL.md → 复制 → 校验）
  install-preset.js   preset 安装器（克隆 → 定位 agent.cordis.yml → 复制 → 校验）
  download.js         git clone 帮助函数、临时目录、dshHome()
  restart.js          分离式自我重启（等端口释放 → 重新拉起 → 检查绑定）
  manifest.js         纯文本名单导出 / 导入（v3）
  net.js              undici fetch 封装 + JSON 帮助函数 + 代理
  result.js           Result ADT（ok/err）与错误码
  contracts.js        校验、规范化、状态形状
  profile.js          profile 路径解析、已装 bundle 探查
  state.js            关注 / 安装记录 / token 持久化
  hot.js              Cordis 补丁层读写（启用 / 禁用行）
  sources/
    curated.js        curated 清单抓取（ETag 缓存）
    github-topic.js   GitHub topic 抓取 + 逐仓库形态识别
    index.js          数据源组装成分桶
client/
  client.js           React 界面（仅 React.createElement，无 JSX）
cordis.patch.yml      bundle 补丁层声明
```

## 数据源

### curated 清单

`https://awesome-dsh-plugin.com/plugins.json` —— [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 清单，以 CC0-1.0 发布。只收录审核过的 **bundle** 插件（1721 条、21 个分类）。抓取用 `If-None-Match` / `ETag`，命中缓存时返回 `304`。可用 `DSHM_REGISTRY_URL` 覆盖。

### GitHub topic

`api.github.com/search/repositories?q=topic:dsh-plugin` —— 按 star 排序的前 200 个仓库。原始 topic 污染严重，因此每个仓库先做形态识别，只展示 bundle / skill / preset，其余进入隐藏的「其他」桶。结果缓存 1 小时。

## 形态识别

`src/shape.js` 的 `detectShape()` 判断一个仓库属于什么：

1. 读根目录 `GET /repos/{owner}/{repo}/contents/`。
2. 若存在 `package.json`，读取并检查 `dsh` 元数据（`bundle`、`client` 或 `preset`）。任一 `dsh` 字段 ⇒ **bundle**。
3. 否则若存在 `agent.cordis.yml` ⇒ **preset**。
4. 否则若存在 `SKILL.md` ⇒ **skill**。
5. 否则 ⇒ **other**。

优先级为 `bundle > preset > skill`，因为 bundle 也可能附带一份文档性质的 `SKILL.md`。

## 安装流程

安装按 `entry.shape` 分发：

| 形态 | 安装器 | 动作 | 重启 |
| --- | --- | --- | --- |
| bundle | `installer.js` | `dsh plugin --profile <p> add <spec>` + 装后校验 | 全新安装后需要 |
| skill | `install-skill.js` | `git clone --depth 1` → 定位 `SKILL.md` → 校验 frontmatter（kebab-case name + description）→ 复制到 `<DSH_HOME>/skills/<name>/` | 不需要（watch 生效） |
| preset | `install-preset.js` | `git clone --depth 1` → 定位 `agent.cordis.yml` → 推导 id → 复制到 `<DSH_HOME>/.agent-presets/<id>/` | 不需要（重新读取） |

bundle 安装 spec 来自清单 `install` 字段，覆盖 npm、`github:owner/repo`、scoped npm、monorepo `github:owner/repo#path:/subdir`（85 条）。`installSpecFor()`（`src/installer.js`）负责解析；切勿仅凭 `fullName` 重建 spec，否则会丢失 `#path` 段。

## 自我重启

`src/restart.js` 复刻 `dsh-market` 的重启模式：

1. 从 `process.argv` 计算重启命令（`dshArgv()`）与可执行文件（`nodeExecutable()`）。
2. 启动一个**分离**的帮助进程（`node -e <script>`），其：
   - 等待当前服务器端口释放，
   - 拉起替换进程（Windows 下包一层 `powershell -WindowStyle Hidden`），
   - 校验端口重新绑定。
3. 终止当前进程。

`/pm/restart` 只接受回环地址、`Origin` host 匹配且无转发头的请求（`trustedRestartRequest()`）。

## 名单格式（v3）

纯文本，一行一条，设计成可直接粘贴进评论区：

```
# dsh-plugin-market v3 · 3 items
dsh-status-rotator
github:0xsline/dsh-spotlight
skill:github:titanwings/colleague-skill
preset:github:owner/repo
```

- 无前缀 ⇒ bundle spec（npm 名 / `github:` / scoped / `#path:`）。
- `skill:` / `preset:` 前缀 ⇒ skill / preset 仓库。
- `#` 与空行忽略。

导入时逐行对清单解析（bundle 按 `fullName` 或 npm 名、skill / preset 按 `fullName`），仅安装白名单条目。

## 自我更新

`/pm/self-update` 对本市场自身执行 `dsh plugin update <spec>`，默认 spec 为 `github:zhuoxuanliu53-svg/dsh-plugin-market`，可用 `config.selfUpdateSpec` 覆盖。bundle 更新后返回 `needsRestart`，界面提供一键重启。

## 状态

| 路径 | 内容 |
| --- | --- |
| `<DSH_HOME>/profiles/<p>/.dsh-plugin-market/state.json` | `follows`、`installed`（含 `shape`/`spec`）、可选 `token` |
| `<DSH_HOME>/profiles/<p>/cordis.patch.yml` | 热启用 / 禁用行 |

token 仅存于 profile，不进入名单导出。

## 开发环境

```sh
# 语法检查（纯 JS，无构建）
node --check src/index.js

# 运行独立模块测试
node --input-type=module -e "import { detectShape } from './src/shape.js'; console.log(await detectShape('liustack/modlens', '', 20000))"
```

形态识别与 GitHub topic 源会消耗 GitHub API 配额；在界面 Token 字段或 `token` 参数传入 PAT 可获得更高限流。topic 源在进程内缓存 1 小时。

## 发布

1. 更新 `package.json` 的 `version` 与两份 README 的版本徽标。
2. 用 Conventional Commits 提交（`feat:` / `fix:` / `docs:`）。
3. 推送到默认分支 `zhuoxuanliu53-svg/dsh-plugin-market`。
4. 用户通过 **设置 → 插件市场 → 更新市场**（`/pm/self-update`）+ 一键重启完成升级，或手动：
   ```sh
   dsh plugin --profile web update github:zhuoxuanliu53-svg/dsh-plugin-market
   ```
