/**
 * net — 出站 HTTP 的唯一出口（单一职责）。
 *
 * 正式插件跑在完整 Node 里，可用全局 fetch。为了"别人也能用"，这里补上
 * 代理感知：Node 全局 fetch 忽略 HTTP(S)_PROXY，而 undici 的 EnvHttpProxyAgent
 * 会读取并遵守它（本机 schannel 缺凭据、或只有本地代理出网的机器都能受益）。
 *
 * 策略：无代理 → 全局 fetch；有代理且 undici 可导入 → undici fetch + 显式 agent；
 * undici 不可用 → 退回全局 fetch（宁可用直连也不崩）。
 */

let undiciMod = null
let undiciAgent = null
let undiciResolved = false

function pickProxy(raw) {
  return raw === undefined || raw.trim() === '' ? null : raw.trim()
}

/** 本进程应使用的代理（若配置了）。规则同 undici：小写优先，https 回退 http。 */
export function configuredProxy() {
  const https = pickProxy(process.env.https_proxy ?? process.env.HTTPS_PROXY)
  return https ?? pickProxy(process.env.http_proxy ?? process.env.HTTP_PROXY)
}

async function ensureUndici() {
  if (undiciResolved) return undiciMod
  undiciResolved = true
  try {
    const mod = await import('undici')
    if (typeof mod.fetch === 'function' && typeof mod.EnvHttpProxyAgent === 'function') {
      undiciMod = mod
    }
  } catch {
    undiciMod = null
  }
  return undiciMod
}

/**
 * 抓取一个 URL，返回 Result<{ statusCode, body }>。
 * @param {string} url
 * @param {object} [init] 透传给 fetch 的选项（headers / signal 等）
 * @param {number} [timeoutMs] 超时毫秒（0 表示不设）
 */
export async function marketFetch(url, init, timeoutMs = 0) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer = null
  if (controller && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }
  const signal = controller ? controller.signal : undefined
  const mergedInit = { ...(init ?? {}) }
  if (signal !== undefined && mergedInit.signal === undefined) mergedInit.signal = signal

  try {
    let response
    if (configuredProxy() === null) {
      response = await fetch(url, mergedInit)
    } else {
      const mod = await ensureUndici()
      if (mod === null) {
        response = await fetch(url, mergedInit)
      } else {
        if (undiciAgent === null) undiciAgent = new mod.EnvHttpProxyAgent()
        response = await mod.fetch(url, { ...mergedInit, dispatcher: undiciAgent })
      }
    }
    const body = await response.text()
    const headers = {}
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((v, k) => { headers[k] = v })
    }
    return { ok: true, value: { statusCode: response.status, body, headers } }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const timedOut = timer !== null && controller && controller.signal.aborted && reason !== ''
    return { ok: false, error: { code: 'NETWORK', message: timedOut ? `请求超时：${reason}` : `网络请求失败：${reason}` } }
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

/**
 * 抓取并解析 JSON，返回 Result<parsed>。非 2xx / 解析失败都归为错误 Result。
 * @param {string} url
 * @param {object} [headers] 附加请求头
 * @param {number} [timeoutMs]
 */
export async function fetchJson(url, headers, timeoutMs = 15000) {
  const mergedHeaders = {
    'accept': 'application/json',
    'user-agent': 'dsh-plugin-market',
    ...(headers ?? {}),
  }
  const result = await marketFetch(url, { headers: mergedHeaders }, timeoutMs)
  if (!result.ok) return result
  const { statusCode, body } = result.value
  if (statusCode !== 200) {
    return {
      ok: false,
      error: {
        code: statusCode === 403 || statusCode === 429 ? 'RATE_LIMITED' : 'HTTP_STATUS',
        message: `数据源返回 ${statusCode}`,
        statusCode,
      },
    }
  }
  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return { ok: false, error: { code: 'BAD_BODY', message: '数据源返回体无法解析为 JSON' } }
  }
}
