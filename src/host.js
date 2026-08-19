// 插件市场 —— Host 半区
// 该文件内容即 cordis_define 的 code.host 字段（纯 JS function body，返回 Cordis Plugin）。
// 数据源：GitHub Topic dsh-plugin（https://github.com/topics/dsh-plugin）的 Search API。
return {
  apply(ctx) {
    const TOPIC = 'dsh-plugin'
    const PROFILE = 'web' // 安装/更新/卸载目标 profile，官方随附模板之一
    const CACHE_TTL = 10 * 60 * 1000
    const AUTO_UPDATE_INTERVAL = 6 * 60 * 60 * 1000 // 同一插件自动更新节流
    const INSTALL_TIMEOUT = 120000
    const UPDATE_TIMEOUT = 60000
    const MAX_REPOS = 200
    const STATE_FILE = '.dsh-plugin-market/state.json'
    const EXPORT_FILE = 'plugin-market-manifest.json'

    // ---------- 进程内状态 ----------
    let cache = { at: 0, result: null } // GitHub 拉取缓存
    let inFlight = null // 单飞：防并发重复拉取
    let state = { follows: [], installed: {} } // 运行时状态（关注 + 已安装 + 自动更新）
    let stateTarget = null
    let exportTarget = null
    let fsInit = false
    let autoUpdateResults = {} // 最近一次自动更新 pass 的结果（fullName -> InstallResult）
    let autoUpdateRunning = false

    // ---------- 关注 / 已安装状态持久化（best-effort） ----------
    const loadState = async () => {
      try {
        const fs = ctx.get('fs')
        if (!fs) return
        const sp = ctx.get('sandboxPolicy')
        const root = sp && sp.workspaceRoot
        stateTarget = await fs.resolve(STATE_FILE, root ? { cwd: root } : undefined)
        exportTarget = await fs.resolve(EXPORT_FILE, root ? { cwd: root } : undefined)
        const text = await fs.readText(stateTarget)
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.follows)) {
            state.follows = parsed.follows.filter((n) => typeof n === 'string')
          }
          if (parsed.installed && typeof parsed.installed === 'object') {
            const out = {}
            Object.keys(parsed.installed).forEach((k) => {
              const v = parsed.installed[k]
              if (v && typeof v === 'object') {
                out[k] = {
                  installedAt: typeof v.installedAt === 'number' ? v.installedAt : 0,
                  autoUpdate: !!v.autoUpdate,
                  lastAutoUpdateAt: typeof v.lastAutoUpdateAt === 'number' ? v.lastAutoUpdateAt : 0,
                }
              }
            })
            state.installed = out
          }
        }
      } catch (e) {
        // 文件不存在或损坏：保持空状态
      }
    }

    const saveState = async () => {
      try {
        const fs = ctx.get('fs')
        if (!fs || !stateTarget) return
        await fs.writeText(stateTarget, JSON.stringify(state))
      } catch (e) {}
    }

    // ---------- GitHub 数据拉取 ----------
    const normalize = (it) => {
      if (!it || typeof it !== 'object') return null
      const fullName = typeof it.full_name === 'string' ? it.full_name : ''
      if (!fullName) return null
      const parts = fullName.split('/')
      return {
        fullName: fullName,
        name: typeof it.name === 'string' ? it.name : (parts[1] || fullName),
        owner: it.owner && typeof it.owner.login === 'string' ? it.owner.login : '',
        url: typeof it.html_url === 'string' ? it.html_url : 'https://github.com/' + fullName,
        description: typeof it.description === 'string' ? it.description : '',
        stars: typeof it.stargazers_count === 'number' ? it.stargazers_count : 0,
        forks: typeof it.forks_count === 'number' ? it.forks_count : 0,
        topics: Array.isArray(it.topics) ? it.topics.filter((t) => typeof t === 'string') : [],
        language: typeof it.language === 'string' ? it.language : '',
        createdAt: typeof it.created_at === 'string' ? it.created_at : '',
        updatedAt: typeof it.updated_at === 'string' ? it.updated_at : '',
        pushedAt: typeof it.pushed_at === 'string' ? it.pushed_at : '',
        archived: !!it.archived,
        license: it.license && typeof it.license.spdx_id === 'string' ? it.license.spdx_id : '',
      }
    }

    // 判断 WebError 是否属于"接缝层无可用 provider"（而非网络/传输错误）。
    // 这类错误意味着 ctx.web 虽有服务、但宿主没装任何可用的 fetch provider，
    // 此时降级到 shell 抓取；其余错误（超时、DNS、TLS、非 2xx）如实返回。
    const isProviderUnavailable = (e) => {
      const code = e && e.code ? e.code : ''
      return code === 'WEB_PROVIDER_UNAVAILABLE'
        || code === 'WEB_PROVIDER_AMBIGUOUS'
        || code === 'WEB_PROVIDER_CONFIGURED_MISSING'
        || code === 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE'
    }

    // 降级通道 1：通过 web 服务抓取（官方 provider，自动选择/复用宿主已装的 fetch provider）。
    const fetchViaWeb = async (url) => {
      const web = ctx.get('web')
      if (!web) return { ok: false, fallback: true, error: { code: 'NO_WEB', message: '当前环境未挂载 web 服务' } }
      try {
        const res = await web.fetch({ url })
        if (!res || typeof res.statusCode !== 'number') {
          return { ok: false, fallback: true, error: { code: 'FETCH_FAILED', message: '数据源请求失败' } }
        }
        const body = res.body && res.body.content
        return { ok: true, statusCode: res.statusCode, body: typeof body === 'string' ? body : '' }
      } catch (e) {
        // 接缝层没有可用 provider → 需要降级到 shell；否则按网络错误返回。
        if (isProviderUnavailable(e)) {
          return { ok: false, fallback: true, error: { code: 'NO_PROVIDER', message: e.message || '无可用 web fetch provider' } }
        }
        return { ok: false, fallback: false, error: { code: 'WEB_ERR', message: e && e.message ? e.message : String(e) } }
      }
    }

    // 降级通道 2：通过 shell（Windows 上优先 curl.exe，若不可用退回 pwsh）抓取原始 JSON 文本。
    const fetchViaShell = async (url) => {
      const shell = ctx.get('shell')
      if (!shell) return { ok: false, error: { code: 'NO_SHELL', message: '当前环境未挂载 shell 服务，无法降级抓取' } }
      const attempts = [
        'curl.exe -s --max-time 25 -H "User-Agent: dsh-plugin-market" -H "Accept: application/vnd.github+json" "' + url + '"',
        'powershell -NoProfile -NonInteractive -Command "$r = Invoke-WebRequest -UseBasicParsing -Uri \'' + url + '\' -TimeoutSec 25; $r.Content"',
      ]
      for (const command of attempts) {
        try {
          const spec = shell.resolve({ command: command, timeoutMs: 30000, stdoutMaxBytes: 1048576 })
          const result = await shell.run(spec)
          const out = (result.stdout && result.stdout.text) || ''
          if (result.exitCode === 0 && out && out.trim()) {
            return { ok: true, statusCode: 200, body: out }
          }
          // 尝试下一条命令
        } catch (e) {
          // 尝试下一条命令
        }
      }
      return { ok: false, error: { code: 'SHELL_ERR', message: 'shell 抓取失败（curl 与 powershell 均不可用或出错）' } }
    }

    // 抓取一页：web 优先，provider 缺失时自动降级 shell。返回 { ok, statusCode, body, error?, used }。
    const fetchOnePage = async (url) => {
      const viaWeb = await fetchViaWeb(url)
      if (viaWeb.ok) return { ok: true, statusCode: viaWeb.statusCode, body: viaWeb.body, used: 'web' }
      if (!viaWeb.fallback) {
        // web 确实在、也确实有 provider，只是网络层失败 → 不降级，如实返回错误。
        return { ok: false, used: 'web', error: viaWeb.error }
      }
      const viaShell = await fetchViaShell(url)
      if (viaShell.ok) return { ok: true, statusCode: viaShell.statusCode, body: viaShell.body, used: 'shell' }
      // provider 缺失 且 shell 也不可用 → 报错并说明。
      return { ok: false, used: 'none', error: viaShell.error || viaWeb.error }
    }

    const fetchPlugins = async () => {
      const items = []
      let totalCount = 0
      for (let page = 1; page <= 2; page++) {
        const url = 'https://api.github.com/search/repositories?q=topic:' + TOPIC + '&sort=stars&order=desc&per_page=100&page=' + page
        const pageRes = await fetchOnePage(url)
        if (!pageRes.ok) {
          return { plugins: [], total: 0, fetchedAt: 0, error: Object.assign({ code: pageRes.error.code, message: pageRes.error.message }, pageRes.error) }
        }
        if (pageRes.statusCode !== 200) {
          return { plugins: [], total: 0, fetchedAt: 0, error: { code: 'HTTP_' + pageRes.statusCode, message: 'GitHub API 返回 ' + pageRes.statusCode + (pageRes.statusCode === 403 ? '（可能触发限流，请稍后重试）' : '') } }
        }
        let parsed = null
        try { parsed = JSON.parse(pageRes.body) } catch (e) { parsed = null }
        if (!parsed || !Array.isArray(parsed.items)) {
          return { plugins: [], total: 0, fetchedAt: 0, error: { code: 'BAD_BODY', message: '数据源返回结构无法解析' } }
        }
        totalCount = typeof parsed.total_count === 'number' ? parsed.total_count : 0
        items.push(...parsed.items)
        if (items.length >= Math.min(totalCount, MAX_REPOS)) break
      }
      const plugins = items.map(normalize).filter(Boolean)
      return { plugins: plugins, total: plugins.length, fetchedAt: Date.now(), error: null }
    }

    const getList = async (refresh) => {
      const now = Date.now()
      if (!refresh && cache.result && now - cache.at < CACHE_TTL) return cache.result
      if (refresh || !inFlight) {
        inFlight = fetchPlugins()
        try {
          const result = await inFlight
          if (!result.error) { cache = { at: Date.now(), result: result } }
          return result
        } finally {
          inFlight = null
        }
      }
      return inFlight
    }

    // ---------- 安装 / 更新 / 卸载命令执行 ----------
    const runCommand = async (command, timeoutMs) => {
      const shell = ctx.get('shell')
      if (!shell) {
        return { status: 'requires-manual', command: command, message: '当前环境未挂载 shell 服务，请在终端手动执行上述命令。', output: '' }
      }
      try {
        const spec = shell.resolve({ command: command, timeoutMs: timeoutMs, stdoutMaxBytes: 32768 })
        const result = await shell.run(spec)
        const out = [result.stdout && result.stdout.text, result.stderr && result.stderr.text].filter(Boolean).join('\n').slice(-2000)
        if (result.exitCode === 0) {
          return { status: 'ok', command: command, message: '命令执行成功', output: out }
        }
        return { status: 'failed', command: command, message: '命令执行失败（exit ' + result.exitCode + '），请在终端手动执行。', output: out }
      } catch (e) {
        return { status: 'failed', command: command, message: '命令执行出错：' + (e && e.message ? e.message : String(e)) + '。请在终端手动执行。', output: '' }
      }
    }

    const repoName = (fullName) => {
      const parts = String(fullName).split('/')
      return parts[1] || parts[0] || fullName
    }

    const installOne = async (fullName) => {
      if (!fullName) return { status: 'requires-manual', command: '', message: '缺少插件标识', output: '' }
      return runCommand('dsh plugin --profile ' + PROFILE + ' add github:' + fullName, INSTALL_TIMEOUT)
    }

    const updateOne = async (fullName) => {
      if (!fullName) return { status: 'requires-manual', command: '', message: '缺少插件标识', output: '' }
      return runCommand('dsh plugin --profile ' + PROFILE + ' update ' + repoName(fullName), UPDATE_TIMEOUT)
    }

    const removeOne = async (fullName) => {
      if (!fullName) return { status: 'requires-manual', command: '', message: '缺少插件标识', output: '' }
      return runCommand('dsh plugin --profile ' + PROFILE + ' remove ' + repoName(fullName), UPDATE_TIMEOUT)
    }

    // ---------- 自动更新 pass（不阻塞列表返回） ----------
    const runAutoUpdates = async () => {
      if (autoUpdateRunning) return
      autoUpdateRunning = true
      try {
        const now = Date.now()
        const targets = Object.keys(state.installed).filter((name) => {
          const rec = state.installed[name]
          return rec && rec.autoUpdate && now - (rec.lastAutoUpdateAt || 0) >= AUTO_UPDATE_INTERVAL
        })
        for (const name of targets) {
          const result = await updateOne(name)
          autoUpdateResults[name] = result
          if (result.status === 'ok') {
            state.installed[name].lastAutoUpdateAt = Date.now()
            await saveState()
          }
        }
      } catch (e) {
      } finally {
        autoUpdateRunning = false
      }
    }

    // ---------- 名单导出 / 导入（组合包） ----------
    const buildManifest = () => {
      const plugins = Object.keys(state.installed).map((fullName) => ({
        fullName: fullName,
        followed: state.follows.indexOf(fullName) >= 0,
        autoUpdate: !!(state.installed[fullName] && state.installed[fullName].autoUpdate),
      }))
      const commands = plugins.map((p) => 'dsh plugin --profile ' + PROFILE + ' add github:' + p.fullName)
      return {
        format: 'dsh-plugin-market',
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: PROFILE,
        plugins: plugins,
        commands: commands,
      }
    }

    const parseManifest = (manifestText) => {
      if (!manifestText || typeof manifestText !== 'string' || !manifestText.trim()) {
        return { ok: false, plugins: [], commands: [], errors: ['清单为空'] }
      }
      let parsed = null
      try { parsed = JSON.parse(manifestText) } catch (e) { parsed = null }
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, plugins: [], commands: [], errors: ['清单不是有效 JSON'] }
      }
      if (parsed.format && parsed.format !== 'dsh-plugin-market') {
        return { ok: false, plugins: [], commands: [], errors: ['不支持的清单格式：' + parsed.format] }
      }
      const plugins = Array.isArray(parsed.plugins)
        ? parsed.plugins.filter((p) => p && typeof p.fullName === 'string').map((p) => ({
            fullName: p.fullName,
            followed: !!p.followed,
            autoUpdate: !!p.autoUpdate,
          }))
        : []
      const commands = Array.isArray(parsed.commands)
        ? parsed.commands.filter((c) => typeof c === 'string')
        : plugins.map((p) => 'dsh plugin --profile ' + PROFILE + ' add github:' + p.fullName)
      if (!plugins.length && !commands.length) {
        return { ok: false, plugins: [], commands: [], errors: ['清单中没有任何插件'] }
      }
      return { ok: true, plugins: plugins, commands: commands, errors: [] }
    }

    // ---------- RPC 注册（disposer 交 ctx.effect 自动清理） ----------
    ctx.effect(() => harness.handle('market/list', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const refresh = !!(args && args.refresh)
      const result = await getList(refresh)
      // 列表有真实数据时触发自动更新 pass（不阻塞返回）
      if (result && !result.error) {
        void runAutoUpdates()
      }
      return Object.assign({}, result, {
        follows: state.follows.slice(),
        installed: JSON.parse(JSON.stringify(state.installed)),
        autoUpdateResults: JSON.parse(JSON.stringify(autoUpdateResults)),
      })
    }))

    ctx.effect(() => harness.handle('market/follows', async () => {
      if (!fsInit) { fsInit = true; await loadState() }
      return { follows: state.follows.slice() }
    }))

    ctx.effect(() => harness.handle('market/toggleFollow', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const name = args && typeof args.fullName === 'string' ? args.fullName : ''
      if (name) {
        const idx = state.follows.indexOf(name)
        if (idx >= 0) state.follows.splice(idx, 1)
        else state.follows.push(name)
        await saveState()
      }
      return { follows: state.follows.slice() }
    }))

    ctx.effect(() => harness.handle('market/install', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const name = args && typeof args.fullName === 'string' ? args.fullName : ''
      const result = await installOne(name)
      if (result.status === 'ok' && name) {
        state.installed[name] = { installedAt: Date.now(), autoUpdate: false, lastAutoUpdateAt: 0 }
        await saveState()
      }
      return result
    }))

    ctx.effect(() => harness.handle('market/update', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const name = args && typeof args.fullName === 'string' ? args.fullName : ''
      const result = await updateOne(name)
      if (result.status === 'ok' && name && state.installed[name]) {
        state.installed[name].lastAutoUpdateAt = Date.now()
        await saveState()
      }
      return result
    }))

    ctx.effect(() => harness.handle('market/updateAll', async () => {
      if (!fsInit) { fsInit = true; await loadState() }
      const names = Object.keys(state.installed)
      const results = {}
      for (const name of names) {
        const result = await updateOne(name)
        results[name] = result
        if (result.status === 'ok') {
          state.installed[name].lastAutoUpdateAt = Date.now()
        }
      }
      if (names.length) await saveState()
      return { results: results }
    }))

    ctx.effect(() => harness.handle('market/remove', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const name = args && typeof args.fullName === 'string' ? args.fullName : ''
      const result = await removeOne(name)
      if (result.status === 'ok' && name) {
        delete state.installed[name]
        const idx = state.follows.indexOf(name)
        if (idx >= 0) state.follows.splice(idx, 1)
        delete autoUpdateResults[name]
        await saveState()
      }
      return result
    }))

    ctx.effect(() => harness.handle('market/toggleAutoUpdate', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const name = args && typeof args.fullName === 'string' ? args.fullName : ''
      if (name) {
        if (!state.installed[name]) {
          state.installed[name] = { installedAt: Date.now(), autoUpdate: true, lastAutoUpdateAt: 0 }
        } else {
          state.installed[name].autoUpdate = !state.installed[name].autoUpdate
        }
        await saveState()
      }
      return { installed: JSON.parse(JSON.stringify(state.installed)) }
    }))

    ctx.effect(() => harness.handle('market/export', async () => {
      if (!fsInit) { fsInit = true; await loadState() }
      const manifest = buildManifest()
      const text = JSON.stringify(manifest, null, 2)
      let path = ''
      let error = null
      try {
        const fs = ctx.get('fs')
        if (fs && exportTarget) {
          await fs.writeText(exportTarget, text)
          path = fs.processPath(exportTarget)
        }
      } catch (e) {
        error = (e && e.message ? e.message : String(e))
      }
      return { text: text, path: path, error: error }
    }))

    ctx.effect(() => harness.handle('market/importPreview', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const text = args && typeof args.manifestText === 'string' ? args.manifestText : ''
      return parseManifest(text)
    }))

    ctx.effect(() => harness.handle('market/importApply', async (args) => {
      if (!fsInit) { fsInit = true; await loadState() }
      const text = args && typeof args.manifestText === 'string' ? args.manifestText : ''
      const preview = parseManifest(text)
      if (!preview.ok) return { results: {}, errors: preview.errors }
      const results = {}
      for (const p of preview.plugins) {
        const result = await installOne(p.fullName)
        results[p.fullName] = result
        if (result.status === 'ok') {
          state.installed[p.fullName] = {
            installedAt: Date.now(),
            autoUpdate: !!p.autoUpdate,
            lastAutoUpdateAt: 0,
          }
          if (p.followed && state.follows.indexOf(p.fullName) < 0) state.follows.push(p.fullName)
        }
      }
      await saveState()
      return { results: results, errors: [] }
    }))
  },
}
