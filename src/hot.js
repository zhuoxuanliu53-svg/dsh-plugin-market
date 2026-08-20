/**
 * hot — 热禁用/启用（System）。
 *
 * 通过写 profile 的用户补丁层 cordis.patch.yml 实现：
 *   - 禁用：追加 `- id: <rowId>` + `  disabled: true`
 *   - 启用：移除该块，或当低层（bundle）压制时追加 `disabled: false` 强制开启
 *
 * DSH 的配置监听（HMR）在保存后约 1s 内重组合树，无需重启；loader 每次 boot
 * 重新应用同一文件，所以选择跨重启存续——走的是官方机制，不是私有状态。
 *
 * 安全（沿用 dsh-plugin-hub 的既有实现）：
 *   - 写操作串行化，防止并发读改写交错；
 *   - 补丁文件不是合法条目数组时拒绝追加，绝不把坏文件改得更坏；
 *   - 宿主基础设施行（webserver / storage / settings 等）拒绝开关。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ok, err, E } from './result.js'
import { bundlePatchInsertedIds, parsePatchRows } from './profile.js'

/** 宿主基础设施行：禁用会打断补丁层赖以运行的链路，拒绝开关。 */
const PROTECTED_MODULE_PATTERNS = [
  /^cordis:/u,
  /^@deepseek-ai\/cordis-plugin-/u,
  /^@deepseek-ai\/dsh-host-/u,
  /^@deepseek-ai\/dsh-client-modules$/u,
  /^@deepseek-ai\/dsh-client-connection$/u,
  /^@deepseek-ai\/dsh-client-hmr$/u,
  /^@deepseek-ai\/dsh-client-runtime$/u,
  /^@deepseek-ai\/dsh-client-locale$/u,
  /^@deepseek-ai\/dsh-client-web/u,
  /^@deepseek-ai\/dsh-web-frontend$/u,
  /^@deepseek-ai\/dsh-web-app$/u,
  /^@deepseek-ai\/dsh-settings/u,
  /^@deepseek-ai\/dsh-credentials/u,
  /^@deepseek-ai\/dsh-session/u,
  /^@deepseek-ai\/dsh-storage/u,
  /^@deepseek-ai\/dsh-typert/u,
  /^@deepseek-ai\/dsh-api-remotes$/u,
  /^@deepseek-ai\/dsh-tools$/u,
  /^@deepseek-ai\/dsh-system-prompt$/u,
  /^@deepseek-ai\/dsh-agent/u,
  /^@deepseek-ai\/dsh-llm/u,
  /^@deepseek-ai\/dsh-persona$/u,
  /^@deepseek-ai\/dsh-scope$/u,
  /^@deepseek-ai\/dsh-launch-environment$/u,
  /^@deepseek-ai\/dsh-shell$/u,
  /^@deepseek-ai\/dsh-subprocess/u,
  /^@deepseek-ai\/dsh-fs/u,
  /^@deepseek-ai\/dsh-sandbox/u,
  /^@deepseek-ai\/dsh-jobs/u,
  /^@deepseek-ai\/dsh-skill/u,
  /^@deepseek-ai\/dsh-goal/u,
  /^@deepseek-ai\/dsh-workflow/u,
  /^@deepseek-ai\/dsh-subagent/u,
  /^@deepseek-ai\/dsh-web$/u,
  /^@deepseek-ai\/dsh-workspace/u,
  /^@deepseek-ai\/dsh-user-approval$/u,
  /^@deepseek-ai\/dsh-user-questions$/u,
  /^@deepseek-ai\/dsh-commands$/u,
  /^@deepseek-ai\/dsh-hook/u,
  /^@deepseek-ai\/dsh-spill/u,
  /^@deepseek-ai\/dsh-guard/u,
  /^@deepseek-ai\/dsh-tool-call-timeout-policy$/u,
  /^@deepseek-ai\/dsh-repeat-tool-reminder$/u,
]

/** 判断模块名是否在宿主基础设施链上（不可开关）。 */
export function isProtectedModule(moduleName) {
  return typeof moduleName === 'string'
    && PROTECTED_MODULE_PATTERNS.some((pattern) => pattern.test(moduleName))
}

/**
 * 解析用户补丁层路径。优先取 loader 里 cordis:include 条目实际读的路径，
 * 回退到约定位置 <profile>/cordis.patch.yml。
 * @param {Iterable} loaderEntries loader.entries() 的结果
 * @param {string} profileDir profile 目录
 */
export function findUserPatchPath(loaderEntries, profileDir) {
  for (const entry of loaderEntries ?? []) {
    const cfg = entry.options && entry.options.config
    if (entry.options && entry.options.name !== 'cordis:include') continue
    if (cfg == null || typeof cfg.path !== 'string') continue
    if (!cfg.path.includes('cordis.yml')) continue
    let includePath = cfg.path
    if (includePath.startsWith('file://')) {
      try {
        includePath = fileURLToPath(includePath)
      } catch {
        includePath = includePath.replace(/^file:\/\//u, '')
      }
    }
    return includePath.replace(/cordis\.yml$/u, 'cordis.patch.yml')
  }
  return join(profileDir, 'cordis.patch.yml')
}

/** 用户补丁层当前对行的说法。 */
export function readUserPatchState(patchPath) {
  const disables = []
  const forced = []
  const inserts = []
  let text = ''
  try {
    text = readFileSync(patchPath, 'utf8')
  } catch {
    // 无补丁文件 → 空状态
  }
  const lines = text.split(/\r?\n/u)
  let inInsert = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (/^- insert:\s*$/u.test(line)) {
      inInsert = true
      continue
    }
    if (/^- /u.test(line)) inInsert = false
    if (inInsert) {
      const insertRow = /^ {4}- id: ([A-Za-z0-9_.-]+)/u.exec(line)
      if (insertRow !== null) inserts.push(insertRow[1])
      continue
    }
    const disableRow = /^- id: ([A-Za-z0-9_.-]+)\s*$/u.exec(line)
    if (disableRow === null) continue
    const next = lines[index + 1] ?? ''
    if (/^ {2}disabled: true\s*$/u.test(next)) disables.push(disableRow[1])
    else if (/^ {2}disabled: false\s*$/u.test(next)) forced.push(disableRow[1])
  }
  return { disables, forced, inserts }
}

/** loader entry id 前缀（loader 的 id 形如 `include:X`）。 */
function includePrefix(loaderEntries) {
  for (const entry of loaderEntries ?? []) {
    if (entry.options && entry.options.name === 'cordis:include' && typeof entry.options.id === 'string') {
      return `${entry.options.id}:`
    }
  }
  return ''
}

/**
 * 一个已安装包在用户补丁层拥有的行 id：其 bundle patch 的 insert id，
 * 加上 loader 中当前承载其名字的条目 id。纯客户端包没有 bundle 行，返回空。
 */
export function rowIdsForPackage(loaderEntries, profileDirectory, packageName) {
  const ids = new Set()
  const packageDir = join(profileDirectory, 'node_modules', packageName)
  try {
    for (const id of bundlePatchInsertedIds(packageDir)) ids.add(id)
  } catch {
    // 包未安装
  }
  try {
    for (const id of parsePatchRows(readFileSync(join(packageDir, 'cordis.patch.yml'), 'utf8')).insertedIds) {
      ids.add(id)
    }
  } catch {
    // 无约定位置的补丁
  }
  const prefix = includePrefix(loaderEntries)
  for (const entry of loaderEntries ?? []) {
    if (entry.options && entry.options.name !== packageName) continue
    let id = entry.options && entry.options.id ? entry.options.id : ''
    if (id === '') continue
    if (prefix !== '' && id.startsWith(prefix)) id = id.slice(prefix.length)
    if (/^(?:mkt-|client-)/u.test(id)) continue
    ids.add(id)
  }
  return [...ids]
}

// ---- 写入（串行化 + 占位符处理） ----

let writeQueue = Promise.resolve()
function queuedWrite(fn) {
  const run = writeQueue.then(fn, fn)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function rowBlock(rowId, disabled) {
  return `- id: ${rowId}\n  disabled: ${disabled ? 'true' : 'false'}\n`
}

/** 把空列表占位符复原（删除最后一行后，纯注释文件会 brick 下次 boot）。 */
function withPlaceholderRestored(text) {
  if (text.replace(/^[ \t]*#.*$/gmu, '').trim() !== '') return text
  const uncommented = text.replace(/^[ \t]*#[ \t]*\[[ \t]*\][ \t]*(?:\r?\n|$)/mu, '[]\n')
  if (uncommented !== text) return uncommented
  return text === '' || text.endsWith('\n') ? `${text}[]\n` : `${text}\n[]\n`
}

/**
 * 追加一条顶层补丁条目。文件不是合法条目数组时拒绝，绝不把坏文件改得更坏。
 * 返回 Result<null>。
 */
function appendPatchEntry(patchPath, block) {
  let text = ''
  try {
    text = readFileSync(patchPath, 'utf8')
  } catch {
    // 下面会创建
  }
  const core = text.trim()
  if (core === '') {
    writeFileSync(patchPath, block)
    return ok(null)
  }
  const withoutComments = text.replace(/^[ \t]*#.*$/gmu, '').trim()
  if (withoutComments === '') {
    const next = text.endsWith('\n') ? text : `${text}\n`
    writeFileSync(patchPath, `${next}${block}`)
    return ok(null)
  }
  if (withoutComments === '[]' || withoutComments === '[ ]') {
    const commented = text.replace(/^[ \t]*\[[ \t]*\][ \t]*(?:#.*)?(?:\r?\n|$)/mu, '# []\n')
    const next = commented.endsWith('\n') ? commented : `${commented}\n`
    writeFileSync(patchPath, `${next}${block}`)
    return ok(null)
  }
  const lastContentLine = text.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .pop() ?? ''
  if (/^[[{]/u.test(lastContentLine)) {
    return err(E.PATCH_REFUSED, '补丁层以顶层流式结构结尾，不支持自动追加；请先整理为条目列表')
  }
  // 不能解析为条目数组 → 拒绝追加。
  const lines = withoutComments.split(/\r?\n/u).filter((l) => l.trim() !== '')
  const looksLikeArray = lines.every((l) => /^-(\s|$)/u.test(l.trim()) || l.trim() === '[]')
  if (!looksLikeArray) {
    return err(E.PATCH_REFUSED, '补丁层不是合法的条目数组，已拒绝追加以免破坏；请先修正 YAML')
  }
  const next = text.endsWith('\n') ? text : `${text}\n`
  writeFileSync(patchPath, `${next}${block}`)
  return ok(null)
}

const ROW_ID_RE = /^[A-Za-z0-9_.-]+$/u

/** 禁用一行：追加 `- id: X` + `disabled: true`（幂等）。 */
export function disableRow(patchPath, rowId) {
  return queuedWrite(async () => {
    if (!ROW_ID_RE.test(rowId)) {
      return err(E.PATCH_REFUSED, `行 id「${rowId}」含特殊字符，不支持写入补丁层`)
    }
    const state = readUserPatchState(patchPath)
    if (state.disables.includes(rowId)) return ok(null)
    const result = appendPatchEntry(patchPath, rowBlock(rowId, true))
    return result
  })
}

/** 启用一行：移除 `disabled: true` 块；低层压制时追加 `disabled: false`。 */
export function enableRow(patchPath, rowId) {
  return queuedWrite(async () => {
    if (!ROW_ID_RE.test(rowId)) {
      return err(E.PATCH_REFUSED, `行 id「${rowId}」含特殊字符，不支持写入补丁层`)
    }
    const state = readUserPatchState(patchPath)
    const blockRe = new RegExp(`^- id: ['\"]?${escapeRegExp(rowId)}['\"]?\\r?\\n  disabled: true\\r?\\n`, 'mu')
    const text = (() => {
      try { return readFileSync(patchPath, 'utf8') } catch { return '' }
    })()
    if (blockRe.test(text)) {
      writeFileSync(patchPath, withPlaceholderRestored(text.replace(blockRe, '')))
      return ok(null)
    }
    if (state.forced.includes(rowId)) return ok(null)
    return appendPatchEntry(patchPath, rowBlock(rowId, false))
  })
}

/** 卸载清理：移除某行所有 disable/force 块。 */
export function removeRowBlocks(patchPath, rowIds) {
  let text = ''
  try {
    text = readFileSync(patchPath, 'utf8')
  } catch {
    return
  }
  let next = text
  for (const rowId of rowIds) {
    const blockRe = new RegExp(`^- id: ['\"]?${escapeRegExp(rowId)}['\"]?\\r?\\n  disabled: (?:true|false)\\r?\\n`, 'mu')
    next = next.replace(blockRe, '')
  }
  if (next !== text) writeFileSync(patchPath, withPlaceholderRestored(next))
}
