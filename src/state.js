import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeState } from './contracts.js'
import { profileDir } from './profile.js'

const STATE_DIR = '.dsh-plugin-market'
const STATE_FILE = 'state.json'

function statePath(profile, explicitDir) {
  return join(profileDir(profile, explicitDir), STATE_DIR, STATE_FILE)
}

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

export function writeState(profile, explicitDir, state) {
  const dir = join(profileDir(profile, explicitDir), STATE_DIR)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // 目录已存在或不可写；后者让 writeFileSync 抛错由调用方兜底
  }
  writeFileSync(statePath(profile, explicitDir), JSON.stringify(state, null, 2))
}

export function writeToken(profile, explicitDir, token) {
  const state = readState(profile, explicitDir)
  state.token = token
  writeState(profile, explicitDir, state)
  return state
}
