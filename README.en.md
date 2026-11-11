# DeepDeep Market

中文 | [English](README.md)

The plugin, skill, and remote MCP marketplace for DeepDeep: this repository provides the **signed registry** and **artifact distribution**. It contains no client code.

- Registry: `https://sadami3066.github.io/deepdeep-market/registry.json`
- Signature: `registry.json.sig` (ECDSA P-256 + SHA-256 over the raw bytes of `registry.json`, DER-encoded, base64)

## Overview

The DeepDeep App's Market tab always reads the registry URL above, verifies it with a built-in public key, checks that `keyId` matches, and then shows the entries:

- **Plugins**: `.ddp` packages downloaded from GitHub Releases, adding capabilities and skills to the App;
- **Skills**: `.zip` packages downloaded from Releases;
- **MCP**: remote HTTP server configuration; no artifact.

The registry only carries metadata plus `sha256`/`size`; artifacts live in type- and date-based GitHub Releases. This repository has no user-facing client code — the client lives in the DeepDeep App repository.

## What's in the repository

| Path | Description |
| --- | --- |
| `entries/plugin/`, `entries/skill/`, `entries/mcp/` | Entry sources, one JSON per entry; `publish.mjs` checks `type` against the directory and builds the registry |
| `entries/sample.json` | Field template (skill example); not published |
| `icons/` | Entry icons, `icons/<name>.png`, ≤128KB; deployed via Pages |
| `previews/` | Plugin preview images; entries reference them with `raw.githubusercontent.com` URLs, and Pages does not publish this directory |
| `scripts/` | `publish.mjs` builds the registry, `validate.mjs` validates registry/signature/artifacts, `sign.mjs` signs the registry |
| `.github/workflows/` | `release.yml` validates and deploys Pages, `validate.yml` validates PRs, `validate-artifacts.yml` validates artifacts daily |
| `keys/market-public.pem` | Registry verification public key; private keys never enter the repo (`keys/*` is ignored, only this public key is kept) |
| `PR_REVIEW.md` | Manual entry review checklist |

## Registry format (schema v3)

`registry.json` is generated from `entries/` by `scripts/publish.mjs`. Do not edit or commit it by hand:

```json
{
  "schemaVersion": 3,
  "generatedAt": "2026-11-09T08:05:52Z",
  "keyId": "ec256:db63256431bd66db",
  "entries": []
}
```

`keyId` is derived from `keys/market-public.pem`: the first 16 hex characters of `sha256(SPKI DER)`, prefixed with `ec256:`.

Common entry fields (enforced by `scripts/validate.mjs`):

- `type`: `plugin` / `skill` / `mcp`, must match the directory;
- `id`: globally unique;
- `version`: string;
- `name` / `summary` / `description`: `{"zh": "…", "en": "…"}`; neither language may be empty;
- `tags`: `{"zh": ["…"], "en": ["…"]}`; at least one tag per language;
- `icon` (optional): `icons/<name>.png`, ≤128KB and a real PNG.

**Plugin entries**

- `artifact`: `{"url": "https://…", "sha256": "<64 lowercase hex>", "size": <bytes>}`, ≤50MB;
- `plugin.publisherKeyId` (required): publisher key ID; the App uses it to verify the Ed25519 signature inside the `.ddp` on install;
- `plugin.publisherName` (optional): display name; the client prefers it and falls back to the first 12 characters of `publisherKeyId`;
- `plugin.apiLevel` / `plugin.minHostVersion`: client compatibility hints (not enforced by the validation script today);
- `plugin.requiredAccess` (optional): the system access tier the plugin needs — `normal` (default), `adb`, or `root`; the App warns when the current access is lower, so declare it truthfully;
- `plugin.previews` (optional): 1–6 HTTPS image URLs; the App shows them as portrait 9:20 cards (1080×2400 or 720×1600 recommended), tap to view full-screen with horizontal paging.

**Skill entries**

- `artifact`: same shape, ≤20MB;
- `skill.license`: non-empty license name (e.g. MIT, Apache-2.0);
- `skill.source`: HTTPS URL of the upstream source.

**MCP entries** (no artifact)

- `mcp.url`: public HTTPS endpoint; `mcp.transport` must be `"http"`;
- `mcp.headers`: string map;
- `mcp.authHint`: `{"zh": "…", "en": "…"}` authorization hint;
- `mcp.auth`:
  - `{"type": "none"}`: public access; no other auth fields allowed;
  - `{"type": "oauth"}`: browser OAuth; `header` / `prefix` may be omitted;
  - `{"type": "apiKey", "header": "Authorization", "prefix": "Bearer ", "placeholder": {"zh": "…", "en": "…"}, "helpUrl": "https://…"}`.

Limits: at most 512 `entries` and 2MB for `registry.json`.

## Quick start: add an entry

Requirements: Node.js 22 or newer and git. The scripts only use Node built-ins; no dependencies to install.

### 1. Create the entry file

```bash
git clone https://github.com/Sadami3066/deepdeep-market.git
cd deepdeep-market
cp entries/sample.json entries/skill/my-skill.json
```

Place entries under `entries/<type>/`: plugins in `entries/plugin/`, skills in `entries/skill/`, MCP in `entries/mcp/`. `type` must match the directory; the filename is free-form.

### 2. Package the artifact and upload a Release

- Plugins: Release tag `plugins-YYYYMMDD`, asset name `<last id segment>-<version>.ddp` (e.g. `sysu-1.2.2.ddp`);
- Skills: Release tag `skills-YYYYMMDD`, asset name `<id>-<version>.zip`; the zip must contain a single skill directory (with `SKILL.md`, plus the upstream `LICENSE` and attribution notes such as `ATTRIBUTION.md`);
- MCP: no artifact and no Release.

### 3. Fill in the `artifact` checksums

```bash
sha256sum my-skill-1.0.0.zip
stat -c %s my-skill-1.0.0.zip
```

Put the results into `artifact.sha256` and `artifact.size`; set `artifact.url` to the direct Release asset URL. Plugin preview images can live in `previews/` and be referenced as `https://raw.githubusercontent.com/Sadami3066/deepdeep-market/master/previews/<file>`.

### 4. Build and validate the registry locally

```bash
node scripts/publish.mjs
node scripts/validate.mjs --no-sig
```

`publish.mjs` writes `registry.json` at the repository root (already in `.gitignore`; never commit it). `validate.mjs --no-sig` checks the entry schema and downloads every artifact to verify `size` and `sha256`.

### 5. Verify the signature locally (maintainers only)

Contributors can skip this. Maintainers sign with the private key and verify:

```bash
node scripts/sign.mjs --key /path/to/private.pem
node scripts/validate.mjs --pub keys/market-public.pem --skip-artifacts
```

Keep the private key local or in a CI secret; never commit it.

### 6. Open a pull request

`validate.yml` runs `node scripts/publish.mjs`, then `node scripts/validate.mjs --schema-only` (schema only, no artifact downloads), and comments on the PR if it fails. Manual review follows `PR_REVIEW.md`; once merged to `master`, `release.yml` publishes automatically.

## Release and validation pipeline

`release.yml` (push to `master` or manual dispatch):

1. `node scripts/publish.mjs` — build the registry from `entries/`;
2. `node scripts/validate.mjs --no-sig --tolerate-network` — validate the registry and download all artifacts to verify `size`/`sha256`;
3. `node scripts/sign.mjs --key-env MARKET_PRIVATE_KEY` — sign with the repository secret;
4. `node scripts/validate.mjs --pub keys/market-public.pem --skip-artifacts` — verify the signature;
5. Deploy `registry.json`, `registry.json.sig`, and `icons/` to GitHub Pages.

`validate-artifacts.yml` runs daily at 18:30 UTC (02:30 Beijing time) and rebuilds the registry from `master` to strictly validate every artifact; failures show up as failed Actions runs. Scheduled GitHub Actions runs may be delayed.

### `validate.mjs` flags

| Flag | Effect |
| --- | --- |
| `--in <path>` | Registry file (default: `registry.json` at the repo root) |
| `--sig <path>` | Signature file (default: `registry.json.sig`) |
| `--pub <path>` | Verification public key (default: `keys/market-public.pem`) |
| `--schema-only` | Validate schema only; implies `--no-sig` and `--skip-artifacts` |
| `--no-sig` | Skip signature verification |
| `--skip-artifacts` | Do not download artifacts |
| `--tolerate-network` | Downgrade retried 5xx/429 and network errors to warnings; 4xx always fails |

Artifact validation downloads each `artifact.url` and compares `size` and `sha256`. HTTP 4xx (404/403/410, etc.) is a permanent error and fails immediately; HTTP 5xx, 408, 425, 429, and network errors (DNS, connection, timeout) get up to 5 attempts (180-second timeout per request) and, with `--tolerate-network`, end as warnings. A `size`/`sha256` mismatch always fails.

## Usage

The App's Market tab loads the registry from the fixed URL:

- it verifies `registry.json.sig` with the built-in public key and requires `keyId` to match, then lists plugins, skills, and MCP;
- the registry is cached for 6 hours; if a refresh fails, the last cache is used;
- installed plugins and skills download and install updates automatically, retrying each entry at most every 5 minutes;
- MCP entries connect after you authorize or enter credentials in the App (remote HTTP only, no local commands).

To install a plugin manually, download the `.ddp` from its Release and use "Import plugin" on the App's Plugins screen. Imports are treated as untrusted sources: the App shows the plugin, publisher, and `sha256` before you confirm. Skills and MCP are installed or configured through the Market.

## Risks and trust boundaries

- **Third-party artifacts**: this repository distributes only the registry and hashes; plugin and skill contents come from their authors. On install, the App verifies the Ed25519 publisher signature inside the package against `publisherKeyId` in the registry. The safety of skills and MCP depends on their upstream sources and authors.
- **Mutable artifacts**: GitHub Release assets can be overwritten or deleted under the same name. After the registry is published, an artifact may still disappear or change; the App verifies `size`/`sha256` and refuses mismatched downloads, but the registry can still advertise an update. Before publishing, make sure the `artifact` target exists and will not change.
- **Deployment tolerance**: `release.yml` uses `--tolerate-network`; if an artifact still returns 5xx/429/network errors after retries, deployment continues with a warning. The daily `validate-artifacts.yml` run is the strict backstop. HTTP 4xx aborts the release immediately.
- **MCP**: third-party MCP services are governed by their own terms and privacy policies. API keys and OAuth credentials are stored by the App and sent only to that service; the market only accepts public remote HTTP endpoints.
- **Icons and previews**: `icons/` is deployed through Pages; `previews/` is served via `raw.githubusercontent.com`, so availability and content depend on the Git host.

## Licensing

- The scripts and workflows in this repository are licensed under [Apache-2.0](LICENSE) (same as the DeepDeep App).
- Third-party skills, plugins, and brand icons belong to their respective authors or trademark holders and follow the `skill.license` and upstream source recorded in each entry; MCP names and icons belong to their respective providers.
- This repository is not affiliated with or endorsed by any third-party service it lists.

## Disclaimer and feedback

- The registry and artifacts are provided as-is, without warranty. You decide whether to install third-party content and accept the risk.
- For issues, entry suggestions, or takedown requests, open an Issue or PR in this repository. Review and listing boundaries are described in the [Market Policy](https://github.com/Sadami3066/DeepDeep-Plugins/blob/master/MARKET_POLICY.md).
- For security or credential-related matters, do not post sensitive information in a public Issue; contact the repository maintainer directly.
