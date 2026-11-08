#!/usr/bin/env node
import { createHash, createPublicKey } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const entries = []

for (const type of ['plugin', 'skill', 'mcp']) {
  const dir = join(root, 'entries', type)
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (entry.type !== type) throw new Error(`${type}/${file}: type 与目录不一致`)
    entries.push(entry)
  }
}

const spki = createPublicKey(readFileSync(join(root, 'keys/market-public.pem'))).export({ type: 'spki', format: 'der' })
const keyId = `ec256:${createHash('sha256').update(spki).digest('hex').slice(0, 16)}`
const registry = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  keyId,
  entries,
}

writeFileSync(join(root, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`)
console.log(`registry.json: ${entries.length} entries, ${keyId}`)
