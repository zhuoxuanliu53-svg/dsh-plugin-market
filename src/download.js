import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const CLONE_TIMEOUT_MS = Number(process.env.DSH_MARKET_CLONE_TIMEOUT_MS) || 5 * 60 * 1000

export function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

export function repoUrlOf(entry) {
  if (entry && typeof entry.url === 'string' && /^https?:\/\//.test(entry.url)) return entry.url
  return `https://github.com/${entry.fullName}`
}

// 异步执行命令，返回 { exitCode, timedOut, stdout, stderr }。
export function runCommand(file, args, timeoutMs = CLONE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch { /* 忽略 */ }
    }, timeoutMs)
    child.stdout?.on('data', (c) => { stdout = (stdout + c.toString()).slice(-64 * 1024) })
    child.stderr?.on('data', (c) => { stderr = (stderr + c.toString()).slice(-64 * 1024) })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ exitCode: 127, timedOut: false, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ exitCode: code, timedOut, stdout, stderr })
    })
  })
}

export function makeTempDir(prefix) {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function cleanDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* 忽略 */ }
}

export function cloneRepo(url, destDir, timeoutMs = CLONE_TIMEOUT_MS) {
  return runCommand('git', ['clone', '--depth', '1', url, destDir], timeoutMs)
}
