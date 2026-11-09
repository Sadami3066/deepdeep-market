# DeepDeep 市场（内容仓库）

DeepDeep 的技能、插件与远程 MCP 配置市场。客户端固定读取：

- 索引：`https://sadami3066.github.io/deepdeep-market/registry.json`
- 签名：`registry.json.sig`（对 registry.json 原始字节的 ECDSA-P256-SHA256 签名，DER + base64）

索引只放元数据与 hash；制品放在按类型拆分的 GitHub Releases。

## 目录

- `registry.json`：市场索引（schema v3，签名的对象）。
- `registry.json.sig`：索引签名。
- `entries/<type>/<id>.json`：条目源文件，`name`/`summary`/`description`/`tags`/`authHint` 均为 `{"zh": …, "en": …}`。
- `icons/<id>.png`：条目图标（≤128KB；MCP 品牌图标仅用于识别来源）。
- `scripts/`：发布、签名与校验脚本。
- `.github/workflows/`：PR 校验与 master 自动发布。

## 索引格式（schema v3）

- `schemaVersion` 固定为 `3`；`keyId` 由签名公钥计算出，`generatedAt` 由脚本写入。
- 插件条目：`artifact` + `plugin.apiLevel`/`plugin.minHostVersion`/`plugin.publisherKeyId`；可选 `plugin.publisherName` 为发布者展示名（客户端优先显示，缺失时回落 `publisherKeyId` 前 12 位，发布者身份仍以 `publisherKeyId` 为准）。
- 技能条目：`artifact` + `skill.license`/`skill.source`。
- MCP 条目：无制品；`mcp.url` 必须是公开远程 HTTP 端点，`mcp.auth` 描述授权方式：
  - `{"type": "none"}`：公开访问。
  - `{"type": "oauth"}`：浏览器 OAuth，可省略 `header`/`prefix`。
  - `{"type": "apiKey", "header": "Authorization", "prefix": "Bearer ", "placeholder": {"zh": …}, "helpUrl": …}`：需要 API Key。
- 体积约束：`entries` ≤ 512 条，`registry.json` ≤ 2MB，图标 ≤128KB。

## 制品 Release

- 插件：`plugins-YYYYMMDD`，资产名为 `<插件 id 最后段>-<version>.ddp`。
- 技能：`skills-YYYYMMDD`，资产名为 `<技能 id>-<version>.zip`，zip 内为单个技能目录（含 `SKILL.md` 与上游 `LICENSE`、`ATTRIBUTION.md`）。
- MCP 无制品，不建 Release。
- 早期 `content-YYYYMMDD` Release 已归档保留，索引不再引用。

## 发布流程

推送 `master` 后由 `.github/workflows/release.yml` 自动完成：

1. `node scripts/publish.mjs` 生成 `registry.json`。
2. `node scripts/validate.mjs --no-sig`：校验 schema 并下载全部制品核对 size 与 sha256。
3. 用仓库 secret `MARKET_PRIVATE_KEY` 签名：`node scripts/sign.mjs --key-env MARKET_PRIVATE_KEY`。
4. 校验签名：`node scripts/validate.mjs --pub keys/market-public.pem --skip-artifacts`。
5. 通过 GitHub Pages（Actions 部署）发布 `registry.json`、`registry.json.sig` 与 `icons/`。

维护者也可以本地执行：

```bash
node scripts/publish.mjs
node scripts/sign.mjs --key /path/to/private.pem
node scripts/validate.mjs --pub keys/market-public.pem
```

`scripts/validate.mjs` 支持 `--schema-only`（只看索引，适合 PR）、`--no-sig`（发布前校验）与 `--skip-artifacts`（只验签名）。私钥不得进入仓库。

## 贡献（所有人可 PR）

- 只接受能公开再分发的技能/插件/MCP 配置，必须写清来源与 license。
- 新增条目请按 `entries/sample.json` 的格式提交，并附上 sha256。
- PR 会自动跑 `node scripts/validate.mjs --schema-only`；人工审核清单见 `PR_REVIEW.md`，审核通过后由维护者发布。
- 上架内容边界、禁止项、签名与下架规则见 [Market Policy](https://github.com/Sadami3066/DeepDeep-Plugins/blob/master/MARKET_POLICY.md)。
