#!/usr/bin/env node
import { createHash, createPublicKey } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const LOCAL_ICON = /^icons\/[A-Za-z0-9._-]+\.png$/
const entries = []

for (const type of ['plugin', 'skill', 'mcp']) {
  const dir = join(root, 'entries', type)
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (entry.type !== type) throw new Error(`${type}/${file}: type 与目录不一致`)
    entries.push(entry)
  }
}

const versioned = entries.map((entry) => {
  const icon = entry.icon
  if (typeof icon !== 'string' || !LOCAL_ICON.test(icon)) return entry
  const file = join(root, icon)
  if (!existsSync(file)) return entry
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)
  return { ...entry, icon: `${icon}?v=${digest}` }
})

const spki = createPublicKey(readFileSync(join(root, 'keys/market-public.pem'))).export({ type: 'spki', format: 'der' })
const keyId = `ec256:${createHash('sha256').update(spki).digest('hex').slice(0, 16)}`
const registry = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  keyId,
  entries: versioned,
}

writeFileSync(join(root, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`)
console.log(`registry.json: ${versioned.length} entries, ${keyId}`)
