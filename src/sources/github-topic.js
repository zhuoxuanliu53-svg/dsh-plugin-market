/**
 * github-topic — 辅助数据源：GitHub Search API 的 topic:dsh-plugin。
 *
 * 低频补充：未认证限流 10 次/分，故缓存 TTL 较长（30 分钟），并在限流时
 * 明确报错而不是静默。可选 PAT token 走认证头提限（30 次/分）。
 */

import { fetchJson } from '../net.js'
import { fromGithub } from '../entities.js'

const TOPIC = 'dsh-plugin'
const PER_PAGE = 100
const MAX_PAGES = 2 // 最多 2 页（200 条），超出部分视为长尾不抓
const CACHE_TTL = 30 * 60 * 1000 // 低频源：30 分钟

let cache = { at: 0, plugins: null }

/**
 * 抓取 GitHub topic 仓库列表，返回 Result<{ plugins }>。
 * @param {string} [token] 可选 PAT（提限用）
 * @param {number} [timeoutMs]
 */
export async function fetchGithubTopic(token = '', timeoutMs = 15000) {
  const now = Date.now()
  if (cache.plugins !== null && now - cache.at < CACHE_TTL) {
    return { ok: true, value: { plugins: cache.plugins } }
  }

  const headers = { 'accept': 'application/vnd.github+json' }
  if (token !== '') headers['authorization'] = `Bearer ${token}`

  const all = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`
    const result = await fetchJson(url, headers, timeoutMs)
    if (!result.ok) {
      // 限流时保留已有缓存（若有），否则如实返回错误。
      if (result.error.code === 'RATE_LIMITED' && cache.plugins !== null) {
        return { ok: true, value: { plugins: cache.plugins, rateLimited: true } }
      }
      return result
    }
    const items = Array.isArray(result.value.items) ? result.value.items : []
    all.push(...items)
    if (items.length < PER_PAGE) break
  }

  const plugins = all.map(fromGithub).filter(Boolean)
  cache = { at: Date.now(), plugins }
  return { ok: true, value: { plugins } }
}
