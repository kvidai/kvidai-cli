# TODO: 에이전트 다수 이미지 배치 — composition.assets 미사용 + generate 행

> **Status**: todo
> **Created In**: /Users/workspace/kvidai-workspace/kvidai-cli
> **발견**: 2026-08-11, marketing-studio 다수 이미지 영상 검증 중 (project 556)

## 배경
긴 영상(다수 씬)은 씬별 이미지가 10장을 훌쩍 넘는다. 현재 `/agent/generate` 의 `attachedFiles`
는 ~10개 캡이라 부족. 이상적 해법 = **업로드 후 `composition.assets` 로 다수 시딩 + message 에
매니페스트(파일명+설명+용도) → 에이전트가 참조 배치.** (파일 바이트 없이 URL+설명만 전달)

## 실측 결과 (project 556/561, kvid 0.9.0) — 3회 검증

| 경로 | 결과 |
|------|------|
| `attachedFiles` ≤10 → `use_uploaded_asset` | ✅ **정상 배치** (유일하게 작동하는 경로) |
| `attachedFiles` **12개**(>10) | ❌ 서버 **400 거부**: `too_big, maximum:10, path:["attachedFiles"]` (Zod 하드 검증) |
| `composition.assets`(add_asset) 12개 + 매니페스트, 첨부 없음 | ❌ 에이전트가 **실제 배치 안 함** — 1차 SSE 15분 행 / 2차 `use_uploaded_asset` 12회 호출했으나 최종본에 시딩 이미지 **0/12**(solid 로 대체). 스킬 문서의 "agent sees it on timeline" 은 **부정확**. |

## 고쳐야 할 것

### 1. ⭐ API — `attachedFiles` 캡 상향 (근본·최소 변경, 권장)
- `/agent/generate` 입력 검증의 **`attachedFiles` 배열 `max(10)` 을 상향**(예: 50) 또는 해제.
- 배치 로직(`use_uploaded_asset`)은 **이미 정상 동작** → **숫자 제한만 풀면** URL+설명(매니페스트) 다수 이미지가 즉시 됨.
- 이게 marketing-studio 의 "agent 모드 다수 이미지"(= 유저 #3 시나리오)를 여는 **단일 스위치**.

### 2. (대안) 에이전트가 `composition.assets` 소비하도록 — 더 큰 작업
- add_asset 로 넣은 자산을 `use_uploaded_asset`/배치가 실제로 사용하도록. 무제한이지만 #1보다 복잡.
- 겸사겸사 attachedFiles 없이 호출돼도 **SSE 정상 종료**(무한 대기 금지).

### 3. kvidai-cli (`src/commands/video.ts`)
- `video generate` 에 **`--timeout` 플래그** (현재 `AbortSignal.timeout(15*60*1000)` 하드코딩, video.ts:131).
- SSE 무진전 시 빠른 실패/경고.

## 참고
- **direct 우회는 폐기** (유저가 agent 모드 유지 요구). 다수 이미지는 #1 로 해결.
- marketing-studio: `.claude/skills/new-video/SKILL.md`(agent-mode-many), `.claude/rules/upstream-cli-contract.md`.
