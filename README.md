# dsh-plugin-market

A visual plugin marketplace for DeepSeek Harness: discover, search, install, and manage DSH plugins.

![version](https://img.shields.io/badge/version-3.0.0-2ea44f) ![license](https://img.shields.io/badge/license-MIT-8ca1af) ![type](https://img.shields.io/badge/type-DSH%20bundle%20plugin-4c6ef5)

`dsh-plugin-market` is a DSH bundle plugin that aggregates plugins from a curated registry and the GitHub Topic `dsh-plugin`, offering browsing, search, sorting, following, install / update / remove, auto-update, hot enable / disable, and export / import of plugin manifests.

## Features

### Discovery

- Dual sources: curated registry (reviewed) and GitHub Topic (community), distinguished by badges, reviewed first
- Keyword search (name / description / topics)
- 8 sort options: stars ↑↓, forks, updated, created ↑↓, name, updates first
- Tag filters, follow-only, installed-only

### Management

- One-click install, update, remove, and update-all
- Per-plugin auto-update toggle
- Hot enable / disable via the profile patch layer (HMR, no restart)

### Safety

- Post-install verification (loadable entry / dsh manifest / loader id conflicts), with automatic rollback on failure
- Install whitelist
- Same-origin checks on mutating endpoints
- Host infrastructure row protection

### Sharing

- Manifest export / import (follows + installed + auto-update flags)
- Optional GitHub token (stored in the local profile only)

## Installation

```sh
dsh plugin --profile web add github:zhuoxuanliu53-svg/dsh-plugin-market
```

After installation, refresh the page and open Settings → Plugin Market.

## Data sources

| Source | URL | Purpose | Cache | Badge |
| --- | --- | --- | --- | --- |
| curated | Configurable (`DSHM_REGISTRY_URL`) | Reviewed plugins, shown first | ETag / 304 | Reviewed |
| github-topic | `api.github.com/search/repositories?q=topic:dsh-plugin` | Community plugins | 30-minute TTL | Community |

- Deduplication key: repo `fullName` (lowercase), curated takes precedence.
- The curated source defaults to a placeholder URL; point `DSHM_REGISTRY_URL` at your own registry (JSON format in `src/entities.js`).

## Data

| Path | Contents |
| --- | --- |
| `<DSH_HOME>/profiles/<profile>/.dsh-plugin-market/state.json` | Follows, install records, optional token |
| `<DSH_HOME>/profiles/<profile>/cordis.patch.yml` | Hot enable / disable state |

Data is stored only in the local profile.

## Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) — architecture and development notes
- [README.zh-CN.md](./README.zh-CN.md) — 中文

## License

[MIT](./LICENSE)
