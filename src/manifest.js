import { ok, err, E } from './result.js'
import { isFullName } from './contracts.js'

const FORMAT = 'dsh-plugin-market'

export function buildManifest(state, profile) {
  const installed = state && state.installed && typeof state.installed === 'object' ? state.installed : {}
  const follows = state && Array.isArray(state.follows) ? state.follows : []
  const followSet = new Set(follows)

  const plugins = Object.keys(installed)
    .filter((fullName) => isFullName(fullName))
    .map((fullName) => ({
      fullName,
      followed: followSet.has(fullName),
      autoUpdate: !!(installed[fullName] && installed[fullName].autoUpdate),
    }))

  const commands = plugins.map((p) => `dsh plugin --profile ${profile} add github:${p.fullName}`)

  return {
    format: FORMAT,
    version: 2,
    exportedAt: new Date().toISOString(),
    profile,
    plugins,
    commands,
  }
}

export function parseManifest(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return err(E.INVALID_ARG, '清单为空')
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return err(E.INVALID_ARG, '清单不是有效 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return err(E.INVALID_ARG, '清单结构无效')
  }
  if (parsed.format !== undefined && parsed.format !== FORMAT) {
    return err(E.INVALID_ARG, `不支持的清单格式：${parsed.format}`)
  }

  const plugins = Array.isArray(parsed.plugins)
    ? parsed.plugins
      .filter((p) => p && typeof p.fullName === 'string' && isFullName(p.fullName))
      .map((p) => ({
        fullName: p.fullName.toLowerCase(),
        followed: !!p.followed,
        autoUpdate: !!p.autoUpdate,
      }))
    : []

  const commands = Array.isArray(parsed.commands)
    ? parsed.commands.filter((c) => typeof c === 'string')
    : []

  if (plugins.length === 0 && commands.length === 0) {
    return err(E.INVALID_ARG, '清单中没有任何插件')
  }
  return ok({ plugins, commands })
}
