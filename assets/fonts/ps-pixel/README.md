# PS Pixel

Peaceful Streets 배포용 서브셋 폰트. 원본은 Galmuri (Lee Minseo, SIL OFL 1.1)다.
OFL 3조(예약 이름 "Galmuri")에 따라 수정본인 이 폰트는 이름을 "PS Pixel"로 바꿨다.
라이선스는 같은 폴더의 `OFL.md`. 다시 만들 때는 `scripts/subset-fonts.py`.

## 게임에서 쓰는 방법

게임은 이 폰트 파일을 브라우저 글꼴로 불러오지 않는다. 삼성 인터넷 등 일부 브라우저가
캔버스 글자에서 웹폰트를 무시하고 사용자가 폰에 설정한 글꼴로 그리기 때문이다.
대신 `scripts/build-font-atlas.mjs`(`npm run assets:font`)가 이 폰트의 글자 픽셀을
`src/font-data.js`로 뽑아 두고, `src/text.js`가 그 픽셀로 글자를 그린다.
`src/font-data.js`도 이 폰트의 파생물이므로 같은 라이선스(`OFL.md`)를 따른다.

문구를 새로 넣었다면 순서대로 다시 만든다.
1. `scripts/subset-fonts.py` (서브셋 폰트)
2. `npm run assets:font` (글자 픽셀)
