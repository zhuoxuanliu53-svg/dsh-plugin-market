/**
 * profile — 对 dsh profile 目录的只读探查（纯函数，无进程、无网络）。
 *
 * 所有"装了哪些、哪些是 bundle、入口产物在不在、loader id 会不会冲突"
 * 都从这里读。装后校验与热禁用都依赖这里的结论。
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** 由 profile 名解析其目录（显式目录用于 Desktop 等宿主）。 */
export function profileDir(profile, explicitDir) {
  if (explicitDir !== undefined) return explicitDir
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** 官方随附的 in-box bundles —— 市场已安装列表中隐藏它们。 */
export const INBOX_BUNDLES = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
])

/** 社区依赖映射：包名 → 安装 spec（过滤 in-box bundles）。 */
export function readInstalled(profile, explicitDir) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile, explicitDir), 'package.json'), 'utf8'))
    const installed = {}
    for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
      if (!INBOX_BUNDLES.has(name)) installed[name] = spec
    }
    return installed
  } catch {
    return {}
  }
}

/** profile manifest 的 dsh.profile.bundles（CLI 已 reconcile 的结果）。 */
export function readProfileBundles(profileDirectory) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDirectory, 'package.json'), 'utf8'))
    const bundles = manifest.dsh && manifest.dsh.profile ? manifest.dsh.profile.bundles : undefined
    return Array.isArray(bundles) ? bundles.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

/** 包是否声明了 dsh 元数据（dsh.bundle 或 dsh.client）。 */
export function hasDshManifest(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return manifest.dsh !== undefined
  } catch {
    return false
  }
}

/** 包声明的入口产物是否真实存在（源码检出但构建被拦时缺失）。 */
export function entryArtifactExists(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const candidates = []
    if (typeof manifest.main === 'string') candidates.push(manifest.main)
    const rootExport = typeof manifest.exports === 'string'
      ? manifest.exports
      : (manifest.exports && typeof manifest.exports === 'object' ? manifest.exports['.'] : undefined)
    if (typeof rootExport === 'string') candidates.push(rootExport)
    else if (rootExport && typeof rootExport === 'object') {
      for (const v of Object.values(rootExport)) if (typeof v === 'string') candidates.push(v)
    }
    if (candidates.length === 0) candidates.push('index.js')
    return candidates.some((rel) => existsSync(join(dir, rel)))
  } catch {
    return false
  }
}

/**
 * 逐行解析一个 bundle patch 的 name/id 行。
 * 只做"这个包带进来什么"的判定；insertedIds 只算 insert 块内的 id。
 */
export function parsePatchRows(text) {
  const names = []
  const ids = []
  const insertedIds = []
  let insertIndent = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '')
    if (line.trim() === '') continue
    const indent = line.length - line.trimStart().length
    if (insertIndent !== null && indent <= insertIndent && !/^\s*-?\s*(id|name|config):/u.test(line)) {
      insertIndent = null
    }
    if (/^\s*-?\s*insert:\s*$/u.test(line)) {
      insertIndent = indent
      continue
    }
    const name = /^\s*-?\s*name:\s*['"]?([^'"\s]+)/.exec(line)
    if (name !== null && !names.includes(name[1])) names.push(name[1])
    const id = /^\s*-?\s*id:\s*['"]?([^'"\s]+)/.exec(line)
    if (id !== null) {
      if (!ids.includes(id[1])) ids.push(id[1])
      if (insertIndent !== null && indent > insertIndent) {
        if (!insertedIds.includes(id[1])) insertedIds.push(id[1])
      } else if (indent <= (insertIndent ?? -1)) {
        insertIndent = null
      }
    }
  }
  return { names, ids, insertedIds }
}

/** 包 patch 里的 name 行（carrier bundle 挂载的其它包）。 */
function bundlePatchNames(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const declared = manifest.dsh && manifest.dsh.bundle ? manifest.dsh.bundle.patch : undefined
    if (typeof declared !== 'string' || declared === '') return []
    return parsePatchRows(readFileSync(join(dir, declared), 'utf8')).names
  } catch {
    return []
  }
}

/** 包 patch 的 insert 块里声明的 loader entry id（冲突判定的依据）。 */
export function bundlePatchInsertedIds(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const declared = manifest.dsh && manifest.dsh.bundle ? manifest.dsh.bundle.patch : undefined
    if (typeof declared !== 'string' || declared === '') return []
    return parsePatchRows(readFileSync(join(dir, declared), 'utf8')).insertedIds
  } catch {
    return []
  }
}

/** loader 是否能为这个包加载出东西（自身入口，或 carrier 挂载的其它包入口）。 */
export function hasLoadableEntry(profileDirectory, name) {
  const dir = join(profileDirectory, 'node_modules', name)
  if (entryArtifactExists(dir)) return true
  const workspaceRoot = dirname(profileDirectory)
  return bundlePatchNames(dir)
    .filter((target) => target !== name)
    .some((target) =>
      entryArtifactExists(join(profileDirectory, 'node_modules', target))
      || entryArtifactExists(join(dir, 'node_modules', target))
      || entryArtifactExists(join(workspaceRoot, 'node_modules', target)))
}

/** 新增包会与 profile 已加载 bundle 冲突的 loader entry id（重复 id 会 brick 下次 boot）。 */
export function conflictingEntryIds(profileDirectory, candidate, installedBundles) {
  const mine = bundlePatchInsertedIds(join(profileDirectory, 'node_modules', candidate))
  if (mine.length === 0) return []
  const conflicts = []
  for (const bundle of installedBundles) {
    if (bundle === candidate) continue
    const theirs = new Set(bundlePatchInsertedIds(join(profileDirectory, 'node_modules', bundle)))
    for (const id of mine) {
      if (theirs.has(id) && !conflicts.some((hit) => hit.id === id)) conflicts.push({ id, owner: bundle })
    }
  }
  return conflicts
}

/** node_modules 里实际存在的版本号。 */
export function readInstalledVersion(profile, name, explicitDir) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile, explicitDir), 'node_modules', name, 'package.json'), 'utf8'))
    return manifest.version ?? null
  } catch {
    return null
  }
}
