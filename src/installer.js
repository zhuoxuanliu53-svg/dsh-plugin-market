import { dirname, join } from 'node:path'
import { err, ok, E } from './result.js'
import { dshArgv, killChild, nodeExecutable, spawnShim, winCmdShim } from './spawn.js'
import {
  conflictingEntryIds,
  hasDshManifest,
  hasLoadableEntry,
  profileDir,
  readInstalled,
  readProfileBundles,
} from './profile.js'

export { winCmdShim }

const INSTALL_TIMEOUT_MS = Number(process.env.DSH_MARKET_INSTALL_TIMEOUT_MS) || 15 * 60 * 1000
const REMOVE_TIMEOUT_MS = 5 * 60 * 1000

const nodeBinDir = dirname(nodeExecutable())

function spawnEnv() {
  const sep = process.platform === 'win32' ? ';' : ':'
  const parts = (process.env.PATH ?? '').split(sep).filter((p) => p !== '')
  if (!parts.includes(nodeBinDir)) parts.push(nodeBinDir)
  return { ...process.env, CI: 'true', PATH: parts.join(sep) }
}

export function runPlugin(profile, pluginArgs, timeoutMs = INSTALL_TIMEOUT_MS) {
  const { file, args, cwd, viaShell } = dshArgv()
  const fullArgs = [...args, 'plugin', '--profile', profile, ...pluginArgs]
  return new Promise((resolvePromise) => {
    const child = spawnShim(file, fullArgs, {
      cwd,
      env: spawnEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      viaShell,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killChild(child)
    }, timeoutMs)
    child.stdout?.on('data', (c) => { stdout = (stdout + c.toString()).slice(-256 * 1024) })
    child.stderr?.on('data', (c) => { stderr = (stderr + c.toString()).slice(-64 * 1024) })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: 127, timedOut: false, stdout, stderr: `${stderr}\n${error.message}`, cancelled: false })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: code, timedOut, stdout, stderr, cancelled: false })
    })
  })
}

// ---- 目标名与 spec ----

export function installSpecFor(entry) {
  // registry 的 install 字段是权威 spec（覆盖 npm/scoped/github/github#path/release tarball 五种形态）。
  if (entry && typeof entry.install === 'string' && entry.install !== '') {
    const m = /\badd\s+(\S+)/.exec(entry.install.trim())
    if (m && m[1] !== '') return m[1]
  }
  if (entry && typeof entry.npm === 'string' && entry.npm !== '') return entry.npm
  // 兜底：按 url 解析出的子目录生成 github:owner/repo#path:/subpath。
  if (entry && typeof entry.subpath === 'string' && entry.subpath !== '') {
    return `github:${entry.fullName}#path:/${entry.subpath}`
  }
  return `github:${entry.fullName}`
}

export function repoNameOf(fullName) {
  // 兼容条目 id（可能带 #path:/ 子目录后缀）：先剥掉 # 之后的部分。
  const bare = String(fullName).split('#')[0]
  const parts = bare.split('/')
  return parts[1] || parts[0] || fullName
}

function commandLabel(verb, profile, spec) {
  return `dsh plugin --profile ${profile} ${verb} ${spec}`
}

function describeRun(run, verb, spec, profile) {
  if (run.timedOut) return `命令超时：${commandLabel(verb, profile, spec)}`
  const tail = (run.stderr || run.stdout || '').split('\n').slice(-5).join('\n').trim()
  return `命令失败（exit ${run.exitCode}）：${commandLabel(verb, profile, spec)}${tail ? `\n${tail}` : ''}`
}

// ---- 装后校验 ----

function verifyPackage(profileDirectory, name) {
  const issues = []
  const dir = join(profileDirectory, 'node_modules', name)
  if (!hasDshManifest(dir) && !hasLoadableEntry(profileDirectory, name)) {
    issues.push(`${name}：未声明 dsh 元数据且无可加载入口`)
  }
  const bundles = readProfileBundles(profileDirectory)
  const conflicts = conflictingEntryIds(profileDirectory, name, bundles)
  for (const c of conflicts) issues.push(`${name}：loader id「${c.id}」与已装插件 ${c.owner} 冲突`)
  return issues
}

// ---- 对外操作 ----

export async function installOne(profile, entry, explicitDir) {
  const spec = installSpecFor(entry)
  const before = readInstalled(profile, explicitDir)
  const run = await runPlugin(profile, ['add', spec])
  if (run.exitCode !== 0 || run.timedOut) {
    return err(E.SPAWN_FAILED, describeRun(run, 'add', spec, profile), {
      command: commandLabel('add', profile, spec),
      run,
    })
  }

  const after = readInstalled(profile, explicitDir)
  const added = Object.keys(after).filter((n) => !(n in before))

  // 重复安装（包已在 profile 里）：视为成功，packageName 取 spec 里的 npm 名或 repo 名。
  if (added.length === 0) {
    const packageName = entry.npm || repoNameOf(entry.fullName)
    return ok({ packageName, spec, run, verify: { added: [], state: 'already' } })
  }

  const profileDirectory = profileDir(profile, explicitDir)
  const issues = []
  for (const name of added) issues.push(...verifyPackage(profileDirectory, name))

  if (issues.length > 0) {
    // 校验失败：卸载刚装的包，防止 brick 下次 boot。
    for (const name of added) await runPlugin(profile, ['remove', name], REMOVE_TIMEOUT_MS)
    return err(E.VERIFY_FAILED, `装后校验失败：${issues.join('；')}`, {
      command: commandLabel('add', profile, spec),
      run,
      verify: { added, issues },
    })
  }

  return ok({ packageName: added[0], spec, run, verify: { added, state: 'ok' } })
}

export async function updateOne(profile, packageName, explicitDir) {
  const run = await runPlugin(profile, ['update', packageName])
  if (run.exitCode !== 0 || run.timedOut) {
    return err(E.SPAWN_FAILED, describeRun(run, 'update', packageName, profile), {
      command: commandLabel('update', profile, packageName),
      run,
    })
  }
  return ok({ packageName, run })
}

export async function removeOne(profile, packageName, explicitDir) {
  const run = await runPlugin(profile, ['remove', packageName], REMOVE_TIMEOUT_MS)
  if (run.exitCode !== 0 || run.timedOut) {
    return err(E.SPAWN_FAILED, describeRun(run, 'remove', packageName, profile), {
      command: commandLabel('remove', profile, packageName),
      run,
    })
  }
  return ok({ packageName, run })
}

export { E }
