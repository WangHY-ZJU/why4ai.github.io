#!/usr/bin/env python3
"""Build the homepage, then serve dist/ for local preview."""

from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import sys
import webbrowser
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))
from build import build  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="构建并启动主页本地预览")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    try:
        output = build()
    except (OSError, ValueError) as exc:
        print(f"构建失败：{exc}", file=sys.stderr)
        return 1
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(output))
    try:
        with socketserver.TCPServer((args.host, args.port), handler) as server:
            address = f"http://{args.host}:{args.port}/"
            print(f"本地预览：{address}")
            print(f"维护页：{address}editor/")
            print("按 Ctrl+C 停止预览。")
            if not args.no_browser:
                webbrowser.open(address)
            server.serve_forever()
    except KeyboardInterrupt:
        print("\n预览已停止。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
