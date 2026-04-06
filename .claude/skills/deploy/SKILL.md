---
name: deploy
description: Build and deploy the tong client to Cloudflare Workers via OpenNext. Deploys to tong.berlayar.ai.
allowed-tools: Bash(npx *), Bash(cd *), Bash(rm *), Bash(find *), Bash(npm *)
---

# Deploy Client to Cloudflare Workers

Build the Next.js client with the OpenNext Cloudflare adapter and deploy to the `tong-berlayar-web` worker with custom domain `tong.berlayar.ai`.

## Steps

1. Change to the client app directory:
   ```bash
   cd /Users/erniesg/code/erniesg/tong/apps/client
   ```

2. Type-check first:
   ```bash
   npx tsc --noEmit 2>&1 | grep -v "integrations/page"
   ```
   If there are errors (after filtering), stop and report them.

3. Build with OpenNext:
   ```bash
   npx opennextjs-cloudflare build
   ```

4. Remove any oversized assets (CF Workers limit is 25MB per file):
   ```bash
   find .open-next/assets -size +25M -type f -exec rm -f {} \;
   ```

5. Deploy with custom domain:
   ```bash
   npx wrangler deploy --keep-vars --domain tong.berlayar.ai
   ```

6. Verify the deploy output shows both:
   - `https://tong-berlayar-web.erniesg.workers.dev`
   - `tong.berlayar.ai (custom domain)`

7. Report the deployed version ID and confirm live at `https://tong.berlayar.ai`.

## Notes

- The `cf:build` and `cf:deploy` npm scripts in `apps/client/package.json` wrap these commands.
- The full deploy script at `scripts/deploy-client-cloudflare.sh` also uploads runtime assets to R2, but that step can fail independently of the code deploy.
- Worker API is separate: deploy with `npm --prefix apps/worker run deploy`.
