"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "records" | "plan" | "coach";
type Activity = { id: number | string; kind: "RUN" | "FOOTBALL" | "OTHER"; title: string; detail: string; date: string; color: string; rpe: number; source: "demo" | "user"; distanceKm?: number | null; durationMinutes?: number };
type CoachContext = {
  goal: string;
  experience: string;
  fatigue: string;
  sleepHours: string;
  painStatus: "none" | "mild" | "pain";
  painDetails: string;
  availableMinutes: string;
};
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
const ACTIVITY_STORAGE_KEY = "stride.user-activities.v1";

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "홈", icon: "⌂" },
  { id: "records", label: "기록", icon: "◷" },
  { id: "plan", label: "일정", icon: "▦" },
  { id: "coach", label: "코치", icon: "✳" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [activities, setActivities] = useState(initialActivities);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [kind, setKind] = useState("러닝");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState("");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [coachAnswer, setCoachAnswer] = useState<CoachAnswer | null>(null);
  const [coachError, setCoachError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [hasDataConsent, setHasDataConsent] = useState(false);
  const [coachContext, setCoachContext] = useState<CoachContext>({ goal: "", experience: "", fatigue: "", sleepHours: "", painStatus: "none", painDetails: "", availableMinutes: "" });
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const authPendingRef = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authErrorCode = params.get("error_code");
    const authError = params.get("auth_error");
    if (authErrorCode || authError) {
      setAuthMessage(authErrorCode === "flow_state_already_used"
        ? "로그인 요청이 이미 처리되었거나 만료됐어요. Google 로그인 버튼을 한 번만 눌러 다시 시도해 주세요."
        : "Google 로그인에 실패했어요. 버튼을 한 번만 눌러 다시 시도해 주세요.");
      const cleanUrl = new URL(window.location.href);
      ["error", "error_code", "error_description", "auth_error"].forEach((key) => cleanUrl.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const userActivities = parsed.filter((item): item is Activity =>
            item && typeof item === "object" && item.source === "user" && typeof item.id === "number" &&
            typeof item.title === "string" && typeof item.detail === "string" &&
            ["RUN", "FOOTBALL", "OTHER"].includes(item.kind) && Number.isInteger(item.rpe) && item.rpe >= 1 && item.rpe <= 10
          );
          setActivities([...userActivities, ...initialActivities]);
        }
      }
    } catch {
      setStorageError("이 브라우저에서 저장한 기록을 불러오지 못했어요.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      // Supabase reports a missing session as AuthSessionMissingError for signed-out visitors.
      if (error && error.name !== "AuthSessionMissingError") setAuthMessage("로그인 상태를 확인하지 못했어요. 네트워크 연결 후 다시 시도해 주세요.");
      setSupabaseUser(data.user);
      setAuthReady(true);
      if (data.user) void loadAccountData(data.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setSupabaseUser(nextUser);
      setAuthReady(true);
      if (nextUser) { setAuthMessage(""); void loadAccountData(nextUser.id); }
      else {
        setActivities((current) => [...current.filter((activity) => activity.source === "user"), ...initialActivities]);
        try {
          const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
          if (stored) setActivities([...JSON.parse(stored) as Activity[], ...initialActivities]);
        } catch { /* Keep the current view if local data cannot be read. */ }
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
    // The client is a stable wrapper around the configured Supabase browser client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAccountData(userId: string) {
    if (!supabase) return;
    setAccountBusy(true);
    const [{ data: rows, error }, { data: profile }] = await Promise.all([
      supabase.from("activity_records").select("id, activity_type, title, distance_km, duration_minutes, rpe, occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("coach_profiles").select("goal, experience").eq("user_id", userId).maybeSingle(),
    ]);
    if (error) {
      setStorageError("계정 기록을 불러오지 못했어요. Supabase 설정과 SQL 적용 여부를 확인해 주세요.");
    } else {
      const records: Activity[] = (rows ?? []).map((row) => {
        const kind = row.activity_type as Activity["kind"];
        const distanceKm = row.distance_km === null ? null : Number(row.distance_km);
        return { id: row.id, kind, title: row.title, distanceKm, durationMinutes: row.duration_minutes, rpe: row.rpe, detail: kind === "RUN" && distanceKm ? `${distanceKm} km · ${row.duration_minutes}분 · RPE ${row.rpe}` : `${row.duration_minutes}분 · RPE ${row.rpe}`, date: new Date(row.occurred_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }), color: kind === "RUN" ? "mint" : kind === "FOOTBALL" ? "orange" : "blue", source: "user" };
      });
      setActivities([...records, ...initialActivities]);
      setStorageError("");
    }
    if (profile) {
      setCoachContext((current) => ({ ...current, goal: profile.goal ?? current.goal, experience: profile.experience ?? current.experience }));
      setProfileSaved(true);
    }
    setAccountBusy(false);
  }

  async function signInWithGoogle() {
    if (authPendingRef.current) return;
    if (!supabase) {
      setAuthMessage("로그인 설정이 아직 없어요. Supabase URL과 공개 키를 설정해 주세요.");
      return;
    }
    authPendingRef.current = true;
    setAuthPending(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) {
        authPendingRef.current = false;
        setAuthPending(false);
        setAuthMessage("Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      authPendingRef.current = false;
      setAuthPending(false);
      setAuthMessage("Google 로그인을 시작하지 못했어요. 네트워크 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthMessage("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.");
    else setAuthMessage("");
  }

  async function saveCoachProfile() {
    if (!supabase || !supabaseUser) return;
    const { error } = await supabase.from("coach_profiles").upsert({ user_id: supabaseUser.id, goal: coachContext.goal || null, experience: coachContext.experience || null, updated_at: new Date().toISOString() });
    if (error) setStorageError("코치 목표 설정을 계정에 저장하지 못했어요.");
    else { setProfileSaved(true); setStorageError(""); }
  }

  async function importLocalActivities() {
    if (!supabase || !supabaseUser) return;
    let stored: Activity[] = [];
    try { stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) ?? "[]") as Activity[]; } catch { setStorageError("브라우저 기록을 읽지 못했어요."); return; }
    const userRows = stored.filter((item) => item.source === "user");
    if (userRows.length === 0) { setAuthMessage("가져올 브라우저 기록이 없습니다."); return; }
    setAccountBusy(true);
    const { error } = await supabase.from("activity_records").insert(userRows.map((item) => ({ user_id: supabaseUser.id, activity_type: item.kind, title: item.title, distance_km: item.distanceKm ?? null, duration_minutes: item.durationMinutes ?? Number(item.detail.match(/(\d+)분/)?.[1] ?? 1), rpe: item.rpe, occurred_at: new Date().toISOString() })));
    if (error) setStorageError("브라우저 기록을 계정으로 옮기지 못했어요.");
    else { localStorage.removeItem(ACTIVITY_STORAGE_KEY); await loadAccountData(supabaseUser.id); setAuthMessage(`${userRows.length}개 기록을 계정으로 옮겼어요.`); }
    setAccountBusy(false);
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activityKind: Activity["kind"] = kind === "러닝" ? "RUN" : kind === "축구" ? "FOOTBALL" : "OTHER";
    const title = kind === "러닝" ? "러닝 기록" : kind === "축구" ? "축구 기록" : "운동 기록";
    const newActivity: Activity = { id: Date.now(), kind: activityKind, title, detail: kind === "러닝" ? `${distance} km · ${duration}분 · RPE ${rpe}` : `${duration}분 · RPE ${rpe}`, date: "방금 전", color: kind === "러닝" ? "mint" : kind === "축구" ? "orange" : "blue", rpe: Number(rpe), source: "user", distanceKm: kind === "러닝" ? Number(distance) : null, durationMinutes: Number(duration) };
    if (supabaseUser && supabase) {
      const { data, error } = await supabase.from("activity_records").insert({ user_id: supabaseUser.id, activity_type: activityKind, title, distance_km: newActivity.distanceKm ?? null, duration_minutes: Number(duration), rpe: Number(rpe) }).select("id, occurred_at").single();
      if (error) { setStorageError("계정에 기록을 저장하지 못했어요. 연결 상태를 확인해 주세요."); return; }
      newActivity.id = data.id;
      newActivity.date = new Date(data.occurred_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setActivities((current) => [newActivity, ...current.filter((activity) => activity.source === "user"), ...initialActivities]);
      setStorageError("");
    } else {
      const updatedActivities = [newActivity, ...activities];
      setActivities(updatedActivities);
      try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updatedActivities.filter((activity) => activity.source === "user")));
        setStorageError("");
      } catch { setStorageError("기록을 브라우저에 저장하지 못했어요. 저장 공간을 확인해 주세요."); }
    }
    setDistance("");
    setDuration("");
    setRpe("");
    setTab("records");
  }

  async function clearUserActivities() {
    if (!window.confirm(supabaseUser ? "내 계정에 저장된 운동 기록을 모두 삭제할까요?" : "이 브라우저에 저장된 내가 입력한 운동 기록을 모두 삭제할까요?")) return;
    try {
      if (supabaseUser && supabase) {
        const { error } = await supabase.from("activity_records").delete().eq("user_id", supabaseUser.id);
        if (error) throw error;
        setActivities(initialActivities);
      } else {
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        setActivities(initialActivities);
      }
      setStorageError("");
    } catch {
      setStorageError("저장한 기록을 삭제하지 못했어요.");
    }
  }

  async function askCoach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || isAsking) return;
    if (!supabaseUser) {
      setCoachError("계정별 운동 기록을 보호하기 위해 Google 로그인 후 이용할 수 있어요.");
      setAsked(submittedQuestion);
      return;
    }
    if (!hasDataConsent) {
      setCoachError("기록과 입력한 컨디션 정보를 AI API로 보내는 데 동의해 주세요.");
      return;
    }
    setAsked(submittedQuestion);
    setCoachAnswer(null);
    setCoachError("");
    setIsAsking(true);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: submittedQuestion,
          context: {
            goal: coachContext.goal || null,
            experience: coachContext.experience || null,
            fatigue: coachContext.fatigue ? Number(coachContext.fatigue) : null,
            sleep_hours: coachContext.sleepHours ? Number(coachContext.sleepHours) : null,
            pain_status: coachContext.painStatus,
            pain_details: coachContext.painStatus === "none" ? null : coachContext.painDetails.trim() || null,
            available_minutes: coachContext.availableMinutes ? Number(coachContext.availableMinutes) : null,
            consent: hasDataConsent,
          },
        }),
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
          {supabaseUser ? <><span className="account-email" title={supabaseUser.email ?? "구글 계정"}>{supabaseUser.email ?? "로그인됨"}</span><button className="account-button" onClick={signOut}>로그아웃</button></> : <button className="account-button" onClick={signInWithGoogle} disabled={!authReady || authPending}>{authPending ? "Google 연결 중…" : "Google 로그인"}</button>}
          {supabaseUser ? <span className="avatar" aria-label="로그인 사용자">{(supabaseUser.user_metadata?.full_name as string | undefined)?.slice(0, 1) ?? "나"}</span> : <button className="avatar" aria-label="프로필">나</button>}
        </div>
      </header>
      {authMessage && <p className="auth-message" role="status">{authMessage}</p>}

      <div className="content-wrap">
        {tab === "home" && <HomeView activities={activities} onNavigate={setTab} userName={supabaseUser && typeof supabaseUser.user_metadata?.full_name === "string" ? supabaseUser.user_metadata.full_name : ""} />}
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
              <p className="form-note">{supabaseUser ? "로그인한 계정에 저장되어 다른 기기에서도 확인할 수 있습니다." : "로그인 전 기록은 이 브라우저에만 저장됩니다. 구글 로그인 후 계정으로 옮길 수 있습니다."}</p>
              {supabaseUser && <button className="text-button clear-activities" type="button" onClick={importLocalActivities} disabled={accountBusy}>이 브라우저 기록 계정으로 가져오기</button>}
              {storageError && <p className="form-error" role="alert">{storageError}</p>}
              <button className="text-button clear-activities" type="button" onClick={clearUserActivities}>내 기록 삭제</button>
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
              <div className="coach-context">
                <div className="context-heading"><div><span className="insight-label">PERSONAL CONTEXT</span><h3>오늘의 컨디션</h3></div><span className="context-optional">선택 입력</span></div>
                <div className="input-grid context-grid">
                  <label><span>운동 목표</span><select value={coachContext.goal} onChange={(e) => setCoachContext((current) => ({ ...current, goal: e.target.value }))}><option value="">선택 안 함</option><option value="체력 향상">체력 향상</option><option value="5km 완주">5km 완주</option><option value="러닝 거리 늘리기">러닝 거리 늘리기</option><option value="꾸준히 운동하기">꾸준히 운동하기</option><option value="기타">기타</option></select></label>
                  <label><span>운동 경험</span><select value={coachContext.experience} onChange={(e) => setCoachContext((current) => ({ ...current, experience: e.target.value }))}><option value="">선택 안 함</option><option value="초보">초보</option><option value="중급">중급</option><option value="숙련">숙련</option></select></label>
                  <label><span>피로도 (1~10)</span><input type="number" min="1" max="10" step="1" value={coachContext.fatigue} onChange={(e) => setCoachContext((current) => ({ ...current, fatigue: e.target.value }))} placeholder="예: 4" /></label>
                  <label><span>최근 수면 (시간)</span><input type="number" min="0" max="24" step="0.5" value={coachContext.sleepHours} onChange={(e) => setCoachContext((current) => ({ ...current, sleepHours: e.target.value }))} placeholder="예: 7.5" /></label>
                  <label><span>오늘 운동 가능 시간 (분)</span><input type="number" min="1" max="360" step="1" value={coachContext.availableMinutes} onChange={(e) => setCoachContext((current) => ({ ...current, availableMinutes: e.target.value }))} placeholder="예: 30" /></label>
                  <label><span>통증·불편감</span><select value={coachContext.painStatus} onChange={(e) => setCoachContext((current) => ({ ...current, painStatus: e.target.value as CoachContext["painStatus"], painDetails: e.target.value === "none" ? "" : current.painDetails }))}><option value="none">없음</option><option value="mild">가벼운 불편감</option><option value="pain">통증이 있음</option></select></label>
                </div>
                {coachContext.painStatus !== "none" && <label className="context-pain-details"><span>불편한 부위나 상황 (선택)</span><input maxLength={200} value={coachContext.painDetails} onChange={(e) => setCoachContext((current) => ({ ...current, painDetails: e.target.value }))} placeholder="진단명이 아닌 느끼는 증상만 적어주세요." /></label>}
                <label className="data-consent"><input type="checkbox" checked={hasDataConsent} onChange={(e) => setHasDataConsent(e.target.checked)} /><span>계정에 저장된 운동 기록·목표·운동 경험과 위에 입력한 컨디션 정보를 Codyssey AI API로 보내 코칭 답변을 만드는 데 동의합니다.</span></label>
                <p className="form-note">컨디션 정보는 현재 앱 DB에 저장하지 않고 요청에만 포함합니다. 이름·연락처 등 식별 정보는 입력하지 마세요.</p>
                {supabaseUser && <div className="profile-save-row"><button className="text-button" type="button" onClick={saveCoachProfile}>목표·운동 경험을 계정에 저장</button><span>{profileSaved ? "계정에 저장됨" : "선택 저장"}</span></div>}
              </div>
              <div className="coach-insight"><span className="insight-label">최근 기록에서 본 흐름</span><p>{activities.some((activity) => activity.source === "user") ? `직접 입력한 운동 ${activities.filter((activity) => activity.source === "user").length}건과 최근 기록을 함께 보냅니다.` : "아직 직접 입력한 기록이 없어요. 예시 기록은 데모 데이터로 표시됩니다."}</p></div>
              {asked && <div className="chat-reply"><span className="user-question">{asked}</span>{isAsking && <p role="status">기록을 살펴보고 코칭을 작성하고 있어요…</p>}{coachError && <p role="alert">{coachError}</p>}{coachAnswer && <CoachResponse answer={coachAnswer} />}</div>}
              <form className="chat-form" onSubmit={askCoach}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="예: 축구 다음 날 러닝은 어떻게 할까?" aria-label="코치에게 질문" maxLength={1000} disabled={isAsking} /><button type="submit" aria-label="질문 보내기" disabled={isAsking || !question.trim() || !storageReady || !authReady}>{isAsking ? "…" : "↑"}</button></form>
              {!supabaseUser && <p className="form-note">AI 코치를 이용하려면 먼저 Google 로그인이 필요합니다.</p>}
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

function HomeView({ activities, onNavigate, userName }: { activities: Activity[]; onNavigate: (tab: Tab) => void; userName: string }) {
  return <section className="page-section home-page">
    <div className="welcome-row"><div><p className="eyebrow">YOUR WEEKLY RHYTHM</p><h1>안녕하세요{userName ? `, ${userName}님` : ""} <span className="wave">✳</span></h1><p className="page-description">오늘 몸의 리듬은 어떤가요?</p></div><button className="date-pill">이번 주 <span>⌄</span></button></div>
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
    <p className="prototype-note">계정 운동 기록은 저장됩니다. 예시 기록과 요약 수치는 데모 데이터입니다.</p>
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
