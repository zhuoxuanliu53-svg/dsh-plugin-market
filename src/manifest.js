import { err, ok, E } from './result.js'

// 纯文本清单 v3：一行一个条目，方便评论区直接粘贴。
//   bundle:  直接写 spec（npm 名 / github:owner/repo / @scope/name / github:owner/repo#path:...）
//   skill:   skill:github:owner/repo
//   preset:  preset:github:owner/repo
//   # 开头的行与空行忽略。

function fullNameFromSpec(spec) {
  const m = /^github:([^#]+)/.exec(spec)
  return m ? m[1].toLowerCase() : ''
}

export function buildManifest(state) {
  const installed = state && state.installed && typeof state.installed === 'object' ? state.installed : {}
  const lines = []
  let count = 0
  for (const [id, rec] of Object.entries(installed)) {
    if (!rec || typeof rec !== 'object') continue
    // installed 的 key 是条目 id，可能带 #path:/ 子目录后缀；导出/回退用干净的 owner/repo。
    const fullName = String(id).split('#')[0]
    const shape = rec.shape === 'skill' ? 'skill' : (rec.shape === 'preset' ? 'preset' : 'bundle')
    if (shape === 'bundle') {
      lines.push((typeof rec.spec === 'string' && rec.spec !== '') ? rec.spec : `github:${fullName}`)
    } else {
      lines.push(`${shape}:github:${fullName}`)
    }
    count++
  }
  lines.sort()
  return [`# dsh-plugin-market v3 · ${count} items`, ...lines].join('\n') + '\n'
}

export function parseManifest(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return err(E.INVALID_ARG, '清单为空')
  }
  const items = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const skillM = /^skill:(.+)$/.exec(line)
    const presetM = /^preset:(.+)$/.exec(line)
    if (skillM || presetM) {
      const shape = skillM ? 'skill' : 'preset'
      const target = (skillM || presetM)[1].trim()
      const fullName = fullNameFromSpec(target) || target.replace(/^github:/, '').toLowerCase()
      if (fullName === '') continue
      items.push({ shape, spec: `github:${fullName}`, fullName })
      continue
    }
    const spec = line
    items.push({ shape: 'bundle', spec, fullName: fullNameFromSpec(spec) })
  }
  if (items.length === 0) {
    return err(E.INVALID_ARG, '清单中没有任何插件')
  }
  return ok({ items })
}
