# @rps/contracts

Shared runtime and TypeScript contracts for the RPS server and web client.

Edit `src/index.ts` only. The package build generates:

- `dist/index.mjs` for ESM consumers
- `dist/index.cjs` for CommonJS consumers
- `dist/index.d.ts` for packaged declaration output

Run these checks after changing contracts:

```bash
pnpm --filter @rps/contracts test
pnpm check-types
pnpm test
```
