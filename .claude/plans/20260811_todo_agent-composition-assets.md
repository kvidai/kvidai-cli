# TODO: 에이전트 다수 이미지 배치 — composition.assets 미사용 + generate 행

> **Status**: todo
> **Created In**: /Users/workspace/kvidai-workspace/kvidai-cli
> **발견**: 2026-08-11, marketing-studio 다수 이미지 영상 검증 중 (project 556)

## 배경
긴 영상(다수 씬)은 씬별 이미지가 10장을 훌쩍 넘는다. 현재 `/agent/generate` 의 `attachedFiles`
는 ~10개 캡이라 부족. 이상적 해법 = **업로드 후 `composition.assets` 로 다수 시딩 + message 에
매니페스트(파일명+설명+용도) → 에이전트가 참조 배치.** (파일 바이트 없이 URL+설명만 전달)

## 실측 결과 (project 556, kvid 0.9.0)
- ✅ `composition.assets` 는 캡 없이 12개 시딩·유지됨 (`kvid assets add-composition`).
- ❌ **attachedFiles 없이** 매니페스트만으로 `kvid video generate` → 에이전트가 그 에셋을
  **배치 안 함**, SSE 가 안 닫혀 **15분 하드 타임아웃까지 행** → 빈 타임라인(items 0).

## 고쳐야 할 것

### 1. API / 에이전트 (근본 — 백엔드)
- `/agent/generate` 가 **프로젝트 composition.assets 를 컨텍스트로 인지**하고, message 매니페스트
  (asset id/파일명 + 설명)를 근거로 **씬에 배치**하도록.
- 최소한 attachedFiles 없이 호출돼도 **SSE 가 정상 종료**해야 함(무한 대기 금지).
- 이게 되면 marketing-studio 의 "순수 A"(에이전트 무제한 배치)가 열림 → 지금은 direct 결정적
  배치로 우회 중(`send-video-kvidai` `assembleProject`).

### 2. kvidai-cli (`src/commands/video.ts`)
- `video generate` 에 **`--timeout` 플래그** 추가 (현재 `AbortSignal.timeout(15*60*1000)` 하드코딩, video.ts:131).
- SSE 가 진전 없이 멈추면 **빠른 실패/경고** (15분 무증상 행 방지). `--verbose` 진행표시 강화.

## 참고
- 우회책(현행): 다수 이미지 = **direct 결정적 배치**(Claude vision 씬매핑 + `replace-composition`, 무제한).
  marketing-studio `.claude/skills/new-video/SKILL.md` step 0 자동 라우팅 참조.
- 관련 계약: marketing-studio `.claude/rules/upstream-cli-contract.md`.
