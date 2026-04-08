#!/usr/bin/env python3
"""Extract XHS cookies from Chrome and save to .xhs-cookie for the pipeline."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
COOKIE_FILE = REPO_ROOT / '.xhs-cookie'

try:
    import browser_cookie3
except ImportError:
    print("Install: pip3 install browser-cookie3")
    sys.exit(1)

try:
    cj = browser_cookie3.chrome(domain_name='.xiaohongshu.com')
    cookies = {c.name: c.value for c in cj}
except Exception as e:
    print(f"Failed to read Chrome cookies: {e}")
    print("Try closing Chrome first, or grant terminal Full Disk Access.")
    sys.exit(1)

if 'a1' not in cookies or 'web_session' not in cookies:
    print(f"Missing required cookies. Found: {list(cookies.keys())}")
    print("Log into https://www.xiaohongshu.com in Chrome first.")
    sys.exit(1)

cookie_str = '; '.join(f'{k}={v}' for k, v in cookies.items())
COOKIE_FILE.write_text(cookie_str)
print(f"Saved {len(cookies)} cookies ({len(cookie_str)} chars) to {COOKIE_FILE}")
print("Keys:", list(cookies.keys()))
print("\nRefresh by re-running this script when searches start failing (~7 days).")
