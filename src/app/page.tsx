"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "records" | "plan" | "coach";
type Activity = { id: number | string; kind: "RUN" | "FOOTBALL" | "OTHER"; title: string; detail: string; date: string; color: string; rpe: number; source: "demo" | "user"; distanceKm?: number | null; durationMinutes?: number; occurredAt?: string };
type PlanKind = "RUN" | "FOOTBALL" | "STRENGTH" | "OTHER";
type WorkoutPlan = { id: string; activity_type: PlanKind; title: string; planned_date: string; duration_minutes: number; distance_km: number | null; note: string | null };
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
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
        try {
          const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as Activity[];
            setActivities([...parsed.filter((activity) => activity.source === "user"), ...initialActivities]);
          } else setActivities(initialActivities);
        } catch { setActivities(initialActivities); }
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
        return { id: row.id, kind, title: row.title, distanceKm, durationMinutes: row.duration_minutes, rpe: row.rpe, detail: kind === "RUN" && distanceKm ? `${distanceKm} km · ${row.duration_minutes}분 · RPE ${row.rpe}` : `${row.duration_minutes}분 · RPE ${row.rpe}`, date: new Date(row.occurred_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }), occurredAt: row.occurred_at, color: kind === "RUN" ? "mint" : kind === "FOOTBALL" ? "orange" : "blue", source: "user" };
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
    if (!supabase || !supabaseUser) {
      setProfileMessage("저장하려면 먼저 Google 로그인이 필요해요.");
      return;
    }
    setProfileSaving(true);
    setProfileMessage("");
    try {
      const { error } = await supabase.from("coach_profiles").upsert({ user_id: supabaseUser.id, goal: coachContext.goal || null, experience: coachContext.experience || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      setProfileSaved(true);
      setProfileMessage("목표와 운동 경험을 계정에 저장했어요.");
    } catch {
      setProfileSaved(false);
      setProfileMessage("저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function importLocalActivities() {
    if (!supabase || !supabaseUser) return;
    let stored: Activity[] = [];
    try { stored = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) ?? "[]") as Activity[]; } catch { setStorageError("브라우저 기록을 읽지 못했어요."); return; }
    const userRows = stored.filter((item) => item.source === "user");
    if (userRows.length === 0) { setAuthMessage("가져올 브라우저 기록이 없습니다."); return; }
    setAccountBusy(true);
    const { error } = await supabase.from("activity_records").insert(userRows.map((item) => ({ user_id: supabaseUser.id, activity_type: item.kind, title: item.title, distance_km: item.distanceKm ?? null, duration_minutes: item.durationMinutes ?? Number(item.detail.match(/(\d+)분/)?.[1] ?? 1), rpe: item.rpe, occurred_at: item.occurredAt ?? new Date().toISOString() })));
    if (error) setStorageError("브라우저 기록을 계정으로 옮기지 못했어요.");
    else { localStorage.removeItem(ACTIVITY_STORAGE_KEY); await loadAccountData(supabaseUser.id); setAuthMessage(`${userRows.length}개 기록을 계정으로 옮겼어요.`); }
    setAccountBusy(false);
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activityKind: Activity["kind"] = kind === "러닝" ? "RUN" : kind === "축구" ? "FOOTBALL" : "OTHER";
    const title = kind === "러닝" ? "러닝 기록" : kind === "축구" ? "축구 기록" : "운동 기록";
    const newActivity: Activity = { id: Date.now(), kind: activityKind, title, detail: kind === "러닝" ? `${distance} km · ${duration}분 · RPE ${rpe}` : `${duration}분 · RPE ${rpe}`, date: "방금 전", occurredAt: new Date().toISOString(), color: kind === "러닝" ? "mint" : kind === "축구" ? "orange" : "blue", rpe: Number(rpe), source: "user", distanceKm: kind === "러닝" ? Number(distance) : null, durationMinutes: Number(duration) };
    if (supabaseUser && supabase) {
      const { data, error } = await supabase.from("activity_records").insert({ user_id: supabaseUser.id, activity_type: activityKind, title, distance_km: newActivity.distanceKm ?? null, duration_minutes: Number(duration), rpe: Number(rpe) }).select("id, occurred_at").single();
      if (error) { setStorageError("계정에 기록을 저장하지 못했어요. 연결 상태를 확인해 주세요."); return; }
      newActivity.id = data.id;
      newActivity.date = new Date(data.occurred_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      newActivity.occurredAt = data.occurred_at;
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
            <ActivityList activities={activities.filter((activity) => activity.source === "user")} title="내 기록" emptyMessage="운동을 저장하면 여기에 보여요." />
            {!supabaseUser && <ActivityList activities={initialActivities} title="예시 기록 · 데모" />}
          </section>
        )}
        {tab === "plan" && <PlanView activities={activities.filter((activity) => activity.source === "user")} userId={supabaseUser?.id ?? null} />}
        {tab === "coach" && (
          <section className="page-section coach-page">
            <PageHeading eyebrow="YOUR AI COACH" title="오늘은 어떤가요?" description="운동 기록을 바탕으로 코치와 대화해보세요." />
            <div className="coach-card card">
              <div className="coach-orb"><span>✳</span></div>
              <div className="coach-copy"><span className="demo-badge">AI 코치 · 연결됨</span><h2>꾸준함이 페이스를 만듭니다.</h2><p>운동 기록을 참고해 오늘의 코칭을 받아보세요. 화면의 샘플 기록은 예시로 표시됩니다.</p></div>
              <div className="coach-context">
                <div className="context-heading"><div><span className="insight-label">PERSONAL CONTEXT</span><h3>오늘의 컨디션</h3></div><span className="context-optional">선택 입력</span></div>
                <div className="input-grid context-grid">
                  <label><span>운동 목표</span><select value={coachContext.goal} onChange={(e) => { setCoachContext((current) => ({ ...current, goal: e.target.value })); setProfileSaved(false); setProfileMessage(""); }}><option value="">선택 안 함</option>{coachContext.goal === "5km 완주" && <option value="5km 완주">5km 완주 (기존 설정)</option>}<option value="체력 향상">체력 향상</option><option value="러닝 거리 늘리기">러닝 거리 늘리기</option><option value="꾸준히 운동하기">꾸준히 운동하기</option><option value="체중 감량">체중 감량</option><option value="근력 향상">근력 향상</option><option value="기타">기타</option></select></label>
                  <label><span>운동 경험</span><select value={coachContext.experience} onChange={(e) => { setCoachContext((current) => ({ ...current, experience: e.target.value })); setProfileSaved(false); setProfileMessage(""); }}><option value="">선택 안 함</option><option value="초보">초보</option><option value="중급">중급</option><option value="숙련">숙련</option></select></label>
                  <label><span>피로도 (1~10)</span><input type="number" min="1" max="10" step="1" value={coachContext.fatigue} onChange={(e) => setCoachContext((current) => ({ ...current, fatigue: e.target.value }))} placeholder="예: 4" /></label>
                  <label><span>최근 수면 (시간)</span><input type="number" min="0" max="24" step="0.5" value={coachContext.sleepHours} onChange={(e) => setCoachContext((current) => ({ ...current, sleepHours: e.target.value }))} placeholder="예: 7.5" /></label>
                  <label><span>오늘 운동 가능 시간 (분)</span><input type="number" min="1" max="360" step="1" value={coachContext.availableMinutes} onChange={(e) => setCoachContext((current) => ({ ...current, availableMinutes: e.target.value }))} placeholder="예: 30" /></label>
                  <label><span>통증·불편감</span><select value={coachContext.painStatus} onChange={(e) => setCoachContext((current) => ({ ...current, painStatus: e.target.value as CoachContext["painStatus"], painDetails: e.target.value === "none" ? "" : current.painDetails }))}><option value="none">없음</option><option value="mild">가벼운 불편감</option><option value="pain">통증이 있음</option></select></label>
                </div>
                {coachContext.painStatus !== "none" && <label className="context-pain-details"><span>불편한 부위나 상황 (선택)</span><input maxLength={200} value={coachContext.painDetails} onChange={(e) => setCoachContext((current) => ({ ...current, painDetails: e.target.value }))} placeholder="진단명이 아닌 느끼는 증상만 적어주세요." /></label>}
                <label className="data-consent"><input type="checkbox" checked={hasDataConsent} onChange={(e) => setHasDataConsent(e.target.checked)} /><span>계정에 저장된 운동 기록·목표·운동 경험과 위에 입력한 컨디션 정보를 Codyssey AI API로 보내 코칭 답변을 만드는 데 동의합니다.</span></label>
                <p className="form-note">컨디션 정보는 현재 앱 DB에 저장하지 않고 요청에만 포함합니다. 이름·연락처 등 식별 정보는 입력하지 마세요.</p>
                {supabaseUser && <div className="profile-save-row"><button className="text-button" type="button" onClick={saveCoachProfile} disabled={profileSaving}>{profileSaving ? "저장 중…" : "목표·운동 경험을 계정에 저장"}</button><span>{profileSaved ? "계정에 저장됨" : "저장 전"}</span></div>}
                {profileMessage && <p className={`form-note ${profileSaved ? "" : "form-error"}`} role={profileSaved ? "status" : "alert"}>{profileMessage}</p>}
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
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const personalActivities = activities.filter((activity) => activity.source === "user");
  const inPeriod = (activity: Activity, start: Date) => {
    if (!activity.occurredAt) return false;
    const occurredAt = new Date(activity.occurredAt);
    return !Number.isNaN(occurredAt.getTime()) && occurredAt >= start && occurredAt <= now;
  };
  const thisWeek = personalActivities.filter((activity) => inPeriod(activity, weekStart));
  const thisMonth = personalActivities.filter((activity) => inPeriod(activity, monthStart));
  const weekRunningKm = thisWeek.filter((activity) => activity.kind === "RUN").reduce((total, activity) => total + (activity.distanceKm ?? 0), 0);
  const monthRunningKm = thisMonth.filter((activity) => activity.kind === "RUN").reduce((total, activity) => total + (activity.distanceKm ?? 0), 0);
  const activityBreakdown = `러닝 ${thisWeek.filter((activity) => activity.kind === "RUN").length} · 축구 ${thisWeek.filter((activity) => activity.kind === "FOOTBALL").length} · 기타 ${thisWeek.filter((activity) => activity.kind === "OTHER").length}`;

  return <section className="page-section home-page">
    <div className="welcome-row"><div><p className="eyebrow">YOUR WEEKLY RHYTHM</p><h1>안녕하세요{userName ? `, ${userName}님` : ""} <span className="wave">✳</span></h1><p className="page-description">오늘 몸의 리듬은 어떤가요?</p></div><button className="date-pill">이번 주 <span>⌄</span></button></div>
    <section className="hero-card">
      <div className="hero-copy"><span className="hero-kicker"><span className="live-dot" /> THIS WEEK</span><h2>이번 주도<br />잘 달리고 있어요.</h2><p>달리기와 다른 운동을 함께 기록하며<br className="desktop-break" /> 나에게 맞는 페이스를 찾아보세요.</p><button className="hero-button" onClick={() => onNavigate("records")}>운동 기록하기 <span>↗</span></button></div>
      <div className="hero-art" aria-hidden="true"><div className="sun" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="runner"><span className="runner-head" /><span className="runner-body" /><span className="runner-arm" /><span className="runner-leg left" /><span className="runner-leg right" /></div><div className="hill hill-back" /><div className="hill hill-front" /><span className="art-label">MOVE<br />YOUR WAY</span></div>
    </section>

    <div className="section-title-row"><div><p className="eyebrow">YOUR OVERVIEW</p><h2>이번 주 요약</h2></div><button className="text-button" onClick={() => onNavigate("records")}>기록 전체 보기 <span>→</span></button></div>
    <section className="stats-grid">
      <StatCard label="이번 주 러닝" value={weekRunningKm.toFixed(1)} unit="km" change={thisWeek.length ? "내 운동 기록 기준" : "이번 주 기록 없음"} icon="↗" tone="mint" />
      <StatCard label="이번 주 운동" value={String(thisWeek.length)} unit="회" change={thisWeek.length ? activityBreakdown : "운동 기록을 남겨보세요"} icon="✳" tone="lilac" />
      <StatCard label="이번 달 러닝" value={monthRunningKm.toFixed(1)} unit="km" change={thisMonth.length ? `${thisMonth.length}개 운동 기록 기준` : "이번 달 기록 없음"} icon="◉" tone="peach" />
    </section>

    <div className="lower-grid">
      <div className="lower-main"><div className="section-title-row compact"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>최근 운동</h2></div><button className="text-button" onClick={() => onNavigate("records")}>더 보기 <span>→</span></button></div><ActivityList activities={personalActivities.slice(0, 2)} emptyMessage="내 운동 기록을 저장하면 여기에 보여요." /></div>
      <aside className="coach-promo"><div className="promo-top"><span className="promo-spark">✳</span><span className="demo-badge dark">AI COACH</span></div><p className="eyebrow">A LITTLE GUIDANCE</p><h3>운동 사이의<br />균형을 찾아봐요.</h3><p className="promo-description">달리기뿐 아니라 축구, 등산 같은 활동도 함께 고려해요.</p><button className="promo-link" onClick={() => onNavigate("coach")}>코치와 대화하기 <span>→</span></button><div className="promo-decoration">✳</div></aside>
    </div>
    <p className="prototype-note">홈 요약과 최근 운동은 내가 입력한 기록만 반영합니다. 예시 데이터는 기록 화면에 따로 표시됩니다.</p>
  </section>;
}

function StatCard({ label, value, unit, change, icon, tone }: { label: string; value: string; unit: string; change: string; icon: string; tone: string }) {
  return <article className="stat-card card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{change}</p></article>;
}

function ActivityList({ activities, title, emptyMessage }: { activities: Activity[]; title?: string; emptyMessage?: string }) {
  return <div className="activity-list card">{title && <h2 className="list-heading">{title}</h2>}{activities.length === 0 && emptyMessage && <p className="form-note">{emptyMessage}</p>}{activities.map((activity) => <article className="activity-row" key={activity.id}><div className={`activity-icon ${activity.color}`}>{activity.kind === "RUN" ? "↗" : activity.kind === "FOOTBALL" ? "◉" : "✳"}</div><div className="activity-info"><h3>{activity.title}</h3><p>{activity.detail}</p></div><span className="activity-date">{activity.date}</span><button className="row-arrow" aria-label={`${activity.title} 상세`}>›</button></article>)}</div>;
}

function startOfLocalWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function PlanView({ activities, userId }: { activities: Activity[]; userId: string | null }) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfLocalWeek(today));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [planKind, setPlanKind] = useState<PlanKind>("RUN");
  const [planTitle, setPlanTitle] = useState("");
  const [planDuration, setPlanDuration] = useState("");
  const [planDistance, setPlanDistance] = useState("");
  const [planNote, setPlanNote] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const weekEnd = weekDates[6];
  const rangeText = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.toLocaleDateString("ko-KR", { month: "long" })} ${weekStart.getDate()}일 — ${weekEnd.getDate()}일`
    : `${weekStart.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} — ${weekEnd.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`;
  const selectedKey = localDateKey(selectedDate);
  const selectedActivities = activities.filter((activity) => activity.occurredAt && localDateKey(new Date(activity.occurredAt)) === selectedKey);
  const selectedPlans = plans.filter((plan) => plan.planned_date === selectedKey);
  const canPlanSelectedDate = selectedKey >= localDateKey(today);

  useEffect(() => {
    if (!userId || !supabase) {
      setPlans([]);
      setPlansLoading(false);
      return;
    }
    let active = true;
    setPlansLoading(true);
    supabase.from("workout_plans").select("id, activity_type, title, planned_date, duration_minutes, distance_km, note").eq("user_id", userId).order("planned_date", { ascending: true }).limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setPlanMessage("운동 계획을 불러오지 못했어요. Supabase 계획 테이블 설정을 확인해 주세요.");
          setPlans([]);
        } else {
          setPlans((data ?? []) as WorkoutPlan[]);
          setPlanMessage("");
        }
        setPlansLoading(false);
      });
    return () => { active = false; };
  }, [supabase, userId]);

  function moveWeek(amount: number) {
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + amount * 7);
    const nextSelectedDate = new Date(selectedDate);
    nextSelectedDate.setDate(nextSelectedDate.getDate() + amount * 7);
    setWeekStart(nextWeekStart);
    setSelectedDate(nextSelectedDate);
  }

  function goToToday() {
    const currentDate = new Date();
    setWeekStart(startOfLocalWeek(currentDate));
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !supabase) {
      setPlanMessage("계정에 계획을 저장하려면 Google 로그인이 필요해요.");
      return;
    }
    if (!canPlanSelectedDate) {
      setPlanMessage("지난 날짜에는 운동 계획을 추가할 수 없어요.");
      return;
    }
    setPlanSaving(true);
    setPlanMessage("");
    const kindLabels: Record<PlanKind, string> = { RUN: "러닝", FOOTBALL: "축구", STRENGTH: "헬스·근력", OTHER: "기타 운동" };
    const title = planTitle.trim() || `${kindLabels[planKind]} 계획`;
    const { data, error } = await supabase.from("workout_plans").insert({
      user_id: userId,
      activity_type: planKind,
      title,
      planned_date: selectedKey,
      duration_minutes: Number(planDuration),
      distance_km: planKind === "RUN" && planDistance ? Number(planDistance) : null,
      note: planNote.trim() || null,
    }).select("id, activity_type, title, planned_date, duration_minutes, distance_km, note").single();
    if (error) {
      setPlanMessage("계획을 저장하지 못했어요. Supabase 마이그레이션이 적용됐는지 확인해 주세요.");
    } else {
      setPlans((current) => [...current, data as WorkoutPlan].sort((a, b) => a.planned_date.localeCompare(b.planned_date)));
      setPlanTitle("");
      setPlanDuration("");
      setPlanDistance("");
      setPlanNote("");
      setPlanMessage("선택한 날짜에 운동 계획을 저장했어요.");
    }
    setPlanSaving(false);
  }

  async function deletePlan(planId: string) {
    if (!userId || !supabase || !window.confirm("이 운동 계획을 삭제할까요?")) return;
    setPlanMessage("");
    const { error } = await supabase.from("workout_plans").delete().eq("id", planId).eq("user_id", userId);
    if (error) setPlanMessage("계획을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    else setPlans((current) => current.filter((plan) => plan.id !== planId));
  }

  return <section className="page-section">
    <PageHeading eyebrow="YOUR WEEKLY RHYTHM" title="운동 일정" description="날짜별 운동 계획과 실제 기록을 함께 확인해요." />
    <div className="week-card card">
      <div className="week-head">
        <div><p className="eyebrow">{rangeText}</p><h2>주간 운동 일정</h2></div>
        <div className="week-controls">
          <button className="round-arrow" type="button" aria-label="이전 주" onClick={() => moveWeek(-1)}>←</button>
          <button className="today-button" type="button" onClick={goToToday}>오늘</button>
          <button className="round-arrow" type="button" aria-label="다음 주" onClick={() => moveWeek(1)}>→</button>
        </div>
      </div>
      <div className="week-days">
        {weekDates.map((date) => {
          const dateKey = localDateKey(date);
          const dayActivities = activities.filter((activity) => activity.occurredAt && localDateKey(new Date(activity.occurredAt)) === dateKey);
          const dayPlans = plans.filter((plan) => plan.planned_date === dateKey);
          const isToday = dateKey === localDateKey(today);
          const isSelected = dateKey === selectedKey;
          const dotType = dayActivities.some((activity) => activity.kind === "RUN") ? "run" : dayActivities.some((activity) => activity.kind === "FOOTBALL") ? "cross" : dayActivities.length ? "strength" : dayPlans.length ? "plan" : isToday ? "today" : "rest";
          return <button className={`day-column ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`} type="button" key={dateKey} aria-pressed={isSelected} onClick={() => setSelectedDate(date)}>
            <span>{date.toLocaleDateString("ko-KR", { weekday: "short" })}</span>
            <b>{date.getDate()}</b>
            <i className={`day-dot ${dotType}`} />
            <small>{dayActivities.length && dayPlans.length ? `${dayActivities.length}회 · 계획 ${dayPlans.length}` : dayActivities.length ? `${dayActivities.length}회 기록` : dayPlans.length ? `계획 ${dayPlans.length}개` : isToday ? "오늘" : "기록 없음"}</small>
          </button>;
        })}
      </div>
    </div>
    <div className="selected-day-heading"><h2>{selectedDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</h2></div>
    <ActivityList activities={selectedActivities} title="이 날짜의 운동 기록" emptyMessage="이 날짜에 저장된 운동 기록이 없어요." />
    <div className="section-title-row plan-section-title"><div><p className="eyebrow">TRAINING PLAN</p><h2>이 날짜의 운동 계획</h2></div></div>
    <div className="plan-list card">
      {plansLoading ? <p className="form-note">계획을 불러오고 있어요…</p> : selectedPlans.length === 0 ? <p className="form-note">이 날짜에 저장된 계획이 없어요.</p> : selectedPlans.map((plan) => {
        const typeLabels: Record<PlanKind, string> = { RUN: "러닝", FOOTBALL: "축구", STRENGTH: "헬스·근력", OTHER: "기타 운동" };
        return <article className="plan-row" key={plan.id}>
          <span className="small-icon lilac-bg">✳</span>
          <div className="plan-row-copy"><span className="plan-badge">예정</span><h3>{plan.title}</h3><p>{typeLabels[plan.activity_type]} · {plan.duration_minutes}분{plan.distance_km ? ` · ${plan.distance_km}km` : ""}{plan.note ? ` · ${plan.note}` : ""}</p></div>
          <button className="text-button plan-delete" type="button" onClick={() => void deletePlan(plan.id)}>삭제</button>
        </article>;
      })}
    </div>
    {userId ? canPlanSelectedDate ? <form className="plan-form card" onSubmit={savePlan}>
      <div className="form-title"><span className="small-icon lilac-bg">＋</span><div><h2>선택한 날짜에 계획 추가</h2><p>계획은 내 계정에 저장되어 다른 기기에서도 확인할 수 있어요.</p></div></div>
      <div className="plan-fields">
        <label><span>운동 종류</span><select value={planKind} onChange={(event) => setPlanKind(event.target.value as PlanKind)}><option value="RUN">러닝</option><option value="FOOTBALL">축구</option><option value="STRENGTH">헬스·근력</option><option value="OTHER">기타 운동</option></select></label>
        <label><span>계획 이름 (선택)</span><input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} maxLength={100} placeholder="예: 하체 운동" /></label>
        <label><span>예상 운동 시간 (분)</span><input type="number" min="1" max="1440" required value={planDuration} onChange={(event) => setPlanDuration(event.target.value)} placeholder="예: 45" /></label>
        {planKind === "RUN" && <label><span>목표 거리 (km, 선택)</span><input type="number" min="0.1" max="1000" step="0.1" value={planDistance} onChange={(event) => setPlanDistance(event.target.value)} placeholder="예: 5" /></label>}
      </div>
      <label className="plan-note-field"><span>메모 (선택)</span><input value={planNote} onChange={(event) => setPlanNote(event.target.value)} maxLength={250} placeholder="예: 가볍게 회복 러닝" /></label>
      <button className="primary-button full-button" type="submit" disabled={planSaving}>{planSaving ? "저장 중…" : "운동 계획 저장"}<span>→</span></button>
      {planMessage && <p className={`form-note ${planMessage.includes("저장했어요") ? "" : "form-error"}`} role={planMessage.includes("저장했어요") ? "status" : "alert"}>{planMessage}</p>}
    </form> : <div className="plan-note card"><span className="small-icon lilac-bg">✳</span><div><h3>지난 날짜에는 계획을 추가할 수 없어요.</h3><p>오늘 또는 미래 날짜를 선택해 운동 계획을 저장해 보세요.</p></div></div> : <div className="plan-note card"><span className="small-icon lilac-bg">✳</span><div><h3>로그인 후 운동 계획을 저장할 수 있어요.</h3><p>로그인하면 계획을 계정에 저장하고 다른 기기에서도 확인할 수 있습니다.</p></div></div>}
    {planMessage && !userId && <p className="form-note form-error" role="alert">{planMessage}</p>}
  </section>;
}
