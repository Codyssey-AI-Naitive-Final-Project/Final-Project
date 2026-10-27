"use client";

import { type FormEvent, useState } from "react";

type Tab = "home" | "records" | "plan" | "coach";
type Activity = { id: number; kind: "RUN" | "FOOTBALL" | "OTHER"; title: string; detail: string; date: string; color: string; rpe: number; source: "demo" | "user" };
type CoachAnswer = {
  summary: string;
  coaching_message: string;
  recommended_workout: { type: string; duration_min: number; intensity: { rpe: number | null; description: string }; details: string[] };
  reason: string[];
  precautions: string[];
  safety_level: "normal" | "caution" | "stop_and_check";
  follow_up_questions: string[];
};

const initialActivities: Activity[] = [
  { id: 1, kind: "RUN", title: "회복 러닝", detail: "4.2 km · 31분 · RPE 3", date: "오늘 오전 7:12", color: "mint", rpe: 3, source: "demo" },
  { id: 2, kind: "FOOTBALL", title: "풋살", detail: "60분 · RPE 7", date: "어제 오후 8:30", color: "orange", rpe: 7, source: "demo" },
  { id: 3, kind: "RUN", title: "천천히 달리기", detail: "6.0 km · 44분 · RPE 3", date: "10월 21일", color: "blue", rpe: 3, source: "demo" },
];

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "홈", icon: "⌂" },
  { id: "records", label: "기록", icon: "◷" },
  { id: "plan", label: "일정", icon: "▦" },
  { id: "coach", label: "코치", icon: "✳" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [activities, setActivities] = useState(initialActivities);
  const [kind, setKind] = useState("러닝");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [coachAnswer, setCoachAnswer] = useState<CoachAnswer | null>(null);
  const [coachError, setCoachError] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activityKind: Activity["kind"] = kind === "러닝" ? "RUN" : kind === "축구" ? "FOOTBALL" : "OTHER";
    const title = kind === "러닝" ? "러닝 기록" : kind === "축구" ? "축구 기록" : "운동 기록";
    setActivities((current) => [
      { id: Date.now(), kind: activityKind, title, detail: kind === "러닝" ? `${distance} km · ${duration}분 · RPE ${rpe}` : `${duration}분 · RPE ${rpe}`, date: "방금 전", color: kind === "러닝" ? "mint" : kind === "축구" ? "orange" : "blue", rpe: Number(rpe), source: "user" },
      ...current,
    ]);
    setDistance("");
    setDuration("");
    setRpe("");
    setTab("records");
  }

  async function askCoach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || isAsking) return;
    setAsked(submittedQuestion);
    setCoachAnswer(null);
    setCoachError("");
    setIsAsking(true);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion, activities: activities.slice(0, 10).map(({ kind, title, detail, date, rpe, source }) => ({ kind, title, detail, date, rpe, source })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "AI 코치 요청에 실패했어요.");
      setCoachAnswer(result.answer as CoachAnswer);
      setQuestion("");
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : "AI 코치 요청에 실패했어요.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("home")} aria-label="Stride 홈">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>stride<span className="brand-period">.</span></span>
        </button>
        <div className="top-actions">
          <button className="icon-button" aria-label="알림">♧<span className="notification-dot" /></button>
          <button className="avatar" aria-label="프로필">연</button>
        </div>
      </header>

      <div className="content-wrap">
        {tab === "home" && <HomeView activities={activities} onNavigate={setTab} />}
        {tab === "records" && (
          <section className="page-section">
            <PageHeading eyebrow="MY MOVEMENT" title="운동 기록" description="러닝과 다른 운동을 한곳에 모아보세요." />
            <form className="record-form card" onSubmit={saveActivity}>
              <div className="form-title"><span className="small-icon mint-bg">＋</span><div><h2>새 기록 추가</h2><p>오늘의 움직임을 남겨보세요.</p></div></div>
              <label className="field-label">운동 종류</label>
              <div className="choice-row">
                {["러닝", "축구", "기타"].map((item) => <button type="button" key={item} className={`choice ${kind === item ? "selected" : ""}`} onClick={() => setKind(item)}>{item}</button>)}
              </div>
              <div className="input-grid">
                {kind === "러닝" && <label><span>거리 (km)</span><input type="number" min="0.1" step="0.1" required value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="예: 5.0" /></label>}
                <label><span>운동 시간 (분)</span><input type="number" min="1" step="1" required value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="예: 35" /></label>
                <label><span>체감 강도 (RPE 1–10)</span><input type="number" min="1" max="10" step="1" required value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="예: 5" /></label>
              </div>
              <button className="primary-button full-button" type="submit">기록 저장 <span>→</span></button>
              <p className="form-note">현재 데모는 브라우저를 새로고침하면 입력 기록이 초기화됩니다.</p>
            </form>
            <ActivityList activities={activities} title="최근 기록" />
          </section>
        )}
        {tab === "plan" && <PlanView />}
        {tab === "coach" && (
          <section className="page-section coach-page">
            <PageHeading eyebrow="YOUR AI COACH" title="오늘은 어떤가요?" description="운동 기록을 바탕으로 코치와 대화해보세요." />
            <div className="coach-card card">
              <div className="coach-orb"><span>✳</span></div>
              <div className="coach-copy"><span className="demo-badge">AI 코치 · 연결됨</span><h2>꾸준함이 페이스를 만듭니다.</h2><p>운동 기록을 참고해 오늘의 코칭을 받아보세요. 화면의 샘플 기록은 예시로 표시됩니다.</p></div>
              <div className="coach-insight"><span className="insight-label">최근 기록에서 본 흐름</span><p>이번 주 러닝 2회와 풋살 1회가 기록되어 있어요. 다음 운동은 컨디션을 먼저 확인하고 정해보세요.</p></div>
              {asked && <div className="chat-reply"><span className="user-question">{asked}</span>{isAsking && <p role="status">기록을 살펴보고 코칭을 작성하고 있어요…</p>}{coachError && <p role="alert">{coachError}</p>}{coachAnswer && <CoachResponse answer={coachAnswer} />}</div>}
              <form className="chat-form" onSubmit={askCoach}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="예: 축구 다음 날 러닝은 어떻게 할까?" aria-label="코치에게 질문" maxLength={1000} disabled={isAsking} /><button type="submit" aria-label="질문 보내기" disabled={isAsking || !question.trim()}>{isAsking ? "…" : "↑"}</button></form>
              <p className="form-note">운동 조언은 참고용이며, 통증이나 건강 문제가 있으면 전문가와 상담하세요.</p>
            </div>
          </section>
        )}
      </div>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {navItems.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}
      </nav>
    </main>
  );
}

function CoachResponse({ answer }: { answer: CoachAnswer }) {
  const { recommended_workout: workout } = answer;
  return <article className={`coach-answer safety-${answer.safety_level}`}>
    <strong>{answer.summary}</strong>
    <p>{answer.coaching_message}</p>
    <div className="answer-workout"><b>{workout.type}</b><span>{workout.duration_min}분 · {workout.intensity.rpe === null ? "강도 안내 없음" : `RPE ${workout.intensity.rpe}`} · {workout.intensity.description}</span>{workout.details.length > 0 && <ul>{workout.details.map((item, index) => <li key={`detail-${index}`}>{item}</li>)}</ul>}</div>
    {answer.reason.length > 0 && <div><b>추천 이유</b><ul>{answer.reason.map((item, index) => <li key={`reason-${index}`}>{item}</li>)}</ul></div>}
    {answer.precautions.length > 0 && <div><b>주의사항</b><ul>{answer.precautions.map((item, index) => <li key={`precaution-${index}`}>{item}</li>)}</ul></div>}
    {answer.follow_up_questions.length > 0 && <div><b>더 알려주면 좋은 점</b><ul>{answer.follow_up_questions.map((item, index) => <li key={`question-${index}`}>{item}</li>)}</ul></div>}
  </article>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>;
}

function HomeView({ activities, onNavigate }: { activities: Activity[]; onNavigate: (tab: Tab) => void }) {
  return <section className="page-section home-page">
    <div className="welcome-row"><div><p className="eyebrow">YOUR WEEKLY RHYTHM</p><h1>안녕하세요, 연섭님 <span className="wave">✳</span></h1><p className="page-description">오늘 몸의 리듬은 어떤가요?</p></div><button className="date-pill">이번 주 <span>⌄</span></button></div>
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker"><span className="live-dot" /> THIS WEEK</span><h2>이번 주도<br />잘 달리고 있어요.</h2><p>달리기와 다른 운동을 함께 기록하며<br className="desktop-break" /> 나에게 맞는 페이스를 찾아보세요.</p><button className="hero-button" onClick={() => onNavigate("records")}>운동 기록하기 <span>↗</span></button></div>
      <div className="hero-art" aria-hidden="true"><div className="sun" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="runner"><span className="runner-head" /><span className="runner-body" /><span className="runner-arm" /><span className="runner-leg left" /><span className="runner-leg right" /></div><div className="hill hill-back" /><div className="hill hill-front" /><span className="art-label">MOVE<br />YOUR WAY</span></div>
    </section>

    <div className="section-title-row"><div><p className="eyebrow">YOUR OVERVIEW</p><h2>이번 주 요약</h2></div><button className="text-button" onClick={() => onNavigate("records")}>기록 전체 보기 <span>→</span></button></div>
    <section className="stats-grid">
      <StatCard label="러닝 거리" value="12.4" unit="km" change="지난주보다 8% 더" icon="↗" tone="mint" />
      <StatCard label="운동 횟수" value="3" unit="회" change="러닝 2 · 풋살 1" icon="✳" tone="lilac" />
      <StatCard label="이번 달" value="38.2" unit="km" change="목표 50 km 중 76%" icon="◉" tone="peach" />
    </section>

    <div className="lower-grid">
      <div className="lower-main"><div className="section-title-row compact"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>최근 운동</h2></div><button className="text-button" onClick={() => onNavigate("records")}>더 보기 <span>→</span></button></div><ActivityList activities={activities.slice(0, 2)} /></div>
      <aside className="coach-promo"><div className="promo-top"><span className="promo-spark">✳</span><span className="demo-badge dark">AI COACH</span></div><p className="eyebrow">A LITTLE GUIDANCE</p><h3>운동 사이의<br />균형을 찾아봐요.</h3><p className="promo-description">달리기뿐 아니라 축구, 등산 같은 활동도 함께 고려해요.</p><button className="promo-link" onClick={() => onNavigate("coach")}>코치와 대화하기 <span>→</span></button><div className="promo-decoration">✳</div></aside>
    </div>
    <p className="prototype-note">시안용 데모 데이터입니다. 개인 기록과 코치 응답은 아직 서버에 저장되지 않습니다.</p>
  </section>;
}

function StatCard({ label, value, unit, change, icon, tone }: { label: string; value: string; unit: string; change: string; icon: string; tone: string }) {
  return <article className="stat-card card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{change}</p></article>;
}

function ActivityList({ activities, title }: { activities: Activity[]; title?: string }) {
  return <div className="activity-list card">{title && <h2 className="list-heading">{title}</h2>}{activities.map((activity) => <article className="activity-row" key={activity.id}><div className={`activity-icon ${activity.color}`}>{activity.kind === "RUN" ? "↗" : activity.kind === "FOOTBALL" ? "◉" : "✳"}</div><div className="activity-info"><h3>{activity.title}</h3><p>{activity.detail}</p></div><span className="activity-date">{activity.date}</span><button className="row-arrow" aria-label={`${activity.title} 상세`}>›</button></article>)}</div>;
}

function PlanView() {
  const days = [{ day: "월", date: "20", label: "휴식", type: "rest" }, { day: "화", date: "21", label: "이지 런", type: "run" }, { day: "수", date: "22", label: "가벼운 근력", type: "strength" }, { day: "목", date: "23", label: "풋살", type: "cross" }, { day: "금", date: "24", label: "컨디션 확인", type: "today" }, { day: "토", date: "25", label: "휴식", type: "rest" }, { day: "일", date: "26", label: "롱 런", type: "run" }];
  return <section className="page-section"><PageHeading eyebrow="YOUR WEEKLY RHYTHM" title="운동 일정" description="계획과 추가 활동을 한 주의 흐름으로 확인해요." /><div className="week-card card"><div className="week-head"><div><p className="eyebrow">OCTOBER 20 — 26</p><h2>무리하지 않는 한 주</h2></div><button className="round-arrow" aria-label="다음 주">→</button></div><div className="week-days">{days.map((item) => <div className={`day-column ${item.type === "today" ? "is-today" : ""}`} key={item.day}><span>{item.day}</span><b>{item.date}</b><i className={`day-dot ${item.type}`} /><small>{item.label}</small></div>)}</div></div><div className="section-title-row"><div><p className="eyebrow">PLAN NOTE</p><h2>이번 주 가이드</h2></div></div><div className="plan-note card"><span className="small-icon lilac-bg">✳</span><div><h3>운동 사이에 여유를 두세요.</h3><p>풋살처럼 강도가 높은 활동도 운동량으로 기록해두면 다음 러닝 일정을 조절하는 데 도움이 됩니다.</p></div></div><p className="prototype-note">일정은 현재 예시 데이터입니다. 실제 계획은 사용자 기록을 연결한 뒤 제공할 예정입니다.</p></section>;
}
