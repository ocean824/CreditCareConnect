# Security Audit – Dependency Vulnerability Tracking

## Status: May 2026

**Audit result:** 4 moderate advisories remain (down from 44 total).  
All critical, high, and low severity vulnerabilities have been resolved.

---

## Resolved Vulnerabilities (May 2026)

| Package | Severity | Fix Applied |
|---|---|---|
| basic-ftp ≤5.2.x | Critical/High | Overridden to ≥6.0.0 via npm overrides |
| drizzle-orm 0.39.x | High | Updated to 0.45.2 |
| vite ≤7.3.1 / 5.x | High/Medium | Updated to 7.3.2 |
| lodash ≤4.17.23 | High/Medium | Updated to 4.18.1 via npm audit fix |
| multer ≤2.0.x | High | Was already at 2.1.1 |
| minimatch, glob, rollup | High | Were already at safe versions |
| picomatch, brace-expansion | High/Medium | Were already at safe versions |
| postcss ≤8.5.9 | Medium | Updated to 8.5.14 via npm audit fix |
| fast-xml-parser ≤5.6.x | Medium | Updated to 5.7.3 via npm audit fix |
| ip-address ≤10.1.0 | Medium | Updated to 10.2.0 via npm audit fix |
| http-proxy-agent / @tootallnate/once | Low | Overridden http-proxy-agent to ≥7.0.0 |
| esbuild@0.21.5 (vite 5.x) | Medium | Resolved by vite upgrade to 7.3.2 |
| path-to-regexp, qs, yaml, js-yaml | Low/Medium | Were already at safe versions |

---

## Accepted Risk – Remaining 4 Moderate Advisories

**Advisory:** GHSA-67mh-4wv8-2f99 (esbuild ≤0.24.2 dev server exposure)

**Affected packages (all in drizzle-kit's legacy toolchain):**
- `@esbuild-kit/core-utils` [moderate]
- `@esbuild-kit/esm-loader` [moderate]
- `drizzle-kit` [moderate]
- `esbuild@0.18.20` (nested under @esbuild-kit/core-utils) [moderate]

**Why the suggested fix is rejected:**  
npm audit recommends downgrading `drizzle-kit` to `0.18.1` — a major regression from the current `0.31.x`. This is incorrect guidance. No version of drizzle-kit resolves this chain (the advisory covers all drizzle-kit versions that use @esbuild-kit).

**Why risk is accepted:**  
The vulnerability (GHSA-67mh-4wv8-2f99) allows arbitrary websites to send requests to esbuild's **development HTTP server** (port 0.0.0.0) and read responses. `drizzle-kit` uses esbuild exclusively for TypeScript code **transformation** (`esbuild.transform()`), never as a dev server. The vulnerable code path (`startDevServer()`) is never invoked during `drizzle-kit` usage. Additionally, `drizzle-kit` is a **dev-only tool** (schema migration), not present in production builds.

**Monitoring:**  
- Watch [drizzle-kit releases](https://github.com/drizzle-team/drizzle-kit-mirror/releases) for removal of the `@esbuild-kit` dependency.
- Re-run `npm audit` after each drizzle-kit minor/major release.
- CI should gate on `--audit-level=high` (these moderate exceptions will be permitted through).

---

## Recommended CI Audit Gate

```bash
npm audit --audit-level=high
```

This fails the build on any new critical or high severity vulnerability while permitting the 4 known moderate exceptions documented above.
