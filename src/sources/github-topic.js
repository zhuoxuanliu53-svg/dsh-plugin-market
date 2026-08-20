import { fetchJson } from '../net.js'
import { fromGithub } from '../entities.js'
import { detectShape, SHAPE } from '../shape.js'
import { readJsonFile, writeJsonFile } from '../cache.js'
import { join } from 'node:path'

const TOPIC = 'dsh-plugin'
const PER_PAGE = 100
const MAX_PAGES = 2 // 前 200（star 排序），形态识别后分桶，超出视为长尾不抓
const CACHE_TTL = 60 * 60 * 1000 // 低频源：1 小时
const SHAPE_CONCURRENCY = 5

let cache = { at: 0, buckets: null }

function emptyBuckets() {
  return { bundle: [], skill: [], preset: [], other: [] }
}

// 识别大面积失败（限流/网络）时是否应保留上次缓存：失败率 ≥ 50% 且确有旧缓存。
export function keepLastCache(failureCount, total, hasCache) {
  return hasCache && failureCount / Math.max(1, total) >= 0.5
}

function restore(cacheDir) {
  if (cacheDir === undefined || cacheDir === '' || cache.buckets !== null) return
  const cached = readJsonFile(join(cacheDir, 'topic.json'))
  if (cached && typeof cached === 'object' && cached.buckets && typeof cached.at === 'number') {
    cache = { at: cached.at, buckets: cached.buckets }
  }
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

export async function fetchGithubTopic(token = '', timeoutMs = 15000, cacheDir = '') {
  restore(cacheDir)

  const now = Date.now()
  if (cache.buckets !== null && now - cache.at < CACHE_TTL) {
    return { ok: true, value: { ...cache.buckets, rateLimited: false, failures: [] } }
  }

  const headers = { 'accept': 'application/vnd.github+json' }
  if (token !== '') headers['authorization'] = `Bearer ${token}`

  const all = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/search/repositories?q=topic:${TOPIC}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`
    const result = await fetchJson(url, headers, timeoutMs)
    if (!result.ok) {
      if (result.error.code === 'RATE_LIMITED' && cache.buckets !== null) {
        return { ok: true, value: { ...cache.buckets, rateLimited: true, failures: [] } }
      }
      return result
    }
    const items = Array.isArray(result.value.items) ? result.value.items : []
    all.push(...items)
    if (items.length < PER_PAGE) break
  }

  const shapes = await mapLimit(all, SHAPE_CONCURRENCY, (repo) => detectShape(repo, token, timeoutMs))

  const buckets = emptyBuckets()
  const failures = []
  for (let i = 0; i < all.length; i++) {
    const shapeRes = shapes[i]
    if (!shapeRes || !shapeRes.ok) {
      failures.push(all[i] && all[i].full_name ? all[i].full_name : String(i))
      continue
    }
    const entry = fromGithub(all[i], shapeRes.value)
    if (!entry) continue
    const target = buckets[entry.shape] ? entry.shape : SHAPE.OTHER
    buckets[target].push(entry)
  }

  // 识别大面积失败（限流/网络）时，保留上次确认有效的缓存，避免 topic 列表被清空。
  if (keepLastCache(failures.length, all.length, cache.buckets !== null)) {
    return { ok: true, value: { ...cache.buckets, rateLimited: true, failures } }
  }

  cache = { at: Date.now(), buckets }
  if (cacheDir !== '') writeJsonFile(join(cacheDir, 'topic.json'), cache)
  return { ok: true, value: { ...buckets, rateLimited: false, failures } }
}
