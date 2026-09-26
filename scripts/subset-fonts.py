#!/usr/bin/env python3
"""게임에 쓰는 글자만 남긴 픽셀 폰트를 만든다 (배포용).

원본: assets/fonts/galmuri/ (Galmuri, SIL OFL 1.1, Reserved Font Name "Galmuri")
결과: assets/fonts/ps-pixel/PSPixel11.woff, PSPixel11-Bold.woff, PSPixel9.woff

OFL 3조에 따라 수정본(서브셋)은 예약 이름 "Galmuri"를 쓸 수 없어 "PS Pixel"로 바꾼다.
저작권 표시와 라이선스는 그대로 남긴다.

남기는 글자: 영문·숫자·기호(0x20~0x7E) + locales/ko.json 의 모든 문구
            + src/, index.html 에 들어 있는 ASCII 밖의 글자(▶ ← → ◀ ♪ Ⅱ × 등)
문구나 기호를 새로 넣었다면 이 스크립트를 다시 실행한다.
필요: fonttools. 원본 woff2 를 읽으려면 brotli 도 필요하므로, brotli 가 없으면
같은 버전(galmuri 2.40.3)의 TTF 가 있는 폴더를 --source 로 넘긴다.
    PYTHONPATH=<fonttools 경로> python3 scripts/subset-fonts.py [--source <Galmuri TTF 폴더>]
"""
import argparse
import json
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "fonts" / "galmuri"
OUT = ROOT / "assets" / "fonts" / "ps-pixel"

FONTS = [
    # 원본 파일, 결과 파일, 새 가족 이름, 굵기 이름
    ("Galmuri11.woff2", "PSPixel11.woff", "PS Pixel 11", "Regular"),
    ("Galmuri11-Bold.woff2", "PSPixel11-Bold.woff", "PS Pixel 11", "Bold"),
    ("Galmuri9.woff2", "PSPixel9.woff", "PS Pixel 9", "Regular"),
]


def used_text():
    chars = {chr(c) for c in range(0x20, 0x7F)}
    strings = json.loads((ROOT / "locales" / "ko.json").read_text(encoding="utf-8"))
    for value in strings.values():
        chars.update(value)
    for path in [*sorted((ROOT / "src").glob("*.js")), ROOT / "index.html"]:
        chars.update(ch for ch in path.read_text(encoding="utf-8") if ord(ch) > 0x7E)
    # 코드 주석에만 나오는 한글까지 들어가지만, 몇 글자 더 들어가는 편이 빠뜨리는 것보다 안전하다
    return "".join(sorted(chars))


def rename(font, family, style):
    full = f"{family} {style}" if style != "Regular" else family
    postscript = f"{family.replace(' ', '')}-{style}"
    names = {1: family, 2: style, 3: f"{postscript};peaceful-streets-subset", 4: full, 6: postscript, 16: family, 17: style}
    table = font["name"]
    for record in list(table.names):
        if record.nameID in names or record.nameID in (21, 22):
            table.removeNames(nameID=record.nameID)
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
    table.setName(
        f"Subset of Galmuri by Lee Minseo for Peaceful Streets. Renamed under SIL OFL 1.1 (Reserved Font Name \"Galmuri\").",
        10, 3, 1, 0x409,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path, help="Galmuri11.ttf 등이 있는 폴더 (없으면 assets/fonts/galmuri 의 woff2)")
    args = parser.parse_args()
    text = used_text()
    OUT.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.flavor = "woff"
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.layout_features = ["*"]
    for source, target, family, style in FONTS:
        origin = args.source / source.replace(".woff2", ".ttf") if args.source else SRC / source
        font = TTFont(origin)
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        rename(font, family, style)
        font.flavor = "woff"
        font.save(OUT / target)
        before, after = (SRC / source).stat().st_size, (OUT / target).stat().st_size  # 원본 woff2 와 비교
        print(f"{target}: {before / 1024:.0f} KB → {after / 1024:.0f} KB")
    (OUT / "OFL.md").write_text((SRC / "OFL.md").read_text(encoding="utf-8"), encoding="utf-8")
    (OUT / "README.md").write_text(
        "# PS Pixel\n\n"
        "Peaceful Streets 배포용 서브셋 폰트. 원본은 Galmuri (Lee Minseo, SIL OFL 1.1)다.\n"
        "OFL 3조(예약 이름 \"Galmuri\")에 따라 수정본인 이 폰트는 이름을 \"PS Pixel\"로 바꿨다.\n"
        "라이선스는 같은 폴더의 `OFL.md`. 다시 만들 때는 `scripts/subset-fonts.py`.\n",
        encoding="utf-8",
    )
    print(f"남긴 글자 {len(text)}개")


if __name__ == "__main__":
    main()
