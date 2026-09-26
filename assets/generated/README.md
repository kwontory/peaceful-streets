# P1 픽셀아트 검토용

`npm run assets:p1`로 `src/art.js`의 기존 그림과 팔레트를 바탕으로 다시 만든다. 실제 게임에는 아직 연결하지 않았다.

- 1배 PNG 20개: `player/`, `tiles/`, `hazards/`, `objects/`, `items/`, `fx/`
- 애니메이션 JSON 11개: 같은 이름의 PNG 옆에 있다. 프레임은 가로 한 줄이며 여백이 없다.
- `_preview_<분류>_4x.png`: 검토용 4배 확대본. 각 줄은 아래 목록 순서다. 게임 에셋으로 사용하지 않는다.

| 미리보기 | 위에서 아래 순서 |
|---|---|
| `_preview_player_4x.png` | `cat_idle`, `cat_run`, `cat_jump`, `cat_land`, `cat_spin` |
| `_preview_tiles_4x.png` | `ground`, `ground_variants`, `platform` |
| `_preview_hazards_4x.png` | `spikes`, `chomper_pot` |
| `_preview_objects_4x.png` | `checkpoint_lamp`, `checkpoint_lamp_glow`, `goal_flag`, `sign_board`, `sign_post` |
| `_preview_items_4x.png` | `flower`, `flower_collect` |
| `_preview_fx_4x.png` | `air_puff`, `dust`, `poof` |

`tiles/ground`의 순서는 윗면 왼쪽·가운데·오른쪽, 속 왼쪽·가운데·오른쪽이다. `tiles/ground_variants`는 윗면 2개, 속 2개다. `tiles/platform`은 왼쪽·가운데·오른쪽이다. `objects/checkpoint_lamp`는 꺼짐·켜짐이고, 빛은 별도 PNG다. `hazards/chomper_pot`은 닫힘·반쯤·벌림 순서다.

Claude 검수 후 채택한 이미지만 `assets/sprites/`로 옮겨 게임 그리기 코드에 연결한다. 현재 코드 그림은 그대로 동작한다.
