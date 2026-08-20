import { ok, err, E } from './result.js'
import { isFullName } from './contracts.js'
import { fetchAllSources } from './sources/index.js'
import { installOne, removeOne, updateOne, repoNameOf, installSpecFor } from './installer.js'
import { installSkill } from './install-skill.js'
import { installPreset } from './install-preset.js'
import { restartAllowed, trustedRestartRequest, servingPort, scheduleRestart } from './restart.js'
import { findUserPatchPath, readUserPatchState, rowIdsForPackage, disableRow, enableRow, removeRowBlocks, isProtectedModule } from './hot.js'
import { buildManifest, parseManifest } from './manifest.js'
import { readState, writeState, writeToken } from './state.js'
import { readInstalled, profileDir, readProfileBundles } from './profile.js'
import { join } from 'node:path'

// ---- HTTP 小工具 ----

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function sameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJsonBody(request, maxBytes = 8192) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// ---- 常量 ----

const REGISTRY_CACHE_TTL = 5 * 60 * 1000

export function createMarketServer(host, config) {
  const profile = config.profile
  const profileDirectory = profileDir(profile)
  const patchPath = findUserPatchPath(host.loader.entries(), profileDirectory)
  const cacheDir = join(profileDirectory, '.dsh-plugin-market')

  // 进程内状态：关注 + 已安装 + token。每次变更写盘。
  let state = readState(profile)

  // registry 缓存（供 install 白名单校验 + 列表展示）。
  let registryCache = { at: 0, payload: null }

  async function getRegistry(force = false) {
    const now = Date.now()
    if (!force && registryCache.payload !== null && now - registryCache.at < REGISTRY_CACHE_TTL) {
      return registryCache.payload
    }
    const res = await fetchAllSources({ token: state.token, cacheDir })
    if (res.ok) {
      registryCache = { at: Date.now(), payload: res.value }
      return res.value
    }
    // 拉取失败但已有缓存：返回旧缓存 + warning。
    if (registryCache.payload !== null) {
      return { ...registryCache.payload, warnings: [...registryCache.payload.warnings, res.error.message] }
    }
    return null
  }

  function save() {
    writeState(profile, undefined, state)
  }

  function packageNameFor(fullName) {
    const rec = state.installed[fullName]
    if (rec && typeof rec.packageName === 'string' && rec.packageName !== '') return rec.packageName
    return repoNameOf(fullName)
  }

  function installLabel(entry) {
    return entry.shape === 'bundle' ? installSpecFor(entry) : `github:${entry.fullName}`
  }

  async function installEntry(profile, entry) {
    if (entry.shape === 'skill') return installSkill(profile, entry)
    if (entry.shape === 'preset') return installPreset(profile, entry)
    return installOne(profile, entry)
  }

  function clientResult(result, verb, spec, needsRestart) {
    if (result.ok) {
      return {
        status: 'ok',
        command: result.value.command || `dsh plugin --profile ${profile} ${verb} ${spec}`,
        message: '命令执行成功',
        packageName: result.value.packageName,
        verify: result.value.verify,
        needsRestart: !!needsRestart,
      }
    }
    return {
      status: 'failed',
      command: result.error.command || `dsh plugin --profile ${profile} ${verb} ${spec}`,
      message: result.error.message,
      code: result.error.code,
    }
  }

  function respond(response, result) {
    if (result.ok) sendJson(response, 200, result.value)
    else sendJson(response, 400, { error: result.error })
  }

  const disposers = []

  function register(path, handler) {
    disposers.push(host.webServer.register({ kind: 'exact', path, handler }))
  }

  // ---- 只读路由 ----

  register('/pm/registry', async (_req, res) => {
    const payload = await getRegistry()
    if (payload === null) {
      return sendJson(res, 502, { error: { code: 'NETWORK', message: '无法加载插件列表（两个数据源都不可用）' } })
    }
    sendJson(res, 200, {
      merged: payload.merged,
      bundles: payload.bundles,
      skills: payload.skills,
      presets: payload.presets,
      otherCount: (payload.others || []).length,
      curated: payload.curated,
      fetchedAt: payload.fetchedAt,
      updated: payload.updated,
      warnings: payload.warnings,
    })
  })

  // 「其他」懒展示：默认不随 registry 返回，点开才拉。
  register('/pm/others', async (_req, res) => {
    const payload = await getRegistry()
    sendJson(res, 200, { others: payload ? payload.others : [] })
  })

  register('/pm/state', (_req, res) => {
    sendJson(res, 200, {
      follows: state.follows.slice(),
      installed: state.installed,
    })
  })

  register('/pm/manifest/export', (_req, res) => {
    sendJson(res, 200, { text: buildManifest(state) })
  })

  // ---- 变更路由（POST，同源校验） ----

  async function guardPost(request, res, fn) {
    if (!sameOrigin(request)) {
      return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: '仅接受同源请求' } })
    }
    let body
    try {
      body = await readJsonBody(request)
    } catch {
      return sendJson(res, 400, { error: { code: 'BAD_BODY', message: '请求体不是有效 JSON 或过大' } })
    }
    try {
      await fn(body, res)
    } catch (error) {
      sendJson(res, 500, { error: { code: 'INTERNAL', message: error instanceof Error ? error.message : String(error) } })
    }
  }

  register('/pm/follow', (req, res) => guardPost(req, res, (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const idx = state.follows.indexOf(fullName)
    if (idx >= 0) state.follows.splice(idx, 1)
    else state.follows.push(fullName)
    save()
    respond(res, ok({ follows: state.follows.slice() }))
  }))

  register('/pm/install', (req, res) => guardPost(req, res, async (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const registry = await getRegistry()
    const entry = registry && Array.isArray(registry.merged)
      ? registry.merged.find((e) => e.fullName === fullName)
      : null
    if (entry === null) {
      return respond(res, err(E.NOT_IN_REGISTRY, '插件不在市场白名单内，拒绝安装'))
    }
    const result = await installEntry(profile, entry)
    if (result.ok) {
      state.installed[fullName] = {
        installedAt: Date.now(),
        autoUpdate: false,
        lastAutoUpdateAt: 0,
        packageName: result.value.packageName,
        shape: entry.shape,
        spec: installLabel(entry),
      }
      save()
    }
    // 只有 bundle 全新安装需要重启挂载；skill/preset 落盘即生效（watch / 重读目录）。
    const needsRestart = result.ok && entry.shape === 'bundle'
    respond(res, ok(clientResult(result, 'add', installLabel(entry), needsRestart)))
  }))

  register('/pm/update', (req, res) => guardPost(req, res, async (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const pkg = packageNameFor(fullName)
    const result = await updateOne(profile, pkg)
    if (result.ok && state.installed[fullName]) {
      state.installed[fullName].lastAutoUpdateAt = Date.now()
      save()
    }
    respond(res, ok(clientResult(result, 'update', pkg)))
  }))

  register('/pm/update-all', (req, res) => guardPost(req, res, async () => {
    const results = {}
    for (const fullName of Object.keys(state.installed)) {
      const rec = state.installed[fullName]
      if (!rec || rec.shape !== 'bundle') continue
      const pkg = packageNameFor(fullName)
      const result = await updateOne(profile, pkg)
      results[fullName] = clientResult(result, 'update', pkg)
      if (result.ok) state.installed[fullName].lastAutoUpdateAt = Date.now()
    }
    save()
    respond(res, ok({ results }))
  }))

  register('/pm/remove', (req, res) => guardPost(req, res, async (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const rec = state.installed[fullName]
    const pkg = packageNameFor(fullName)
    const result = await removeOne(profile, pkg)
    if (result.ok) {
      const rows = rowIdsForPackage(host.loader.entries(), profileDirectory, pkg)
      removeRowBlocks(patchPath, rows)
      delete state.installed[fullName]
      const idx = state.follows.indexOf(fullName)
      if (idx >= 0) state.follows.splice(idx, 1)
      save()
    }
    respond(res, ok(clientResult(result, 'remove', pkg)))
  }))

  register('/pm/auto-update', (req, res) => guardPost(req, res, (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const rec = state.installed[fullName]
    const enabled = body.enabled !== false
    if (!rec) {
      state.installed[fullName] = { installedAt: Date.now(), autoUpdate: enabled, lastAutoUpdateAt: 0, packageName: repoNameOf(fullName), shape: 'bundle', spec: `github:${fullName}` }
    } else {
      rec.autoUpdate = enabled
    }
    save()
    respond(res, ok({ installed: state.installed }))
  }))

  register('/pm/hot', (req, res) => guardPost(req, res, async (body) => {
    const fullName = typeof body.fullName === 'string' ? body.fullName.toLowerCase() : ''
    if (!isFullName(fullName)) return respond(res, err(E.INVALID_ARG, '无效的插件标识'))
    const disabled = !!body.disabled
    const pkg = packageNameFor(fullName)
    const rows = rowIdsForPackage(host.loader.entries(), profileDirectory, pkg)
    if (rows.length === 0) {
      return respond(res, err(E.PATCH_REFUSED, '该插件没有可写入补丁层的行 id（可能是纯客户端插件）'))
    }
    const results = []
    let allOk = true
    for (const rowId of rows) {
      if (isProtectedModule(rowId)) {
        results.push({ rowId, ok: false, reason: '宿主基础设施行，禁止开关' })
        allOk = false
        continue
      }
      const r = disabled ? await disableRow(patchPath, rowId) : await enableRow(patchPath, rowId)
      results.push({ rowId, ok: r.ok, reason: r.ok ? null : r.error.message })
      if (!r.ok) allOk = false
    }
    respond(res, allOk
      ? ok({ fullName, disabled, rows: results, patchState: readUserPatchState(patchPath) })
      : err(E.PATCH_REFUSED, `部分行写入失败：${results.filter((r) => !r.ok).map((r) => r.rowId).join(', ')}`, { rows: results }))
  }))

  register('/pm/token', (req, res) => guardPost(req, res, (body) => {
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    state = writeToken(profile, undefined, token)
    respond(res, ok({ tokenSet: token !== '' }))
  }))

  register('/pm/manifest/preview', (req, res) => guardPost(req, res, (body) => {
    const result = parseManifest(typeof body.manifestText === 'string' ? body.manifestText : '')
    if (!result.ok) {
      return respond(res, err(E.INVALID_ARG, result.error.message))
    }
    respond(res, ok({ items: result.value.items }))
  }))

  register('/pm/manifest/apply', (req, res) => guardPost(req, res, async (body) => {
    const result = parseManifest(typeof body.manifestText === 'string' ? body.manifestText : '')
    if (!result.ok) {
      return respond(res, err(E.INVALID_ARG, result.error.message))
    }
    const registry = await getRegistry()
    const merged = registry && Array.isArray(registry.merged) ? registry.merged : []
    const results = {}
    const errors = []
    for (const item of result.value.items) {
      const entry = findEntryForItem(merged, item)
      const label = item.spec || item.fullName
      if (entry === null) {
        results[label] = { status: 'failed', message: '不在市场白名单内，跳过', code: 'NOT_IN_REGISTRY' }
        errors.push(`${label}: 不在市场白名单内`)
        continue
      }
      const r = await installEntry(profile, entry)
      results[label] = clientResult(r, 'add', installLabel(entry), entry.shape === 'bundle')
      if (r.ok) {
        state.installed[entry.fullName] = {
          installedAt: Date.now(),
          autoUpdate: false,
          lastAutoUpdateAt: 0,
          packageName: r.value.packageName,
          shape: entry.shape,
          spec: installLabel(entry),
        }
      } else {
        errors.push(`${label}: ${r.error.message}`)
      }
    }
    save()
    respond(res, ok({ results, errors }))
  }))

  register('/pm/self-update', (req, res) => guardPost(req, res, async () => {
    const spec = (config && typeof config.selfUpdateSpec === 'string' && config.selfUpdateSpec !== '')
      ? config.selfUpdateSpec
      : 'github:zhuoxuanliu53-svg/dsh-plugin-market'
    const result = await updateOne(profile, spec)
    // bundle 更新需要重启挂载，返回 needsRestart。
    respond(res, ok(clientResult(result, 'update', spec, result.ok)))
  }))

  register('/pm/restart', (req, res) => guardPost(req, res, () => {
    if (!restartAllowed(config)) {
      return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: '重启已禁用' } })
    }
    if (!trustedRestartRequest(req)) {
      return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: '仅接受本机同源请求' } })
    }
    const r = scheduleRestart(servingPort(req))
    sendJson(res, 200, { status: 'ok', message: '正在重启，稍后自动恢复…', pid: r.pid, logOut: r.logOut })
  }))

  return () => {
    for (const dispose of disposers) {
      try { dispose() } catch { /* 忽略 */ }
    }
  }
}

function findEntryForItem(merged, item) {
  if (item.shape === 'skill' || item.shape === 'preset') {
    return merged.find((e) => e.shape === item.shape && e.fullName === item.fullName) || null
  }
  if (item.fullName !== '') {
    return merged.find((e) => e.shape === 'bundle' && e.fullName === item.fullName) || null
  }
  return merged.find((e) => e.shape === 'bundle' && (e.npm === item.spec || e.name === item.spec)) || null
}

export { readInstalled, readProfileBundles, profileDir }
