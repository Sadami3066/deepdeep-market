import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const entriesDir = path.join(root, 'entries')
const types = ['plugin', 'skill', 'mcp']
const entries = []
for (const type of types) {
  const dir = path.join(entriesDir, type)
  if (!fs.existsSync(dir)) continue
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const entry = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    if (entry.type !== type) throw new Error(`${file}: type mismatch`)
    entries.push(entry)
  }
}
const publicKey = crypto.createPublicKey({ key: fs.readFileSync('keys/market-public.pem'), format: 'pem' })
const der = publicKey.export({ type: 'spki', format: 'der' })
const keyId = `ec256:${crypto.createHash('sha256').update(der).digest('hex').slice(0, 16)}`
const registry = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  keyId,
  entries,
}
fs.writeFileSync('registry.json', JSON.stringify(registry, null, 2) + '\n')
console.log(`wrote registry.json: ${entries.length} entries, keyId ${keyId}`)
