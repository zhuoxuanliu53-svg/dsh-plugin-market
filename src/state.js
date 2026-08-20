/**
 * state — 市场自身持久化状态（Component 的存储层）。
 *
 * 存到 <profile>/.dsh-plugin-market/state.json：
 *   - follows：关注名单（fullName 数组）
 *   - installed：安装记录 { installedAt, autoUpdate, lastAutoUpdateAt }
 *   - token：可选 GitHub PAT（只存 profile 本地，绝不进导出 manifest）
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeState } from './contracts.js'
import { profileDir } from './profile.js'

const STATE_DIR = '.dsh-plugin-market'
const STATE_FILE = 'state.json'

function statePath(profile, explicitDir) {
  return join(profileDir(profile, explicitDir), STATE_DIR, STATE_FILE)
}

/** 读取并归一化状态；文件缺失/损坏时返回空状态。 */
export function readState(profile, explicitDir) {
  try {
    const parsed = JSON.parse(readFileSync(statePath(profile, explicitDir), 'utf8'))
    const state = normalizeState(parsed)
    // token 单独读，绝不参与 normalizeState（不进入导出）。
    const token = parsed && typeof parsed.token === 'string' ? parsed.token : ''
    return { ...state, token }
  } catch {
    return { follows: [], installed: {}, token: '' }
  }
}

/** 写入状态（follows/installed/token）。 */
export function writeState(profile, explicitDir, state) {
  const dir = join(profileDir(profile, explicitDir), STATE_DIR)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // 目录已存在或不可写；后者让 writeFileSync 抛错由调用方兜底
  }
  writeFileSync(statePath(profile, explicitDir), JSON.stringify(state, null, 2))
}

/** 仅更新 token，保留其余状态。 */
export function writeToken(profile, explicitDir, token) {
  const state = readState(profile, explicitDir)
  state.token = token
  writeState(profile, explicitDir, state)
  return state
}
