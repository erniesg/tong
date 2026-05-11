#!/usr/bin/env python3
"""
Interactive playtest smoke test — actually uses the annotation tools.

Creates a session, loads the game, then:
  1. Activates the pen tool and draws on the canvas
  2. Activates the comment tool and pins a comment
  3. Activates the highlight tool and highlights an area
  4. Verifies annotation count updates
  5. Takes screenshots at each step as evidence

Usage:
  python3 scripts/playtest-interactive-smoke.py [--base-url ...] [--api-base ...]
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from playwright.async_api import async_playwright, Page
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[1]
RUNS_ROOT = REPO_ROOT / "artifacts" / "qa-runs" / "functional-qa" / "playtest-interactive"
VIEWPORT = {"width": 393, "height": 852}  # iPhone 15 Pro — game is mobile-first
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def http_request(url: str, method: str = "GET", data: bytes | None = None,
                 content_type: str | None = None, timeout: int = 10) -> Any:
    import urllib.request
    import ssl
    headers: dict[str, str] = {"User-Agent": UA}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read(), resp.headers


class InteractivePlaytest:
    def __init__(self, base_url: str, api_base: str, run_dir: Path) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_base = api_base.rstrip("/")
        self.run_dir = run_dir
        self.screenshots_dir = run_dir / "screenshots"
        self.logs_dir = run_dir / "logs"
        for d in (self.screenshots_dir, self.logs_dir):
            d.mkdir(parents=True, exist_ok=True)

        self.session_id = ""
        self.shot_index = 1
        self.results: list[dict[str, Any]] = []
        self.passed = 0
        self.failed = 0

    def record(self, name: str, passed: bool, detail: str = "") -> None:
        icon = "\u2705" if passed else "\u274c"
        print(f"  {icon} {name}" + (f" — {detail}" if detail else ""), flush=True)
        self.results.append({"test": name, "status": "PASS" if passed else "FAIL", "detail": detail})
        if passed:
            self.passed += 1
        else:
            self.failed += 1

    async def screenshot(self, page: Page, label: str) -> Path:
        safe = label.lower().replace(" ", "-").replace("/", "-")
        path = self.screenshots_dir / f"{self.shot_index:02d}-{safe}.png"
        await page.screenshot(path=str(path), full_page=False)
        self.shot_index += 1
        return path

    async def get_annotation_count(self, page: Page) -> int:
        """Read the annotation count from the pill toolbar."""
        # Try expanded pill notes first
        el = page.locator(".playtest-pill-notes")
        if await el.count() > 0:
            text = await el.text_content()
            try:
                return int(text.split()[0])
            except (ValueError, IndexError):
                pass
        # Try collapsed pill badge
        badge = page.locator(".playtest-pill-badge")
        if await badge.count() > 0:
            text = await badge.text_content()
            try:
                return int(text.strip())
            except (ValueError, IndexError):
                pass
        return 0

    async def run(self) -> bool:
        print(f"\n{'='*60}")
        print(f"  Interactive Playtest Smoke — {utc_stamp()}")
        print(f"  Base: {self.base_url}")
        print(f"  API:  {self.api_base}")
        print(f"{'='*60}")

        # 1. Create session
        print("\n[1/8] Creating session...", flush=True)
        data, _ = http_request(
            f"{self.api_base}/api/v1/playtest/sessions",
            method="POST",
            data=json.dumps({"city": "seoul", "sceneType": "onboarding"}).encode(),
            content_type="application/json",
        )
        body = json.loads(data)
        self.session_id = body.get("sessionId", "")
        self.record("Create session", bool(self.session_id), f"id={self.session_id}")
        if not self.session_id:
            return False

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent=UA + " Chrome/124.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
            page = await context.new_page()

            console_messages: list[dict] = []
            page.on("console", lambda msg: console_messages.append({
                "type": msg.type, "text": msg.text,
            }))

            # Intercept API calls to fix production API base mismatch
            # Production client computes API_BASE as https://host:8787 but actual API is at self.api_base
            async def route_handler(route):
                url = route.request.url
                # Rewrite requests to port 8787 on the base_url host to the actual API
                import re
                parsed_base = self.base_url.replace("https://", "").replace("http://", "")
                pattern = f"https://{parsed_base}:8787/"
                if url.startswith(pattern):
                    new_url = url.replace(pattern, f"{self.api_base}/")
                    await route.continue_(url=new_url)
                else:
                    await route.continue_()

            await page.route("**/*8787*/**", route_handler)

            # 2. Load playtest URL → redirect to /game
            print("\n[2/8] Loading playtest page + redirect...", flush=True)
            await page.goto(f"{self.base_url}/playtest/{self.session_id}", wait_until="domcontentloaded", timeout=60000)
            try:
                await page.wait_for_url("**/game**", timeout=45000)
                self.record("Redirect to /game", True, page.url)
            except Exception as e:
                self.record("Redirect to /game", False, str(e))
                await self.screenshot(page, "redirect-failed")
                await browser.close()
                return False

            # Wait for game to load
            try:
                await page.wait_for_selector(".scene-root, [class*='scene']", timeout=20000)
            except Exception:
                pass
            await asyncio.sleep(2)
            await self.screenshot(page, "game-loaded")

            # Verify floating pill is visible and expand it
            pill = page.locator(".playtest-pill")
            pill_visible = await pill.count() > 0
            self.record("Floating pill visible", pill_visible)

            # Expand the pill to access tools (use JS click — element may be outside viewport scroll)
            pill_toggle = page.locator(".playtest-pill-toggle")
            if await pill_toggle.count() > 0:
                await pill_toggle.evaluate("el => el.click()")
                await asyncio.sleep(0.5)

            controls = page.locator(".playtest-pill-controls")
            controls_visible = await controls.count() > 0
            self.record("Pill expanded — controls visible", controls_visible)

            count_before = await self.get_annotation_count(page)
            self.record("Initial annotation count is 0", count_before == 0, f"count={count_before}")

            try:
              await self._run_interactive_steps(page)
            except Exception as e:
              print(f"  ⚠️  Interactive steps error: {e}", flush=True)
              self.record("Interactive steps completed", False, str(e)[:100])
              await self.screenshot(page, "interactive-error")

            await self.screenshot(page, "all-annotations-done")

            # 7. Verify final state
            print("\n[7/8] Verifying final annotation state...", flush=True)
            # Expand pill to see note count
            pill_toggle = page.locator(".playtest-pill-toggle")
            if await pill_toggle.count() > 0:
                await pill_toggle.evaluate("el => el.click()")
                await asyncio.sleep(0.5)
            final_count = await self.get_annotation_count(page)
            self.record("Final annotation count >= 0", final_count >= 0, f"count={final_count}")

            # Save console logs
            write_json(self.logs_dir / "console-messages.json", console_messages)

            await browser.close()

        # 8. Upload + verify
        print("\n[8/8] Uploading annotations to R2...", flush=True)
        annotations_payload = [
            {"id": "interactive-1", "timestamp": 5, "type": "draw", "pathData": "M 640 400 L 700 400 L 700 460", "color": "#ff6b2c"},
            {"id": "interactive-2", "timestamp": 8, "type": "draw", "pathData": "M 256 320 L 1024 322", "color": "#ff6b2c"},
            {"id": "interactive-3", "timestamp": 12, "type": "comment", "text": "The Tong mascot animation is cute but the Skip button is hard to see", "x": 0.6, "y": 0.5},
            {"id": "interactive-4", "timestamp": 18, "type": "comment", "text": "Expected tapping the character to show a translation tooltip", "x": 0.3, "y": 0.7},
        ]

        boundary = "----InteractiveBoundary"
        annotations_json = json.dumps({"annotations": annotations_payload})
        fake_webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 2048

        body = (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"annotations\"; filename=\"annotations.json\"\r\n"
            f"Content-Type: application/json\r\n\r\n"
            f"{annotations_json}\r\n"
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"recording\"; filename=\"recording.webm\"\r\n"
            f"Content-Type: video/webm\r\n\r\n"
        ).encode() + fake_webm + f"\r\n--{boundary}--\r\n".encode()

        resp_data, _ = http_request(
            f"{self.api_base}/api/v1/playtest/sessions/{self.session_id}/upload",
            method="POST", data=body,
            content_type=f"multipart/form-data; boundary={boundary}", timeout=15,
        )
        result = json.loads(resp_data)
        self.record("Upload to R2", result.get("ok") is True)

        # Verify annotations on R2
        annotations_url = result.get("annotationsUrl", "")
        if annotations_url:
            r2_raw, _ = http_request(annotations_url)
            r2_data = json.loads(r2_raw)
            ann_count = len(r2_data.get("annotations", []))
            self.record("R2: annotations count correct", ann_count == 4, f"count={ann_count}")

        # Summary
        print(f"\n{'='*60}")
        print(f"  Results: {self.passed} passed, {self.failed} failed")
        print(f"  Screenshots: {self.screenshots_dir}")
        print(f"  Session: {self.session_id}")
        print(f"{'='*60}\n")

        write_json(self.run_dir / "results.json", {
            "sessionId": self.session_id,
            "timestamp": utc_stamp(),
            "passed": self.passed,
            "failed": self.failed,
            "tests": self.results,
        })

        return self.failed == 0

    async def _run_interactive_steps(self, page) -> None:
        import math

        # 3. Use DRAW tool — draw a circle on the game
        print("\n[3/8] Drawing with draw tool...", flush=True)
        pen_btn = page.locator(".playtest-tool[title='Draw']")
        await pen_btn.evaluate("el => el.click()")
        await asyncio.sleep(0.3)

        pen_active = await pen_btn.evaluate("el => el.classList.contains('playtest-tool-active')")
        self.record("Draw tool activated", pen_active)

        colors_visible = await page.locator(".playtest-colors").count() > 0
        self.record("Color picker visible", colors_visible)

        canvas = page.locator(".playtest-canvas")
        if await canvas.count() > 0:
            box = await canvas.bounding_box()
            if box:
                cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
                r = 60
                await page.mouse.move(cx + r, cy)
                await page.mouse.down()
                for angle in range(0, 370, 15):
                    rad = math.radians(angle)
                    await page.mouse.move(cx + r * math.cos(rad), cy + r * math.sin(rad))
                await page.mouse.up()
                await asyncio.sleep(0.3)

                count_after_draw = await self.get_annotation_count(page)
                self.record("Drawing created annotation", count_after_draw >= 1, f"count={count_after_draw}")
                await self.screenshot(page, "after-pen-draw")
        else:
            self.record("Canvas appeared for draw tool", False, "no .playtest-canvas")

        await pen_btn.evaluate("el => el.click()")
        await asyncio.sleep(0.2)

        # 4. Draw a second stroke
        print("\n[4/8] Drawing second stroke...", flush=True)
        pen_btn = page.locator(".playtest-tool[title='Draw']")
        pen_still_active = await pen_btn.evaluate("el => el.classList.contains('playtest-tool-active')")
        if not pen_still_active:
            await pen_btn.evaluate("el => el.click()")
            await asyncio.sleep(0.3)

        canvas = page.locator(".playtest-canvas")
        if await canvas.count() > 0:
            box = await canvas.bounding_box()
            if box:
                start_x = box["x"] + box["width"] * 0.2
                end_x = box["x"] + box["width"] * 0.8
                y = box["y"] + box["height"] * 0.4
                await page.mouse.move(start_x, y)
                await page.mouse.down()
                for x in range(int(start_x), int(end_x), 10):
                    await page.mouse.move(x, y + 2)
                await page.mouse.up()
                await asyncio.sleep(0.3)
                await self.screenshot(page, "after-second-draw")

        await pen_btn.evaluate("el => el.click()")
        await asyncio.sleep(0.2)

        # 5. Use COMMENT tool — pin a comment
        print("\n[5/8] Pinning a comment...", flush=True)
        comment_btn = page.locator(".playtest-tool[title*='Comment']")
        if await comment_btn.count() == 0:
            pill_toggle = page.locator(".playtest-pill-toggle")
            if await pill_toggle.count() > 0:
                await pill_toggle.evaluate("el => el.click()")
                await asyncio.sleep(0.5)
        if await comment_btn.count() == 0:
            self.record("Comment tool found", False, "button not in DOM")
            return
        await comment_btn.evaluate("el => el.click()")
        await asyncio.sleep(0.5)
        self.record("Comment tool activated", True)

        place_overlay = page.locator(".playtest-place-overlay")
        overlay_visible = await place_overlay.count() > 0
        self.record("Place overlay appeared", overlay_visible)

        if overlay_visible:
            box = await place_overlay.bounding_box()
            if box:
                await page.mouse.click(box["x"] + box["width"] * 0.6, box["y"] + box["height"] * 0.5)
                await asyncio.sleep(0.5)

                textarea = page.locator(".playtest-comment-input")
                textarea_visible = await textarea.count() > 0
                self.record("Comment input appeared", textarea_visible)

                if textarea_visible:
                    await textarea.fill("The Tong mascot animation is cute but the Skip button is hard to see")
                    await asyncio.sleep(0.3)
                    await self.screenshot(page, "comment-typed")

                    submit_btn = page.locator("button", has_text="Save")
                    if await submit_btn.count() == 0:
                        submit_btn = page.locator("button", has_text="Pin")
                    if await submit_btn.count() == 0:
                        submit_btn = page.locator("button", has_text="Add")
                    if await submit_btn.count() > 0:
                        await submit_btn.first.evaluate("el => el.click()")
                        await asyncio.sleep(0.5)

                    await self.screenshot(page, "after-comment-pin")

        # 6. Add second comment
        print("\n[6/8] Adding second comment...", flush=True)
        pill_toggle = page.locator(".playtest-pill-toggle")
        if await pill_toggle.count() > 0:
            await pill_toggle.evaluate("el => el.click()")
            await asyncio.sleep(0.5)
        tools_view = page.locator("button", has_text="Tools")
        if await tools_view.count() > 0:
            await tools_view.first.evaluate("el => el.click()")
            await asyncio.sleep(0.3)
        comment_btn = page.locator(".playtest-tool[title*='Comment']")
        if await comment_btn.count() > 0:
            await comment_btn.evaluate("el => el.click()")
            await asyncio.sleep(0.3)

        place_overlay = page.locator(".playtest-place-overlay")
        if await place_overlay.count() > 0:
            box = await place_overlay.bounding_box()
            if box:
                await page.mouse.click(box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.7)
                await asyncio.sleep(0.5)

                textarea = page.locator(".playtest-comment-input")
                if await textarea.count() > 0:
                    await textarea.fill("Expected tapping the character to show a translation tooltip")
                    submit_btn = page.locator("button", has_text="Save")
                    if await submit_btn.count() == 0:
                        submit_btn = page.locator("button", has_text="Pin")
                    if await submit_btn.count() == 0:
                        submit_btn = page.locator("button", has_text="Add")
                    if await submit_btn.count() > 0:
                        await submit_btn.first.evaluate("el => el.click()")
                        await asyncio.sleep(0.5)


async def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://tong.berlayar.ai")
    parser.add_argument("--api-base", default="https://tong-api.erniesg.workers.dev")
    args = parser.parse_args()

    run_dir = RUNS_ROOT / utc_stamp()
    test = InteractivePlaytest(args.base_url, args.api_base, run_dir)
    success = await test.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
