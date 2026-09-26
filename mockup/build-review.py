#!/usr/bin/env python3
"""실제 게임(index.html, styles.css, src/, locales/, 폰트)을 검토 페이지 한 파일로 묶는다.

claude.ai 아티팩트로 공유하려고 쓴다. 외부 파일을 불러올 수 없으므로 전부 인라인한다.
게임 코드는 고치지 않고, 묶을 때 두 군데만 바꾼다.
  - locale.js 의 fetch → 페이지에 넣은 문자열(window.__STRINGS)
  - main.js 의 창 크기(window.innerWidth/innerHeight) → 검토 페이지 게임 영역 크기(window.__viewport())

사용: python3 mockup/build-review.py <출력 경로>
"""
import base64
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "mockup" / "dist" / "review.html"

IMPORT_RE = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*"\./([\w-]+)\.js";\s*$', re.M | re.S)


def module_var(name):
    return "__mod_" + re.sub(r"\W", "_", name)


def load_modules():
    modules = {}
    for path in sorted(SRC.glob("*.js")):
        modules[path.stem] = path.read_text(encoding="utf-8")
    return modules


def deps_of(code):
    return [m.group(2) for m in IMPORT_RE.finditer(code)]


def order(modules, entry="main"):
    seen, result = set(), []

    def visit(name):
        if name in seen:
            return
        seen.add(name)
        for dep in deps_of(modules[name]):
            visit(dep)
        result.append(name)

    visit(entry)
    return result


def exported_names(code):
    names = []
    for m in re.finditer(r"^export\s+(?:async\s+)?function\s+(\w+)", code, re.M):
        names.append(m.group(1))
    for m in re.finditer(r"^export\s+(?:const|let)\s+([^\n]*)", code, re.M):
        line = m.group(1)
        # "W = 480, H = 270, T = 16;" 처럼 한 줄에 여러 개인 경우
        if line.rstrip().endswith(";") and "{" not in line and "[" not in line:
            names += re.findall(r"(?:^|,)\s*(\w+)\s*=", line)
        else:
            names.append(re.match(r"(\w+)", line).group(1))
    return names


def wrap(name, code):
    def to_const(m):
        parts = []
        for item in m.group(1).split(","):
            item = item.strip()
            if not item:
                continue
            if " as " in item:
                a, b = [x.strip() for x in item.split(" as ")]
                parts.append(f"{a}: {b}")
            else:
                parts.append(item)
        return f"const {{ {', '.join(parts)} }} = {module_var(m.group(2))};"

    names = exported_names(code)
    body = IMPORT_RE.sub(to_const, code)
    body = re.sub(r"^export\s+", "", body, flags=re.M)
    return f"const {module_var(name)} = (() => {{\n{body}\nreturn {{ {', '.join(names)} }};\n}})();\n"


def patch(name, code):
    if name == "locale":
        new, n = re.subn(r"export async function loadLocale\(\) \{.*?\n\}", "export async function loadLocale() {\n  strings = window.__STRINGS;\n}", code, flags=re.S)
        assert n == 1, "locale.js 의 loadLocale 을 찾지 못함"
        return new
    if name == "main":
        code = code.replace("window.innerWidth", "window.__viewport().width").replace("window.innerHeight", "window.__viewport().height")
    return code


def game_styles():
    css = (ROOT / "styles.css").read_text(encoding="utf-8")

    def font(m):
        data = base64.b64encode((ROOT / m.group(1)).read_bytes()).decode()
        return f"url('data:font/woff2;base64,{data}')"

    css = re.sub(r"url\('\./(assets/fonts/[^']+\.woff2)'\)", font, css)
    # 페이지 전체 배치(html/body/main)는 검토 페이지가 정한다
    css = re.sub(r"(?<![\w.#-])(html,\s*body|body|main)\s*\{[^}]*\}", "", css)
    return css


def game_markup():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    m = re.search(r"<main>(.*?)</main>", html, re.S)
    assert m, "index.html 의 <main> 을 찾지 못함"
    return "<main>" + m.group(1) + "</main>"


modules = load_modules()
bundle = "".join(wrap(n, patch(n, modules[n])) for n in order(modules))
strings = json.loads((ROOT / "locales" / "ko.json").read_text(encoding="utf-8"))
script = "<script>\nwindow.__STRINGS = " + json.dumps(strings, ensure_ascii=False) + ";\n" + bundle + "</script>"

page = (ROOT / "mockup" / "review.html").read_text(encoding="utf-8")
page = page.replace("/*__GAME_STYLES__*/", game_styles())
page = page.replace("<!--__GAME_MARKUP__-->", game_markup())
page = page.replace("<!--__GAME_SCRIPT__-->", script)
page = page.replace("__BUILT_AT__", datetime.date.today().isoformat())
for marker in ("__GAME_STYLES__", "__GAME_MARKUP__", "__GAME_SCRIPT__"):
    assert marker not in page, marker

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding="utf-8")
print(f"{out} ({out.stat().st_size / 1024:.0f} KB, 모듈 {len(order(modules))}개: {' → '.join(order(modules))})")
