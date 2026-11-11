# DeepDeep 市场

[English](README.en.md) | 中文

DeepDeep 的插件、技能与远程 MCP 市场：本仓库提供**签名索引**与**制品分发**，不包含客户端代码。

- 索引：`https://sadami3066.github.io/deepdeep-market/registry.json`
- 签名：`registry.json.sig`（ECDSA P-256 + SHA-256，对 `registry.json` 原始字节签名，DER 编码后 base64）

## 概览

DeepDeep App 的市场页固定读取上面的索引，用内置公钥验证签名并确认 `keyId` 匹配后展示条目：

- **插件**：`.ddp` 包，从 GitHub Releases 下载安装，为 App 增加能力与技能；
- **技能**：`.zip` 包，从 Releases 下载安装；
- **MCP**：远程 HTTP 服务配置，没有制品。

索引只存元数据与 `sha256`/`size`，制品放在按类型与日期命名的 GitHub Releases 中。本仓库不含用户端代码，客户端在 DeepDeep App 仓库。

## 仓库里有什么

| 路径 | 说明 |
| --- | --- |
| `entries/plugin/`、`entries/skill/`、`entries/mcp/` | 条目源文件，一条一个 JSON；`publish.mjs` 按目录校验 `type` 并生成索引 |
| `entries/sample.json` | 条目字段模板（技能示例），不参与发布 |
| `icons/` | 条目图标，`icons/<name>.png`，≤128KB；随 Pages 发布 |
| `previews/` | 插件效果预览图；条目用 `raw.githubusercontent.com` URL 引用，Pages 不发布该目录 |
| `scripts/` | `publish.mjs` 生成索引、`validate.mjs` 校验索引/签名/制品、`sign.mjs` 签名 |
| `.github/workflows/` | `release.yml` 校验并部署 Pages、`validate.yml` 校验 PR、`validate-artifacts.yml` 每日校验制品 |
| `keys/market-public.pem` | 索引验签公钥；私钥不入库（`keys/*` 已被忽略，只保留该公钥） |
| `PR_REVIEW.md` | 条目人工审核清单 |

## 索引格式（schema v3）

`registry.json` 由 `scripts/publish.mjs` 从 `entries/` 生成，不要手改或提交：

```json
{
  "schemaVersion": 3,
  "generatedAt": "2026-11-09T08:05:52Z",
  "keyId": "ec256:db63256431bd66db",
  "entries": []
}
```

`keyId` 由 `keys/market-public.pem` 算出：`sha256(SPKI DER)` 的前 16 个十六进制字符，加前缀 `ec256:`。

条目公共字段（以 `scripts/validate.mjs` 的校验为准）：

- `type`：`plugin` / `skill` / `mcp`，必须与所在目录一致；
- `id`：全局唯一；
- `version`：字符串；
- `name` / `summary` / `description`：`{"zh": "…", "en": "…"}`，两种语言都不能为空；
- `tags`：`{"zh": ["…"], "en": ["…"]}`，两种语言都至少一项；
- `icon`（可选）：`icons/<name>.png`，≤128KB 且必须是 PNG。

**插件条目**

- `artifact`：`{"url": "https://…", "sha256": "<64 位小写 hex>", "size": <字节数>}`，≤50MB；
- `plugin.publisherKeyId`（必填）：发布者公钥 ID；App 安装时会用它校验 `.ddp` 内的 Ed25519 签名；
- `plugin.publisherName`（可选）：发布者展示名，客户端优先显示，缺失时回落 `publisherKeyId` 前 12 位；
- `plugin.apiLevel` / `plugin.minHostVersion`：客户端兼容性信息（当前校验脚本不强制）；
- `plugin.requiredAccess`（可选）：插件运行需要的系统访问档位，`normal`（默认）/ `adb` / `root`；客户端按当前启用权限提示「未必能用」，请如实标注、不要虚标；
- `plugin.previews`（可选）：1–6 个 https 图片 URL；App 按竖版 9:20 卡片展示（建议 1080×2400 或 720×1600），点开可全屏左右滑动。

**技能条目**

- `artifact`：同上，≤20MB；
- `skill.license`：非空许可证名（如 MIT、Apache-2.0）；
- `skill.source`：上游源码的 https URL。

**MCP 条目**（无制品）

- `mcp.url`：公开的 https 端点；`mcp.transport` 固定为 `"http"`；
- `mcp.headers`：字符串映射；
- `mcp.authHint`：`{"zh": "…", "en": "…"}` 授权提示；
- `mcp.auth`：
  - `{"type": "none"}`：公开访问，不能带其它授权字段；
  - `{"type": "oauth"}`：浏览器 OAuth，可省略 `header` / `prefix`；
  - `{"type": "apiKey", "header": "Authorization", "prefix": "Bearer ", "placeholder": {"zh": "…", "en": "…"}, "helpUrl": "https://…"}`。

限制：`entries` ≤ 512 条，`registry.json` ≤ 2MB。

## 快速开始：新增一个条目

前置：Node.js 22 或更高、git。脚本只依赖 Node 内置能力，无需安装依赖。

### 1. 新建条目文件

```bash
git clone https://github.com/Sadami3066/deepdeep-market.git
cd deepdeep-market
cp entries/sample.json entries/skill/my-skill.json
```

按 `entries/<type>/` 放置：插件在 `entries/plugin/`，技能在 `entries/skill/`，MCP 在 `entries/mcp/`；`type` 必须与目录一致，文件名不作限制。

### 2. 打包制品并上传 Release

- 插件：Release 标签 `plugins-YYYYMMDD`，资产名 `<id 最后一段>-<version>.ddp`（如 `sysu-1.2.2.ddp`）；
- 技能：Release 标签 `skills-YYYYMMDD`，资产名 `<id>-<version>.zip`，zip 内为单个技能目录（含 `SKILL.md`，并附上游 `LICENSE` 与署名说明，如 `ATTRIBUTION.md`）；
- MCP 没有制品，不需要 Release。

### 3. 填写 `artifact` 的校验值

```bash
sha256sum my-skill-1.0.0.zip
stat -c %s my-skill-1.0.0.zip
```

把输出分别填入 `artifact.sha256` 与 `artifact.size`；`artifact.url` 填 Release 资产的直链。插件预览图可放在 `previews/`，用 `https://raw.githubusercontent.com/Sadami3066/deepdeep-market/master/previews/<file>` 引用。

### 4. 本地生成并校验索引

```bash
node scripts/publish.mjs
node scripts/validate.mjs --no-sig
```

`publish.mjs` 会生成仓库根的 `registry.json`（已加入 `.gitignore`，不要提交）；`validate.mjs --no-sig` 会检查条目格式，并下载每个制品核对 `size` 与 `sha256`。

### 5. 本地验签（仅维护者）

贡献者跳过这一步；维护者用私钥签名后再校验：

```bash
node scripts/sign.mjs --key /path/to/private.pem
node scripts/validate.mjs --pub keys/market-public.pem --skip-artifacts
```

私钥只放在本地或 CI secret，不得进入仓库。

### 6. 提交 PR

`validate.yml` 会先运行 `node scripts/publish.mjs`，再运行 `node scripts/validate.mjs --schema-only`（只校验索引格式，不下载制品）；失败时会在 PR 下自动留言。人工审核按 `PR_REVIEW.md` 进行，合并到 `master` 后由 `release.yml` 自动发布。

## 发布与校验流程

`release.yml`（push `master` 或手动触发）：

1. `node scripts/publish.mjs` —— 从 `entries/` 生成索引；
2. `node scripts/validate.mjs --no-sig --tolerate-network` —— 校验索引并下载全部制品核对 `size`/`sha256`；
3. `node scripts/sign.mjs --key-env MARKET_PRIVATE_KEY` —— 用 repository secret 签名；
4. `node scripts/validate.mjs --pub keys/market-public.pem --skip-artifacts` —— 校验签名；
5. 发布 `registry.json`、`registry.json.sig` 与 `icons/` 到 GitHub Pages。

`validate-artifacts.yml` 每天 18:30 UTC（北京时间次日 02:30）从 `master` 重新生成索引，并下载全部制品做严格校验，失败即 Actions 报错；GitHub Actions 的定时任务可能延迟。

### `validate.mjs` 参数

| 参数 | 作用 |
| --- | --- |
| `--in <path>` | 指定索引文件（默认仓库根 `registry.json`） |
| `--sig <path>` | 指定签名文件（默认 `registry.json.sig`） |
| `--pub <path>` | 验签公钥（默认 `keys/market-public.pem`） |
| `--schema-only` | 只校验索引格式；隐含 `--no-sig` 与 `--skip-artifacts` |
| `--no-sig` | 跳过签名校验 |
| `--skip-artifacts` | 不下载制品 |
| `--tolerate-network` | 5xx/429 与网络错误重试后降级为警告；4xx 永远失败 |

制品校验会下载每个 `artifact.url` 并比对 `size` 与 `sha256`。HTTP 4xx（404/403/410 等）是永久错误，直接失败；HTTP 5xx、408、425、429 以及 DNS/连接/超时等网络错误最多尝试 5 次（每次请求超时 180 秒），加 `--tolerate-network` 时最终降级为警告。`size`/`sha256` 不匹配始终失败。

## 使用方式

App 的市场页从固定 URL 读取索引：

- 用内置公钥校验 `registry.json.sig`，并要求 `keyId` 匹配，然后展示插件、技能与 MCP；
- 索引缓存 6 小时，刷新失败时回落到上次缓存；
- 已安装的插件或技能有新版本时自动下载并安装，单个条目的重试间隔为 5 分钟；
- MCP 条目在 App 内完成授权或填写凭据后连接（远程 HTTP，无本地命令）。

手动安装插件：从对应 Release 下载 `.ddp`，在 App 的插件页选择「导入插件」打开该文件。导入时按未信任来源处理，展示插件信息、发布者与 `sha256` 后由用户确认。技能与 MCP 通过市场安装或配置。

## 风险与信任边界

- **第三方制品**：本仓库只分发索引与 hash，插件/技能内容由各自作者提供。插件安装时 App 会校验包内 Ed25519 发布者签名与索引里的 `publisherKeyId` 是否一致；技能与 MCP 的安全性取决于上游来源与作者。
- **制品可变**：GitHub Release 资产可以被同名覆盖或删除。索引发布后制品仍可能失效或被替换；App 下载后会校验 `size`/`sha256`，不匹配会拒绝安装，但索引本身可能仍显示"有更新"。发布前请确认 `artifact` 指向的资产已存在且不会再变更。
- **部署容忍**：`release.yml` 使用 `--tolerate-network`，重试后仍是 5xx/429/网络错误时只警告并继续部署；每日 `validate-artifacts.yml` 会严格校验兜底。HTTP 4xx 会直接中止发布。
- **MCP**：第三方 MCP 服务适用其自身条款与隐私政策；API Key / OAuth 凭据由 App 保管，只发送给对应服务；市场只接受公开远程 HTTP 端点。
- **图标与预览图**：`icons/` 随 Pages 发布；`previews/` 通过 `raw.githubusercontent.com` 提供，可用性与内容由 Git 托管方决定。

## 权益与许可

- 本仓库的脚本与工作流采用 [Apache-2.0](LICENSE) 许可（与 DeepDeep App 一致）。
- 条目中的第三方技能、插件与品牌图标归各自作者或商标持有人所有，遵循条目里标注的 `skill.license` 与上游来源；MCP 名称与图标归各自服务商。
- 本仓库与条目中出现的第三方服务无隶属或背书关系。

## 声明与反馈

- 索引与制品按现状提供，不附带任何担保；是否安装第三方内容由用户自行决定并承担风险。
- 问题、条目建议或下架请求：在本仓库提交 Issue / PR。审核与上架边界见 [Market Policy](https://github.com/Sadami3066/DeepDeep-Plugins/blob/master/MARKET_POLICY.md)。
- 安全或凭据相关问题请勿在公开 Issue 中贴出敏感信息，请直接联系仓库维护者。
