# 市场条目审核清单

- [ ] 来源可公开访问，许可证允许再分发（MIT/Apache-2.0/CC-BY 等），仓库内保留 LICENSE 与来源链接。
- [ ] 制品 sha256 与 Release 文件一致，体积合理（插件 ≤ 50MB，技能 ≤ 20MB）。
- [ ] 插件：Release 标签与资产名符合约定（`plugins-YYYYMMDD`，同日第二次发布加 `-2`；资产名 `<id 最后一段>-<version>.ddp`）。
- [ ] 插件：`entry.version`、`plugin.version` 与资产文件名里的版本三者一致。
- [ ] 插件：发布者签名有效（`META-INF/plugin-signature.json`），`plugin.publisherKeyId` 匹配 `^ed25519:[0-9a-f]{64}$` 且与签名里的 `keyId` 一致。
- [ ] 插件：`plugin.apiLevel` 为 6；`plugin.minHostVersion` 不低于 1.0.4，且不高于当前宿主版本。
- [ ] 插件：`plugin.publisherName` 可选，为发布者展示名，须与该插件签名 `publisherKeyId` 对应同一发布者；缺失时客户端回落 keyId 前 12 位。
- [ ] 插件：`plugin.requiredAccess` 如实标注运行所需档位（`normal`/`adb`/`root`），需要 Root 的插件说明原因。
- [ ] 插件：`plugin.previews`（如有）为 1–6 个 https 竖版图（9:20），内容与插件一致。
- [ ] 技能：zip 内为单个技能目录（含 SKILL.md），无二进制/脚本之外的越权内容。
- [ ] MCP：只接受远程 HTTP 端点，不允许本地 command/args/env；不收集用户凭据；`auth` 与 `authHint` 写清授权方式。
- [ ] 文案：`name`/`summary`/`description`/`tags` 均含 `zh` 与 `en`，英文自然；不含开发侧说明与内部链接。
- [ ] 图标：≤128KB PNG，来源可追溯（品牌图标仅用于识别来源）；索引里的 `?v=` 由 `publish.mjs` 生成，若与文件内容哈希不一致说明未重新生成索引。
