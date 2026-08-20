export function ok(value) {
  return { ok: true, value }
}

export function err(code, message, extra) {
  const error = { code, message: message == null ? code : message }
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    Object.assign(error, extra)
  }
  return { ok: false, error }
}

export function isOk(r) {
  return r != null && r.ok === true
}

export function isErr(r) {
  return r != null && r.ok === false
}

export function message(r) {
  return r && r.error ? r.error.message : '未知错误'
}

export const E = {
  NETWORK: 'NETWORK', // 网络层失败（DNS/超时/TLS/连接）
  HTTP_STATUS: 'HTTP_STATUS', // 数据源返回非 2xx
  BAD_BODY: 'BAD_BODY', // 数据源返回体无法解析
  RATE_LIMITED: 'RATE_LIMITED', // GitHub 限流
  INVALID_ARG: 'INVALID_ARG', // 入参不合法
  NOT_IN_REGISTRY: 'NOT_IN_REGISTRY', // 安装源不在白名单
  UNSAFE_TARGET: 'UNSAFE_TARGET', // 安装目标含危险字符
  SPAWN_FAILED: 'SPAWN_FAILED', // 子进程启动失败
  VERIFY_FAILED: 'VERIFY_FAILED', // 装后校验失败
  PATCH_REFUSED: 'PATCH_REFUSED', // 补丁层拒绝写入
  CONFLICT: 'CONFLICT', // loader id 冲突
  INTERNAL: 'INTERNAL',
}
