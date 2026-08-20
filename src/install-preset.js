import { existsSync, readFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { err, ok, E } from './result.js'
import { cloneRepo, cleanDir, dshHome, makeTempDir, repoUrlOf } from './download.js'

const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]*$/

function presetsRoot() {
  const dir = join(dshHome(), '.agent-presets')
  mkdirSync(dir, { recursive: true })
  return dir
}

function presetIdFrom(entry) {
  const raw = String((entry && entry.name) || (entry && entry.fullName ? entry.fullName.split('/')[1] : '') || 'preset').toLowerCase()
  const cleaned = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (PRESET_ID_RE.test(cleaned)) return cleaned
  return cleaned.startsWith('-') ? `p${cleaned}` : `p-${cleaned}`
}

function copyPreset(src, dest) {
  cpSync(src, dest, { recursive: true })
  rmSync(join(dest, '.git'), { recursive: true, force: true })
}

export async function installPreset(_profile, entry) {
  const url = repoUrlOf(entry)
  const tmp = makeTempDir('dsh-preset')
  const repoDir = join(tmp, 'repo')
  try {
    const clone = await cloneRepo(url, repoDir)
    if (clone.exitCode !== 0 || clone.timedOut) {
      return err(E.SPAWN_FAILED, clone.timedOut ? '下载 preset 超时' : `下载 preset 失败：${clone.stderr || clone.stdout || 'git clone 非零退出'}`, { command: `git clone ${url}` })
    }

    const cordis = join(repoDir, 'agent.cordis.yml')
    if (!existsSync(cordis)) {
      return err(E.VERIFY_FAILED, '未找到 agent.cordis.yml（preset 组装文件）')
    }
    // 基本可读性校验：非空文本。
    const text = readFileSync(cordis, 'utf8')
    if (text.trim() === '') {
      return err(E.VERIFY_FAILED, 'agent.cordis.yml 为空')
    }

    const id = presetIdFrom(entry)
    const dest = join(presetsRoot(), id)
    if (existsSync(dest)) {
      return err(E.CONFLICT, `preset id「${id}」已存在（${dest}）`)
    }
    copyPreset(repoDir, dest)

    return ok({ packageName: id, installed: [{ name: id, composition: 'agent.cordis.yml' }], command: `复制到 ${dest}` })
  } finally {
    cleanDir(tmp)
  }
}
