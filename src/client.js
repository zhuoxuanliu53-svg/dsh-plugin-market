// 插件市场 —— Client 半区
// 该文件内容即 cordis_define 的 code.client 字段（纯 JS function body，返回 Cordis Plugin）。
// 纯 React.createElement，无 JSX/TS/import；样式使用 DSW 主题 token。
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const TOPIC = 'dsh-plugin'

    ctx.effect(() => styles.insert(`
.pm-root{font-family:inherit;color:var(--dsw-alias-label-primary);box-sizing:border-box}
.pm-root *{box-sizing:border-box}
.pm-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.pm-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.pm-source{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pm-link{color:var(--dsw-alias-brand-primary);text-decoration:none}
.pm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.pm-input{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 8px;font-size:13px;min-width:180px}
.pm-select{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 6px;font-size:12px}
.pm-btn{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);padding:4px 10px;font-size:12px;cursor:pointer}
.pm-btn:hover{border-color:var(--dsw-alias-brand-primary)}
.pm-btn.active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.pm-btn:disabled{opacity:.55;cursor:default}
.pm-tags-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
.pm-tag{font-size:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:1px 8px;line-height:16px;cursor:pointer}
.pm-tag.active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.pm-list{display:flex;flex-direction:column;gap:8px}
.pm-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px}
.pm-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.pm-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);text-decoration:none}
.pm-name:hover{color:var(--dsw-alias-brand-primary)}
.pm-stats{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.pm-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pm-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.pm-card .pm-tag{cursor:default}
.pm-actions{display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap}
.pm-badge{font-size:10px;border-radius:10px;padding:0 8px;line-height:16px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.pm-badge.installed{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.pm-badge.update{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
.pm-cmd{font-size:11px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px 8px;margin-top:6px;white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-secondary)}
.pm-msg{font-size:11px;margin-top:6px}
.pm-err{color:var(--dsw-alias-state-error-primary);font-size:12px}
.pm-ok{color:var(--dsw-alias-state-success-primary)}
.pm-warn{color:var(--dsw-alias-state-warn-primary)}
.pm-empty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:16px 0;text-align:center}
.pm-hint{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:8px;text-align:center}
.pm-count{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pm-modal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
.pm-modal-box{background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;max-width:640px;width:92%;max-height:80vh;overflow:auto;display:flex;flex-direction:column;gap:10px}
.pm-modal-title{font-size:14px;font-weight:600}
.pm-textarea{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-primary);padding:6px 8px;font-size:12px;min-height:120px;width:100%;font-family:monospace;resize:vertical}
.pm-modal-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pm-list-outline{margin:0;padding:0 0 0 18px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.pm-auto{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}
`))

    const el = React.createElement

    const SORTS = [
      { key: 'created-desc', label: '发布时间：最新优先' },
      { key: 'created-asc', label: '发布时间：最早优先' },
      { key: 'stars-desc', label: '热门程度：星标最多' },
      { key: 'stars-asc', label: '热门程度：星标最少' },
      { key: 'forks-desc', label: 'Fork 最多' },
      { key: 'updated-desc', label: '最近更新' },
      { key: 'name-asc', label: '名称 A-Z' },
      { key: 'update-first', label: '有更新优先' },
    ]

    function MarketApp(props) {
      const variant = props && props.variant === 'page' ? 'page' : 'card'
      const [state, setState] = React.useState({ phase: 'loading', plugins: [], total: 0, error: null })
      const [follows, setFollows] = React.useState([])
      const [installed, setInstalled] = React.useState({})
      const [autoResults, setAutoResults] = React.useState({})
      const [query, setQuery] = React.useState('')
      const [sortKey, setSortKey] = React.useState('created-desc')
      const [tag, setTag] = React.useState('')
      const [onlyFollows, setOnlyFollows] = React.useState(false)
      const [onlyInstalled, setOnlyInstalled] = React.useState(false)
      const [ops, setOps] = React.useState({}) // fullName -> {running: 'install'|'update'|'remove', result}
      const [modal, setModal] = React.useState('') // '' | 'export' | 'import'
      const [exportState, setExportState] = React.useState({ text: '', path: '', error: null })
      const [importText, setImportText] = React.useState('')
      const [importPreview, setImportPreview] = React.useState(null)
      const [importResults, setImportResults] = React.useState(null)
      const [importBusy, setImportBusy] = React.useState(false)

      const refresh = (force) => {
        setState((s) => ({ plugins: s.plugins, total: s.total, phase: s.plugins.length ? s.phase : 'loading', error: null }))
        host.call('market/list', { refresh: !!force }).then((r) => {
          if (r && r.error) {
            setState({ plugins: [], total: 0, phase: 'error', error: r.error })
            return
          }
          if (r && Array.isArray(r.plugins)) {
            setState({ plugins: r.plugins, total: typeof r.total === 'number' ? r.total : r.plugins.length, phase: 'ready', error: null })
            if (Array.isArray(r.follows)) setFollows(r.follows)
            if (r.installed && typeof r.installed === 'object') setInstalled(r.installed)
            if (r.autoUpdateResults && typeof r.autoUpdateResults === 'object') setAutoResults(r.autoUpdateResults)
          } else {
            setState({ plugins: [], total: 0, phase: 'error', error: { message: '无响应' } })
          }
        }).catch((e) => {
          setState({ plugins: [], total: 0, phase: 'error', error: { message: String(e && e.message || e) } })
        })
      }

      React.useEffect(() => {
        refresh(false)
      }, [])

      const toggleFollow = (name) => {
        host.call('market/toggleFollow', { fullName: name }).then((r) => {
          if (r && Array.isArray(r.follows)) setFollows(r.follows)
        }).catch(() => {})
      }

      const setOp = (name, patch) => {
        setOps((m) => { const n = Object.assign({}, m); n[name] = Object.assign({}, m[name], patch); return n })
      }

      const runOp = (name, method, label) => {
        const cur = ops[name]
        if (cur && cur.running) return
        setOp(name, { running: label, result: null })
        host.call(method, { fullName: name }).then((r) => {
          setOp(name, { running: null, result: r || { status: 'failed', message: '无响应' } })
          if (method === 'market/install' || method === 'market/remove' || method === 'market/update') refresh(false)
        }).catch((e) => {
          setOp(name, { running: null, result: { status: 'failed', message: String(e && e.message || e) } })
        })
      }

      const toggleAutoUpdate = (name) => {
        host.call('market/toggleAutoUpdate', { fullName: name }).then((r) => {
          if (r && r.installed && typeof r.installed === 'object') setInstalled(r.installed)
        }).catch(() => {})
      }

      const updateAll = () => {
        host.call('market/updateAll').then((r) => {
          if (r && r.results && typeof r.results === 'object') setAutoResults(r.results)
          refresh(false)
        }).catch(() => {})
      }

      const doExport = () => {
        setModal('export')
        setExportState({ text: '生成中…', path: '', error: null })
        host.call('market/export').then((r) => {
          setExportState(r || { text: '', path: '', error: '无响应' })
        }).catch((e) => {
          setExportState({ text: '', path: '', error: String(e && e.message || e) })
        })
      }

      const doImportPreview = () => {
        setImportBusy(true)
        setImportPreview(null)
        setImportResults(null)
        host.call('market/importPreview', { manifestText: importText }).then((r) => {
          setImportPreview(r || { ok: false, errors: ['无响应'] })
        }).catch((e) => {
          setImportPreview({ ok: false, plugins: [], commands: [], errors: [String(e && e.message || e)] })
        }).finally(() => setImportBusy(false))
      }

      const doImportApply = () => {
        setImportBusy(true)
        host.call('market/importApply', { manifestText: importText }).then((r) => {
          setImportResults(r || { results: {}, errors: ['无响应'] })
          refresh(false)
        }).catch((e) => {
          setImportResults({ results: {}, errors: [String(e && e.message || e)] })
        }).finally(() => setImportBusy(false))
      }

      const followSet = {}
      for (const f of follows) followSet[f] = true

      const tagCounts = {}
      for (const p of state.plugins) {
        for (const t of p.topics) {
          if (t === TOPIC) continue
          if (tagCounts[t] === undefined) tagCounts[t] = 0
          tagCounts[t]++
        }
      }
      const tagNames = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]).slice(0, 12)

      const hasUpdate = (p) => {
        const rec = installed[p.fullName]
        if (!rec || !rec.installedAt || !p.pushedAt) return false
        const pushed = new Date(p.pushedAt).getTime()
        return pushed > rec.installedAt
      }

      const q = query.trim().toLowerCase()
      let list = state.plugins.filter((p) => {
        if (q) {
          const hay = (p.fullName + ' ' + (p.description || '') + ' ' + p.topics.join(' ')).toLowerCase()
          if (hay.indexOf(q) < 0) return false
        }
        if (tag && p.topics.indexOf(tag) < 0) return false
        if (onlyFollows && !followSet[p.fullName]) return false
        if (onlyInstalled && !installed[p.fullName]) return false
        return true
      })
      const cmp = {
        'created-desc': (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
        'created-asc': (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
        'stars-desc': (a, b) => b.stars - a.stars,
        'stars-asc': (a, b) => a.stars - b.stars,
        'forks-desc': (a, b) => b.forks - a.forks,
        'updated-desc': (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
        'name-asc': (a, b) => a.fullName.localeCompare(b.fullName),
        'update-first': (a, b) => {
          const ua = hasUpdate(a) ? 1 : 0
          const ub = hasUpdate(b) ? 1 : 0
          if (ua !== ub) return ub - ua
          return (b.createdAt || '').localeCompare(a.createdAt || '')
        },
      }
      list = list.sort(cmp[sortKey] || cmp['created-desc'])
      if (variant === 'card') list = list.slice(0, 8)

      const fmtDay = (iso) => (iso && iso.length >= 10) ? iso.slice(0, 10) : ''
      const fmtTime = (t) => t ? new Date(t).toLocaleDateString() : ''

      const renderCard = (p) => {
        const followed = !!followSet[p.fullName]
        const rec = installed[p.fullName]
        const op = ops[p.fullName]
        const tags = p.topics.filter((t) => t !== 'dsh-plugin').slice(0, 4)
        const date = fmtDay(p.createdAt)
        const upd = hasUpdate(p)
        const lastAuto = autoResults[p.fullName]

        let primaryLabel = '安装'
        let primaryCls = 'pm-btn'
        const running = op && op.running
        if (running) { primaryLabel = running === 'install' ? '安装中…' : running === 'update' ? '更新中…' : '卸载中…' }
        else if (rec) {
          primaryLabel = upd ? '更新' : '已安装'
          primaryCls = upd ? 'pm-btn active' : 'pm-btn active'
        }
        const opResult = op && op.result

        return el('div', { className: 'pm-card', key: p.fullName },
          el('div', { className: 'pm-card-head' },
            el('a', { className: 'pm-name', href: p.url, target: '_blank', rel: 'noreferrer' }, p.fullName),
            el('span', { className: 'pm-stats' }, '★ ' + p.stars + ' · ⑂ ' + p.forks + ' · ' + date),
          ),
          el('div', { className: 'pm-actions' },
            rec
              ? el('span', { className: 'pm-badge' + (upd ? ' update' : ' installed') }, upd ? '有更新' : '已安装')
              : el('span', { className: 'pm-badge' }, '未安装'),
            p.language ? el('span', { className: 'pm-stats' }, p.language) : null,
          ),
          p.description ? el('div', { className: 'pm-desc' }, p.description) : null,
          tags.length
            ? el('div', { className: 'pm-tags' }, tags.map((t) => el('span', { className: 'pm-tag', key: t }, t)))
            : null,
          el('div', { className: 'pm-actions' },
            el('button', { className: 'pm-btn' + (followed ? ' active' : ''), onClick: () => toggleFollow(p.fullName) }, followed ? '已关注' : '关注'),
            rec
              ? el('button', { className: 'pm-btn', disabled: !!running, onClick: () => runOp(p.fullName, 'market/update', 'update') }, '更新')
              : el('button', { className: primaryCls, disabled: !!running, onClick: () => runOp(p.fullName, 'market/install', 'install') }, primaryLabel),
            rec
              ? el('button', { className: 'pm-btn', disabled: !!running, onClick: () => runOp(p.fullName, 'market/remove', 'remove') }, '卸载')
              : null,
            rec
              ? el('label', { className: 'pm-auto' },
                  el('input', { type: 'checkbox', checked: !!rec.autoUpdate, onChange: () => toggleAutoUpdate(p.fullName) }),
                  '自动更新')
              : null,
          ),
          opResult && opResult.command
            ? el('div', { className: 'pm-cmd' }, '$ ' + opResult.command)
            : null,
          opResult && opResult.message
            ? el('div', { className: 'pm-msg ' + (opResult.status === 'ok' ? 'pm-ok' : 'pm-err') }, opResult.message)
            : null,
          lastAuto && lastAuto.message
            ? el('div', { className: 'pm-msg ' + (lastAuto.status === 'ok' ? 'pm-ok' : 'pm-warn') }, '自动更新：' + lastAuto.message)
            : null,
          rec && rec.installedAt
            ? el('div', { className: 'pm-stats', style: { marginTop: '4px' } }, '安装于 ' + fmtTime(rec.installedAt))
            : null,
        )
      }

      const renderExportModal = () => {
        return el('div', { className: 'pm-modal', onClick: () => setModal('') },
          el('div', { className: 'pm-modal-box', onClick: (e) => e.stopPropagation() },
            el('div', { className: 'pm-modal-title' }, '导出插件名单（组合包）'),
            exportState.error
              ? el('div', { className: 'pm-err' }, '导出失败：' + exportState.error)
              : null,
            exportState.path
              ? el('div', { className: 'pm-ok' }, '已写入：' + exportState.path)
              : null,
            el('textarea', { className: 'pm-textarea', readOnly: true, value: exportState.text, style: { minHeight: '200px' } }),
            el('div', { className: 'pm-modal-actions' },
              el('span', { className: 'pm-stats' }, '将 JSON 发给他人，或用其导入本市场以复刻相同配置。commands 也可直接在终端执行。'),
              el('button', { className: 'pm-btn', onClick: () => setModal('') }, '关闭'),
            ),
          ),
        )
      }

      const renderImportModal = () => {
        const preview = importPreview
        return el('div', { className: 'pm-modal', onClick: () => setModal('') },
          el('div', { className: 'pm-modal-box', onClick: (e) => e.stopPropagation() },
            el('div', { className: 'pm-modal-title' }, '导入插件名单'),
            el('textarea', { className: 'pm-textarea', placeholder: '粘贴导出的插件名单 JSON…', value: importText, onChange: (e) => setImportText(e.target.value) }),
            el('div', { className: 'pm-modal-actions' },
              el('button', { className: 'pm-btn', disabled: importBusy, onClick: doImportPreview }, '预览'),
              preview && preview.ok
                ? el('button', { className: 'pm-btn active', disabled: importBusy, onClick: doImportApply }, '应用导入')
                : null,
              el('button', { className: 'pm-btn', onClick: () => setModal('') }, '关闭'),
            ),
            preview && !preview.ok
              ? el('div', { className: 'pm-err' }, '预览失败：' + (preview.errors || []).join('；'))
              : null,
            preview && preview.ok
              ? el('div', {},
                  el('div', { className: 'pm-ok' }, '清单有效：' + preview.plugins.length + ' 个插件'),
                  el('ul', { className: 'pm-list-outline' }, preview.plugins.slice(0, 20).map((p) => el('li', { key: p.fullName }, p.fullName + (p.autoUpdate ? '（自动更新）' : '') + (p.followed ? '（关注）' : '')))),
                  preview.commands.length
                    ? el('div', { className: 'pm-cmd' }, preview.commands.slice(0, 10).join('\n') + (preview.commands.length > 10 ? '\n…' : ''))
                    : null,
                )
              : null,
            importResults
              ? el('div', {},
                  (importResults.errors || []).length
                    ? el('div', { className: 'pm-err' }, '导入出错：' + importResults.errors.join('；'))
                    : el('div', { className: 'pm-ok' }, '导入完成'),
                  el('ul', { className: 'pm-list-outline' }, Object.keys(importResults.results || {}).map((k) => {
                    const r = importResults.results[k]
                    return el('li', { key: k }, k + ' → ' + (r.status === 'ok' ? '成功' : r.status === 'requires-manual' ? '需手动执行' : '失败'))
                  })),
                )
              : null,
          ),
        )
      }

      if (state.phase === 'loading') {
        return el('div', { className: 'pm-root' }, '正在从 GitHub 加载插件市场…')
      }
      if (state.phase === 'error') {
        return el('div', { className: 'pm-root' },
          el('div', { className: 'pm-err' }, '无法加载插件列表：' + (state.error && state.error.message || '未知错误')),
          el('div', { className: 'pm-actions' }, el('button', { className: 'pm-btn', onClick: () => refresh(true) }, '重试')),
        )
      }

      return el('div', { className: 'pm-root' },
        el('div', { className: 'pm-head' },
          el('span', { className: 'pm-title' }, '插件市场'),
          el('a', { className: 'pm-link pm-source', href: 'https://github.com/topics/dsh-plugin', target: '_blank', rel: 'noreferrer' }, '来源：GitHub Topic dsh-plugin'),
          el('span', { className: 'pm-count' }, '共 ' + state.total + ' 个插件'),
          el('button', { className: 'pm-btn', onClick: () => refresh(true) }, '刷新'),
          variant === 'page'
            ? el('button', { className: 'pm-btn', onClick: updateAll }, '更新全部')
            : null,
          variant === 'page'
            ? el('button', { className: 'pm-btn', onClick: doExport }, '导出名单')
            : null,
          variant === 'page'
            ? el('button', { className: 'pm-btn', onClick: () => { setImportPreview(null); setImportResults(null); setModal('import') } }, '导入名单')
            : null,
        ),
        el('div', { className: 'pm-toolbar' },
          el('input', { className: 'pm-input', placeholder: '搜索名称或标签…', value: query, onChange: (e) => setQuery(e.target.value) }),
          el('select', { className: 'pm-select', value: sortKey, onChange: (e) => setSortKey(e.target.value) },
            SORTS.map((s) => el('option', { key: s.key, value: s.key }, s.label))),
          el('button', { className: 'pm-btn' + (onlyFollows ? ' active' : ''), onClick: () => setOnlyFollows(!onlyFollows) }, '只看关注' + (follows.length ? '（' + follows.length + '）' : '')),
          el('button', { className: 'pm-btn' + (onlyInstalled ? ' active' : ''), onClick: () => setOnlyInstalled(!onlyInstalled) }, '只看已安装'),
        ),
        variant === 'page' && tagNames.length
          ? el('div', { className: 'pm-tags-row' },
              tagNames.map((t) => el('span', { className: 'pm-tag' + (tag === t ? ' active' : ''), key: t, onClick: () => setTag(tag === t ? '' : t) }, t + ' (' + tagCounts[t] + ')')))
          : null,
        list.length
          ? el('div', { className: 'pm-list' }, list.map(renderCard))
          : el('div', { className: 'pm-empty' }, '没有匹配的插件'),
        variant === 'card'
          ? el('div', { className: 'pm-hint' }, '完整市场：设置 → 插件 → 插件市场（排序、标签筛选、关注、安装/更新/卸载、自动更新、名单导入导出）')
          : null,
        modal === 'export' ? renderExportModal() : null,
        modal === 'import' ? renderImportModal() : null,
      )
    }

    slots.inject('tool.view.cordis', () => slots.register(
      { name: 'tool.view.cordis', key: 'self' },
      () => React.createElement(MarketApp, { variant: 'card' }),
    ))

    slots.inject('settings.plugins.tab', () => slots.register(
      { name: 'settings.plugins.tab', id: 'plugin-market', order: 20, label: '插件市场' },
      () => React.createElement(MarketApp, { variant: 'page' }),
    ))
  },
}
