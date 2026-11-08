import fs from 'node:fs'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const get = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const registry = get('--in', 'registry.json')
const keyPath = get('--key', process.env.MARKET_SIGNING_KEY)
const out = get('--out', `${registry}.sig`)
if (!keyPath) {
  console.error('missing --key (or MARKET_SIGNING_KEY)')
  process.exit(1)
}
const data = fs.readFileSync(registry)
const privateKey = crypto.createPrivateKey({ key: fs.readFileSync(keyPath), format: 'pem' })
const signature = crypto.sign('sha256', data, privateKey)
fs.writeFileSync(out, signature.toString('base64'))
console.log(`signed ${registry} -> ${out} (${signature.length} bytes)`)
