import { SHAPE } from './shape.js'

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

function validSubpath(subpath) {
  if (!/^[A-Za-z0-9_./-]+$/.test(subpath)) return false
  return subpath.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

// 从 curated 的 url 解析 repo + 子目录。用 URL 标准解析（而非抓取字符串）：
// pathname 形如 /owner/repo 或 /owner/repo/tree/<branch>/<subpath>。monorepo 子目录插件
// 用 /tree/ 后缀链接，url 才是子目录完整路径的权威来源；name 里的 `#` 只是短标识，不可靠。
export function parseSourceUrl(url) {
  let parsed
  try {
    parsed = new URL(typeof url === 'string' ? url : '')
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return null
  const segments = parsed.pathname.split('/').filter((s) => s !== '')
  if (segments.length < 2) return null
  const repo = `${segments[0]}/${segments[1]}`
  if (!REPO_RE.test(repo)) return null
  if (segments.length === 2) return { repo, subpath: null }
  // /tree/<branch>/<subpath>：segments[2] 必须是 tree，之后第一个是 branch，其余是子目录。
  if (segments[2] === 'tree' && segments.length >= 4) {
    const subpath = segments.slice(4).join('/')
    if (subpath === '') return { repo, subpath: null }
    return validSubpath(subpath) ? { repo, subpath } : null
  }
  return null
}

// 条目显示名：name 是身份标识，对 monorepo 条目是复合形 `repo#path/to/plugin`；
// 卡片标题只显示插件自己的名字（# 后最后一段），仓库名交给 byline。
export function pluginName(name) {
  const hash = name.indexOf('#')
  if (hash === -1) return name
  const segments = name.slice(hash + 1).split('/').filter((s) => s !== '')
  return segments.length > 0 ? segments[segments.length - 1] : name.slice(0, hash)
}

// 从 curated 条目推导安装源位置（repo + 可选子目录）。
function repoLocation(name, owner, url) {
  const source = parseSourceUrl(url)
  if (source !== null) return source
  // 兜底：url 缺失或非 GitHub 时，用 owner + name（name 可能带 `#`，取 `#` 前部分）。
  if (owner === '' || name === '') return null
  const hash = name.indexOf('#')
  return { repo: `${owner}/${hash >= 0 ? name.slice(0, hash) : name}`, subpath: null }
}

export function fromCurated(entry) {
  if (!entry || typeof entry !== 'object') return null
  const rawName = typeof entry.name === 'string' ? entry.name : ''
  const owner = typeof entry.owner === 'string' ? entry.owner : ''
  const url = typeof entry.url === 'string' ? entry.url : ''

  const loc = repoLocation(rawName, owner, url)
  if (loc === null) return null

  const fullName = loc.repo.toLowerCase()
  const subpath = loc.subpath ?? ''
  // 条目唯一标识：普通条目 = owner/repo；monorepo 子目录 = owner/repo#path:/subpath（pnpm 语法）。
  const id = subpath !== '' ? `${fullName}#path:/${subpath.toLowerCase()}` : fullName

  const description = entry.description && typeof entry.description === 'object'
    ? (typeof entry.description.zh === 'string' ? entry.description.zh
      : typeof entry.description.en === 'string' ? entry.description.en : '')
    : typeof entry.description === 'string' ? entry.description : ''

  return {
    id,
    fullName,
    subpath,
    name: rawName,
    displayName: pluginName(rawName),
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
  const name = typeof repo.name === 'string' ? repo.name : (parts[1] || fullName)
  return {
    id: fullName.toLowerCase(),
    fullName: fullName.toLowerCase(),
    subpath: '',
    name,
    displayName: name,
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

// curated（bundle）+ topic 识别结果按形态合并。bundles 去重按 id（区分 monorepo 兄弟子目录）。
export function mergeShapes(curated, topicBuckets) {
  const buckets = topicBuckets && typeof topicBuckets === 'object' ? topicBuckets : {}
  const seen = new Set()
  const bundles = []
  for (const entry of curated) {
    if (!entry || typeof entry.id !== 'string') continue
    seen.add(entry.id)
    bundles.push(entry)
  }
  for (const entry of (buckets.bundle ?? [])) {
    if (!entry || typeof entry.id !== 'string') continue
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    bundles.push(entry)
  }
  return {
    bundles,
    skills: (buckets.skill ?? []).filter((e) => e && typeof e.id === 'string'),
    presets: (buckets.preset ?? []).filter((e) => e && typeof e.id === 'string'),
    others: (buckets.other ?? []).filter((e) => e && typeof e.id === 'string'),
  }
}
