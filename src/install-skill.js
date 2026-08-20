import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { err, ok, E } from './result.js'
import { cloneRepo, cleanDir, dshHome, makeTempDir, repoUrlOf } from './download.js'

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function parseSkillFrontmatter(text) {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return { name: '', description: '' }
  const front = m[1]
  const name = /^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(front)
  const desc = /^description:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(front)
  return {
    name: name ? name[1].trim() : '',
    description: desc ? desc[1].trim() : '',
  }
}

function listDir(dir) {
  try { return readdirSync(dir) } catch { return [] }
}

function isDir(p) {
  try { return statSync(p).isDirectory() } catch { return false }
}

function skillsRoot() {
  const dir = join(dshHome(), 'skills')
  mkdirSync(dir, { recursive: true })
  return dir
}

function copySkill(src, dest) {
  try {
    cpSync(src, dest, { recursive: true })
    rmSync(join(dest, '.git'), { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

// 收集 skill 单元：根 SKILL.md 视为单 skill；否则 skills/ 下每个 <name>/SKILL.md。
function collectSkills(repoDir) {
  const out = []
  if (existsSync(join(repoDir, 'SKILL.md'))) {
    out.push({ srcDir: repoDir })
    return out
  }
  const skillsDir = join(repoDir, 'skills')
  if (isDir(skillsDir)) {
    for (const name of listDir(skillsDir)) {
      const sub = join(skillsDir, name)
      if (isDir(sub) && existsSync(join(sub, 'SKILL.md'))) out.push({ srcDir: sub })
    }
  }
  return out
}

export async function installSkill(_profile, entry) {
  const url = repoUrlOf(entry)
  const tmp = makeTempDir('dsh-skill')
  const repoDir = join(tmp, 'repo')
  try {
    const clone = await cloneRepo(url, repoDir)
    if (clone.exitCode !== 0 || clone.timedOut) {
      return err(E.SPAWN_FAILED, clone.timedOut ? '下载 skill 超时' : `下载 skill 失败：${clone.stderr || clone.stdout || 'git clone 非零退出'}`, { command: `git clone ${url}` })
    }

    const units = collectSkills(repoDir)
    if (units.length === 0) {
      return err(E.VERIFY_FAILED, '未找到 SKILL.md（既不在根目录，也不在 skills/ 下）')
    }

    const root = skillsRoot()
    const installed = []
    for (const unit of units) {
      let text
      try {
        text = readFileSync(join(unit.srcDir, 'SKILL.md'), 'utf8')
      } catch {
        return err(E.VERIFY_FAILED, `读取 SKILL.md 失败：${unit.srcDir}`)
      }
      const fm = parseSkillFrontmatter(text)
      if (fm.name === '' || !KEBAB_RE.test(fm.name)) {
        return err(E.VERIFY_FAILED, `SKILL.md 缺少合法的 kebab-case name（frontmatter）：${fm.name || '(空)'}`)
      }
      if (fm.description === '') {
        return err(E.VERIFY_FAILED, `SKILL.md「${fm.name}」缺少 description（frontmatter）`)
      }
      const dest = join(root, fm.name)
      if (!copySkill(unit.srcDir, dest)) {
        return err(E.VERIFY_FAILED, `复制 skill「${fm.name}」到 ${dest} 失败`)
      }
      installed.push({ name: fm.name, description: fm.description })
    }

    return ok({ packageName: installed.map((s) => s.name).join(', '), installed, command: `复制到 ${root}` })
  } finally {
    cleanDir(tmp)
  }
}
