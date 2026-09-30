#!/usr/bin/env python3
"""Validate the single source of public site content (standard library only)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "site.json"
LOCAL_RE = re.compile(r"^assets/(?:images|files)/[A-Za-z0-9._/-]+$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}
SENSITIVE_KEYS = {"password", "passwd", "token", "secret", "credential", "api_key", "private_key"}


def is_text(value: object) -> bool:
    return isinstance(value, str)


def filled(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def local_path(value: object) -> bool:
    if not isinstance(value, str) or not LOCAL_RE.fullmatch(value):
        return False
    return all(part not in {"", ".", ".."} for part in value.split("/"))


def web_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.hostname) and not (parsed.username or parsed.password)


def valid_link(value: object) -> bool:
    return value == "" or local_path(value) or web_url(value)


def load_data(path: Path = DEFAULT_DATA) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"无法读取 JSON：{path}：{exc}") from exc
    if not isinstance(value, dict):
        raise ValueError("顶层 JSON 必须是对象。")
    return value


def validate(data: dict, root: Path = ROOT, check_files: bool = True) -> list[str]:
    errors: list[str] = []

    def text_field(item: dict, key: str, context: str, required: bool = False) -> None:
        value = item.get(key, "")
        if not is_text(value):
            errors.append(f"{context}.{key} 必须是文字。")
        elif required and not filled(value):
            errors.append(f"{context}.{key} 不能为空。")

    def text_array(item: dict, key: str, context: str) -> None:
        value = item.get(key, [])
        if not isinstance(value, list) or not all(is_text(part) for part in value):
            errors.append(f"{context}.{key} 必须是文字数组。")

    def link(item: dict, key: str, context: str) -> None:
        value = item.get(key, "")
        if not valid_link(value):
            errors.append(f"{context}.{key} 必须是 http(s) 网址或 assets/ 下的安全相对路径。")
        elif check_files and local_path(value) and not (root / value).is_file():
            errors.append(f"{context}.{key} 指向的本地文件不存在：{value}")

    def image(item: dict, path_key: str, alt_key: str, context: str) -> None:
        value = item.get(path_key, "")
        text_field(item, path_key, context)
        text_field(item, alt_key, context)
        if not value:
            return
        if not local_path(value) or not value.startswith("assets/images/") or Path(value).suffix.lower() not in IMAGE_EXTENSIONS:
            errors.append(f"{context}.{path_key} 必须是 assets/images/ 下的 PNG、JPG、WebP、GIF 或 AVIF 路径。")
        elif check_files and not (root / value).is_file():
            errors.append(f"{context}.{path_key} 指向的图片不存在：{value}")
        if not filled(item.get(alt_key, "")):
            errors.append(f"{context}.{alt_key}：有图片时必须填写替代文本。")

    def scan_sensitive(value: object, context: str = "data") -> None:
        if isinstance(value, dict):
            for key, part in value.items():
                if isinstance(key, str) and key.lower() in SENSITIVE_KEYS:
                    errors.append(f"{context}.{key} 不允许存放凭据或密钥。")
                scan_sensitive(part, f"{context}.{key}")
        elif isinstance(value, list):
            for index, part in enumerate(value):
                scan_sensitive(part, f"{context}[{index}]")

    scan_sensitive(data)
    if type(data.get("schema_version")) is not int or data.get("schema_version") != 1:
        errors.append("schema_version 必须是 1。")
    site = data.get("site")
    if not isinstance(site, dict):
        errors.append("site 必须是对象。")
    else:
        if site.get("language") not in {"en", "zh"}:
            errors.append("site.language 必须是 en 或 zh。")
        url = site.get("url", "")
        if not is_text(url) or (url and (not web_url(url) or urlsplit(url).query or urlsplit(url).fragment)):
            errors.append("site.url 必须留空或填写不带参数和锚点的完整 http(s) 网址。")

    profile = data.get("profile")
    if not isinstance(profile, dict):
        errors.append("profile 必须是对象。")
    else:
        for key in ("name", "name_zh", "affiliation", "affiliation_zh", "position", "position_zh", "email"):
            text_field(profile, key, "profile", required=key == "name")
        for key in ("bio", "bio_zh", "research_interests", "research_interests_zh"):
            text_array(profile, key, "profile")
        image(profile, "photo", "photo_alt", "profile")
        for key in ("scholar", "github", "cv"):
            link(profile, key, "profile")
        email = profile.get("email", "")
        if filled(email) and not EMAIL_RE.fullmatch(email):
            errors.append("profile.email 格式无效。")
        cv = profile.get("cv", "")
        if local_path(cv) and (not cv.startswith("assets/files/") or Path(cv).suffix.lower() != ".pdf"):
            errors.append("profile.cv 的本地文件必须是 assets/files/ 下的 PDF。")

    publications = data.get("publications")
    if not isinstance(publications, list):
        errors.append("publications 必须是数组。")
    else:
        seen_ids: set[str] = set()
        for index, pub in enumerate(publications, 1):
            context = f"publications[{index}]"
            if not isinstance(pub, dict):
                errors.append(f"{context} 必须是对象。")
                continue
            for key in ("id", "title", "title_zh", "venue", "status", "thumbnail_alt", "summary", "summary_zh"):
                text_field(pub, key, context, required=key in {"id", "title"})
            pub_id = pub.get("id")
            if is_text(pub_id):
                if not ID_RE.fullmatch(pub_id):
                    errors.append(f"{context}.id 只能使用小写英文、数字和连字符。")
                if pub_id in seen_ids:
                    errors.append(f"{context}.id 重复：{pub_id}")
                seen_ids.add(pub_id)
            authors = pub.get("authors")
            if not isinstance(authors, list) or not authors or not all(filled(author) for author in authors):
                errors.append(f"{context}.authors 至少有一位作者，且每位作者都应是非空文字。")
            year = pub.get("year")
            if type(year) is not int or not (1000 <= year <= 3000):
                errors.append(f"{context}.year 必须是四位整数。")
            if type(pub.get("selected")) is not bool:
                errors.append(f"{context}.selected 必须是 true 或 false。")
            image(pub, "thumbnail", "thumbnail_alt", context)
            links = pub.get("links")
            if not isinstance(links, dict):
                errors.append(f"{context}.links 必须是对象。")
            else:
                for key in ("paper", "scholar", "code", "project"):
                    link(links, key, f"{context}.links")

    for section in ("news", "education", "experience", "projects", "service"):
        entries = data.get(section)
        if not isinstance(entries, list):
            errors.append(f"{section} 必须是数组。")
            continue
        for index, entry in enumerate(entries, 1):
            context = f"{section}[{index}]"
            if not isinstance(entry, dict):
                errors.append(f"{context} 必须是对象。")
                continue
            fields = ("date", "title", "title_zh", "description", "description_zh") if section == "news" else ("period", "title", "title_zh", "organization", "organization_zh", "description", "description_zh")
            for key in fields:
                text_field(entry, key, context)
            if not filled(entry.get("title", "")) and any(filled(value) for value in entry.values() if isinstance(value, str)):
                errors.append(f"{context}.title：已有其他内容时标题不能为空。")
            link(entry, "url", context)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="校验个人主页 JSON 与本地资源")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="待校验的 site.json")
    parser.add_argument("--skip-files", action="store_true", help="只校验格式，不检查本地资源是否存在")
    args = parser.parse_args()
    try:
        data = load_data(args.data)
    except ValueError as exc:
        print(f"校验失败：{exc}", file=sys.stderr)
        return 1
    errors = validate(data, check_files=not args.skip_files)
    if errors:
        print("校验失败：", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"校验通过：{args.data}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
