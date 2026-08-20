/**
 * result — Go 风格的显式错误返回。
 *
 * 约定：禁止用 throw 作为控制流。所有可能失败的函数返回 Result<T>：
 *   { ok: true,  value }                       成功
 *   { ok: false, error: { code, message } }    失败
 * 调用方必须显式处理 ok 分支。错误码集中在 E 常量表，避免魔法字符串。
 */

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

/** 从 Result 取用户可读错误信息。 */
export function message(r) {
  return r && r.error ? r.error.message : '未知错误'
}

/** 统一错误码。 */
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
