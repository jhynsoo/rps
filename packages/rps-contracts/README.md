# @rps/contracts

Shared runtime and TypeScript contracts for the RPS server and web client.

Edit `src/index.ts` only. The runtime build outputs include:

- `dist/index.mjs` for ESM consumers
- `dist/index.cjs` for CommonJS consumers

The build also emits declaration artifacts under `dist/`, but local TypeScript consumers currently resolve types from `src/index.ts`.

Run these checks after changing contracts:

```bash
pnpm --filter @rps/contracts test
pnpm check-types
pnpm test
```
