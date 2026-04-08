#!/usr/bin/env python3
"""
XHS search via the `xhs` Python library (reverse-engineered API client).

Usage:
  python scripts/xhs-search.py search "学韩语" --limit 10
  python scripts/xhs-search.py detail <note_id>
  python scripts/xhs-search.py download <note_id> --output ./downloads/
  python scripts/xhs-search.py setup          # interactive cookie setup

Cookie setup (one-time, refresh every ~7 days):
  1. Open https://www.xiaohongshu.com in Chrome, log in
  2. DevTools (F12) → Application → Cookies → xiaohongshu.com
  3. Copy the full cookie string (or just a1 + web_session + webId values)
  4. Run: python scripts/xhs-search.py setup
     OR: set XHS_COOKIE env var / save to .xhs-cookie file

Output: JSON to stdout (for piping to Node.js pipeline)
"""

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
COOKIE_FILE = REPO_ROOT / '.xhs-cookie'


def get_cookie():
    """Get XHS cookie from env var or file."""
    # 1. Environment variable
    cookie = os.environ.get('XHS_COOKIE', '')
    if cookie:
        return cookie

    # 2. Cookie file
    if COOKIE_FILE.exists():
        cookie = COOKIE_FILE.read_text().strip()
        if cookie:
            return cookie

    return ''


def make_client(cookie):
    """Create XhsClient with cookie and built-in signing."""
    from xhs import XhsClient
    from xhs.help import sign as xhs_sign

    def sign_wrapper(uri, data=None, a1='', web_session=''):
        return xhs_sign(uri, data, a1=a1)

    return XhsClient(cookie=cookie, sign=sign_wrapper)


def cmd_setup():
    """Interactive cookie setup."""
    print("XHS Cookie Setup")
    print("=" * 40)
    print()
    print("1. Open https://www.xiaohongshu.com in Chrome")
    print("2. Log in to your account")
    print("3. Open DevTools (F12) → Network tab")
    print("4. Refresh the page")
    print("5. Click any request to xiaohongshu.com")
    print("6. In Headers tab, find 'Cookie:' and copy the ENTIRE value")
    print()

    cookie = input("Paste your cookie string here:\n> ").strip()
    if not cookie:
        print("No cookie provided. Aborting.")
        sys.exit(1)

    # Validate it has the required fields
    required = ['a1=', 'web_session=']
    missing = [r for r in required if r not in cookie]
    if missing:
        print(f"Warning: cookie might be incomplete — missing: {', '.join(missing)}")
        print("The cookie should contain a1, web_session, and webId values.")

    # Save to file
    COOKIE_FILE.write_text(cookie)
    print(f"\nCookie saved to {COOKIE_FILE}")
    print("This will be used automatically by the search pipeline.")
    print("Refresh every ~7 days when searches start failing.")

    # Test it
    print("\nTesting...")
    try:
        client = make_client(cookie)
        result = client.get_note_by_keyword('test', page=1, page_size=1)
        items = result.get('items', [])
        print(f"Search works! Got {len(items)} result(s).")
    except Exception as e:
        print(f"Search failed: {e}")
        print("The cookie might be invalid or expired. Try again.")


def cmd_search(keyword, limit=20, sort='general', note_type=0, page=1):
    """Search XHS and output JSON."""
    from xhs.core import SearchSortType, SearchNoteType

    cookie = get_cookie()
    if not cookie:
        json.dump({
            'error': 'no_cookie',
            'message': 'XHS cookie not configured. Run: python scripts/xhs-search.py setup',
        }, sys.stdout)
        sys.exit(1)

    sort_map = {
        'general': SearchSortType.GENERAL,
        'popularity_descending': SearchSortType.MOST_POPULAR,
        'time_descending': SearchSortType.LATEST,
    }
    type_map = {
        0: SearchNoteType.ALL,
        1: SearchNoteType.VIDEO,
        2: SearchNoteType.IMAGE,
    }

    client = make_client(cookie)
    result = client.get_note_by_keyword(
        keyword,
        page=page,
        page_size=min(limit, 20),
        sort=sort_map.get(sort, SearchSortType.GENERAL),
        note_type=type_map.get(note_type, SearchNoteType.ALL),
    )

    items = result.get('items', [])
    normalised = []
    for item in items[:limit]:
        note = item.get('note_card', item)
        user = note.get('user', {})
        interact = note.get('interact_info', {})
        images = note.get('image_list', note.get('images_list', []))

        normalised.append({
            'platform': 'xiaohongshu',
            'keyword': keyword,
            'type': note.get('type', 'normal'),
            'note_id': note.get('note_id', item.get('id', '')),
            'title': note.get('display_title', note.get('title', '')),
            'desc': note.get('desc', '')[:300],
            'author': user.get('nickname', user.get('nick_name', '')),
            'user_id': user.get('user_id', ''),
            'stats': {
                'likes': _parse_count(interact.get('liked_count', 0)),
                'collects': _parse_count(interact.get('collected_count', 0)),
                'comments': _parse_count(interact.get('comment_count', 0)),
                'shares': _parse_count(interact.get('share_count', 0)),
            },
            'cover_url': images[0].get('url_default', images[0].get('url', '')) if images else '',
            'image_count': len(images),
            'has_video': note.get('type') == 'video',
            'video_page_url': f"https://www.xiaohongshu.com/explore/{note.get('note_id', '')}",
            'tags': [t.get('name', '') for t in note.get('tag_list', [])],
        })

    json.dump({
        'keyword': keyword,
        'count': len(normalised),
        'has_more': result.get('has_more', False),
        'items': normalised,
        '_provider': 'xhs-python',
    }, sys.stdout, ensure_ascii=False, indent=2)


def cmd_detail(note_id):
    """Get full note detail including video URLs."""
    from xhs.help import get_video_url_from_note, get_imgs_url_from_note

    cookie = get_cookie()
    if not cookie:
        json.dump({'error': 'no_cookie'}, sys.stdout)
        sys.exit(1)

    client = make_client(cookie)
    data = client.get_note_by_id(note_id)
    note = data.get('note_card', data) if isinstance(data, dict) else data

    # Extract media URLs
    video_url = None
    image_urls = []
    try:
        video_url = get_video_url_from_note(data)
    except Exception:
        pass
    try:
        image_urls = get_imgs_url_from_note(data)
    except Exception:
        pass

    interact = note.get('interact_info', {})
    user = note.get('user', {})

    json.dump({
        'note_id': note_id,
        'title': note.get('title', note.get('display_title', '')),
        'desc': note.get('desc', ''),
        'type': note.get('type', ''),
        'author': user.get('nickname', ''),
        'user_id': user.get('user_id', ''),
        'stats': {
            'likes': _parse_count(interact.get('liked_count', 0)),
            'collects': _parse_count(interact.get('collected_count', 0)),
            'comments': _parse_count(interact.get('comment_count', 0)),
            'shares': _parse_count(interact.get('share_count', 0)),
        },
        'video_url': video_url,
        'image_urls': image_urls,
        'tags': [t.get('name', '') for t in note.get('tag_list', [])],
        '_provider': 'xhs-python',
    }, sys.stdout, ensure_ascii=False, indent=2)


def cmd_download(note_id, output_dir='.'):
    """Download all files from a note."""
    cookie = get_cookie()
    if not cookie:
        json.dump({'error': 'no_cookie'}, sys.stdout)
        sys.exit(1)

    client = make_client(cookie)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    client.save_files_from_note_id(note_id, str(out))

    # List what was downloaded
    files = list(out.glob(f'{note_id}*'))
    json.dump({
        'note_id': note_id,
        'downloaded': [str(f) for f in files],
        'count': len(files),
    }, sys.stdout, ensure_ascii=False, indent=2)


def _parse_count(val):
    """Parse count values that might be strings like '1.2万'."""
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        val = val.strip()
        if val.endswith('万'):
            return int(float(val[:-1]) * 10000)
        if val.endswith('亿'):
            return int(float(val[:-1]) * 100000000)
        try:
            return int(val)
        except ValueError:
            return 0
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='XHS search/download via Python xhs library')
    sub = parser.add_subparsers(dest='command')

    p_setup = sub.add_parser('setup', help='Interactive cookie setup')

    p_search = sub.add_parser('search', help='Search notes by keyword')
    p_search.add_argument('keyword', help='Search term')
    p_search.add_argument('--limit', type=int, default=20)
    p_search.add_argument('--sort', default='general', choices=['general', 'popularity_descending', 'time_descending'])
    p_search.add_argument('--note-type', type=int, default=0, choices=[0, 1, 2], help='0=all, 1=video, 2=image')
    p_search.add_argument('--page', type=int, default=1)

    p_detail = sub.add_parser('detail', help='Get note detail with media URLs')
    p_detail.add_argument('note_id', help='XHS note ID')

    p_dl = sub.add_parser('download', help='Download files from a note')
    p_dl.add_argument('note_id', help='XHS note ID')
    p_dl.add_argument('--output', default='./artifacts/xhs-downloads/')

    args = parser.parse_args()

    if args.command == 'setup':
        cmd_setup()
    elif args.command == 'search':
        cmd_search(args.keyword, args.limit, args.sort, args.note_type, args.page)
    elif args.command == 'detail':
        cmd_detail(args.note_id)
    elif args.command == 'download':
        cmd_download(args.note_id, args.output)
    else:
        parser.print_help()
