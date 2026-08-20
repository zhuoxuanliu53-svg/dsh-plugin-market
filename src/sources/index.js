import { fetchCurated } from './curated.js'
import { fetchGithubTopic } from './github-topic.js'
import { mergeShapes } from '../entities.js'

export async function fetchAllSources(opts = {}) {
  const token = typeof opts.token === 'string' ? opts.token : ''
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000
  const cacheDir = typeof opts.cacheDir === 'string' ? opts.cacheDir : ''
  const warnings = []

  const curatedRes = await fetchCurated(timeoutMs, cacheDir)
  const githubRes = await fetchGithubTopic(token, timeoutMs, cacheDir)

  const curated = curatedRes.ok ? curatedRes.value.plugins : []
  const topicBuckets = githubRes.ok ? githubRes.value : null

  if (!curatedRes.ok) warnings.push(`curated 源失败：${curatedRes.error.message}`)
  if (!githubRes.ok) {
    warnings.push(`GitHub topic 源失败：${githubRes.error.message}`)
  } else if (Array.isArray(githubRes.value.failures) && githubRes.value.failures.length > 0) {
    const n = githubRes.value.failures.length
    const sample = githubRes.value.failures.slice(0, 5).join(', ')
    warnings.push(`GitHub topic 形态识别失败 ${n} 个${n > 5 ? `（示例：${sample}…）` : `：${sample}`}`)
  }

  // 两个源都失败：报错（附 warning 明细）。
  if (!curatedRes.ok && !githubRes.ok) {
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: `两个数据源都不可用：${warnings.join('；')}`,
        warnings,
      },
    }
  }

  const shapes = mergeShapes(curated, topicBuckets)
  // 主列表 = bundle + skill + preset（「其他」不主动展示）。
  const merged = [...shapes.bundles, ...shapes.skills, ...shapes.presets]

  return {
    ok: true,
    value: {
      merged,
      bundles: shapes.bundles,
      skills: shapes.skills,
      presets: shapes.presets,
      others: shapes.others,
      curated,
      fetchedAt: Date.now(),
      warnings,
      updated: curatedRes.ok ? curatedRes.value.updated : '',
    },
  }
}
