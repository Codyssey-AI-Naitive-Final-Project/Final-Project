# Stride — 러너 AI 코치

러닝과 축구·등산 같은 추가 운동을 함께 기록하고, 운동 흐름을 바탕으로 다음 활동을 계획하도록 돕는 AI 코치 서비스입니다.

## 현재 버전 보기

[Stride 앱 열기](https://runner-ai-coach.vercel.app)

## 현재 구현

- 모바일 우선 대시보드 시안
- 홈, 기록, 일정, 코치 탭 전환
- 러닝·축구·기타 활동 기록 입력 및 RPE 1~10 기록 (입력 기록은 브라우저 로컬 저장소에 보관)
- Supabase Auth 기반 Google 로그인과 사용자별 운동 기록 저장 구조 (Supabase 프로젝트 설정 후 활성화)
- 일정 탭에서 선택한 오늘/미래 날짜에 러닝·축구·헬스·기타 운동 계획을 계정별로 저장하고 삭제
- 계정에 운동 목표·경험을 선택 저장하고, 로그인 사용자의 최근 운동 기록을 AI 코치 요청에 연결
- 코칭 질문과 함께 목표·운동 경험·피로도·수면·통증·가능 시간을 선택적으로 전달
- Codyssey OpenAI 호환 API를 통한 실제 AI 코칭 응답
- 서버 API에서 응답 JSON 필드와 RPE 범위 검증

> 로그인 전 입력 기록은 현재 브라우저에만 저장됩니다. Google 로그인 후 브라우저 기록을 명시적으로 계정으로 가져올 수 있습니다. 로그인 후 추가한 기록은 사용자 계정에 저장되어 기기 간 동기화됩니다. 초기 기록과 일부 대시보드 수치는 시안용 예시입니다. 당일 피로도·수면·통증 컨디션은 동의한 AI 요청에만 포함되며 저장하지 않습니다. 저장한 목표와 운동 경험은 AI 코치의 장기 참고 정보로 사용됩니다.

팀에서 작성한 시스템 프롬프트는 [`docs/ai/system-prompt.md`](docs/ai/system-prompt.md)에서 관리합니다. 모델에는 사용자의 질문, 최근 운동 기록, 입력한 코칭 정보를 보냅니다. 개인별 기록을 서버 DB에 저장해 다음 세션에서 불러오는 장기 기억 기능은 아직 연결 전입니다.

## 실행 방법

Node.js LTS가 설치된 환경에서 저장소 루트에서 실행합니다. Google 로그인과 계정 기록을 켜려면 먼저 Supabase 프로젝트를 만들고 다음 두 마이그레이션을 순서대로 Supabase SQL Editor에서 실행합니다.

1. [사용자 인증·운동 기록 테이블](supabase/migrations/202610270001_google_auth_and_user_data.sql)
2. [운동 계획 테이블](supabase/migrations/202610300001_workout_plans.sql)

운동 계획은 로그인 사용자별로 저장됩니다. 일정 탭에서 날짜를 선택한 뒤 운동 종류, 시간, 선택 항목(러닝 거리·메모)을 입력합니다. 과거 날짜에는 계획을 추가할 수 없으며, 계획 완료 처리와 AI 추천 계획 저장은 아직 구현하지 않았습니다.

```bash
npm install
npm run dev
```

PowerShell에서 `npm.ps1` 실행이 차단되면 다음처럼 `.cmd` 실행 파일을 사용하세요.

```powershell
npm.cmd install
npm.cmd run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

`.env.example`을 참고해 프로젝트 루트에 `.env.local`을 만들고 다음 값을 설정합니다.

- Codyssey 콘솔의 Base URL, API 키, 모델 ID
- Supabase의 Project URL과 Publishable key (legacy `anon` key도 사용 가능)

Google OAuth Client ID와 Secret은 앱 코드나 환경 변수에 넣지 않습니다. Supabase Dashboard의 Authentication → Providers → Google에서 설정합니다. Supabase Auth URL Configuration의 허용 리디렉션 주소에 `http://localhost:3000/auth/callback`과 `https://runner-ai-coach.vercel.app/auth/callback`을 추가해야 합니다. Google Cloud의 OAuth 웹 클라이언트에는 로컬/배포 도메인을 Authorized JavaScript origins로, Supabase가 표시하는 callback URL을 Authorized redirect URI로 등록합니다. Vercel에서 쓸 때는 Codyssey와 Supabase 공개 설정값을 프로젝트 환경 변수로 등록합니다.

Publishable key는 브라우저에서 사용하도록 공개된 키입니다. 테이블 접근은 RLS 정책으로 사용자별 제한됩니다. Supabase `service_role` 키는 브라우저 코드나 GitHub에 넣지 마세요.

## 다음 작업

1. Supabase 계획 마이그레이션 적용 후 계획 저장·조회·삭제 확인
2. RAG 등 두 번째 필수 기술 요소를 팀에서 결정하고 근거 자료 구성
3. AI 코칭 안전 기준과 사용자별 기록을 활용한 응답을 실제 사용자 테스트로 개선
4. 외부 사용자 5명 이상 테스트 후 피드백을 반영하고 결과를 문서화

## 기술 스택

- Next.js App Router, React, TypeScript
- 일반 CSS 기반 반응형 UI
- Codyssey OpenAI 호환 Chat Completions API (서버 경유)
- Supabase Auth, Postgres, RLS (프로젝트 설정 완료 후 활성화)
