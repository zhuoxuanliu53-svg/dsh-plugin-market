import { marketFetch } from './net.js'

// 插件形态。识别优先级：bundle > preset > skill > other。
export const SHAPE = {
  BUNDLE: 'bundle',
  SKILL: 'skill',
  PRESET: 'preset',
  OTHER: 'other',
}

function ghHeaders(token, raw) {
  const headers = {
    accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'user-agent': 'dsh-plugin-market',
  }
  if (token !== '') headers.authorization = `Bearer ${token}`
  return headers
}

// 读根目录 package.json，确认是否声明了 dsh 元数据（bundle/client/preset）。
async function hasDshManifest(fullName, token, timeoutMs) {
  const res = await marketFetch(
    `https://api.github.com/repos/${fullName}/contents/package.json`,
    { headers: ghHeaders(token, true) },
    timeoutMs,
  )
  if (!res.ok || res.value.statusCode !== 200) return false
  try {
    const pkg = JSON.parse(res.value.body)
    return !!(pkg.dsh && (pkg.dsh.bundle || pkg.dsh.client || pkg.dsh.preset))
  } catch {
    return false
  }
}

// 依据仓库根目录内容判定形态。repo 传 fullName 字符串或 GitHub repo 对象均可。
export async function detectShape(repo, token = '', timeoutMs = 15000) {
  const fullName = typeof repo === 'string' ? repo : (repo && repo.full_name)
  if (typeof fullName !== 'string' || fullName === '') return SHAPE.OTHER

  const res = await marketFetch(
    `https://api.github.com/repos/${fullName}/contents/`,
    { headers: ghHeaders(token, false) },
    timeoutMs,
  )
  if (!res.ok || res.value.statusCode !== 200) return SHAPE.OTHER

  let entries
  try {
    entries = JSON.parse(res.value.body)
  } catch {
    return SHAPE.OTHER
  }
  if (!Array.isArray(entries)) return SHAPE.OTHER

  const names = entries
    .map((f) => (f && typeof f.name === 'string' ? f.name.toLowerCase() : ''))
    .filter((n) => n !== '')

  if (names.includes('package.json')) {
    const hasDsh = await hasDshManifest(fullName, token, timeoutMs)
    if (hasDsh) return SHAPE.BUNDLE
  }
  if (names.includes('agent.cordis.yml')) return SHAPE.PRESET
  if (names.includes('skill.md')) return SHAPE.SKILL
  return SHAPE.OTHER
}
