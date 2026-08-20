import { createMarketServer } from './routes.js'

export const name = 'dsh-plugin-market'

function argvProfile() {
  const argv = process.argv
  const flag = argv.indexOf('--profile')
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith('-')) {
    return argv[flag + 1]
  }
  return undefined
}

export function apply(ctx, config) {
  ctx.inject(['webServer', 'loader'], (hostCtx) => {
    const resolved = {
      profile: (config && config.profile) ?? argvProfile() ?? 'web',
    }
    hostCtx.effect(() => createMarketServer(hostCtx, resolved), 'dsh-plugin-market: http routes')
  })
}
