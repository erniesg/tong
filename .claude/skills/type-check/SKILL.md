---
name: type-check
description: Run TypeScript type checking and filter out known pre-existing errors.
disable-model-invocation: true
allowed-tools: Bash(npx tsc *)
---

# Type Check

Run the TypeScript compiler in the client app directory, filtering out known pre-existing errors that are not related to current work.

## Steps

1. Change to the client app directory:
   ```bash
   cd /Users/erniesg/code/erniesg/tong/apps/client
   ```

2. Run `npx tsc --noEmit` and filter results:
   ```bash
   npx tsc --noEmit 2>&1 | grep -v "integrations/page"
   ```

3. The `integrations/page.tsx` errors are pre-existing and unrelated to game development. Ignore them.

4. Report any remaining errors with file path and line number.

5. If clean (no output after filtering), report success.
