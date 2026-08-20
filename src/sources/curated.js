/**
 * curated — 主数据源：awesome-dsh-plugin.com 的 curated registry。
 *
 * 每次调用都向源站校验新鲜度（ETag → 304 只拿 0 字节），失败则如实报错，
 * 绝不拿过期快照糊弄。只在内存里记一份「上次被源站确认有效」的数据。
 */

import { marketFetch } from '../net.js'
import { fromCurated } from '../entities.js'

const REGISTRY_URL = process.env.DSHM_REGISTRY_URL ?? 'https://awesome-dsh-plugin.com/plugins.json'

// 上次被源站确认有效的数据 + 校验器（etag）。只在内存，不做磁盘缓存。
let served = { etag: null, data: null }

/**
 * 抓取并解析 curated registry，返回 Result<{ plugins, updated, count }>。
 * @param {number} [timeoutMs]
 */
export async function fetchCurated(timeoutMs = 15000) {
  const headers = {}
  if (served.etag !== null) headers['if-none-match'] = served.etag

  const raw = await marketFetch(REGISTRY_URL, { headers }, timeoutMs)
  if (!raw.ok) return raw

  const { statusCode, body, headers: respHeaders } = raw.value

  // 304：源站确认缓存仍是最新，直接返回上次数据。
  if (statusCode === 304 && served.data !== null) {
    return { ok: true, value: served.data }
  }

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

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, error: { code: 'BAD_BODY', message: 'curated registry 无法解析为 JSON' } }
  }

  const plugins = (Array.isArray(parsed.plugins) ? parsed.plugins : [])
    .map(fromCurated)
    .filter(Boolean)

  const value = {
    plugins,
    updated: typeof parsed.updated === 'string' ? parsed.updated : '',
    count: plugins.length,
  }

  // 只有 200 且解析成功才更新缓存与 etag。
  served = {
    etag: respHeaders && (respHeaders.etag || respHeaders['last-modified']) ? (respHeaders.etag || respHeaders['last-modified']) : null,
    data: value,
  }
  return { ok: true, value }
}
