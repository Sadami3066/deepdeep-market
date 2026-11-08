# DeepDeep 市场（内容仓库）

DeepDeep 的技能、插件与远程 MCP 配置市场。客户端固定读取：

- 索引：`https://sadami3066.github.io/deepdeep-market/registry.json`
- 签名：`registry.json.sig`（对 registry.json 原始字节的 ECDSA-P256-SHA256 签名，DER + base64）

制品放在 GitHub Releases；索引只放元数据与 hash。

## 目录

- `registry.json`：市场索引（签名对象，发布时由 `scripts/publish.mjs` 生成）。
- `registry.json.sig`：索引签名。
- `entries/<type>/<id>.json`：条目源文件。
- `icons/<id>.png`：条目图标（≤128KB）。
- `scripts/`：签名、校验与发布脚本。

## 发布流程（维护者）

1. 修改 `entries/`、`icons/`，把制品上传到新的 GitHub Release（tag `content-YYYYMMDD`）。
2. 运行 `node scripts/publish.mjs` 生成 `registry.json`。
3. 用离线私钥签名：`node scripts/sign.mjs --key /path/to/private.pem`。
4. 运行 `node scripts/validate.mjs --pub keys/market-public.pem`。
5. 提交并推送；GitHub Pages 自动更新。

私钥不得进入仓库。

## 贡献（所有人可 PR）

- 只接受能公开再分发的技能/插件/MCP 配置，必须写清来源与 license。
- 新增条目请按 `entries/sample.json` 的格式提交，并附上 sha256。
- 人工审核清单见 `PR_REVIEW.md`；审核通过后由维护者发布。
