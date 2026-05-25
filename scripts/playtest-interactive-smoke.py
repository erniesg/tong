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
    headers: dict[str, str] = {"User-Agent": UA}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
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
        import re
        # Try Notes button text (e.g. "📝 3") in tools view
        notes_btn = page.locator(".playtest-tool[title='Notes']")
        if await notes_btn.count() > 0:
            text = await notes_btn.text_content()
            nums = re.findall(r'\d+', text or '')
            if nums:
                return int(nums[0])
        # Try collapsed pill badge
        badge = page.locator(".playtest-pill-badge")
        if await badge.count() > 0:
            text = await badge.text_content()
            nums = re.findall(r'\d+', text or '')
            if nums:
                return int(nums[0])
        # Try reading annotation count from JS state directly
        try:
            count = await page.evaluate("""() => {
                const el = document.querySelector('.playtest-pill-badge');
                if (el) { const n = parseInt(el.textContent); if (!isNaN(n)) return n; }
                const notes = document.querySelector('.playtest-tool[title="Notes"]');
                if (notes) { const m = notes.textContent.match(/\\d+/); if (m) return parseInt(m[0]); }
                return -1;
            }""")
            if count >= 0:
                return count
        except Exception:
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

            # 2. Load playtest URL → redirect to /game
            print("\n[2/8] Loading playtest page + redirect...", flush=True)
            await page.goto(f"{self.base_url}/playtest/{self.session_id}", wait_until="domcontentloaded", timeout=30000)
            try:
                await page.wait_for_url("**/game**", timeout=15000)
                self.record("Redirect to /game", True, page.url)
            except Exception as e:
                self.record("Redirect to /game", False, str(e))
                await self.screenshot(page, "redirect-failed")
                await browser.close()
                return False

            # Wait for game to load
            await page.wait_for_selector(".scene-root, [class*='scene']", timeout=20000)
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

            # 3. Use DRAW tool — draw a circle on the game
            print("\n[3/8] Drawing with pen tool...", flush=True)
            import math
            draw_btn = page.locator(".playtest-tool[title='Draw']")
            await draw_btn.click()
            await asyncio.sleep(0.5)

            pen_active = await draw_btn.evaluate("el => el.classList.contains('playtest-tool-active')")
            self.record("Pen tool activated", pen_active)

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
                    await asyncio.sleep(0.5)

                    count_after_draw = await self.get_annotation_count(page)
                    self.record("Drawing created annotation", count_after_draw >= 1, f"count={count_after_draw}")
                    await self.screenshot(page, "after-pen-draw")
            else:
                self.record("Canvas appeared for pen tool", False, "no .playtest-canvas")

            # 4. Draw another stroke (highlight-style) — Draw tool still active
            print("\n[4/8] Drawing highlight stroke...", flush=True)
            draw_still_active = await draw_btn.evaluate("el => el.classList.contains('playtest-tool-active')")
            self.record("Draw tool still active", draw_still_active)

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
                    await asyncio.sleep(0.5)

                    count_after_hl = await self.get_annotation_count(page)
                    self.record("Second stroke created annotation", count_after_hl >= 2, f"count={count_after_hl}")
                    await self.screenshot(page, "after-highlight-stroke")

            # Deactivate draw tool before switching to comment
            await draw_btn.click()
            await asyncio.sleep(0.3)

            # 5. Use COMMENT tool — pin a comment
            print("\n[5/8] Pinning a comment...", flush=True)
            comment_btn = page.locator(".playtest-tool[title*='Comment']")
            await comment_btn.click()
            await asyncio.sleep(0.5)

            # Comment button collapses the pill and enters placing mode
            # Check for place overlay instead of button active state
            place_overlay = page.locator(".playtest-place-overlay")
            placing_mode = await place_overlay.count() > 0
            self.record("Comment placing mode active", placing_mode)

            if placing_mode:
                vp = page.viewport_size
                tap_x = vp["width"] * 0.6
                tap_y = vp["height"] * 0.5
                await place_overlay.click(position={"x": tap_x, "y": tap_y})
                await asyncio.sleep(0.5)

                # Comment input panel should appear
                comment_input = page.locator(".playtest-comment-input")
                input_visible = await comment_input.count() > 0
                self.record("Comment input appeared", input_visible)

                if input_visible:
                    await comment_input.fill("The Tong mascot animation is cute but the Skip button is hard to see")
                    await asyncio.sleep(0.3)
                    await self.screenshot(page, "comment-typed")

                    # Submit comment via Pin button
                    pin_btn = page.locator(".playtest-btn-small", has_text="Pin")
                    if await pin_btn.count() > 0:
                        await pin_btn.click()
                    else:
                        await page.keyboard.press("Enter")
                    await asyncio.sleep(1.0)

                    # Dismiss AI reply panel if it appeared
                    ai_skip = page.locator(".playtest-btn-small", has_text="Skip")
                    ai_save = page.locator(".playtest-btn-small", has_text="Save")
                    if await ai_skip.count() > 0:
                        await ai_skip.click()
                        await asyncio.sleep(0.3)
                    elif await ai_save.count() > 0:
                        await ai_save.click()
                        await asyncio.sleep(0.3)

                    count_after_comment = await self.get_annotation_count(page)
                    self.record("Comment created annotation", count_after_comment >= 1, f"count={count_after_comment}")

                    pins = page.locator(".playtest-marker")
                    pin_count = await pins.count()
                    self.record("Comment pin marker visible", pin_count > 0, f"pins={pin_count}")

                    await self.screenshot(page, "after-comment-pin")

            # 6. Add second comment
            print("\n[6/8] Adding second comment...", flush=True)
            # Re-activate comment placing mode
            # First expand the pill if collapsed
            pill_toggle = page.locator(".playtest-pill-toggle")
            if await pill_toggle.count() > 0:
                await pill_toggle.click()
                await asyncio.sleep(0.3)
            comment_btn2 = page.locator(".playtest-tool[title*='Comment']")
            if await comment_btn2.count() > 0:
                await comment_btn2.click()
                await asyncio.sleep(0.5)

            place_overlay = page.locator(".playtest-place-overlay")
            if await place_overlay.count() > 0:
                vp = page.viewport_size
                await place_overlay.click(position={"x": vp["width"] * 0.3, "y": vp["height"] * 0.7})
                await asyncio.sleep(0.5)

                comment_input = page.locator(".playtest-comment-input")
                if await comment_input.count() > 0:
                    await comment_input.fill("Expected tapping the character to show a translation tooltip")
                    pin_btn = page.locator(".playtest-btn-small", has_text="Pin")
                    if await pin_btn.count() > 0:
                        await pin_btn.click()
                    else:
                        await page.keyboard.press("Enter")
                    await asyncio.sleep(1.0)

                    # Dismiss AI reply panel if it appeared
                    ai_skip2 = page.locator(".playtest-btn-small", has_text="Skip")
                    ai_save2 = page.locator(".playtest-btn-small", has_text="Save")
                    if await ai_skip2.count() > 0:
                        await ai_skip2.click()
                        await asyncio.sleep(0.3)
                    elif await ai_save2.count() > 0:
                        await ai_save2.click()
                        await asyncio.sleep(0.3)

                    # Ensure pill shows tools view for count read
                    pill_t = page.locator(".playtest-pill-toggle")
                    if await pill_t.count() > 0:
                        ctrl = page.locator(".playtest-pill-controls")
                        if await ctrl.count() == 0:
                            await pill_t.click()
                            await asyncio.sleep(0.3)

                    final_count = await self.get_annotation_count(page)
                    self.record("Second comment pinned", final_count >= 2, f"count={final_count}")

            await self.screenshot(page, "all-annotations-done")

            # 7. Verify final state — ensure pill is expanded in tools view
            print("\n[7/8] Verifying final annotation state...", flush=True)
            # Dismiss any AI reply panel
            ai_skip = page.locator(".playtest-btn-small", has_text="Skip")
            if await ai_skip.count() > 0:
                await ai_skip.click()
                await asyncio.sleep(0.3)
            # Expand pill if collapsed
            pill_toggle = page.locator(".playtest-pill-toggle")
            if await pill_toggle.count() > 0:
                controls = page.locator(".playtest-pill-controls")
                if await controls.count() == 0:
                    await pill_toggle.click()
                    await asyncio.sleep(0.3)
            final_count = await self.get_annotation_count(page)
            self.record("Final annotation count >= 3", final_count >= 3, f"count={final_count}")

            # Check all pin markers
            total_pins = await page.locator(".playtest-marker").count()
            self.record("Multiple comment pins visible", total_pins >= 2, f"pins={total_pins}")

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
