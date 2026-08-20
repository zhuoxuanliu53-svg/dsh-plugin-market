import { marketFetch } from './net.js'
import { err, ok, E } from './result.js'

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
// 返回 Result<boolean>：读取失败显式报错，不静默当作「无 dsh 字段」。
async function hasDshManifest(fullName, token, timeoutMs) {
  const res = await marketFetch(
    `https://api.github.com/repos/${fullName}/contents/package.json`,
    { headers: ghHeaders(token, true) },
    timeoutMs,
  )
  if (!res.ok) return err(E.NETWORK, `读取 ${fullName} 的 package.json 失败`)
  const { statusCode, body } = res.value
  if (statusCode === 404) return ok(false)
  if (statusCode === 403 || statusCode === 429) return err(E.RATE_LIMITED, `读取 ${fullName} 的 package.json 被限流`)
  if (statusCode !== 200) return err(E.HTTP_STATUS, `读取 ${fullName} 的 package.json 返回 ${statusCode}`)
  try {
    const pkg = JSON.parse(body)
    return ok(!!(pkg.dsh && (pkg.dsh.bundle || pkg.dsh.client || pkg.dsh.preset)))
  } catch {
    return err(E.BAD_BODY, `${fullName} 的 package.json 无法解析`)
  }
}

// 依据仓库根目录内容判定形态。repo 传 fullName 字符串或 GitHub repo 对象均可。
// 返回 Result<Shape>：只有成功读取并分类才 ok（含 OTHER）；网络/限流/解析失败返回 err。
export async function detectShape(repo, token = '', timeoutMs = 15000) {
  const fullName = typeof repo === 'string' ? repo : (repo && repo.full_name)
  if (typeof fullName !== 'string' || fullName === '') return err(E.INVALID_ARG, '无效的仓库标识')

  const res = await marketFetch(
    `https://api.github.com/repos/${fullName}/contents/`,
    { headers: ghHeaders(token, false) },
    timeoutMs,
  )
  if (!res.ok) return err(E.NETWORK, `读取 ${fullName} 根目录失败`)
  const { statusCode, body } = res.value
  if (statusCode === 403 || statusCode === 429) return err(E.RATE_LIMITED, `识别 ${fullName} 被限流`)
  if (statusCode !== 200) return err(E.HTTP_STATUS, `识别 ${fullName} 返回 ${statusCode}`)

  let entries
  try {
    entries = JSON.parse(body)
  } catch {
    return err(E.BAD_BODY, `${fullName} 根目录内容无法解析`)
  }
  if (!Array.isArray(entries)) return err(E.BAD_BODY, `${fullName} 根目录内容不是数组`)

  const names = entries
    .map((f) => (f && typeof f.name === 'string' ? f.name.toLowerCase() : ''))
    .filter((n) => n !== '')

  if (names.includes('package.json')) {
    const dshRes = await hasDshManifest(fullName, token, timeoutMs)
    if (!dshRes.ok) return dshRes
    if (dshRes.value) return ok(SHAPE.BUNDLE)
  }
  if (names.includes('agent.cordis.yml')) return ok(SHAPE.PRESET)
  if (names.includes('skill.md')) return ok(SHAPE.SKILL)
  return ok(SHAPE.OTHER)
}
