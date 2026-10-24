# Stride — 러너 AI 코치

러닝과 축구·등산 같은 추가 운동을 함께 기록하고, 운동 흐름을 바탕으로 다음 활동을 계획하도록 돕는 AI 코치 서비스입니다.

## 현재 버전 보기

[Stride 앱 열기](https://runner-ai-coach.vercel.app)

## 현재 구현

- 모바일 우선 대시보드 시안
- 홈, 기록, 일정, 코치 탭 전환
- 러닝·축구·기타 활동 기록 입력 (현재 브라우저 메모리 데모)
- AI 코치 화면의 데모 응답

> 현재 데이터는 서버에 저장되지 않으며, AI 응답도 실제 모델 API와 연결되어 있지 않습니다.

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

## 다음 작업

1. 팀 합의에 따라 MVP 기능과 화면을 확정
2. 운동 기록 저장소와 사용자 동의 흐름 설계
3. 서버 측 AI API 연결 및 사용자별 기록 기반 코칭
4. 배포 후 실제 사용자 테스트와 피드백 반영

## 기술 스택

- Next.js App Router, React, TypeScript
- 일반 CSS 기반 반응형 UI
- 추후 AI API와 데이터 저장소 연결 예정
