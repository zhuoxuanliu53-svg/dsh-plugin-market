import { ok, err, E } from './result.js'

// ---- 标识形状 ----

// GitHub 仓库全名：owner/name，两侧仅允许 [A-Za-z0-9_.-]
const FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export function isFullName(x) {
  return typeof x === 'string' && FULL_NAME_RE.test(x)
}

export function validateFullName(x) {
  if (!isFullName(x)) {
    return err(E.INVALID_ARG, '无效的插件标识（应为 owner/repo）：' + String(x))
  }
  return ok(x.toLowerCase())
}

// npm 包名（宽松校验，用于安装/卸载目标名）
const PACKAGE_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

export function isPackageName(x) {
  return typeof x === 'string' && PACKAGE_NAME_RE.test(x)
}

// pnpm/dsh 安装目标的安全白名单（防命令注入）
const SAFE_TARGET_RE = /^[A-Za-z0-9@:./_#+-]+$/

export function isSafeTarget(x) {
  return typeof x === 'string' && x !== '' && SAFE_TARGET_RE.test(x)
}

// ---- 实体形状 ----

export function isPluginEntry(x) {
  return x != null
    && typeof x === 'object'
    && typeof x.fullName === 'string'
    && (x.source === 'curated' || x.source === 'github-topic')
}

export function normalizeInstallState(v) {
  if (v && typeof v === 'object') {
    return {
      installedAt: typeof v.installedAt === 'number' ? v.installedAt : 0,
      autoUpdate: !!v.autoUpdate,
      lastAutoUpdateAt: typeof v.lastAutoUpdateAt === 'number' ? v.lastAutoUpdateAt : 0,
      packageName: typeof v.packageName === 'string' ? v.packageName : '',
      shape: typeof v.shape === 'string' ? v.shape : 'bundle',
      spec: typeof v.spec === 'string' ? v.spec : '',
    }
  }
  return { installedAt: 0, autoUpdate: false, lastAutoUpdateAt: 0, packageName: '', shape: 'bundle', spec: '' }
}

export function normalizeFollowState(v) {
  if (Array.isArray(v)) {
    const seen = new Set()
    const out = []
    for (const item of v) {
      if (typeof item === 'string' && item !== '' && !seen.has(item)) {
        seen.add(item)
        out.push(item)
      }
    }
    return out
  }
  return []
}

export function normalizeState(v) {
  const follows = normalizeFollowState(v && v.follows)
  const installed = {}
  if (v && v.installed && typeof v.installed === 'object' && !Array.isArray(v.installed)) {
    for (const [name, rec] of Object.entries(v.installed)) {
      if (isFullName(name)) installed[name] = normalizeInstallState(rec)
    }
  }
  return { follows, installed }
}
