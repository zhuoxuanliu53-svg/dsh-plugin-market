import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export function profileDir(profile, explicitDir) {
  if (explicitDir !== undefined) return explicitDir
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

export const INBOX_BUNDLES = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
])

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

export function readProfileBundles(profileDirectory) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDirectory, 'package.json'), 'utf8'))
    const bundles = manifest.dsh && manifest.dsh.profile ? manifest.dsh.profile.bundles : undefined
    return Array.isArray(bundles) ? bundles.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

export function hasDshManifest(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return manifest.dsh !== undefined
  } catch {
    return false
  }
}

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

export function readInstalledVersion(profile, name, explicitDir) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile, explicitDir), 'node_modules', name, 'package.json'), 'utf8'))
    return manifest.version ?? null
  } catch {
    return null
  }
}
