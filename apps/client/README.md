# apps/client

Next.js mobile-first client application.

Current demo responsibilities:
1. Video player page with subtitle overlay lanes.
2. Dictionary hover/tap panel.
3. Last-3-days vocab + media signal visualization.
4. Profile setup and "Start New Game"/resume flow.
5. Game scene UI with Tong assistant chat panel.
6. Shanghai advanced texting mission reward preview.

Implementation rules:
- Use shared contracts from `packages/contracts` and mocked data first.
- Load demo state directly from `packages/contracts/fixtures`.
- Keep `demo_fast_path` and `auto_pass_checks` toggleable via query params.

Run from repo root:
```bash
npm install
npm run client:dev
```

Validate in browser:
- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000?demo_fast_path=true&auto_pass_checks=true](http://localhost:3000?demo_fast_path=true&auto_pass_checks=true)
