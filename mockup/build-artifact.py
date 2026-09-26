#!/usr/bin/env python3
"""mockup/play.html 을 폰트·문자열·스크립트까지 모두 넣은 단일 HTML 로 묶는다.

claude.ai 아티팩트로 공유하려고 쓴다 (외부 파일을 불러올 수 없으므로 전부 인라인).
사용: python3 mockup/build-artifact.py <출력 경로>
"""
import base64
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = ROOT / "mockup"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else MOCK / "dist" / "play.html"

html = (MOCK / "play.html").read_text(encoding="utf-8")

# 1) 폰트 → data URI
def font_uri(m):
    path = (MOCK / m.group(1)).resolve()
    data = base64.b64encode(path.read_bytes()).decode()
    return f"url('data:font/woff2;base64,{data}')"

html = re.sub(r"url\('(\.\./assets/fonts/[^']+\.woff2)'\)", font_uri, html)

# 2) 문자열 + 스크립트 인라인
strings = json.loads((ROOT / "locales" / "ko.json").read_text(encoding="utf-8"))
lib = (MOCK / "lib.js").read_text(encoding="utf-8")
play = (MOCK / "play.js").read_text(encoding="utf-8")
inline = (
    "<script>window.PS_STRINGS = " + json.dumps(strings, ensure_ascii=False) + ";</script>\n"
    "<script>\n" + lib + "\n</script>\n<script>\n" + play + "\n</script>"
)
html = html.replace('<script src="lib.js"></script>\n<script src="play.js"></script>', inline)
assert "play.js\"></script>" not in html, "스크립트 태그를 찾지 못함"

# 3) 아티팩트 뼈대가 charset/viewport 를 넣어 주므로 제거
html = re.sub(r'<meta (charset|name="viewport")[^>]*>\n', "", html)

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out} ({out.stat().st_size / 1024:.0f} KB)")
