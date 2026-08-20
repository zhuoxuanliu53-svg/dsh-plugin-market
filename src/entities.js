/**
 * entities — 纯数据实体与归一化器（ECS 的 E + C）。
 *
 * PluginEntry 是市场里的一条插件，只是字段容器，不含任何行为。
 * 两个来源（curated / github-topic）各自归一化到同一个 PluginEntry 形状，
 * 使上层（排序/筛选/UI）只面对一种实体。
 *
 * Component（可组合的数据面）：
 *   - source 字段即 SourceMeta 的精简表达（来源 + 是否审核 + 原始 URL）
 *   - InstallState / FollowState 由 contracts.js 归一化，这里不重复
 */

/** 把 curated registry 条目归一化为 PluginEntry。 */
export function fromCurated(entry) {
  if (!entry || typeof entry !== 'object') return null
  const name = typeof entry.name === 'string' ? entry.name : ''
  const owner = typeof entry.owner === 'string' ? entry.owner : ''
  const fullName = owner !== '' && name !== '' ? `${owner}/${name}` : ''
  if (fullName === '') return null
  const description = entry.description && typeof entry.description === 'object'
    ? (typeof entry.description.zh === 'string' ? entry.description.zh
      : typeof entry.description.en === 'string' ? entry.description.en : '')
    : typeof entry.description === 'string' ? entry.description : ''
  const url = typeof entry.url === 'string' ? entry.url : `https://github.com/${fullName}`
  return {
    fullName: fullName.toLowerCase(),
    name,
    owner,
    url,
    description,
    stars: typeof entry.stars === 'number' ? entry.stars : 0,
    forks: 0,
    downloads: typeof entry.downloads === 'number' ? entry.downloads : null,
    topics: [],
    category: typeof entry.category === 'string' ? entry.category : '',
    language: '',
    createdAt: '',
    updatedAt: '',
    pushedAt: '',
    npm: typeof entry.npm === 'string' ? entry.npm : null,
    install: typeof entry.install === 'string' ? entry.install : '',
    deprecated: !!entry.deprecated,
    replacement: typeof entry.replacement === 'string' ? entry.replacement : '',
    source: 'curated',
  }
}

/** 把 GitHub Search API 的 repository 归一化为 PluginEntry。 */
export function fromGithub(repo) {
  if (!repo || typeof repo !== 'object') return null
  const fullName = typeof repo.full_name === 'string' ? repo.full_name : ''
  if (fullName === '') return null
  const parts = fullName.split('/')
  return {
    fullName: fullName.toLowerCase(),
    name: typeof repo.name === 'string' ? repo.name : (parts[1] || fullName),
    owner: repo.owner && typeof repo.owner.login === 'string' ? repo.owner.login : (parts[0] || ''),
    url: typeof repo.html_url === 'string' ? repo.html_url : `https://github.com/${fullName}`,
    description: typeof repo.description === 'string' ? repo.description : '',
    stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
    forks: typeof repo.forks_count === 'number' ? repo.forks_count : 0,
    downloads: null,
    topics: Array.isArray(repo.topics) ? repo.topics.filter((t) => typeof t === 'string') : [],
    category: '',
    language: typeof repo.language === 'string' ? repo.language : '',
    createdAt: typeof repo.created_at === 'string' ? repo.created_at : '',
    updatedAt: typeof repo.updated_at === 'string' ? repo.updated_at : '',
    pushedAt: typeof repo.pushed_at === 'string' ? repo.pushed_at : '',
    npm: null,
    install: '',
    deprecated: !!repo.archived,
    replacement: '',
    source: 'github-topic',
  }
}

/**
 * 按 fullName（小写）去重合并两个来源的条目。
 * 规则：curated 在前，github-topic 去重后接在后面；同名时 curated 胜出。
 * @param {Array} curated
 * @param {Array} github
 */
export function mergeSources(curated, github) {
  const seen = new Set()
  const merged = []
  for (const entry of curated) {
    if (!entry || typeof entry.fullName !== 'string') continue
    seen.add(entry.fullName)
    merged.push(entry)
  }
  for (const entry of github) {
    if (!entry || typeof entry.fullName !== 'string') continue
    if (seen.has(entry.fullName)) continue
    seen.add(entry.fullName)
    merged.push(entry)
  }
  return merged
}
