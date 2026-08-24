# B — kvidai-cli 스킬 기능 인수: 핀 bump + 검증 + 잔여

> **Status**: plan (B track of A→B→C handoff)
> **Created In**: /Users/workspace/kvidai/apps/cli
> **Root plan**: `/Users/workspace/kvidai/.claude/plans/20260724_todo_kvidai-cli-skills-feature-handoff.md` (이 결과로 갱신 예정)

---

## Context

다른 개발자가 kvidai-cli 의 "skills 기능" MVP 를 개발 후 이어받았다. **조사 결과, 스킬 기능 자체는 이미 사실상 완성·일관된 상태**다 — 단, 그 완성본은 각 서브모듈 repo 의 `develop`/`main` 브랜치에 있고, **모노레포가 가리키는 submodule 핀이 리팩터 이전의 오래된 커밋**이라 모노레포를 체크아웃하면 옛(불일치) 상태로 보인다.

리팩터(apps/cli `develop`)에서 일어난 일:
- **번들 스킬을 CLI repo 밖으로 이동** → 단일 레지스트리 `kvidai/kvidai-skills` 로 통합 (커밋 `5cdfeb9`). `skills/index.json` 생성기·번들 스킬 디렉토리 전부 CLI repo 에서 제거.
- CLI 의 skills 레지스트리 URL 이 `kvidai-cli/main/skills` → **`kvidai-skills/main/skills`** 로 변경 (`src/lib/skills-registry.ts`).
- `kvidai` CLI-teaching 스킬을 **실제 명령 표면(project/video/image/task/assets/upload/docs)** 에 맞게 재작성. 옛 phantom 명령(`models`/`run`/`schema`/`pricing`) 을 쓰던 `kvidai-ref` 는 폐기 (`c882428`).
- install 이 **multi-target(claude/cursor/agents-md)** 로 확장 (`src/lib/skills-install.ts`, `src/commands/skills/install.ts`, `init.ts`).

즉 이 트랙의 목표는 새 기능 개발이 아니라 **모노레포를 완성 상태로 동기화(핀 bump) + 로컬 end-to-end 검증 + 잔여 버그**다.

## 현재 상태 (조사 확정값)

| repo | 모노레포 핀(구) | 실제 최신(신) | 상태 |
| --- | --- | --- | --- |
| apps/cli (`kvidai/kvidai-cli`) | `ada43e7` (리팩터 이전, 번들스킬 잔존) | `origin/develop` = `c882428` | 핀 stale |
| skills/kvidai-skills (`kvidai/kvidai-skills`) | `d5bf4cc` (이동 이전, index.json 없음) | `origin/main` = `02df14b` | 핀 stale |

- `kvidai-skills` `origin/main == origin/develop` (develop 0 ahead). 레지스트리는 **main** 을 읽으므로 main 이 canonical.
- `kvidai-skills` main 스킬 콘텐츠 **phantom 명령 0건** (cinematography/commercial/character-design/model-routing/workflow/kvidai 전부 clean). `storytelling` 의 grep 매치는 **false positive** — 산문 "executable kvidai **runs**" (명령 아님). → **수정 불필요.**
- 라이브 레지스트리(`kvidai-skills/main/skills/index.json`)는 **이미 정상** → 다른 개발자가 개인환경에서 테스트 가능했던 이유.

## ⚠️ Track A 와의 충돌

Track A(멀티OS smoke 테스트)의 [release.yml](.github/workflows/release.yml)·[build.yml](.github/workflows/build.yml) 편집을 **stale `ada43e7` 워킹트리에 적용**했다. develop 은 build.yml 이 이미 다름(`skills:index:check` 스텝 제거됨). → **Track A 편집을 폐기하고 develop 위에서 재적용**해야 한다. (develop 의 build.yml `Build` 스텝 / release.yml `Build binary` 스텝은 그대로라 smoke 스텝 추가는 동일하게 적용됨.)

---

## Plan (권장 접근)

> Git 커밋/push/PR 은 사용자가 직접 관리. 아래는 워킹트리 변경 + 검증까지 내가 수행하고, 커밋은 사용자. 서브모듈 repo 커밋은 각 서브모듈 안에서(별도 브랜치→PR), 모노레포 핀 bump 는 별도 커밋 (monorepo 규칙).

### 1. apps/cli 를 develop 로 정렬 + Track A 재적용
- `apps/cli` 를 detached `ada43e7` → **`develop`(c882428) 체크아웃**. (현재 워킹트리의 stale Track A 편집은 폐기.)
- develop 위에서 **Track A smoke 스텝 재적용**:
  - [.github/workflows/release.yml](.github/workflows/release.yml): `Build binary` 뒤에 `Smoke test binary` 스텝 (darwin-x64 skip, `KVIDAI_NO_UPDATE=1`, `--json` + `version --json`, `shell: bash`).
  - [.github/workflows/build.yml](.github/workflows/build.yml): `Build` 뒤에 linux-x64 smoke 실행.
- → apps/cli develop 에 새 커밋(사용자 push). 모노레포 핀은 이 새 커밋을 가리키게 bump.

### 2. kvidai-skills 핀 bump
- `skills/kvidai-skills` 를 `d5bf4cc` → **`main`(02df14b)** 체크아웃. 콘텐츠 수정 없음(잔여 버그 없음 확정).

### 3. 모노레포 핀 bump 커밋 (사용자)
- `git add apps/cli skills/kvidai-skills` → `chore: bump kvidai-cli(develop)+kvidai-skills(main) submodules` 성격의 별도 커밋.

### 4. 잔여 버그
- storytelling phantom → **false positive, 수정 없음** (이 판단을 근거와 함께 기록).
- 그 외 조사에서 실제 잔여 버그 발견 시 여기에 추가.

---

## Verification (end-to-end runnable/testable)

develop CLI 바이너리로 라이브 `kvidai/kvidai-skills` 레지스트리 대상 실행:

```bash
cd apps/cli   # develop 체크아웃 상태
bun install --frozen-lockfile
bun run scripts/gen-version.ts
bun build --compile --minify --bytecode --target=bun-darwin-arm64 src/index.ts --outfile /tmp/kvidai-dev
export KVIDAI_NO_UPDATE=1

# 4-1. 레지스트리 목록 (kvidai-skills/main/index.json 을 읽어야 함)
/tmp/kvidai-dev skills list --json            # registry URL 이 kvidai-skills 인지, 스킬 나열되는지

# 4-2. multi-target 설치 (임시 프로젝트)
TMP=$(mktemp -d); cd "$TMP"; mkdir .claude
/tmp/kvidai-dev init --json                   # 기본 kvidai 스킬 번들 설치
find .claude -type f                          # .claude/skills/kvidai/SKILL.md + .installed.json 확인
grep -c "kvidai run\|kvidai models\|kvidai schema" .claude/skills/kvidai/SKILL.md   # → 0 (실제 명령만)
/tmp/kvidai-dev skills install cinematography --json
/tmp/kvidai-dev skills remove cinematography --json

# 4-3. Track A smoke (develop 바이너리)
/tmp/kvidai-dev --json > /dev/null && /tmp/kvidai-dev version --json > /dev/null && echo OK
```

- 결과·스크립트는 `tests/plan-test/kvidai-cli-skills-feature-handoff/` 에 저장 (results/ 타임스탬프 포함).
- Track A Actions 레벨 검증(멀티OS 러너)은 사용자 태그 push / `workflow_dispatch` 필요 — 로컬 불가.

## 완료 기준 (Done)

- [x] apps/cli 워킹트리 → develop(c882428) 체크아웃, kvidai-skills 워킹트리 → origin/main(02df14b) 체크아웃
- [x] Track A smoke 스텝이 develop 의 build.yml/release.yml 에 재적용됨 (uncommitted, 사용자 커밋 대기)
- [x] `skills list` 가 kvidai-skills 레지스트리(refs/heads/main)를 읽고, `init` multi-target(claude/cursor/agents-md) 설치 성공, 설치된 kvidai 스킬 phantom 명령 0건
- [x] 검증 스크립트·결과 `tests/plan-test/kvidai-cli-skills-feature-handoff/` 저장 (verify.sh + results/20260724-1030-verify.txt)
- [x] storytelling phantom → false positive 확정 (수정 없음)
- [ ] **(사용자)** Track A 커밋 → apps/cli develop push → 모노레포 핀을 그 커밋으로 bump / kvidai-skills 핀 02df14b bump / Track A Actions 검증(태그 push or workflow_dispatch)

## 실행 결과 요약 (2026-07-24)

- 워킹트리: `apps/cli` = develop `c882428` (+ Track A smoke 편집 uncommitted), `skills/kvidai-skills` = detached `02df14b` (origin/main).
- 검증 로그: `skills list` → registry=`kvidai-skills/refs/heads/main`, 11개 스킬. `init` → kvidai 스킬 claude+cursor+agents-md 3타깃 설치, `.claude/skills/kvidai/SKILL.md` phantom 0건. install/remove cinematography 라운드트립 OK. smoke OK.
- 남은 것은 전부 git 작업(사용자 관할): 서브모듈 repo 커밋/푸시 + 모노레포 핀 bump 커밋 + Actions 레벨 멀티OS 검증.

## 크리티컬 파일

- `apps/cli/.github/workflows/{release,build}.yml` — Track A 재적용
- `apps/cli/src/lib/skills-registry.ts` — 레지스트리 URL(kvidai-skills), AGENT_ROOTS, installed manifest (수정 아님, 검증 참조)
- `apps/cli/src/lib/skills-install.ts`, `src/commands/skills/install.ts`, `src/commands/init.ts` — multi-target 설치 (검증 참조)
- 모노레포 `.gitmodules` 핀: `apps/cli`, `skills/kvidai-skills`
