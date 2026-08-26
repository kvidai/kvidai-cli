# DONE(백엔드): 에이전트 다수 이미지 배치 — 토큰-free 자산 라이브러리

> ✅ **2026-08-11 해결**: web-service `/api/agent/route.ts` 가 프로젝트 composition.assets 를
> 로드·병합하고 **compact 매니페스트(id+파일명)를 프롬프트에 주입** → 에이전트 `use_uploaded_asset`
> 이 이제 resolve. **실측 project 564: add_asset 12개 + attachedFiles 0 → Media 트랙 12/12 배치**
> (토큰 초과 없음). 남은 것: kvidai-cli `--timeout`, marketing-studio `send-video-kvidai` 배선.

---

# (원본 기록) 에이전트 다수 이미지 배치 — composition.assets 미사용 + generate 행

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

## 제약 (중요)
- `attachedFiles` 캡 10 은 **에이전트 입력 토큰 예산 보호용** → **단순 캡 상향 불가**(토큰 초과). 파일을 프롬프트 컨텍스트에 더 못 실음.
- 따라서 해법은 **"토큰을 안 먹으면서 다수 자산을 배치"** 여야 함.

## 고쳐야 할 것

### 1. ⭐ API/에이전트 — composition.assets 를 **토큰-free 로 배치** (근본)
- 에이전트가 프로젝트 `composition.assets`(또는 미디어 라이브러리)를 **서버측에서 참조**해 배치하도록.
  자산 바이트/URL 은 프롬프트에 안 싣고, 프롬프트엔 **compact 매니페스트(id + 짧은 설명)만**(토큰 저렴) → id 로 배치.
- 구체: **`use_uploaded_asset`(또는 신규 tool)이 `composition.assets` 의 asset id 를 해석**하도록.
  현재는 attachedFiles 만 참조하는 정황(실측: composition.assets id 로 use_uploaded_asset 12회 호출했으나 최종 0/12).
- 이게 되면 attachedFiles 캡(10)과 무관하게 **토큰 예산 안에서 다수 이미지** 배치 = 유저 #3 시나리오.
- 겸사겸사: attachedFiles 없이 호출돼도 **SSE 정상 종료**(무한 대기 금지).

### 2. kvidai-cli (`src/commands/video.ts`)
- `video generate` 에 **`--timeout` 플래그** (현재 `AbortSignal.timeout(15*60*1000)` 하드코딩, video.ts:131).
- SSE 무진전 시 빠른 실패/경고.
- (필요 시) 미디어 라이브러리 등록 커맨드 노출 — 현재 `kvid assets` 는 CDN upload + add-composition 뿐.

## 참고
- **direct 우회는 폐기** (유저가 agent 모드 유지 요구). 다수 이미지는 #1 로 해결.
- marketing-studio: `.claude/skills/new-video/SKILL.md`(agent-mode-many), `.claude/rules/upstream-cli-contract.md`.
