#!/usr/bin/env python3
"""Generate the multi-page Agro Core handbook from maintained Markdown guides."""

from __future__ import annotations

import html
import json
import posixpath
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "project-handbook"
LEGACY_ENTRY = ROOT / "docs" / "project-handbook.html"

DOCUMENT_GROUPS = [
    (
        "Project overview",
        [
            ("README.md", "Repository overview and implementation"),
        ],
    ),
    (
        "Requirements and design",
        [
            ("docs/system-requirements.md", "System requirements"),
            ("docs/crop-management-requirements.md", "Crop-management requirements"),
            ("docs/guias-agronomicas-aplicadas.md", "Applied agronomic guides"),
        ],
    ),
    (
        "Module guides",
        [
            ("docs/fertilization.md", "Fertilization"),
            ("docs/water-management.md", "Water management"),
        ],
    ),
    (
        "User interface and operations",
        [
            ("frontend/README.md", "AgroVision frontend"),
            ("frontend/tests/manual-agricultural-workflow.md", "QA tests and farm walkthrough"),
            ("docs/test-results.md", "Resultados de pruebas"),
            ("scripts/README.md", "Guasita map fixture"),
            ("frontend/public/images/README.md", "Demonstration aerial image"),
        ],
    ),
]

PAGE_NAMES = {
    "README.md": "project-overview.html",
    "docs/system-requirements.md": "system-requirements.html",
    "docs/crop-management-requirements.md": "crop-management.html",
    "docs/guias-agronomicas-aplicadas.md": "agronomic-guides.html",
    "docs/fertilization.md": "fertilization.html",
    "docs/water-management.md": "water-management.html",
    "frontend/README.md": "frontend.html",
    "frontend/tests/manual-agricultural-workflow.md": "manual-workflow.html",
    "docs/test-results.md": "test-results.html",
    "scripts/README.md": "map-fixture.html",
    "frontend/public/images/README.md": "aerial-image.html",
}

DESCRIPTIONS = {
    "README.md": "Product scope, current implementation, feature behavior, API routes, architecture diagrams, setup, and remaining work.",
    "docs/system-requirements.md": "Functional and non-functional requirements, implementation status, security boundaries, and farm authorization model.",
    "docs/crop-management-requirements.md": "Crop catalog, planting, crop-cycle coverage, endpoint inventory, and remaining requirements.",
    "docs/guias-agronomicas-aplicadas.md": "Agronomic source material and how its guidance maps to implemented workflows and future decisions.",
    "docs/fertilization.md": "The analysis, review, approval, application, recurrence, and follow-up workflow with its technical limits.",
    "docs/water-management.md": "Irrigation planning and execution, moisture, water records, persistence, API, and open gaps.",
    "frontend/README.md": "AgroVision screens, demo and real modes, authentication, setup, build, and frontend organization.",
    "frontend/tests/manual-agricultural-workflow.md": "Run the backend and frontend suites and watch an automated QA farm walkthrough in Chrome.",
    "docs/test-results.md": "Resultados por suite y módulo, incidencias de la verificación y evidencias de la ejecución.",
    "scripts/README.md": "The Guasita test-map fixture, its geographic reference, and how its example geometry is created.",
    "frontend/public/images/README.md": "Provenance and intended use of the demonstration aerial image.",
}

FENCE_MARKER = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
HEADING_MARKER = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
LIST_MARKER = re.compile(r"^( *)([-+*]|\d+[.)])\s+(.*)$")


def doc_id(relative_path: str) -> str:
    return "doc-" + re.sub(r"[^a-z0-9]+", "-", relative_path.lower()).strip("-")


def slugify(text: str) -> str:
    value = text.lower().strip()
    value = re.sub(r"[`*_~]", "", value)
    value = re.sub(r"[^\w\- ]", "", value, flags=re.UNICODE)
    return re.sub(r"[\s-]+", "-", value).strip("-") or "section"


def heading_inventory(relative_path: str, source: str) -> tuple[str, dict[str, str], list[dict[str, object]]]:
    seen: dict[str, int] = {}
    anchors: dict[str, str] = {}
    toc: list[dict[str, object]] = []
    first_heading = ""
    prefix = doc_id(relative_path)
    fence_character = ""
    fence_length = 0

    for line in source.splitlines():
        fence = FENCE_MARKER.match(line)
        if fence_character:
            if re.match(rf"^\s*{re.escape(fence_character)}{{{fence_length},}}\s*$", line):
                fence_character = ""
                fence_length = 0
            continue
        if fence:
            fence_character = fence.group(1)[0]
            fence_length = len(fence.group(1))
            continue

        match = HEADING_MARKER.match(line)
        if not match:
            continue
        level = len(match.group(1))
        title = match.group(2).strip()
        slug = slugify(title)
        seen[slug] = seen.get(slug, 0) + 1
        unique = slug if seen[slug] == 1 else f"{slug}-{seen[slug]}"
        anchor = f"{prefix}--{unique}"
        anchors.setdefault(slug, anchor)
        if level == 1 and not first_heading:
            first_heading = title
        elif level > 1:
            toc.append({"level": level, "title": title, "anchor": anchor})

    return first_heading, anchors, toc


SOURCES: dict[str, str] = {}
DOC_META: dict[str, dict[str, object]] = {}
for group_name, entries in DOCUMENT_GROUPS:
    for relative_path, label in entries:
        source = (ROOT / relative_path).read_text(encoding="utf-8")
        title, anchors, toc = heading_inventory(relative_path, source)
        SOURCES[relative_path] = source
        DOC_META[relative_path] = {
            "id": doc_id(relative_path),
            "label": label,
            "title": title or label,
            "anchors": anchors,
            "toc": toc,
            "group": group_name,
            "page": PAGE_NAMES[relative_path],
            "description": DESCRIPTIONS[relative_path],
        }


def markdown_link(source_path: str, target: str, title: str = "") -> str:
    target = target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    parsed = urlsplit(target)
    scheme = parsed.scheme.lower()
    if scheme or target.startswith("//"):
        safe_target = html.escape(target, quote=True)
        title_attr = f' title="{html.escape(title, quote=True)}"' if title else ""
        external = scheme in {"http", "https"}
        attrs = ' target="_blank" rel="noopener noreferrer"' if external else ""
        return f'<a href="{safe_target}"{attrs}{title_attr}>'

    path_part = unquote(parsed.path)
    fragment = unquote(parsed.fragment)
    if path_part:
        destination = posixpath.normpath(posixpath.join(posixpath.dirname(source_path), path_part))
    else:
        destination = source_path

    current_page = str(DOC_META[source_path]["page"])
    if destination in DOC_META:
        meta = DOC_META[destination]
        href = "" if destination == source_path else str(meta["page"])
        if fragment:
            anchor_map = meta["anchors"]
            assert isinstance(anchor_map, dict)
            href += "#" + anchor_map.get(slugify(fragment), f"{meta['id']}--{slugify(fragment)}")
        elif not href:
            href = current_page
    else:
        relative_href = posixpath.relpath(destination, "docs/project-handbook")
        href = quote(relative_href, safe="/-._~")
        if parsed.query:
            href += "?" + quote(parsed.query, safe="=&?/:@-._~")
        if fragment:
            href += "#" + quote(fragment, safe="-._~")

    title_attr = f' title="{html.escape(title, quote=True)}"' if title else ""
    return f'<a href="{html.escape(href, quote=True)}"{title_attr}>'


INLINE_TOKEN = re.compile(
    r"(?P<code>`+)(?P<code_text>.+?)(?P=code)|"
    r"(?P<link>\[(?P<label>[^\]]+)\]\((?P<url><[^>]+>|[^)]+)\))"
)


def inline_markdown(text: str, source_path: str) -> str:
    placeholders: list[str] = []

    def preserve(value: str) -> str:
        token = f"\x00{len(placeholders)}\x00"
        placeholders.append(value)
        return token

    def replace_token(match: re.Match[str]) -> str:
        if match.group("code"):
            code = html.escape(match.group("code_text").strip(), quote=False)
            return preserve(f"<code>{code}</code>")

        raw_url = match.group("url").strip()
        link_title = ""
        title_match = re.match(r'^(<[^>]+>|[^\s]+)\s+["\'](.*)["\']$', raw_url)
        if title_match:
            raw_url, link_title = title_match.groups()
        opening = markdown_link(source_path, raw_url, link_title)
        return preserve(opening + inline_markdown(match.group("label"), source_path) + "</a>")

    protected = INLINE_TOKEN.sub(replace_token, text)
    safe = html.escape(protected, quote=False)
    safe = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: f"<strong>{m.group(1) or m.group(2)}</strong>", safe)
    safe = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)", lambda m: f"<em>{m.group(1) or m.group(2)}</em>", safe)
    for index, value in enumerate(placeholders):
        safe = safe.replace(f"\x00{index}\x00", value)
    return safe


def is_separator_row(line: str) -> bool:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def render_list(lines: list[str], start: int, base_indent: int, source_path: str) -> tuple[str, int]:
    first = LIST_MARKER.match(lines[start])
    assert first is not None
    ordered = first.group(2)[0].isdigit()
    tag = "ol" if ordered else "ul"
    items: list[list[str]] = []
    index = start
    current: list[str] | None = None

    while index < len(lines):
        line = lines[index]
        marker = LIST_MARKER.match(line)
        if marker:
            indent = len(marker.group(1))
            marker_ordered = marker.group(2)[0].isdigit()
            if indent < base_indent or (indent == base_indent and marker_ordered != ordered):
                break
            if indent == base_indent:
                current = [marker.group(3)]
                items.append(current)
            elif current is not None:
                current.append(line[base_indent + 2 :])
            index += 1
            continue

        if not line.strip():
            lookahead = index + 1
            while lookahead < len(lines) and not lines[lookahead].strip():
                lookahead += 1
            next_marker = LIST_MARKER.match(lines[lookahead]) if lookahead < len(lines) else None
            if next_marker and len(next_marker.group(1)) >= base_indent:
                if current is not None:
                    current.append("")
                index += 1
                continue
            break

        indentation = len(line) - len(line.lstrip(" "))
        if current is None or indentation < base_indent + 2:
            break
        current.append(line[base_indent + 2 :])
        index += 1

    rendered_items = [f"<li>{render_blocks(item, source_path)}</li>" for item in items]
    return f"<{tag}>" + "".join(rendered_items) + f"</{tag}>", index


def render_blocks(lines: list[str], source_path: str) -> str:
    result: list[str] = []
    index = 0
    heading_seen = False
    heading_counts: dict[str, int] = {}
    prefix = str(DOC_META[source_path]["id"])

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        fence = FENCE_MARKER.match(line)
        if fence:
            marker, language = fence.groups()
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not re.match(rf"^\s*{re.escape(marker[0])}{{{len(marker)},}}\s*$", lines[index]):
                code_lines.append(lines[index])
                index += 1
            index += 1 if index < len(lines) else 0
            code = "\n".join(code_lines)
            if language.strip().lower() == "mermaid":
                escaped = html.escape(code, quote=False)
                result.append(
                    '<figure class="diagram-block"><div class="mermaid" role="img" '
                    'aria-label="Diagram; expand the details below to read its source">'
                    f"{escaped}</div><details><summary>Diagram source</summary>"
                    f'<pre><code class="language-mermaid">{escaped}</code></pre></details></figure>'
                )
            else:
                class_name = f' class="language-{html.escape(language.strip(), quote=True)}"' if language.strip() else ""
                result.append(f"<pre><code{class_name}>{html.escape(code, quote=False)}</code></pre>")
            continue

        heading = HEADING_MARKER.match(line)
        if heading:
            level = len(heading.group(1))
            title = heading.group(2).strip()
            slug = slugify(title)
            heading_counts[slug] = heading_counts.get(slug, 0) + 1
            unique = slug if heading_counts[slug] == 1 else f"{slug}-{heading_counts[slug]}"
            heading_id = f"{prefix}--{unique}"
            if level == 1 and not heading_seen:
                heading_seen = True
            else:
                result.append(f'<h{level} id="{heading_id}">{inline_markdown(title, source_path)}</h{level}>')
            index += 1
            continue

        if re.fullmatch(r"\s*(?:-{3,}|\*{3,}|_{3,})\s*", line):
            result.append("<hr>")
            index += 1
            continue

        if (
            index + 1 < len(lines)
            and "|" in line
            and "|" in lines[index + 1]
            and is_separator_row(lines[index + 1])
        ):
            headers = split_table_row(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip() and "|" in lines[index]:
                rows.append(split_table_row(lines[index]))
                index += 1
            head = "<thead><tr>" + "".join(
                f'<th scope="col">{inline_markdown(cell, source_path)}</th>' for cell in headers
            ) + "</tr></thead>"
            body = "<tbody>" + "".join(
                "<tr>" + "".join(
                    f"<td>{inline_markdown(row[column] if column < len(row) else '', source_path)}</td>"
                    for column in range(len(headers))
                ) + "</tr>"
                for row in rows
            ) + "</tbody>"
            result.append(f'<div class="table-scroll"><table>{head}{body}</table></div>')
            continue

        list_marker = LIST_MARKER.match(line)
        if list_marker:
            rendered, index = render_list(lines, index, len(list_marker.group(1)), source_path)
            result.append(rendered)
            continue

        if line.lstrip().startswith(">"):
            quoted: list[str] = []
            while index < len(lines) and lines[index].lstrip().startswith(">"):
                quoted.append(re.sub(r"^\s*> ?", "", lines[index]))
                index += 1
            result.append(f"<blockquote>{render_blocks(quoted, source_path)}</blockquote>")
            continue

        paragraph = [line.strip()]
        index += 1
        while index < len(lines) and lines[index].strip():
            candidate = lines[index]
            if (
                FENCE_MARKER.match(candidate)
                or HEADING_MARKER.match(candidate)
                or LIST_MARKER.match(candidate)
                or candidate.lstrip().startswith(">")
                or re.fullmatch(r"\s*(?:-{3,}|\*{3,}|_{3,})\s*", candidate)
                or (index + 1 < len(lines) and "|" in candidate and is_separator_row(lines[index + 1]))
            ):
                break
            paragraph.append(candidate.strip())
            index += 1
        result.append(f"<p>{inline_markdown(' '.join(paragraph), source_path)}</p>")

    return "\n".join(result)


def toc_html(relative_path: str) -> str:
    meta = DOC_META[relative_path]
    title = str(meta["title"])
    title_anchor = meta["anchors"].get(slugify(title), f"{meta['id']}--title")
    links = [
        f'<a class="toc-link level-1" href="#{html.escape(title_anchor, quote=True)}">'
        '<span class="toc-index">01</span><span>Overview</span></a>'
    ]
    entries = meta["toc"]
    assert isinstance(entries, list)
    for number, item in enumerate(entries, start=2):
        level = int(item["level"])
        anchor = str(item["anchor"])
        heading_title = str(item["title"])
        links.append(
            f'<a class="toc-link level-{min(level, 6)}" href="#{html.escape(anchor, quote=True)}">'
            f'<span class="toc-index">{number:02}</span><span>{html.escape(heading_title)}</span></a>'
        )
    return "".join(links)


def navigation_html(active_page: str) -> str:
    home_active = ' aria-current="page"' if active_page == "index.html" else ""
    groups = [
        f'<a class="nav-home{" active" if home_active else ""}" href="index.html"{home_active}>'
        '<span class="nav-home-icon" aria-hidden="true">⌂</span><span>Handbook home</span></a>'
    ]
    for group_name, entries in DOCUMENT_GROUPS:
        links = []
        for relative_path, label in entries:
            meta = DOC_META[relative_path]
            page = str(meta["page"])
            current = page == active_page
            active = " active" if current else ""
            aria = ' aria-current="page"' if current else ""
            links.append(f'<a class="nav-link{active}" href="{page}"{aria}>{html.escape(label)}</a>')
        groups.append(
            f'<div class="nav-group"><p>{html.escape(group_name)}</p>' + "".join(links) + "</div>"
        )
    return "".join(groups)


def word_count(source: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", source, flags=re.UNICODE))


def search_sections(relative_path: str) -> list[dict[str, str]]:
    meta = DOC_META[relative_path]
    title = str(meta["title"])
    anchors = meta["anchors"]
    assert isinstance(anchors, dict)
    counts: dict[str, int] = {}
    chunks: list[dict[str, str]] = []
    current = {"title": "Overview", "anchor": anchors.get(slugify(title), ""), "text": []}
    heading_seen = False
    fence_character = ""
    fence_length = 0

    def save() -> None:
        text = " ".join(current["text"])
        text = re.sub(r"\[([^\]]+)\]\((?:<)?[^)]+(?:>)?\)", r"\1", text)
        text = re.sub(r"`+([^`]+)`+", r"\1", text)
        text = re.sub(r"[*_~#|]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            chunks.append({"title": current["title"], "anchor": current["anchor"], "text": text})

    for line in SOURCES[relative_path].splitlines():
        fence = FENCE_MARKER.match(line)
        if fence_character:
            current["text"].append(line)
            if re.match(rf"^\s*{re.escape(fence_character)}{{{fence_length},}}\s*$", line):
                fence_character = ""
                fence_length = 0
            continue
        if fence:
            fence_character = fence.group(1)[0]
            fence_length = len(fence.group(1))
            continue

        heading = HEADING_MARKER.match(line)
        if heading:
            level = len(heading.group(1))
            heading_title = heading.group(2).strip()
            slug = slugify(heading_title)
            counts[slug] = counts.get(slug, 0) + 1
            unique = slug if counts[slug] == 1 else f"{slug}-{counts[slug]}"
            if level == 1 and not heading_seen:
                heading_seen = True
                current["title"] = "Overview"
                current["anchor"] = anchors.get(slug, "")
            else:
                save()
                current = {"title": heading_title, "anchor": f"{meta['id']}--{unique}", "text": [heading_title]}
            continue
        current["text"].append(line)
    save()
    return chunks


def search_index_js() -> str:
    index = []
    for _, entries in DOCUMENT_GROUPS:
        for relative_path, _ in entries:
            meta = DOC_META[relative_path]
            index.append(
                {
                    "title": meta["title"],
                    "group": meta["group"],
                    "page": meta["page"],
                    "sections": search_sections(relative_path),
                }
            )
    payload = json.dumps(index, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f"window.AGRO_HANDBOOK_SEARCH = {payload};\n"


def stylesheet() -> str:
    return """@charset "utf-8";
:root{color-scheme:light;--forest:#183b31;--forest-2:#244f3e;--moss:#718b5f;--clay:#b7734d;--gold:#c9a766;--ink:#1d3029;--muted:#66766d;--line:#dce4dc;--paper:#fff;--canvas:#f2f4ef;--soft:#eaf0e8;--shadow:0 14px 38px rgba(25,55,42,.08);font-synthesis:none}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;color:var(--ink);background:var(--canvas);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}
a{color:#206a4c;text-underline-offset:3px}a:hover{color:#104a32}
button,input{font:inherit}
.skip-link{position:fixed;top:-60px;left:12px;z-index:30;padding:10px 14px;border-radius:8px;color:#fff;background:var(--forest)}.skip-link:focus{top:12px}
.site-grid{min-height:100vh;display:grid;grid-template-columns:278px minmax(0,1fr)}
.sidebar{position:sticky;top:0;height:100vh;overflow-y:auto;padding:25px 17px 28px;color:#e8f0e9;background:var(--forest)}
.brand{display:flex;align-items:center;gap:11px;padding:0 6px;color:#fff;text-decoration:none}.brand-mark{display:grid;width:40px;height:40px;place-items:center;border:1px solid rgba(222,237,223,.32);border-radius:13px;color:#e3c982;background:rgba(255,255,255,.06);font-family:Georgia,serif;font-size:1.32rem}.brand-name{display:block;font-size:1rem;font-weight:800;letter-spacing:.025em}.brand-subtitle{display:block;color:#adc6b5;font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.search-wrap{position:relative;margin:22px 0 18px}.search-wrap label{display:block;margin:0 0 7px 2px;color:#b6cfbd;font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.search-wrap input{width:100%;height:42px;padding:8px 11px;border:1px solid #577464;border-radius:9px;outline:none;color:#193b30;background:#f9fbf8;font-size:.86rem}.search-wrap input:focus{box-shadow:0 0 0 3px rgba(201,223,201,.25)}
.search-results{position:absolute;top:100%;right:-5px;left:-5px;z-index:20;max-height:min(58vh,520px);margin-top:8px;overflow:auto;padding:7px;border:1px solid #dce5dd;border-radius:12px;color:var(--ink);background:white;box-shadow:0 16px 40px rgba(0,0,0,.22)}.search-results[hidden]{display:none}.search-result{display:block;padding:10px;border-radius:8px;color:var(--ink);text-decoration:none}.search-result:hover,.search-result:focus{background:#edf4ed}.search-result-title{display:block;font-size:.82rem;font-weight:800;line-height:1.3}.search-result-meta{display:block;margin-top:2px;color:#477057;font-size:.68rem;font-weight:700}.search-result-snippet{display:block;margin-top:5px;color:#65736b;font-size:.75rem;line-height:1.4}.search-empty{padding:12px;color:#617269;font-size:.8rem}
.nav-home{display:flex;align-items:center;gap:10px;margin:6px 0 16px;padding:9px;border:1px solid rgba(219,235,222,.2);border-radius:9px;color:#eef5ef;text-decoration:none;font-size:.86rem;font-weight:750}.nav-home:hover,.nav-home.active{color:#fff;background:#2b5944}.nav-home-icon{display:grid;width:22px;height:22px;place-items:center;color:#e0c779;font-size:1.13rem}
.nav-group{margin-top:20px}.nav-group>p{margin:0 0 7px 9px;color:#97b6a0;font-size:.65rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.nav-link{display:block;margin:2px 0;padding:7px 9px;border-left:2px solid transparent;border-radius:0 7px 7px 0;color:#e3ede5;text-decoration:none;font-size:.81rem;line-height:1.4}.nav-link:hover{color:white;background:#244c3a}.nav-link.active{border-color:#d5bd73;color:white;background:#285641;font-weight:750}.sidebar-note{margin:25px 8px 0;color:#a9c1af;font-size:.72rem;line-height:1.55}
.main-area{min-width:0;width:100%;max-width:1600px;margin:0 auto;padding:28px clamp(22px,4.5vw,68px) 72px}.topline{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px;color:#718077;font-size:.75rem}.topline a{color:#567363;text-decoration:none}.topline a:hover{text-decoration:underline}.topline-date{white-space:nowrap}
.hero{position:relative;overflow:hidden;padding:clamp(30px,5vw,66px);border:1px solid #244b3d;border-radius:24px;color:#f2f5ed;background:radial-gradient(circle at 86% 18%,rgba(201,167,102,.23),transparent 23%),radial-gradient(circle at 72% 112%,rgba(114,148,105,.25),transparent 33%),linear-gradient(125deg,#183b31 5%,#214c3a 72%,#315c42);box-shadow:0 20px 52px rgba(22,57,41,.18)}.hero:after{position:absolute;right:-65px;bottom:-150px;width:410px;height:410px;border:1px solid rgba(234,222,170,.2);border-radius:50%;content:"";box-shadow:0 0 0 26px rgba(234,222,170,.035),0 0 0 56px rgba(234,222,170,.025)}.hero-content{position:relative;z-index:1;max-width:920px}.eyebrow{margin:0 0 9px;color:#819979;font-size:.69rem;font-weight:850;letter-spacing:.15em;text-transform:uppercase}.hero .eyebrow{color:#d6c27c}.hero h1{max-width:850px;margin:0;color:#fffdf5;font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.5rem,6vw,5rem);font-weight:500;letter-spacing:-.045em;line-height:1.03}.hero-lede{max-width:770px;margin:18px 0 0;color:#dce8dc;font-size:clamp(.98rem,1.6vw,1.13rem)}.hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:23px}.pill{padding:6px 10px;border:1px solid rgba(221,236,222,.26);border-radius:999px;color:#edf4ed;background:rgba(8,33,23,.17);font-size:.73rem;font-weight:700}.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 14px;border:1px solid #e5d18b;border-radius:9px;color:#203d30;background:#f0dfa3;font:inherit;font-size:.85rem;font-weight:800;text-decoration:none;cursor:pointer}.button:hover{color:#18372b;background:#f8e8b1}.button.secondary{border-color:rgba(234,242,231,.4);color:#f5f6ed;background:transparent}.button.secondary:hover{background:rgba(255,255,255,.1)}
.section-block{margin-top:43px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:17px}.section-heading h2{margin:0;color:var(--forest);font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.55rem,3vw,2.1rem);font-weight:500;letter-spacing:-.025em;line-height:1.15}.section-heading>p{max-width:620px;margin:0;color:var(--muted);font-size:.88rem}.section-heading .eyebrow{margin-bottom:6px}
.architecture-flow{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr);align-items:stretch;gap:0;padding:17px;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:var(--shadow)}.architecture-node{min-width:0;padding:16px 15px;border:1px solid #dce6dc;border-top:3px solid #729568;border-radius:10px;background:#fcfdf9}.architecture-node .step{margin:0;color:#87958b;font-size:.65rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.architecture-node h3{margin:5px 0 3px;color:#234537;font-size:1rem;line-height:1.25}.architecture-node strong,.architecture-node span{display:block}.architecture-node strong{color:#406747;font-size:.79rem}.architecture-node span{margin-top:7px;color:#66776c;font-size:.76rem;line-height:1.5}.architecture-arrow{align-self:center;color:#9c8953;text-align:center;font-size:1.3rem}.architecture-note{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}.architecture-note span{padding:6px 10px;border:1px solid #e1e7df;border-radius:999px;color:#5e6e63;background:#f9fbf7;font-size:.73rem}.architecture-caption{margin:10px 3px 0;color:#6a786f;font-size:.78rem}
.guide-group{margin-top:28px;padding:22px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.68)}.group-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:15px}.group-heading h3{margin:0;color:#2c4e3d;font-family:Georgia,"Times New Roman",serif;font-size:1.28rem;font-weight:500}.group-heading span{color:#78857b;font-size:.7rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.guide-card{display:flex;min-height:188px;flex-direction:column;padding:17px;border:1px solid #dfe7df;border-radius:12px;color:var(--ink);background:white;text-decoration:none;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.guide-card:hover{transform:translateY(-2px);border-color:#9bb397;box-shadow:0 10px 24px rgba(36,78,56,.08)}.card-kicker{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#78877d;font-size:.67rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.card-mark{color:#a48b4a;font-size:1.15rem}.guide-card h4{margin:13px 0 5px;color:#1e4132;font-size:1.04rem;line-height:1.25}.guide-card p{margin:0;color:#65736a;font-size:.81rem;line-height:1.5}.card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:15px;color:#51735a;font-size:.72rem;font-weight:750}.card-footer span:last-child{color:#9c7e39}
.home-bottom{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:22px}.info-panel{padding:20px;border:1px solid var(--line);border-radius:14px;background:#fff}.info-panel h3{margin:0 0 8px;color:#254b38;font-family:Georgia,"Times New Roman",serif;font-size:1.2rem;font-weight:500}.info-panel p{margin:0;color:#627168;font-size:.84rem}.info-panel ol{margin:10px 0 0;padding-left:1.25rem;color:#586a5f;font-size:.81rem}.info-panel li{margin:.3em 0}.info-panel code{padding:2px 5px;border-radius:4px;color:#70482e;background:#f2eee6;font-size:.78rem}
.breadcrumb{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 18px;color:#819087;font-size:.74rem}.breadcrumb a{color:#557462;text-decoration:none}.breadcrumb a:hover{text-decoration:underline}.breadcrumb-separator{color:#adb8af}.guide-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin:8px 0 25px;padding:0 0 21px;border-bottom:1px solid #d9e2d9}.guide-heading-copy{max-width:840px}.guide-number{display:flex;align-items:center;gap:8px;margin:0 0 8px;color:#79877e;font-size:.66rem;font-weight:850;letter-spacing:.13em;text-transform:uppercase}.guide-number:before{display:inline-block;width:23px;height:2px;background:var(--clay);content:""}.guide-heading h1{margin:0;color:#193c30;font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.1rem,4.3vw,3.4rem);font-weight:500;letter-spacing:-.035em;line-height:1.08}.guide-deck{max-width:790px;margin:11px 0 0;color:#586a5f;font-size:.97rem}.source-note{margin:11px 0 0;color:#879189;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.68rem}.guide-actions{display:flex;flex-shrink:0;gap:8px}.guide-actions .button{border-color:#b8c8b8;color:#365c45;background:#fff}.guide-actions .button:hover{background:#edf4ed}
.reader-layout{display:grid;grid-template-columns:minmax(0,1fr) 246px;align-items:start;gap:36px}.doc-body{grid-column:1;grid-row:1;min-width:0;color:#2a3931;font-size:.94rem;overflow-wrap:anywhere}.guide-toc{grid-column:2;grid-row:1;min-width:0}.toc-panel{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow:auto;padding:16px 13px;border:1px solid #dce4da;border-radius:12px;background:#fff;box-shadow:0 7px 23px rgba(28,61,43,.045)}.toc-kicker{margin:0 0 3px;color:#929b91;font-size:.61rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.toc-panel h2{margin:0 0 11px;color:#294d39;font-family:Georgia,"Times New Roman",serif;font-size:1.13rem;font-weight:500}.toc-nav{display:grid;gap:2px}.toc-link{display:grid;grid-template-columns:24px minmax(0,1fr);gap:5px;padding:5px 4px;border-radius:6px;color:#56675d;text-decoration:none;font-size:.72rem;line-height:1.35}.toc-link:hover{color:#1c4e35;background:#eff5ef}.toc-link.level-3{padding-left:12px}.toc-link.level-4,.toc-link.level-5,.toc-link.level-6{padding-left:20px}.toc-index{color:#a0a99f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.63rem}.toc-note{margin:13px 3px 0;padding-top:11px;border-top:1px solid #e9ede8;color:#89938a;font-size:.68rem;line-height:1.45}
.doc-body h1,.doc-body h2,.doc-body h3,.doc-body h4,.doc-body h5,.doc-body h6{color:#264b38;line-height:1.28;scroll-margin-top:18px}.doc-body h2{margin:2.15em 0 .7em;padding-bottom:.34em;border-bottom:1px solid #e3e9e2;font-family:Georgia,"Times New Roman",serif;font-size:1.48rem;font-weight:500}.doc-body h3{margin:1.7em 0 .55em;font-size:1.14rem}.doc-body h4{margin:1.4em 0 .45em;font-size:1rem}.doc-body h5,.doc-body h6{font-size:.92rem}.doc-body p{margin:.75em 0}.doc-body a{color:#206b4b}.doc-body ul,.doc-body ol{padding-left:1.5rem}.doc-body li{margin:.31em 0;padding-left:.1rem}.doc-body li>p:first-child{margin-top:.3em}.doc-body blockquote{margin:1.15em 0;padding:3px 16px;border-left:3px solid #91a987;color:#52665a;background:#f5f8f3}.doc-body code{padding:.13em .34em;border-radius:5px;color:#874e2e;background:#f1eee7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em}.doc-body pre{margin:1em 0;padding:15px 17px;overflow:auto;border:1px solid #253e32;border-radius:10px;color:#e9f2e9;background:#172b24;line-height:1.55}.doc-body pre code{padding:0;color:inherit;background:transparent;font-size:.81rem}.table-scroll{margin:1em 0 1.35em;overflow-x:auto;border:1px solid #dce4dc;border-radius:10px}.doc-body table{width:100%;border-collapse:collapse;background:#fff;font-size:.82rem}.doc-body th,.doc-body td{min-width:95px;padding:9px 11px;border-bottom:1px solid #e6ebe5;text-align:left;vertical-align:top}.doc-body th{color:#2b503a;background:#edf3eb;font-size:.75rem;font-weight:800}.doc-body tr:nth-child(even) td{background:#fafbf9}.doc-body tr:last-child td{border-bottom:0}.diagram-block{margin:1.25em 0;padding:13px;overflow:hidden;border:1px solid #dce5da;border-radius:12px;background:#fbfcf9}.mermaid{display:flex;justify-content:center;min-height:72px;overflow:auto;padding:8px;white-space:pre-wrap;font: .8rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.mermaid svg{max-width:100%;height:auto}.diagram-block details{margin:8px 3px 0;color:#67766c;font-size:.77rem}.diagram-block summary{width:max-content;cursor:pointer;font-weight:750}.diagram-block pre{margin-top:9px}hr{height:1px;margin:2em 0;border:0;background:var(--line)}
.page-navigation{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:34px 0 8px}.page-nav-card{min-height:88px;padding:14px;border:1px solid var(--line);border-radius:11px;color:var(--ink);background:#fff;text-decoration:none}.page-nav-card:hover{border-color:#9fb59b;background:#fbfdf9}.page-nav-card.next{text-align:right}.page-nav-label{display:block;color:#89948a;font-size:.65rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.page-nav-title{display:block;margin-top:5px;color:#2a563d;font-size:.85rem;font-weight:750}.site-footer{margin-top:34px;padding-top:14px;border-top:1px solid #dbe3da;color:#7c877e;font-size:.72rem}.site-footer a{color:#557760}
@media(max-width:1160px){.reader-layout{grid-template-columns:minmax(0,1fr)}.guide-toc{grid-column:1;grid-row:1}.doc-body{grid-column:1;grid-row:2}.toc-panel{position:static;max-height:270px}.toc-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.toc-note{display:none}}
@media(max-width:920px){.site-grid{display:block}.sidebar{position:relative;z-index:5;height:auto;padding:16px 18px}.sidebar nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.nav-home{margin-bottom:8px}.nav-group{margin-top:12px}.sidebar-note{display:none}.main-area{padding-top:23px}.architecture-flow{grid-template-columns:1fr;gap:7px}.architecture-arrow{transform:rotate(90deg)}.home-bottom{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.sidebar nav{grid-template-columns:1fr}.nav-group{margin-top:10px}.main-area{padding:17px 15px 48px}.topline{align-items:start;font-size:.68rem}.hero{padding:27px 22px;border-radius:17px}.hero h1{font-size:2.55rem}.hero-lede{font-size:.9rem}.hero-meta{gap:6px}.pill{font-size:.66rem}.section-block{margin-top:34px}.section-heading{display:block}.section-heading>p{margin-top:7px}.guide-group{padding:15px}.guide-grid{grid-template-columns:1fr}.guide-card{min-height:160px}.home-bottom{grid-template-columns:1fr}.guide-heading{display:block}.guide-heading h1{font-size:2.25rem}.guide-actions{margin-top:17px}.toc-nav{grid-template-columns:1fr}.toc-panel{max-height:245px}.page-navigation{grid-template-columns:1fr}.page-nav-card.next{text-align:left}.architecture-node{padding:13px}.topline-date{white-space:normal;text-align:right}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.guide-card{transition:none}}
@media print{body{background:white}.site-grid{display:block}.sidebar,.topline,.guide-toc,.guide-actions,.page-navigation,.site-footer{display:none!important}.main-area{width:auto;max-width:none;padding:0}.hero{padding:0 0 18px;border:0;color:#1d3029;background:white;box-shadow:none}.hero:after{display:none}.hero h1,.hero-lede,.hero .eyebrow{color:#1d3029}.hero-meta{display:none}.section-block{margin-top:20px}.guide-group,.info-panel,.architecture-flow{break-inside:avoid}.reader-layout{display:block}.guide-heading{margin-top:0}.doc-body{font-size:10pt}.doc-body h2,.doc-body h3{break-after:avoid}.doc-body a{color:inherit}.diagram-block,.table-scroll{break-inside:avoid}.diagram-block pre{display:none}}
"""


def page_scripts(include_mermaid: bool = False) -> str:
    mermaid = """<script type="module">
try {
  const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { htmlLabels: false } });
  await mermaid.run({ querySelector: '.mermaid' });
} catch (error) {
  // Diagram source remains available in the page and in each expandable source panel.
}
</script>""" if include_mermaid else ""
    return (
        '<script src="search-index.js" defer></script>\n'
        '<script src="handbook.js" defer></script>\n'
        + mermaid
    )


def page_shell(title: str, description: str, active_page: str, content: str, include_mermaid: bool = False) -> str:
    generated = date.today().strftime("%d %B %Y")
    browser_title = "Agro Core · Project Handbook" if title == "Project Handbook" else f"{title} · Agro Core Handbook"
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#183b31">
  <meta name="description" content="{html.escape(description, quote=True)}">
  <title>{html.escape(browser_title)}</title>
  <link rel="stylesheet" href="handbook.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to handbook content</a>
  <div class="site-grid">
    <aside class="sidebar" aria-label="Handbook navigation">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">A</span><span><span class="brand-name">AGRO CORE</span><span class="brand-subtitle">Project handbook</span></span></a>
      <div class="search-wrap">
        <label for="handbook-search">Search all guides</label>
        <input id="handbook-search" type="search" placeholder="Try “irrigation” or “FR-20”" autocomplete="off" aria-controls="search-results">
        <div class="search-results" id="search-results" role="status" aria-live="polite" hidden></div>
      </div>
      <nav aria-label="Guides">{navigation_html(active_page)}</nav>
      <p class="sidebar-note">Search project guides, jump to a section, or use the contents panel on each guide page.</p>
    </aside>
    <main class="main-area" id="main-content">
      <div class="topline"><a href="index.html">AGRO CORE <span aria-hidden="true">/</span> HANDBOOK</a><span class="topline-date">Updated from project docs · {generated}</span></div>
      {content}
      <footer class="site-footer">Generated from maintained Markdown guides. Refresh with <code>python3 scripts/generate_project_handbook.py</code> from the repository root. <a href="index.html">Handbook home</a></footer>
    </main>
  </div>
  {page_scripts(include_mermaid)}
</body>
</html>
'''


def architecture_html() -> str:
    stages = [
        ("01 · Web client", "AgroVision", "React · TypeScript · Vite", "Demonstration mode or authenticated farm workspace"),
        ("02 · Application API", "Agro Core", "Spring Boot · Java 17 · REST", "Sessions · CSRF · farm-scoped permissions"),
        ("03 · Domain workflows", "Agricultural modules", "Farms · tasks · planting · irrigation", "Fertilization · inspections · harvest · analytics"),
        ("04 · Persistence", "PostgreSQL + PostGIS", "JPA + Hibernate Spatial · Flyway migrations", "Operational records · spatial data · photos"),
    ]
    nodes = []
    for index, (step, title, stack, detail) in enumerate(stages):
        arrow = '<span class="architecture-arrow" aria-hidden="true">→</span>' if index < len(stages) - 1 else ""
        nodes.append(
            f'<div class="architecture-node"><p class="step">{html.escape(step)}</p>'
            f'<h3>{html.escape(title)}</h3><strong>{html.escape(stack)}</strong>'
            f'<span>{html.escape(detail)}</span></div>{arrow}'
        )
    return "".join(nodes)


def guide_card(relative_path: str, number: int) -> str:
    meta = DOC_META[relative_path]
    title = str(meta["title"])
    description = str(meta["description"])
    page = str(meta["page"])
    source = SOURCES[relative_path]
    toc = meta["toc"]
    section_count = len(toc) if isinstance(toc, list) else 0
    words = word_count(source)
    return (
        f'<a class="guide-card" href="{html.escape(page, quote=True)}">'
        f'<span class="card-kicker"><span>Guide {number:02}</span><span class="card-mark" aria-hidden="true">↗</span></span>'
        f'<h4>{html.escape(title)}</h4><p>{html.escape(description)}</p>'
        f'<span class="card-footer"><span>{section_count} sections · {words:,} words</span><span>Open guide</span></span></a>'
    )


def index_content() -> str:
    total_guides = len(DOC_META)
    total_diagrams = sum(len(re.findall(r"^```mermaid\s*$", source, re.MULTILINE)) for source in SOURCES.values())
    number = 0
    groups = []
    for group_name, entries in DOCUMENT_GROUPS:
        cards = []
        for relative_path, _ in entries:
            number += 1
            cards.append(guide_card(relative_path, number))
        groups.append(
            f'<section class="guide-group" aria-labelledby="group-{number}">'
            f'<div class="group-heading"><h3 id="group-{number}">{html.escape(group_name)}</h3>'
            f'<span>{len(entries)} {"guide" if len(entries) == 1 else "guides"}</span></div>'
            f'<div class="guide-grid">{"".join(cards)}</div></section>'
        )

    content = f'''<section class="hero" aria-labelledby="home-title">
  <div class="hero-content">
    <p class="eyebrow">Product · design · implementation · field operations</p>
    <h1 id="home-title">A clear view of the whole system.</h1>
    <p class="hero-lede">A curated guide to Agro Core and AgroVision. Browse the implementation, architecture, requirements, agronomic references, and workflows as individual chapters, each with its own table of contents.</p>
    <div class="hero-meta"><span class="pill">{total_guides} project guides</span><span class="pill">{total_diagrams} system diagrams</span><span class="pill">Requirements FR-01–FR-29 · NFR-01–NFR-16</span></div>
    <div class="hero-actions"><a class="button" href="project-overview.html">Start with the project overview</a><a class="button secondary" href="system-requirements.html">Browse requirements</a></div>
  </div>
</section>

<section class="section-block" aria-labelledby="architecture-title">
  <div class="section-heading"><div><p class="eyebrow">System at a glance</p><h2 id="architecture-title">Architecture and implementation flow</h2></div><p>The browser experience calls farm-scoped APIs, which run agricultural workflows and store operational and spatial records.</p></div>
  <div class="architecture-flow" role="img" aria-label="Architecture flow from the AgroVision browser client through the Agro Core REST API and agricultural modules to PostgreSQL and PostGIS">{architecture_html()}</div>
  <div class="architecture-note"><span>Map tiles · OpenStreetMap and Esri imagery</span><span>Spatial storage · PostGIS</span><span>Schema changes · Flyway</span><span>Photos · PostgreSQL-backed storage</span></div>
  <p class="architecture-caption">Demo mode is visibly labeled and isolated in browser storage. Real mode uses session-based authentication and farm records. See the overview guide for implementation detail and the original relationship, sequence, architecture, and component diagrams.</p>
</section>

<section class="section-block" aria-labelledby="guides-title">
  <div class="section-heading"><div><p class="eyebrow">Explore the chapters</p><h2 id="guides-title">Project documentation</h2></div><p>Every maintained Markdown guide is included in full. Pick a chapter below, or use the sidebar search to jump directly to a matching section.</p></div>
  {''.join(groups)}
</section>

<div class="home-bottom">
  <section class="info-panel"><h3>A useful reading path</h3><ol><li>Start with the overview for product scope and current implementation.</li><li>Read the requirements and crop audit to see coverage and remaining gaps.</li><li>Use the module guides for day-to-day workflows, API details, and limits.</li><li>Finish with the frontend and runbook guides for setup and manual operation.</li></ol></section>
  <section class="info-panel"><h3>Keep the handbook current</h3><p>The Markdown files remain the maintained source. After changing a guide, regenerate the site from the repository root:</p><p><code>python3 scripts/generate_project_handbook.py</code></p></section>
</div>'''
    return content


def guide_content(relative_path: str) -> tuple[str, bool]:
    meta = DOC_META[relative_path]
    title = str(meta["title"])
    title_anchor = meta["anchors"].get(slugify(title), f"{meta['id']}--title")
    toc_items = meta["toc"]
    toc_count = len(toc_items) if isinstance(toc_items, list) else 0
    source = SOURCES[relative_path]
    body = render_blocks(source.splitlines(), relative_path)
    order = [path for _, entries in DOCUMENT_GROUPS for path, _ in entries]
    position = order.index(relative_path)
    previous = order[position - 1] if position > 0 else None
    following = order[position + 1] if position + 1 < len(order) else None

    prev_html = ""
    if previous:
        previous_meta = DOC_META[previous]
        prev_html = (
            f'<a class="page-nav-card" href="{previous_meta["page"]}">'
            f'<span class="page-nav-label">← Previous guide</span>'
            f'<span class="page-nav-title">{html.escape(str(previous_meta["title"]))}</span></a>'
        )
    else:
        prev_html = '<a class="page-nav-card" href="index.html"><span class="page-nav-label">← Handbook home</span><span class="page-nav-title">All project guides</span></a>'
    next_html = ""
    if following:
        next_meta = DOC_META[following]
        next_html = (
            f'<a class="page-nav-card next" href="{next_meta["page"]}">'
            f'<span class="page-nav-label">Next guide →</span>'
            f'<span class="page-nav-title">{html.escape(str(next_meta["title"]))}</span></a>'
        )
    else:
        next_html = '<a class="page-nav-card next" href="index.html"><span class="page-nav-label">Back to handbook →</span><span class="page-nav-title">All project guides</span></a>'

    content = f'''<div class="breadcrumb"><a href="index.html">Handbook home</a><span class="breadcrumb-separator">/</span><span>{html.escape(str(meta['group']))}</span><span class="breadcrumb-separator">/</span><span>{html.escape(str(meta['label']))}</span></div>
<header class="guide-heading">
  <div class="guide-heading-copy"><p class="guide-number">Project guide · {html.escape(str(meta['group']))}</p><h1 id="{html.escape(title_anchor, quote=True)}">{html.escape(title)}</h1><p class="guide-deck">{html.escape(str(meta['description']))}</p><p class="source-note">Source · {html.escape(relative_path)}</p></div>
  <div class="guide-actions"><button class="button" type="button" data-print>Print / PDF</button></div>
</header>
<div class="reader-layout">
  <aside class="guide-toc" aria-label="Table of contents for {html.escape(title, quote=True)}"><div class="toc-panel"><p class="toc-kicker">Navigate this guide</p><h2>Contents <span>({toc_count + 1})</span></h2><nav class="toc-nav">{toc_html(relative_path)}</nav><p class="toc-note">Choose a section to jump to its implementation notes, tables, or requirement details.</p></div></aside>
  <article class="doc-body" aria-label="{html.escape(title, quote=True)} guide content">{body}</article>
</div>
<nav class="page-navigation" aria-label="Guide pagination">{prev_html}{next_html}</nav>'''
    has_mermaid = "```mermaid" in source
    return content, has_mermaid


def redirect_html() -> str:
    return '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=project-handbook/index.html"><title>Agro Core Project Handbook</title><script>window.location.replace("project-handbook/index.html");</script></head>
<body><p>The handbook has moved to its chapter-based layout. <a href="project-handbook/index.html">Open the Agro Core project handbook</a>.</p></body></html>
'''


def generate() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "handbook.css").write_text(stylesheet(), encoding="utf-8")
    (OUTPUT_DIR / "search-index.js").write_text(search_index_js(), encoding="utf-8")
    (OUTPUT_DIR / "handbook.js").write_text(
        """(() => {
  const input = document.getElementById('handbook-search');
  const results = document.getElementById('search-results');
  const index = window.AGRO_HANDBOOK_SEARCH || [];
  if (input && results) {
    const clear = () => { results.replaceChildren(); results.hidden = true; };
    const makeResult = (guide, section, query) => {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = `${guide.page}#${section.anchor}`;
      const heading = document.createElement('span');
      heading.className = 'search-result-title';
      heading.textContent = section.title;
      const meta = document.createElement('span');
      meta.className = 'search-result-meta';
      meta.textContent = `${guide.title} · ${guide.group}`;
      const snippet = document.createElement('span');
      snippet.className = 'search-result-snippet';
      const lower = section.text.toLocaleLowerCase();
      const at = lower.indexOf(query);
      const start = Math.max(0, at - 48);
      const end = Math.min(section.text.length, Math.max(at + query.length + 90, start + 140));
      snippet.textContent = `${start ? '…' : ''}${section.text.slice(start, end)}${end < section.text.length ? '…' : ''}`;
      link.append(heading, meta, snippet);
      return link;
    };
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      if (query.length < 2) { clear(); return; }
      const matches = [];
      for (const guide of index) {
        for (const section of guide.sections) {
          if (`${section.title} ${section.text}`.toLocaleLowerCase().includes(query)) {
            matches.push({ guide, section });
            if (matches.length >= 12) break;
          }
        }
        if (matches.length >= 12) break;
      }
      results.replaceChildren();
      if (matches.length) {
        for (const match of matches) results.append(makeResult(match.guide, match.section, query));
      } else {
        const empty = document.createElement('p');
        empty.className = 'search-empty';
        empty.textContent = 'No matching guide sections. Try another project term.';
        results.append(empty);
      }
      results.hidden = false;
    });
    input.addEventListener('keydown', event => { if (event.key === 'Escape') { clear(); input.blur(); } });
    document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) clear(); });
  }
  for (const button of document.querySelectorAll('[data-print]')) button.addEventListener('click', () => window.print());
})();
""",
        encoding="utf-8",
    )

    index_description = "A chapter-based, searchable reference to Agro Core and AgroVision architecture, requirements, implementation, agronomic guidance, module workflows, and operations."
    index = page_shell("Project Handbook", index_description, "index.html", index_content())
    (OUTPUT_DIR / "index.html").write_text(index, encoding="utf-8")

    page_count = 1
    for group_name, entries in DOCUMENT_GROUPS:
        for relative_path, _ in entries:
            meta = DOC_META[relative_path]
            content, has_mermaid = guide_content(relative_path)
            page = page_shell(
                str(meta["title"]),
                str(meta["description"]),
                str(meta["page"]),
                content,
                include_mermaid=has_mermaid,
            )
            (OUTPUT_DIR / str(meta["page"])).write_text(page, encoding="utf-8")
            page_count += 1

    LEGACY_ENTRY.write_text(redirect_html(), encoding="utf-8")
    print(f"Generated {page_count} handbook pages from {len(SOURCES)} Markdown guides in {OUTPUT_DIR.relative_to(ROOT)}.")


if __name__ == "__main__":
    generate()
