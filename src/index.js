/**
 * dsh-plugin-market host 入口：挂载市场 HTTP 路由。
 *
 * 正式 bundle 插件的 Host 半区：export name + apply。apply 里用
 * ctx.inject(['webServer', 'loader']) 等在两个服务可用时挂载路由，
 * 并把 disposer 交给 ctx.effect，使停止/更新时所有路由一并拆除。
 */

import { createMarketServer } from './routes.js'

export const name = 'dsh-plugin-market'

/** 本进程实际 boot 的 profile（`dsh --profile <name>`）。 */
function argvProfile() {
  const argv = process.argv
  const flag = argv.indexOf('--profile')
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith('-')) {
    return argv[flag + 1]
  }
  return undefined
}

/** 可选 cordis 配置；profile 默认 `web`。 */
export function apply(ctx, config) {
  ctx.inject(['webServer', 'loader'], (hostCtx) => {
    const resolved = {
      profile: (config && config.profile) ?? argvProfile() ?? 'web',
    }
    hostCtx.effect(() => createMarketServer(hostCtx, resolved), 'dsh-plugin-market: http routes')
  })
}
