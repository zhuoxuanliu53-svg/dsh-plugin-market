import { SHAPE } from './shape.js'

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
    page: typeof entry.page === 'string' ? entry.page : '',
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
    added: typeof entry.added === 'string' ? entry.added : '',
    npm: typeof entry.npm === 'string' ? entry.npm : null,
    install: typeof entry.install === 'string' ? entry.install : '',
    deprecated: !!entry.deprecated,
    replacement: typeof entry.replacement === 'string' ? entry.replacement : '',
    source: 'curated',
    shape: SHAPE.BUNDLE,
  }
}

export function fromGithub(repo, shape = SHAPE.OTHER) {
  if (!repo || typeof repo !== 'object') return null
  const fullName = typeof repo.full_name === 'string' ? repo.full_name : ''
  if (fullName === '') return null
  const parts = fullName.split('/')
  return {
    fullName: fullName.toLowerCase(),
    name: typeof repo.name === 'string' ? repo.name : (parts[1] || fullName),
    owner: repo.owner && typeof repo.owner.login === 'string' ? repo.owner.login : (parts[0] || ''),
    url: typeof repo.html_url === 'string' ? repo.html_url : `https://github.com/${fullName}`,
    page: '',
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
    added: '',
    npm: null,
    install: '',
    deprecated: !!repo.archived,
    replacement: '',
    source: 'github-topic',
    shape,
  }
}

// curated（bundle）+ topic 识别结果按形态合并。bundles 去重；skill/preset/other 来自 topic。
export function mergeShapes(curated, topicBuckets) {
  const buckets = topicBuckets && typeof topicBuckets === 'object' ? topicBuckets : {}
  const seen = new Set()
  const bundles = []
  for (const entry of curated) {
    if (!entry || typeof entry.fullName !== 'string') continue
    seen.add(entry.fullName)
    bundles.push(entry)
  }
  for (const entry of (buckets.bundle ?? [])) {
    if (!entry || typeof entry.fullName !== 'string') continue
    if (seen.has(entry.fullName)) continue
    seen.add(entry.fullName)
    bundles.push(entry)
  }
  return {
    bundles,
    skills: (buckets.skill ?? []).filter((e) => e && typeof e.fullName === 'string'),
    presets: (buckets.preset ?? []).filter((e) => e && typeof e.fullName === 'string'),
    others: (buckets.other ?? []).filter((e) => e && typeof e.fullName === 'string'),
  }
}
