import { fetchJson } from '../net.js'
import { fromGithub } from '../entities.js'
import { detectShape, SHAPE } from '../shape.js'

const TOPIC = 'dsh-plugin'
const PER_PAGE = 100
const MAX_PAGES = 2 // 前 200（star 排序），形态识别后分桶，超出视为长尾不抓
const CACHE_TTL = 60 * 60 * 1000 // 低频源：1 小时
const SHAPE_CONCURRENCY = 5

let cache = { at: 0, buckets: null }

function emptyBuckets() {
  return { bundle: [], skill: [], preset: [], other: [] }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export async function fetchGithubTopic(token = '', timeoutMs = 15000) {
  const now = Date.now()
  if (cache.buckets !== null && now - cache.at < CACHE_TTL) {
    return { ok: true, value: { ...cache.buckets, rateLimited: false } }
  }

  const headers = { 'accept': 'application/vnd.github+json' }
  if (token !== '') headers['authorization'] = `Bearer ${token}`

  const all = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`
    const result = await fetchJson(url, headers, timeoutMs)
    if (!result.ok) {
      if (result.error.code === 'RATE_LIMITED' && cache.buckets !== null) {
        return { ok: true, value: { ...cache.buckets, rateLimited: true } }
      }
      return result
    }
    const items = Array.isArray(result.value.items) ? result.value.items : []
    all.push(...items)
    if (items.length < PER_PAGE) break
  }

  const shapes = await mapLimit(all, SHAPE_CONCURRENCY, (repo) => detectShape(repo, token, timeoutMs))

  const buckets = emptyBuckets()
  for (let i = 0; i < all.length; i++) {
    const entry = fromGithub(all[i], shapes[i] || SHAPE.OTHER)
    if (!entry) continue
    const target = buckets[entry.shape] ? entry.shape : SHAPE.OTHER
    buckets[target].push(entry)
  }

  cache = { at: Date.now(), buckets }
  return { ok: true, value: { ...buckets, rateLimited: false } }
}
