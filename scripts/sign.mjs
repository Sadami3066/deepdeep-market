#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sign } from 'node:crypto'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const arg = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const inputPath = arg('--in') ?? join(root, 'registry.json')
const outputPath = arg('--out') ?? join(root, 'registry.json.sig')
const keyFile = arg('--key')
const keyEnv = arg('--key-env')

let key = keyFile ? readFileSync(keyFile, 'utf8') : undefined
if (!key && keyEnv) key = process.env[keyEnv]
if (!key && process.env.MARKET_SIGNING_KEY) key = process.env.MARKET_SIGNING_KEY
if (!key) throw new Error('缺少签名私钥：用 --key <文件> 或 --key-env <环境变量名>')

const signature = sign('sha256', readFileSync(inputPath), key)
writeFileSync(outputPath, signature.toString('base64'))
console.log(`signed ${inputPath} -> ${outputPath}`)
