#!/usr/bin/env python3
"""mockup/lib.js 의 그림 코드로 게임용 ES 모듈 src/art.js 를 만든다.

그림은 lib.js 한 곳에서만 고치고, 이 스크립트로 게임 쪽에 옮긴다.
사용: python3 mockup/build-art-module.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
lib = (ROOT / "mockup" / "lib.js").read_text(encoding="utf-8")


def between(a, b):
    i = lib.index(a)
    return lib[i:lib.index(b, i)]


parts = [
    between("const P = {", "let S = {};"),
    between("const rect = ", "// 모서리 1px"),
    between("// 모서리 1px", "// 픽셀 폰트 텍스트"),
    between("function sprite(", "// ── 스프라이트"),
    between("// ── 스프라이트", "// ── 배경 레이어"),
    between("// ── 배경 레이어", "// 튜토리얼 표지판"),
]
body = "\n".join(parts)
body = re.sub(r"^const (P|CAT|CAT_MAP|LEGS|FLOWER|FLOWER_MAP|CLOCK|CLOCK_MAP|AIR_PUFF|AIR_PUFF_MAP) =", r"export const \1 =", body, flags=re.M)
body = re.sub(r"^const rect = ", "export const rect = ", body, flags=re.M)
body = re.sub(r"^function (\w+)\(", r"export function \1(", body, flags=re.M)

head = """// 자동 생성 파일: 직접 고치지 말고 mockup/lib.js 를 고친 뒤
//   python3 mockup/build-art-module.py
// 를 실행한다. Peaceful Streets 의 팔레트, 스프라이트, 배경·지형·오브젝트 그리기.
// 그리기 전에 useContext(ctx) 로 대상 캔버스를 지정한다.

export const W = 480, H = 270, T = 16;
export const GROUND_Y = 224; // 지면 윗면 = 타일 14행

let ctx = null;
export function useContext(context) { ctx = context; }

"""
(ROOT / "src" / "art.js").write_text(head + body, encoding="utf-8")
print("src/art.js 생성")
