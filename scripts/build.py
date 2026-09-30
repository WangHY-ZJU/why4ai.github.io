#!/usr/bin/env python3
"""Render the data file into a small, self-contained static website."""

from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
DEFAULT_DATA = ROOT / "data" / "site.json"
TEMPLATE = ROOT / "templates" / "index.html"
sys.path.insert(0, str(SCRIPT_DIR))
from validate import load_data, validate  # noqa: E402


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def filled(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def arr(value: object) -> list:
    return value if isinstance(value, list) else []


def localized(item: dict, key: str, language: str):
    if language == "zh":
        translated = item.get(f"{key}_zh")
        if isinstance(translated, list) and any(filled(part) for part in translated):
            return translated
        if filled(translated):
            return translated
    return item.get(key, [] if key in {"bio", "research_interests"} else "")


def safe_url(value: object, label: str, root: str = "") -> str:
    if not filled(value):
        return ""
    text = str(value)
    if text.startswith("assets/"):
        href = root + text
    elif urlsplit(text).scheme in {"http", "https"}:
        href = text
    else:
        return ""
    external = ' target="_blank" rel="noopener noreferrer"' if href.startswith(("http://", "https://")) else ""
    return f'<a href="{esc(href)}"{external}>{esc(label)}</a>'


def image_url(value: object, root: str) -> str:
    return esc(root + str(value)) if isinstance(value, str) and value.startswith("assets/") else ""


def labels(language: str) -> dict[str, str]:
    if language == "zh":
        return {"home": "首页", "nav_publications": "论文", "publications": "精选论文", "news": "动态", "education": "教育经历", "experience": "工作或研究经历", "projects": "项目", "service": "学术服务", "interest": "研究方向", "email": "Email", "scholar": "Google Scholar", "github": "GitHub", "cv": "CV", "paper": "Paper (arXiv)", "code": "Code", "project": "Project"}
    return {"home": "Home", "nav_publications": "Publications", "publications": "Selected Publications", "news": "News", "education": "Education", "experience": "Experience", "projects": "Projects", "service": "Academic Service", "interest": "Research interests", "email": "Email", "scholar": "Google Scholar", "github": "GitHub", "cv": "CV", "paper": "Paper (arXiv)", "code": "Code", "project": "Project"}


def render_content(data: dict, language: str, root: str) -> tuple[str, str, list[str]]:
    labels_map = labels(language)
    profile = data.get("profile", {})
    name = localized(profile, "name", language) or profile.get("name", "")
    metadata = " · ".join(esc(value) for value in (localized(profile, "position", language), localized(profile, "affiliation", language)) if filled(value))

    links = []
    if filled(profile.get("scholar")):
        links.append(safe_url(profile["scholar"], labels_map["scholar"], root))
    if filled(profile.get("email")):
        links.append(f'<a href="mailto:{esc(profile["email"])}">{labels_map["email"]}</a>')
    if filled(profile.get("github")):
        links.append(safe_url(profile["github"], labels_map["github"], root))
    if filled(profile.get("cv")):
        links.append(safe_url(profile["cv"], labels_map["cv"], root))

    bio = "".join(f"<p>{esc(paragraph)}</p>" for paragraph in arr(localized(profile, "bio", language)) if filled(paragraph))
    interests = " · ".join(esc(value) for value in arr(localized(profile, "research_interests", language)) if filled(value))
    photo = ""
    if filled(profile.get("photo")) and filled(profile.get("photo_alt")):
        photo = f'<img class="profile-photo" src="{image_url(profile["photo"], root)}" alt="{esc(profile["photo_alt"])}" data-optional-image>'
    profile_class = "profile with-photo" if photo else "profile"
    metadata_html = f'<p class="profile-meta">{metadata}</p>' if metadata else ""
    links_html = f'<div class="profile-links">{"".join(links)}</div>' if links else ""
    bio_html = f'<div class="bio">{bio}</div>' if bio else ""
    interests_html = f'<div class="interests"><span class="interests-label">{labels_map["interest"]}: </span><span class="interests-list">{interests}</span></div>' if interests else ""
    profile_html = f'<section class="{profile_class}" id="home"><div class="profile-body"><h1 class="profile-name">{esc(name)}</h1>{metadata_html}{links_html}{bio_html}{interests_html}</div>{photo}</section>'

    publications = []
    for pub in arr(data.get("publications")):
        if not pub.get("selected"):
            continue
        pub_name = localized(pub, "title", language)
        title = safe_url(pub.get("links", {}).get("paper", ""), pub_name, root) or esc(pub_name)
        author_parts = []
        for author in arr(pub.get("authors")):
            author_parts.append(f"<strong>{esc(author)}</strong>" if author == profile.get("name") or (filled(profile.get("name_zh")) and author == profile.get("name_zh")) else esc(author))
        venue = " ".join(str(value) for value in (pub.get("venue", ""), pub.get("year", "")) if value not in ("", None))
        status = " · ".join(esc(value) for value in (venue, pub.get("status", "")) if filled(value))
        resource_keys = (("paper", labels_map["paper"]), ("scholar", labels_map["scholar"]), ("code", labels_map["code"]), ("project", labels_map["project"]))
        resources = "".join(safe_url(pub.get("links", {}).get(key, ""), label, root) for key, label in resource_keys)
        summary = localized(pub, "summary", language)
        thumbnail = ""
        if filled(pub.get("thumbnail")) and filled(pub.get("thumbnail_alt")):
            thumbnail = f'<img class="publication-image" src="{image_url(pub["thumbnail"], root)}" alt="{esc(pub["thumbnail_alt"])}" data-optional-image>'
        publication_class = "publication has-image" if thumbnail else "publication"
        venue_html = f'<p class="publication-venue">{status}</p>' if status else ""
        summary_html = f'<p class="publication-summary">{esc(summary)}</p>' if filled(summary) else ""
        resources_html = f'<div class="publication-links">{resources}</div>' if resources else ""
        publications.append(f'<li class="{publication_class}">{thumbnail}<div class="publication-body"><h3 class="publication-title">{title}</h3><p class="publication-authors">{", ".join(author_parts)}</p>{venue_html}{summary_html}{resources_html}</div></li>')
    publication_html = f'<section class="section" id="publications"><h2 class="section-title">{labels_map["publications"]}</h2><ol class="publication-list">{"".join(publications)}</ol></section>' if publications else ""

    section_labels = {"news": labels_map["news"], "education": labels_map["education"], "experience": labels_map["experience"], "projects": labels_map["projects"], "service": labels_map["service"]}
    section_html = []
    visible_sections: list[str] = []
    for key, section_label in section_labels.items():
        entries = [entry for entry in arr(data.get(key)) if filled(entry.get("title"))]
        if not entries:
            continue
        visible_sections.append(key)
        rendered = []
        for entry in entries:
            title = localized(entry, "title", language)
            url = safe_url(entry.get("url", ""), title, root)
            time = entry.get("date", "") if key == "news" else entry.get("period", "")
            organization = localized(entry, "organization", language) if key != "news" else ""
            description = localized(entry, "description", language)
            time_html = f'<div class="entry-date">{esc(time)}</div>' if filled(time) else ""
            organization_html = f'<p class="entry-org">{esc(organization)}</p>' if filled(organization) else ""
            description_html = f'<p class="entry-description">{esc(description)}</p>' if filled(description) else ""
            rendered.append(f'<li class="entry">{time_html}<h3 class="entry-title">{url or esc(title)}</h3>{organization_html}{description_html}</li>')
        section_html.append(f'<section class="section" id="{key}"><h2 class="section-title">{section_label}</h2><ol class="entry-list">{"".join(rendered)}</ol></section>')
    return profile_html + publication_html + "".join(section_html), name, visible_sections


def page(data: dict, language: str, root: str, url: str) -> str:
    content, name, visible = render_content(data, language, root)
    labels_map = labels(language)
    publications_exist = any(pub.get("selected") for pub in arr(data.get("publications")))
    nav = [f'<a href="#home">{labels_map["home"]}</a>']
    if publications_exist:
        nav.append(f'<a href="#publications">{labels_map["nav_publications"]}</a>')
    for key in visible:
        nav.append(f'<a href="#{key}">{labels_map[key]}</a>')
    if language == "zh":
        language_links = '<a href="../index.html">EN</a><a href="index.html" aria-current="page">中文</a>'
        home_href = "index.html#home"
        lang = "zh-CN"
    else:
        language_links = '<a href="zh/index.html">中文</a><a href="index.html" aria-current="page">EN</a>'
        home_href = "index.html#home"
        lang = "en"
    template = TEMPLATE.read_text(encoding="utf-8")
    canonical = f'<link rel="canonical" href="{esc(url)}">' if url else ""
    sitemap = f'<link rel="sitemap" type="application/xml" href="{esc(url.rstrip("/") + "/sitemap.xml")}">' if url else ""
    description = f"{name} — academic homepage" if language == "en" else f"{name} — 个人学术主页"
    replacements = {"LANG": lang, "DESCRIPTION": description, "TITLE": name, "CANONICAL": canonical, "SITEMAP": sitemap, "ROOT": root, "HOME_HREF": home_href, "NAME": name, "NAV": "".join(nav), "LANGUAGE_LINKS": language_links, "CONTENT": content, "FOOTER": name}
    for key, value in replacements.items():
        template = template.replace("{{" + key + "}}", value)
    return template


def referenced_assets(data: dict) -> set[str]:
    references: set[str] = set()

    def visit(value: object) -> None:
        if isinstance(value, str) and (value.startswith("assets/images/") or value.startswith("assets/files/")):
            references.add(value)
        elif isinstance(value, dict):
            for part in value.values():
                visit(part)
        elif isinstance(value, list):
            for part in value:
                visit(part)

    visit(data)
    return references


def copy_public_assets(output: Path, data: dict) -> None:
    (output / "assets" / "css").mkdir(parents=True, exist_ok=True)
    (output / "assets" / "js").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "assets" / "css" / "site.css", output / "assets" / "css" / "site.css")
    shutil.copy2(ROOT / "assets" / "js" / "site.js", output / "assets" / "js" / "site.js")
    for reference in referenced_assets(data):
        source = ROOT / reference
        if source.is_file():
            destination = output / reference
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def build(data_path: Path = DEFAULT_DATA, output: Path = ROOT / "dist") -> Path:
    data = load_data(data_path)
    errors = validate(data)
    if errors:
        raise ValueError("\n".join(errors))
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    (output / ".nojekyll").write_text("", encoding="utf-8")
    copy_public_assets(output, data)
    (output / "data").mkdir()
    shutil.copy2(data_path, output / "data" / "site.json")
    (output / "editor").mkdir()
    for filename in ("index.html", "editor.js", "editor.css"):
        shutil.copy2(ROOT / "editor" / filename, output / "editor" / filename)
    url = str(data.get("site", {}).get("url", "")).rstrip("/")
    (output / "index.html").write_text(page(data, "en", "", url), encoding="utf-8")
    (output / "zh").mkdir()
    (output / "zh" / "index.html").write_text(page(data, "zh", "../", f"{url}/zh" if url else ""), encoding="utf-8")
    if url:
        sitemap = "\n".join(f'  <url><loc>{esc(value)}</loc></url>' for value in (url, f"{url}/zh/"))
        (output / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sitemap}\n</urlset>\n', encoding="utf-8")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="构建静态学术主页")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    try:
        output = build(args.data, args.output)
    except (OSError, ValueError) as exc:
        print(f"构建失败：{exc}", file=sys.stderr)
        return 1
    print(f"构建完成：{output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
