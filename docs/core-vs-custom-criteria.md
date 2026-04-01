# Core vs Custom 분류 기준 문서

> **목적**: 기능 추가·수정 시 "Core에 넣을 것인가, Custom(Extension)으로 뺄 것인가"를 판단하는 기준.
> 이 문서는 반복 가능하고 확장 가능한 아키텍처를 유지하기 위한 **의사결정 레퍼런스**로 사용한다.

---

## 1. 용어 정의

| 용어 | 위치 | 의미 |
|------|------|------|
| **Core** | `src/lib/domain/` | 모든 마케팅 대행사에 공통으로 적용되는 불변 규칙. Supabase·Next.js 등 외부 의존성 없음. |
| **Custom (Extension)** | `src/lib/extensions/` | 특정 조직·고객사에만 적용되는 가변 로직. Core를 수정하지 않고 주입(hook/validator). |
| **Infrastructure** | `src/lib/infrastructure/` | Core 인터페이스의 기술 구현체 (Supabase, 이메일 등). Core와 Custom 모두 이 레이어를 모름. |

---

## 2. 판단 기준 (Decision Matrix)

기능을 추가·수정할 때 아래 질문에 순서대로 답한다.

### 2.1 "이 규칙은 **모든** 마케팅 대행사에 적용되는가?"

| 답변 | 분류 | 예시 |
|------|------|------|
| **예** → Core | "승인 없이 문서를 외부 발송할 수 없다" |
| **아니오** → Custom | "500만원 이상 견적서는 2단계 승인 필요" |

### 2.2 "이 규칙이 없으면 **데이터 무결성이 깨지는가**?"

| 답변 | 분류 | 예시 |
|------|------|------|
| **예** → Core | "프로젝트 상태 전이는 정해진 경로만 허용" |
| **아니오** → Custom | "상태 전이 시 Slack 알림 전송" |

### 2.3 "이 로직을 **제거해도** 시스템이 정상 동작하는가?"

| 답변 | 분류 | 예시 |
|------|------|------|
| **제거 시 오류 발생** → Core | "활동 로그 기록" (감사 추적 필수) |
| **제거해도 정상** → Custom | "리포트 생성 시 자동 요약 생성" |

### 2.4 빠른 판단 플로우차트

```
기능 요구사항 수신
    │
    ├─ 모든 조직에 공통? ─── No ──→ Custom (Extension)
    │       │
    │      Yes
    │       │
    ├─ 제거 시 무결성 깨짐? ── No ──→ Custom (Extension)
    │       │
    │      Yes
    │       │
    └─ Core에 추가
```

---

## 3. Core 영역 상세

### 3.1 Core에 포함된 것 (현재 기준)

#### 엔티티 구조

| 엔티티 | 핵심 속성 | Core인 이유 |
|--------|-----------|------------|
| **Organization** | id, name, slug, settings | 멀티테넌시 루트. 모든 데이터의 소속 기준. |
| **User** | email, role, organization_id | 인증·인가의 기반. |
| **Client** | name, contact_* | 프로젝트의 필수 관계. |
| **Project** | client_id, status, title | 시스템의 중심 엔티티. 상태 머신의 주체. |
| **ProjectDocument** | project_id, type, status, version | 프로젝트 하위 문서. 승인 게이트의 대상. |
| **DocumentApproval** | document_id, action, requester/approver | 승인 이력. 감사 추적 대상. |
| **ActivityLog** | entity_type, entity_id, action | 불변 감사 로그. |

#### 상태 머신 (State Machine)

**프로젝트 상태 전이**
```
draft → quoted → contracted → paid → running → completed
      ↘ rejected                     ↘ paused ↗
                             ↘ refunded
모든 상태 → cancelled (admin only)
```

| 전이 | 필요 역할 | Core 규칙 |
|------|-----------|----------|
| → contracted | manager 이상 | 계약 체결은 매니저 승인 필요 |
| → paid | manager 이상 | 입금 확인은 매니저 승인 필요 |
| → refunded | admin | 환불은 관리자만 가능 |
| → cancelled | admin | 취소는 관리자만 가능 |
| 그 외 전이 | member 이상 | 일반 멤버도 가능 |

**문서 상태 전이**
```
draft → in_review → approved → sent
                  ↘ rejected → draft (수정 후 재요청, version +1)
```

#### 비즈니스 불변 규칙 (Business Invariants)

이 규칙들은 **어떤 상황에서도** 위반하면 안 되며, Core 서비스 레이어에서 강제된다.

| # | 규칙 | 강제 위치 | 설명 |
|---|------|-----------|------|
| **R1** | 승인 없이 문서 발송 불가 | `DocumentService.sendDocumentToClient()` | 문서 status가 `approved`여야 `sent`로 전이 가능 |
| **R2** | 프로젝트 상태는 정해진 경로만 허용 | `ProjectService.transitionStatus()` | `PROJECT_STATUS_TRANSITIONS` 맵에 정의된 전이만 허용 |
| **R3** | 문서 타입은 프로젝트 상태에 종속 | `DocumentService.createProjectDocument()` | 견적서는 draft에서만, 계약서는 quoted에서만 생성 가능 |
| **R4** | 자기 자신의 문서를 승인할 수 없음 | `ApprovalService.approveDocument()` | requester ≠ approver 강제 |
| **R5** | 반려 시 사유(comment) 필수 | `ApprovalService.rejectDocument()` | comment가 비어 있으면 reject 불가 |
| **R6** | 완료/취소/환불된 프로젝트는 수정 불가 | `ProjectService.updateProject()` | 종료 상태 이후 데이터 변경 차단 |
| **R7** | 발송 완료된 문서는 수정 불가 | `DocumentService.updateProjectDocument()` | `sent` 상태 문서는 readOnly |
| **R8** | 활동 로그는 삽입만 가능 (불변) | `IActivityLogRepository` | update/delete 메서드 미제공 |
| **R9** | 승인 이력은 삽입만 가능 (불변) | DB trigger + 서비스 로직 | 과거 승인 기록 수정 불가 |
| **R10** | 모든 주요 동작은 ActivityLog에 기록 | 모든 Service | 생성/수정/상태전이/승인/발송 시 자동 로깅 |

#### 문서 타입-프로젝트 상태 매핑

| 문서 타입 | 생성 가능한 프로젝트 상태 |
|-----------|------------------------|
| estimate (견적서) | `draft` |
| contract (계약서) | `quoted` |
| campaign (캠페인 안내문) | `paid`, `running` |
| report (보고서) | `running` |

#### 역할 계층

```
admin (level 100)  ⊃  manager (level 50)  ⊃  member (level 10)
```

### 3.2 Core 수정이 필요한 경우

아래 상황은 Core 변경이 불가피하다. **마이그레이션 SQL + TypeScript 타입 + 서비스 로직** 3곳 동시 수정이 필요.

| 변경 사항 | 수정 파일 |
|-----------|----------|
| 새 프로젝트 상태 추가 | `status.types.ts`, `00001_core_schema.sql` CHECK, 전이맵, 메타 |
| 새 문서 타입 추가 | `status.types.ts`, `entities.types.ts` (ContentMap), 스키마 CHECK |
| 엔티티 필드 추가 | `entities.types.ts`, `dto.types.ts`, 마이그레이션 SQL |
| 새 역할 추가 | `status.types.ts`, RLS 정책, 전이 역할맵 |

> **필수 체크리스트**: Core 수정 시 반드시 아래 파일을 함께 검토한다.
> 1. `status.types.ts` — 상태/타입 상수 및 전이맵
> 2. `00001_core_schema.sql` — CHECK 제약조건
> 3. `00002_rls_policies.sql` — RLS 정책 및 상태 뷰
> 4. 관련 Service 파일 — 비즈니스 로직 반영
> 5. `dto.types.ts` — Input DTO 반영

---

## 4. Custom (Extension) 영역 상세

### 4.1 확장 메커니즘

| 메커니즘 | 파일 | 역할 |
|----------|------|------|
| **Hooks** | `extensions/hooks.ts` | Core 서비스 실행 전/후에 콜백 주입 |
| **Validators** | `extensions/validators.ts` | 승인 규칙·전이 조건을 조직별로 override |

### 4.2 사용 가능한 Hook 목록

#### ProjectHooks

| Hook | 시점 | 용도 | 실패 시 |
|------|------|------|---------|
| `beforeTransition(project, toStatus)` | 상태 전이 직전 | 추가 검증, 외부 조건 확인 | throw 시 전이 차단 |
| `afterTransition(project, fromStatus)` | 상태 전이 직후 | 알림, 외부 연동, 후속 작업 | 전이는 이미 완료됨 (보상 트랜잭션 필요) |
| `afterCreate(project)` | 프로젝트 생성 직후 | 기본 설정 적용, 알림 | 생성은 이미 완료됨 |

#### DocumentHooks

| Hook | 시점 | 용도 | 실패 시 |
|------|------|------|---------|
| `beforeCreate(projectId, type, content)` | 문서 생성 직전 | 기본값 주입, 자동 가격 계산 | throw 시 생성 차단 |
| `afterSend(document)` | 문서 발송 직후 | 이메일, 카카오 알림, 외부 전송 | 발송은 이미 기록됨 |
| `afterApprove(document, approval)` | 승인 완료 직후 | 후속 워크플로우 트리거 | 승인은 이미 완료됨 |

### 4.3 사용 가능한 Validator 목록

#### ApprovalRuleConfig

```typescript
{
  requiresApproval: boolean;  // 승인 필요 여부
  steps: number;              // 승인 단계 수 (기본: 1)
  condition?: (context) => boolean;  // 조건부 적용
}
```

| 문서 타입 | 기본값 | Override 예시 |
|-----------|--------|--------------|
| estimate | 1단계 필수 | "1000만원 이상은 2단계" |
| contract | 1단계 필수 | "VIP 고객은 즉시 승인" |
| campaign | 1단계 필수 | 변경 없음 |
| report | 1단계 필수 | "내부 보고서는 승인 생략" |

#### CustomTransitionRules

```typescript
{
  condition?: (context) => Promise<boolean>;  // 비동기 추가 조건
  failMessage?: string;                       // 실패 메시지 (UI 노출)
}
```

### 4.4 Custom으로 해결하는 시나리오

| # | 요구사항 | 사용 메커니즘 | 구현 방법 |
|---|----------|--------------|----------|
| C1 | 500만원 이상 견적서 2단계 승인 | `ApprovalRuleConfig` | estimate에 `steps: 2`, `condition: (ctx) => ctx.totalAmount >= 5_000_000` |
| C2 | 계약 완료 시 Slack 알림 | `ProjectHooks.afterTransition` | toStatus가 `contracted`일 때 Slack webhook 호출 |
| C3 | 견적서 생성 시 자동 가격 계산 | `DocumentHooks.beforeCreate` | type이 `estimate`일 때 content에 계산된 금액 주입 |
| C4 | 리포트 승인 후 AI 요약 생성 | `DocumentHooks.afterApprove` | type이 `report`일 때 LLM API 호출 → content 업데이트 |
| C5 | 특정 고객사 프로젝트는 바로 contracted | `ProjectHooks.beforeTransition` | 조건 충족 시 중간 상태 자동 전이 |
| C6 | 문서 발송 시 고객 이메일 발송 | `DocumentHooks.afterSend` | 이메일 서비스 호출 |
| C7 | running 전이 전 팀원 배정 검증 | `CustomTransitionRules` | running 전이에 condition 추가: 팀원 1명 이상 배정 확인 |

### 4.5 Custom 확장 시 주의사항

| 규칙 | 이유 |
|------|------|
| `before*` Hook에서 Core 규칙을 우회하지 않기 | Core 불변 규칙(R1~R10) 위반 방지 |
| `after*` Hook은 실패해도 Core 트랜잭션에 영향 없음 | 이미 커밋된 상태. 보상 로직 별도 구현. |
| 한 조직의 Custom이 다른 조직에 영향 주지 않기 | `organizationId`로 격리된 hook 실행 |
| Custom 로직에서 Repository를 직접 호출하지 않기 | 반드시 Service를 통해 접근 (일관성 보장) |

---

## 5. 의존 방향 규칙

```
┌───────────────────────────────────────────────────┐
│                   src/app/  (UI + API)             │
│  Route Handler에서 service-factory를 통해 서비스 호출  │
└──────────────────────┬────────────────────────────┘
                       │ 호출
┌──────────────────────▼────────────────────────────┐
│              service-factory.ts (조립 지점)          │
│  Repository 구현체 생성 → Service에 주입              │
│  Extension hooks/validators도 여기서 주입             │
└──────┬───────────────┬──────────────┬─────────────┘
       │               │              │
       ▼               ▼              ▼
┌──────────┐   ┌──────────────┐  ┌────────────────┐
│  domain/ │   │ extensions/  │  │infrastructure/ │
│  (Core)  │   │  (Custom)    │  │  (Supabase)    │
│          │   │              │  │                │
│ types    │   │ hooks        │  │ repositories   │
│ services │◀──│ validators   │  │ client         │
│ repo I/F │   │              │  │                │
│          │◀────────────────────│ (I/F 구현)      │
└──────────┘   └──────────────┘  └────────────────┘

✅ 허용: app → factory → domain, infrastructure → domain, extensions → domain
❌ 금지: domain → infrastructure, domain → extensions, domain → app
```

**핵심 원칙**: `domain/` 폴더는 그 어떤 외부 패키지도 import하지 않는다.

---

## 6. 새 기능 추가 시 체크리스트

### 6.1 Core 기능 추가

- [ ] 모든 조직에 공통으로 적용되는 규칙인지 확인
- [ ] `status.types.ts`에 새 상수/전이 추가 (해당 시)
- [ ] `entities.types.ts`에 엔티티/필드 추가 (해당 시)
- [ ] `dto.types.ts`에 Input DTO 추가 (해당 시)
- [ ] 마이그레이션 SQL 작성 (CHECK 제약조건 포함)
- [ ] RLS 정책 검토/수정
- [ ] Service 로직 구현
- [ ] Repository 인터페이스에 메서드 추가
- [ ] Supabase Repository 구현체 업데이트
- [ ] 이 문서의 §3 업데이트

### 6.2 Custom 기능 추가

- [ ] 특정 조직에만 적용되는 로직인지 확인
- [ ] 적절한 Hook/Validator 선택 (§4.2, §4.3 참조)
- [ ] Core 불변 규칙(R1~R10)을 우회하지 않는지 확인
- [ ] `service-factory.ts`에서 주입 연결
- [ ] 필요 시 `extensions/` 하위에 조직별 파일 생성
- [ ] 이 문서의 §4.4에 시나리오 추가

---

## 7. 업데이트 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-03-30 | 최초 작성 | — |

---

## 부록: 파일 경로 맵

| 분류 | 파일 | 역할 |
|------|------|------|
| Core | `domain/types/status.types.ts` | 상태값 상수, 전이맵, 메타데이터, 헬퍼함수 |
| Core | `domain/types/entities.types.ts` | 엔티티 인터페이스, 관계 타입, DocumentContentMap |
| Core | `domain/types/dto.types.ts` | Create/Update Input DTO, Filter 타입 |
| Core | `domain/types/base.types.ts` | BaseEntity, ServiceResult, 유틸리티 타입 |
| Core | `domain/services/project.service.ts` | 프로젝트 CRUD + 상태 전이 |
| Core | `domain/services/document.service.ts` | 문서 CRUD + 발송 (승인 게이트) |
| Core | `domain/services/approval.service.ts` | 승인 요청/처리/취소 |
| Core | `domain/services/activity-log.service.ts` | 활동 로그 기록/조회 |
| Core | `domain/repositories/interfaces.ts` | Repository 추상 인터페이스 (6개) |
| Custom | `extensions/hooks.ts` | ProjectHooks, DocumentHooks 인터페이스 + 기본값 |
| Custom | `extensions/validators.ts` | ApprovalRuleConfig, CustomTransitionRules + 기본값 |
| Infra | `infrastructure/supabase/repositories/*.ts` | Supabase 구현체 (5개) |
| Infra | `infrastructure/supabase/client.ts` | Supabase 클라이언트 생성 |
| DB | `supabase/migrations/00001_core_schema.sql` | 테이블, 트리거, CHECK 제약 |
| DB | `supabase/migrations/00002_rls_policies.sql` | RLS 정책, 헬퍼 함수, 상태 뷰 |
