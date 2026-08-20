/**
 * sources — 双源编排（System）。
 *
 * 拉取 curated（主）与 github-topic（辅），按 fullName 去重合并，
 * 产出单一 PluginEntry 列表，每条带 source 标记供 UI 区分徽标。
 * 单个源失败不阻断另一个：curated 失败时仍返回 github 结果（并附 warning）。
 */

import { fetchCurated } from './curated.js'
import { fetchGithubTopic } from './github-topic.js'
import { mergeSources } from '../entities.js'

/**
 * 拉取并合并两个来源，返回 Result<{ merged, curated, community, fetchedAt, warnings }>。
 * @param {object} [opts] { token?: string, timeoutMs?: number }
 */
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
