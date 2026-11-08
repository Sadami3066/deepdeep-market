# 市场条目审核清单

- [ ] 来源可公开访问，许可证允许再分发（MIT/Apache-2.0/CC-BY 等），仓库内保留 LICENSE 与来源链接。
- [ ] 制品 sha256 与 Release 文件一致，体积合理（插件 ≤ 50MB，技能 ≤ 20MB）。
- [ ] 插件：发布者签名有效（`META-INF/plugin-signature.json`），publisherKeyId 与提交一致。
- [ ] 技能：zip 内为单个技能目录（含 SKILL.md），无二进制/脚本之外的越权内容。
- [ ] MCP：只接受远程 HTTP 端点，不允许本地 command/args/env；不收集用户凭据；说明中写清授权方式。
- [ ] 文案：中文名称、一句话说明、2-4 行说明，不含开发侧说明与内部链接。
- [ ] 图标：≤128KB PNG，来源可追溯（品牌图标仅用于识别）。
