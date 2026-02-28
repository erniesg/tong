# packages/contracts

Shared schema and examples for client/server parallel development.

Keep this package stable:
1. Update here first for any payload shape change.
2. Client and server both consume from here.
3. Add examples for all new fields.

Typed contracts:
- `types.ts` defines TypeScript request/response models for Tong demo endpoints.
- `index.ts` re-exports typed contracts for app usage.
