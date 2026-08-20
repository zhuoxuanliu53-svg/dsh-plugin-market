let undiciMod = null
let undiciAgent = null
let undiciResolved = false

function pickProxy(raw) {
  return raw === undefined || raw.trim() === '' ? null : raw.trim()
}

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
