import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// 磁盘 JSON 缓存：读失败返回 null，写失败返回 false（缓存是加速项，失败静默降级）。

export function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function writeJsonFile(path, data) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(tmp, JSON.stringify(data), 'utf8')
    renameSync(tmp, path)
    return true
  } catch {
    return false
  }
}
