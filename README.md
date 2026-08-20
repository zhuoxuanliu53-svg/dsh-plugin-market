# dsh-plugin-market

A visual plugin marketplace for DeepSeek Harness: discover, search, install, and manage DSH plugins across three plugin shapes.

![version](https://img.shields.io/badge/version-4.0.0-2ea44f) ![license](https://img.shields.io/badge/license-MIT-8ca1af) ![type](https://img.shields.io/badge/type-DSH%20bundle%20plugin-4c6ef5)

`dsh-plugin-market` is a DSH bundle plugin that aggregates plugins from the curated registry [awesome-dsh-plugin](https://awesome-dsh-plugin.com) and, for skill / preset discovery, the GitHub Topic `dsh-plugin`. It offers browsing, search, sorting, following, install / update / remove, auto-update, hot enable / disable, one-click restart, and plain-text manifest export / import.

## Plugin shapes

DSH plugins come in three shapes, each installed differently. The marketplace separates them into tabs:

| Shape | Marker | Installation |
| --- | --- | --- |
| Bundle | `package.json` with `dsh` metadata | `dsh plugin add <spec>` (npm / `github:` / scoped / monorepo `#path:`) |
| Skill | root `SKILL.md` | Copied to `<DSH_HOME>/skills/<name>/` |
| Preset | root `agent.cordis.yml` | Copied to `<DSH_HOME>/.agent-presets/<id>/` |

Repositories that match none of the three shapes are kept in a hidden **Other** bucket — not shown by default, visible only when the tab is opened or searched explicitly.

## Features

### Discovery

- Curated bundle registry (1721 reviewed plugins, 21 categories, bilingual descriptions) plus topic-based shape recognition for skills and presets
- Keyword search (name / description / topics)
- 8 sort options: stars ↑↓, forks, updated, created ↑↓, name, updates first
- Tag filters, follow-only, installed-only
- Shape tabs: Bundle / Skill / Preset / Other (lazy)

### Management

- One-click install, update, remove, and update-all
- Per-plugin auto-update toggle
- One-click self-update for the marketplace itself (Settings → Plugin Market → Update market)
- Hot enable / disable via the profile patch layer (HMR, no restart)
- One-click restart after a fresh bundle install or marketplace update (skills and presets take effect on disk without restart)

### Safety

- Post-install verification (loadable entry / dsh manifest / loader id conflicts), with automatic rollback on failure
- Install whitelist (only registry-identified entries)
- Same-origin checks on mutating endpoints; loopback + origin validation on restart
- Host infrastructure row protection

### Sharing

- Plain-text manifest export (one item per line, paste-ready for comments) and import
- Optional GitHub token (stored in the local profile only, never committed or exported)

## Installation

```sh
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market
```

After installation, refresh the page and open Settings → Plugin Market.

## Data sources

| Source | URL | Purpose | Cache | License |
| --- | --- | --- | --- | --- |
| Curated registry | `https://awesome-dsh-plugin.com/plugins.json` | Bundle plugins (reviewed, shown first) | ETag / 304 | [CC0-1.0](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) |
| GitHub topic | `api.github.com/search/repositories?q=topic:dsh-plugin` | Skill / preset / other discovery (shape-classified, top 200 by stars) | 1-hour TTL | GitHub public repos |

- The curated registry is [awesome-dsh-plugin](https://awesome-dsh-plugin.com), published under CC0-1.0 (public-domain dedication); it may be overridden with `DSHM_REGISTRY_URL`.
- The GitHub topic is not shown raw: each repository is classified by shape and only bundle / skill / preset entries are surfaced; everything else stays in the hidden Other bucket.

## Data

| Path | Contents |
| --- | --- |
| `<DSH_HOME>/profiles/<profile>/.dsh-plugin-market/state.json` | Follows, install records, optional token |
| `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` | Hot enable / disable state |
| `<DSH_HOME>/skills/<name>/` | Installed skills |
| `<DSH_HOME>/.agent-presets/<id>/` | Installed presets |

Data is stored only in the local profile.

## Languages

- [README.zh-CN.md](./README.zh-CN.md) — 中文

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture, data flow, and the release process.

## License

[MIT](./LICENSE)
