import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

// 共享的 CLI 启动/子进程原语：installer 与 restart 复用同一份实现，避免复制与 cwd 不一致。

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

export function spawnShim(file, args, options = {}) {
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

export function nodeExecutable() {
  if (process.argv0 && process.argv0 !== '' && isAbsolute(process.argv0) && existsSync(process.argv0)) {
    return process.argv0
  }
  return process.execPath
}

// 重建本进程的 dsh 启动命令。cwd 用 process.cwd()（当前进程真实工作目录），
// 保证 install/restart 派生的 dsh 与当前进程处于同一环境；bin.ts 用 import.meta.url
// 定位自身资源、profile 用 DSH_HOME，均不依赖 cwd，因此 cwd 只需「前后一致」。
export function dshArgv() {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: nodeExecutable(), args: [...process.execArgv, abs], cwd: process.cwd(), viaShell: false }
  }
  return { file: 'dsh', args: [], cwd: process.cwd(), viaShell: winCmdShim }
}

export function killChild(child) {
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
