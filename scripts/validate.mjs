import fs from 'node:fs'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const get = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const registryPath = get('--in', 'registry.json')
const sigPath = get('--sig', `${registryPath}.sig`)
const pubPath = get('--pub', 'keys/market-public.pem')
const raw = fs.readFileSync(registryPath)
const sig = Buffer.from(fs.readFileSync(sigPath, 'utf8').trim(), 'base64')
const publicKey = crypto.createPublicKey({ key: fs.readFileSync(pubPath), format: 'pem' })
if (!crypto.verify('sha256', raw, publicKey, sig)) {
  console.error('signature verification FAILED')
  process.exit(1)
}
const json = JSON.parse(raw.toString('utf8'))
const errors = []
const ids = new Set()
const types = new Set(['plugin', 'skill', 'mcp'])
const isSha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
if (json.schemaVersion !== 2) errors.push('schemaVersion must be 2')
if (!Array.isArray(json.entries)) errors.push('entries must be an array')
else {
  if (json.entries.length > 512) errors.push('too many entries')
  for (const [i, entry] of json.entries.entries()) {
    const at = `entry[${i}]`
    if (!types.has(entry.type)) errors.push(`${at}: bad type`)
    if (!entry.id || typeof entry.id !== 'string') errors.push(`${at}: missing id`)
    else if (ids.has(entry.id)) errors.push(`${at}: duplicate id ${entry.id}`)
    else ids.add(entry.id)
    if (!entry.name || !entry.summary || !entry.version) errors.push(`${at}: missing name/summary/version`)
    if (entry.type !== 'mcp') {
      const artifact = entry.artifact
      if (!artifact || !artifact.url || !isSha(artifact.sha256) || !(artifact.size > 0)) {
        errors.push(`${at}: bad artifact`)
      }
    }
    if (entry.type === 'plugin' && !entry.plugin?.publisherKeyId) errors.push(`${at}: missing publisherKeyId`)
    if (entry.type === 'mcp' && (!entry.mcp?.url || entry.mcp.transport !== 'http')) errors.push(`${at}: bad mcp template`)
  }
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`OK: ${json.entries.length} entries, schema v2, signature valid`)
