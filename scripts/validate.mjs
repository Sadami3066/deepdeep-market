#!/usr/bin/env node
import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const arg = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const schemaOnly = args.includes('--schema-only')
const noSignature = schemaOnly || args.includes('--no-sig')
const skipArtifacts = schemaOnly || args.includes('--skip-artifacts')
const tolerateNetwork = args.includes('--tolerate-network')
const inputPath = arg('--in') ?? join(root, 'registry.json')
const signaturePath = arg('--sig') ?? join(root, 'registry.json.sig')
const publicKeyPath = arg('--pub') ?? join(root, 'keys/market-public.pem')

const PLUGIN_API_LEVEL = 6
const MIN_HOST_VERSION = '1.0.4'

const errors = []
const fail = (message) => errors.push(message)
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isUrl = (value) => typeof value === 'string' && /^https:\/\/[^/\s]+/.test(value)
const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const isPublisherKeyId = (value) => typeof value === 'string' && /^ed25519:[0-9a-f]{64}$/.test(value)
const parseCoreVersion = (value) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(typeof value === 'string' ? value : '')
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}
const isVersionAtLeast = (value, minimum) => {
  const current = parseCoreVersion(value)
  if (!current) return false
  const target = parseCoreVersion(minimum)
  for (let index = 0; index < 3; index++) {
    if (current[index] !== target[index]) return current[index] > target[index]
  }
  return true
}

const checkLocalized = (value, field, id) => {
  if (!isObject(value)) {
    fail(`${id}: ${field} 必须是 {zh, en} 对象`)
    return
  }
  for (const lang of ['zh', 'en']) {
    if (typeof value[lang] !== 'string' || !value[lang].trim()) fail(`${id}: ${field}.${lang} 不能为空`)
  }
}

const checkTags = (value, id) => {
  if (!isObject(value)) {
    fail(`${id}: tags 必须是 {zh, en} 对象`)
    return
  }
  for (const lang of ['zh', 'en']) {
    const list = value[lang]
    if (!Array.isArray(list) || list.length === 0 || list.some((tag) => typeof tag !== 'string' || !tag.trim())) {
      fail(`${id}: tags.${lang} 必须是非空字符串数组`)
    }
  }
}

const checkAuth = (auth, id) => {
  if (!isObject(auth)) {
    fail(`${id}: mcp.auth 缺失`)
    return
  }
  if (!['none', 'apiKey', 'oauth'].includes(auth.type)) {
    fail(`${id}: mcp.auth.type 必须是 none/apiKey/oauth`)
    return
  }
  if (auth.type === 'apiKey') {
    if (typeof auth.header !== 'string' || !auth.header.trim()) fail(`${id}: apiKey 必须给 header`)
    if (typeof auth.prefix !== 'string') fail(`${id}: apiKey 必须给 prefix`)
    checkLocalized(auth.placeholder, 'mcp.auth.placeholder', id)
    if (!isUrl(auth.helpUrl)) fail(`${id}: apiKey 必须给 helpUrl`)
    return
  }
  if (auth.type === 'oauth') {
    if (auth.header !== undefined && typeof auth.header !== 'string') fail(`${id}: oauth header 必须是字符串`)
    if (auth.prefix !== undefined && typeof auth.prefix !== 'string') fail(`${id}: oauth prefix 必须是字符串`)
    return
  }
  if (auth.header !== undefined || auth.prefix !== undefined || auth.placeholder !== undefined || auth.helpUrl !== undefined) {
    fail(`${id}: auth.type=none 不应带授权字段`)
  }
}

let registry
try {
  registry = JSON.parse(readFileSync(inputPath, 'utf8'))
} catch (error) {
  console.error(`FAIL: 无法读取 ${inputPath}: ${error.message}`)
  if (!arg('--in')) console.error('先运行 node scripts/publish.mjs 生成 registry.json')
  process.exit(1)
}

if (registry.schemaVersion !== 3) fail(`schemaVersion 必须是 3（实际 ${registry.schemaVersion}）`)
if (!Array.isArray(registry.entries)) fail('entries 必须是数组')

const entries = Array.isArray(registry.entries) ? registry.entries : []
if (entries.length > 512) fail(`entries 不能超过 512 条（实际 ${entries.length}）`)
if (Buffer.byteLength(JSON.stringify(registry)) > 2 * 1024 * 1024) fail('registry.json 超过 2MB')

const ids = new Set()
const artifacts = []
for (const [index, entry] of entries.entries()) {
  const id = typeof entry?.id === 'string' && entry.id.trim() ? entry.id : `entries[${index}]`
  if (ids.has(id)) fail(`${id}: id 重复`)
  ids.add(id)

  if (!['plugin', 'skill', 'mcp'].includes(entry?.type)) {
    fail(`${id}: type 必须是 plugin/skill/mcp`)
    continue
  }
  if (typeof entry.version !== 'string' || !entry.version.trim()) fail(`${id}: 缺少 version`)
  checkLocalized(entry.name, 'name', id)
  checkLocalized(entry.summary, 'summary', id)
  checkLocalized(entry.description, 'description', id)
  checkTags(entry.tags, id)

  if (entry.icon !== undefined) {
    const iconMatch = typeof entry.icon === 'string'
      ? /^icons\/([A-Za-z0-9._-]+\.png)(?:\?v=([0-9a-f]{12}))?$/.exec(entry.icon)
      : null
    if (iconMatch === null) {
      fail(`${id}: icon 必须是 icons/<name>.png（publish 会追加 ?v=<内容哈希>）`)
    } else {
      const iconPath = join(root, 'icons', iconMatch[1])
      if (!existsSync(iconPath)) {
        fail(`${id}: icon 文件不存在 ${iconMatch[1]}`)
      } else {
        if (statSync(iconPath).size > 128 * 1024) fail(`${id}: icon 超过 128KB`)
        if (readFileSync(iconPath).subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${id}: icon 不是 PNG`)
        const version = iconMatch[2]
        if (version !== undefined) {
          const digest = createHash('sha256').update(readFileSync(iconPath)).digest('hex').slice(0, 12)
          if (digest !== version) fail(`${id}: icon 内容哈希与 ?v= 不一致，请重新运行 publish`)
        }
      }
    }
  }

  if (entry.type === 'mcp') {
    if (!isObject(entry.mcp)) {
      fail(`${id}: mcp 缺失`)
      continue
    }
    if (!isUrl(entry.mcp.url)) fail(`${id}: mcp.url 必须是 https URL`)
    if (entry.mcp.transport !== 'http') fail(`${id}: mcp.transport 必须是 "http"`)
    if (!isObject(entry.mcp.headers) || Object.values(entry.mcp.headers).some((value) => typeof value !== 'string')) {
      fail(`${id}: mcp.headers 必须是字符串映射`)
    }
    checkLocalized(entry.mcp.authHint, 'mcp.authHint', id)
    checkAuth(entry.mcp.auth, id)
    continue
  }

  const limit = entry.type === 'plugin' ? 50 * 1024 * 1024 : 20 * 1024 * 1024
  if (!isObject(entry.artifact)) {
    fail(`${id}: artifact 缺失`)
    continue
  }
  if (!isUrl(entry.artifact.url)) fail(`${id}: artifact.url 必须是 https URL`)
  if (!isSha256(entry.artifact.sha256)) fail(`${id}: artifact.sha256 必须是 64 位小写 hex`)
  if (!Number.isInteger(entry.artifact.size) || entry.artifact.size <= 0) fail(`${id}: artifact.size 必须是正整数`)
  else if (entry.artifact.size > limit) fail(`${id}: artifact 超过 ${limit / 1024 / 1024}MB`)
  if (entry.type === 'plugin') {
    if (!isObject(entry.plugin)) {
      fail(`${id}: plugin 缺失`)
      continue
    }
    if (entry.plugin.version !== entry.version) fail(`${id}: plugin.version 必须与 version 一致`)
    if (entry.plugin.apiLevel !== PLUGIN_API_LEVEL) fail(`${id}: plugin.apiLevel 必须是 ${PLUGIN_API_LEVEL}`)
    if (!isVersionAtLeast(entry.plugin.minHostVersion, MIN_HOST_VERSION)) {
      fail(`${id}: plugin.minHostVersion 必须不低于 ${MIN_HOST_VERSION}`)
    }
    if (!isPublisherKeyId(entry.plugin.publisherKeyId)) {
      fail(`${id}: plugin.publisherKeyId 必须是 ed25519:<64 位小写 hex>`)
    }
    if (entry.plugin.requiredAccess !== undefined && !['normal', 'adb', 'root'].includes(entry.plugin.requiredAccess)) {
      fail(`${id}: plugin.requiredAccess 必须是 normal/adb/root`)
    }
    if (entry.plugin.previews !== undefined) {
      if (!Array.isArray(entry.plugin.previews) || entry.plugin.previews.length === 0 || entry.plugin.previews.length > 6) {
        fail(`${id}: plugin.previews 必须是非空数组且最多 6 项`)
      } else if (entry.plugin.previews.some((url) => !isUrl(url))) {
        fail(`${id}: plugin.previews 每项必须是 https URL`)
      }
    }
  } else {
    if (!isObject(entry.skill) || typeof entry.skill.license !== 'string' || !entry.skill.license.trim()) fail(`${id}: skill.license 缺失`)
    if (!isObject(entry.skill) || !isUrl(entry.skill.source)) fail(`${id}: skill.source 必须是 https URL`)
  }
  artifacts.push({ id, url: entry.artifact.url, sha256: entry.artifact.sha256, size: entry.artifact.size })
}

if (!noSignature) {
  try {
    const key = createPublicKey(readFileSync(publicKeyPath))
    const signature = Buffer.from(readFileSync(signaturePath, 'utf8').trim(), 'base64')
    if (!verify('sha256', readFileSync(inputPath), key, signature)) fail('签名校验失败')
  } catch (error) {
    fail(`签名校验失败: ${error.message}`)
  }
}

const transientHttpStatus = new Set([408, 425, 429])
const isTransientHttpStatus = (status) => status >= 500 || transientHttpStatus.has(status)

const isNetworkError = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  if (/^(ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ECONNABORTED|EPIPE|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|UND_ERR_HEADERS_TIMEOUT)$/.test(code)) return true
  return /fetch failed|network|timeout|timed out|aborted|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|socket/i.test(String(error?.message ?? ''))
}

const classifyFailure = (error) => {
  if (Number.isInteger(error?.httpStatus)) return isTransientHttpStatus(error.httpStatus) ? 'transient' : 'permanent'
  if (error?.verification) return 'verification'
  if (isNetworkError(error)) return 'transient'
  return 'permanent'
}

const checkArtifact = async (artifact) => {
  let lastError
  let failure = 'transient'
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(artifact.url, { redirect: 'follow', signal: AbortSignal.timeout(180000) })
      if (response.status !== 200) {
        const error = new Error(`HTTP ${response.status}`)
        error.httpStatus = response.status
        throw error
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length !== artifact.size) {
        const error = new Error(`size ${buffer.length} != ${artifact.size}`)
        error.verification = true
        throw error
      }
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      if (sha256 !== artifact.sha256) {
        const error = new Error(`sha256 ${sha256} != ${artifact.sha256}`)
        error.verification = true
        throw error
      }
      return `${artifact.id}: ${artifact.size} bytes`
    } catch (error) {
      lastError = error
      failure = classifyFailure(error)
      if (failure === 'permanent' || attempt === 5) break
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt))
    }
  }
  if (tolerateNetwork && failure === 'transient') return `WARN ${artifact.id}: ${lastError?.message}`
  return `FAILED ${artifact.id}: ${lastError?.message}`
}

if (!skipArtifacts) {
  for (const artifact of artifacts) {
    const result = await checkArtifact(artifact)
    if (result.startsWith('WARN')) console.warn(`artifact warned ${result.slice(5)}`)
    else if (result.startsWith('FAILED')) fail(result.slice(7))
    else console.log(`artifact ok ${result}`)
  }
}

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} 个问题`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const mode = schemaOnly ? 'schema only' : noSignature ? 'no signature' : 'signature valid'
console.log(`OK: ${entries.length} entries, schema v3, plugin api level ${PLUGIN_API_LEVEL}, ${mode}`)
