/**
 * installer — 安装/更新/卸载 + 装后校验（System）。
 *
 * 通过 node:child_process 重调起本进程的 dsh CLI（`dsh plugin --profile <p> <verb>`），
 * 而不是 ctx.shell：正式插件里的 shell 服务是 agent 沙箱执行器，会拒绝对 profile 目录的写。
 *
 * 装后校验：装完检查每个新增包是否有可加载入口 / 是否声明 dsh 元数据 / loader id 冲突，
 * 失败则立即卸载并报因，防止"下次 boot 起不来"。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { err, ok, E } from './result.js'
import {
  conflictingEntryIds,
  hasDshManifest,
  hasLoadableEntry,
  profileDir,
  readInstalled,
  readProfileBundles,
} from './profile.js'

const INSTALL_TIMEOUT_MS = Number(process.env.DSH_MARKET_INSTALL_TIMEOUT_MS) || 15 * 60 * 1000
const REMOVE_TIMEOUT_MS = 5 * 60 * 1000

// ---- Windows .cmd shim（同 dsh 官方 plugin forwarder 的做法） ----
export const winCmdShim = process.platform === 'win32'
const COMSPEC = process.env.ComSpec ?? 'cmd.exe'
const CMD_METACHARS = /[\s"&|<>^()%!]/

function quoteCmdArg(arg) {
  if (!CMD_METACHARS.test(arg)) return arg
  return `"${arg.replace(/"/g, '""')}"`
}

function cmdCommandLine(argv) {
  return argv.map(quoteCmdArg).join(' ')
}

function spawnShim(file, args, options = {}) {
  const { viaShell = false, ...spawnOptions } = options
  if (viaShell && process.platform === 'win32') {
    return spawn(COMSPEC, ['/d', '/s', '/c', `"${cmdCommandLine([file, ...args])}"`], {
      ...spawnOptions,
      shell: false,
      windowsVerbatimArguments: true,
    })
  }
  return spawn(file, args, { ...spawnOptions, shell: false })
}

function nodeExecutable() {
  if (process.argv0 && process.argv0 !== '' && isAbsolute(process.argv0) && existsSync(process.argv0)) {
    return process.argv0
  }
  return process.execPath
}

const nodeBinDir = dirname(nodeExecutable())

function spawnEnv() {
  const sep = process.platform === 'win32' ? ';' : ':'
  const parts = (process.env.PATH ?? '').split(sep).filter((p) => p !== '')
  if (!parts.includes(nodeBinDir)) parts.push(nodeBinDir)
  return { ...process.env, CI: 'true', PATH: parts.join(sep) }
}

/** 重调起本进程的 dsh CLI（优先进程入口，回退 PATH 上的 dsh）。 */
function dshArgv() {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: nodeExecutable(), args: [...process.execArgv, abs], cwd: dirname(abs), viaShell: false }
  }
  return { file: 'dsh', args: [], cwd: undefined, viaShell: winCmdShim }
}

function killChild(child) {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      return
    } catch {
      // 落到普通 kill
    }
  }
  child.kill('SIGKILL')
}

/** 运行一条 dsh plugin 命令，返回 { exitCode, timedOut, stdout, stderr, cancelled }。 */
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

/** 安装 spec：curated 有 npm 名用 npm 名，否则 github:owner/repo。 */
export function installSpecFor(entry) {
  if (entry && typeof entry.npm === 'string' && entry.npm !== '') return entry.npm
  return `github:${entry.fullName}`
}

/** 从 fullName 取 repo 名（owner/repo → repo）。 */
export function repoNameOf(fullName) {
  const parts = String(fullName).split('/')
  return parts[1] || parts[0] || fullName
}

function commandLabel(verb, profile, spec) {
  return `dsh plugin --profile ${profile} ${verb} ${spec}`
}

/** 把 run 结果转成用户可读的失败说明。 */
function describeRun(run, verb, spec, profile) {
  if (run.timedOut) return `命令超时：${commandLabel(verb, profile, spec)}`
  const tail = (run.stderr || run.stdout || '').split('\n').slice(-5).join('\n').trim()
  return `命令失败（exit ${run.exitCode}）：${commandLabel(verb, profile, spec)}${tail ? `\n${tail}` : ''}`
}

// ---- 装后校验 ----

/**
 * 校验刚装进 profile 的包（按 installed 包名）。
 * @returns {Array} 问题描述数组，空数组表示通过。
 */
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

/**
 * 安装一个插件，返回 Result<{ packageName, spec, run }>。
 * @param {string} profile
 * @param {object} entry PluginEntry
 * @param {string} [explicitDir]
 */
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

/** 更新一个插件（按已安装的包名）。 */
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

/** 卸载一个插件（按已安装的包名）。 */
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
