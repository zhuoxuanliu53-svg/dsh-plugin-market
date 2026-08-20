import { fetchCurated } from './curated.js'
import { fetchGithubTopic } from './github-topic.js'
import { mergeSources } from '../entities.js'

export async function fetchAllSources(opts = {}) {
  const token = typeof opts.token === 'string' ? opts.token : ''
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000
  const warnings = []

  const curatedRes = await fetchCurated(timeoutMs)
  const githubRes = await fetchGithubTopic(token, timeoutMs)

  const curated = curatedRes.ok ? curatedRes.value.plugins : []
  const community = githubRes.ok ? githubRes.value.plugins : []

  if (!curatedRes.ok) warnings.push(`curated 源失败：${curatedRes.error.message}`)
  if (!githubRes.ok) warnings.push(`GitHub topic 源失败：${githubRes.error.message}`)

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

  const merged = mergeSources(curated, community)
  return {
    ok: true,
    value: {
      merged,
      curated,
      community,
      fetchedAt: Date.now(),
      warnings,
      updated: curatedRes.ok ? curatedRes.value.updated : '',
    },
  }
}
