# KKA-workflow

마케팅 대행사의 업무 프로세스를 관리하는 내부 SaaS 툴.

범용 Core 구조 위에 회사별 확장(Extension)을 얹는 아키텍처.

---

## 기술 스택

- **Next.js 15** (App Router, React 19)
- **TypeScript 5.6+** (Strict)
- **Supabase** (Postgres + RLS + Auth)
- **@supabase/ssr** (쿠키 기반 세션)

---

## 초기 설정 가이드

### 1. 저장소 복제 & 의존성 설치

```bash
git clone <repo-url> my-agency-workflow
cd my-agency-workflow
npm install
```

### 2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. **Settings → API** 에서 아래 값 확인:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`을 열어 실제 값으로 채움:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. DB 마이그레이션 실행

Supabase 대시보드 **SQL Editor** 에서 아래 순서대로 실행:

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `supabase/migrations/00001_core_schema.sql` | 핵심 테이블 7개 + 트리거 |
| 2 | `supabase/migrations/00002_rls_policies.sql` | RLS 정책 + 헬퍼 함수 |
| 3 | `supabase/migrations/00003_multi_step_approval.sql` | 다단계 승인 정책 테이블 |

또는 Supabase CLI를 사용:

```bash
npx supabase db push
```

### 5. Auth 설정

Supabase 대시보드 **Authentication → Providers** 에서:

- **Email** (Magic Link) 활성화
- 필요 시 **Google / Kakao** OAuth 추가
- Redirect URL에 `http://localhost:3000/auth/callback` 등록

### 6. 초기 데이터 삽입

SQL Editor에서 조직과 첫 번째 관리자 계정 생성:

```sql
-- 조직 생성
INSERT INTO organizations (id, name) 
VALUES ('org-001', '내 에이전시 이름');

-- 사용자는 Auth 가입 후 users 테이블에 연결
-- (auth.users.id → users.auth_id)
```

회사별 승인 정책 설정 (선택):

```sql
-- 2단계 승인 정책 (팀장 → 대표)
SELECT create_default_approval_policy(
  'org-001',  -- organization_id
  2,           -- required_steps
  '팀장-대표 2단계 승인'
);
```

### 7. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000` 접속.

---

## 프로젝트 구조

```
src/
├── app/                          # Next.js App Router (페이지 + API)
│   ├── api/                      # Route Handlers
│   └── projects/[id]/            # 프로젝트 상세 화면
├── components/ui/                # 공통 UI 컴포넌트
└── lib/
    ├── domain/                   # ★ Core 도메인 (수정 금지)
    │   ├── types/                #   엔티티, DTO, 상태 머신
    │   ├── services/             #   비즈니스 로직
    │   └── repositories/         #   리포지토리 인터페이스
    ├── infrastructure/supabase/  # Supabase 구현체
    ├── extensions/               # ★ 회사별 확장 포인트
    │   ├── hooks.ts              #   이벤트 훅
    │   └── validators.ts         #   조건부 승인 등 커스텀 규칙
    ├── auth/                     # 인증 헬퍼
    └── service-factory.ts        # DI 조립
```

---

## Core vs Custom 원칙

| 구분 | Core (수정 금지) | Custom (회사별 확장) |
|------|-----------------|---------------------|
| 위치 | `lib/domain/` | `lib/extensions/` |
| 예시 | 상태 전이 규칙, 승인 메커니즘, 발송 전 승인 필수 | 승인 계층 이름, 조건부 승인, 커스텀 전이 조건 |
| 변경 시 | 모든 프로젝트에 영향 | 해당 회사만 영향 |

상세 기준: `docs/core-vs-custom-criteria.md`

---

## Custom 빌딩 체크리스트

새 에이전시 프로젝트 시작 시:

- [ ] `.env.local` 환경변수 설정
- [ ] DB 마이그레이션 3개 실행
- [ ] Auth provider 설정
- [ ] 조직 + 관리자 계정 생성
- [ ] `approval_policies`에 회사 승인 정책 INSERT
- [ ] `extensions/validators.ts`에 조건부 승인 규칙 추가 (필요 시)
- [ ] `extensions/hooks.ts`에 커스텀 이벤트 핸들러 추가 (필요 시)
- [ ] UI 화면 추가 (프로젝트 목록, 문서 편집 폼, 대시보드 등)
