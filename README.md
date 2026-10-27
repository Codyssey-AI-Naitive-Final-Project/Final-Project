# Stride — 러너 AI 코치

러닝과 축구·등산 같은 추가 운동을 함께 기록하고, 운동 흐름을 바탕으로 다음 활동을 계획하도록 돕는 AI 코치 서비스입니다.

## 현재 버전 보기

[Stride 앱 열기](https://runner-ai-coach.vercel.app)

## 현재 구현

- 모바일 우선 대시보드 시안
- 홈, 기록, 일정, 코치 탭 전환
- 러닝·축구·기타 활동 기록 입력 및 RPE 1~10 기록 (현재 브라우저 메모리 데모)
- Codyssey OpenAI 호환 API를 통한 실제 AI 코칭 응답
- 서버 API에서 응답 JSON 필드와 RPE 범위 검증

> 운동 기록은 아직 서버에 저장되지 않습니다. 화면에 표시되는 초기 기록과 일부 대시보드 수치는 시안용 예시입니다.

팀에서 작성한 시스템 프롬프트는 [`docs/ai/system-prompt.md`](docs/ai/system-prompt.md)에서 관리합니다. 현재 모델에 보내는 입력은 사용자의 질문과 최근 운동 기록이며, 목표·수면·피로·통증·가능 시간은 별도 입력 화면이 없어 모델이 임의로 가정하지 않도록 안내합니다.

## 실행 방법

Node.js LTS가 설치된 환경에서 저장소 루트에서 실행합니다.

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

AI 코치를 사용하려면 `.env.example`을 참고해 프로젝트 루트에 `.env.local`을 만들고 Codyssey 콘솔의 Base URL과 발급받은 키, 모델 ID를 설정합니다. API 키는 브라우저 코드나 GitHub에 올리지 마세요. 배포 환경에서는 Vercel 프로젝트의 환경 변수로 등록해야 합니다.

## 다음 작업

1. 사용자 목표·피로도·수면·통증·운동 가능 시간 입력 화면과 AI 전송 데이터 합의
2. 운동 기록의 서버 저장, 사용자 동의 및 데이터 보호 흐름 구현
3. AI 코칭 안전 기준과 사용자별 기록을 활용한 응답을 실제 사용자 테스트로 개선
4. Vercel 환경 변수 등록 후 업데이트 배포 및 실제 사용자 테스트

## 기술 스택

- Next.js App Router, React, TypeScript
- 일반 CSS 기반 반응형 UI
- Codyssey OpenAI 호환 Chat Completions API (서버 경유)
- 데이터 저장소와 사용자 인증은 추후 연결 예정
