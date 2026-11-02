import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { searchFitnessKnowledge } from "@/lib/coach/fitness-knowledge";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CoachAnswer = {
  summary: string;
  coaching_message: string;
  nutrition_guidance: string[];
  recommended_workout: {
    type: string;
    duration_min: number;
    intensity: { rpe: number | null; description: string };
    details: string[];
  };
  reason: string[];
  precautions: string[];
  safety_level: "normal" | "caution" | "stop_and_check";
  follow_up_questions: string[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseCoachAnswer(value: unknown): CoachAnswer | null {
  if (typeof value !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const answer = parsed as Record<string, unknown>;
  const workout = answer.recommended_workout as Record<string, unknown> | undefined;
  const intensity = workout?.intensity as Record<string, unknown> | undefined;
  const rpe = intensity?.rpe;

  if (
    typeof answer.summary !== "string" ||
    typeof answer.coaching_message !== "string" ||
    !isStringArray(answer.nutrition_guidance) ||
    answer.nutrition_guidance.length > 3 ||
    !workout ||
    typeof workout.type !== "string" ||
    typeof workout.duration_min !== "number" ||
    workout.duration_min < 0 ||
    !intensity ||
    !(rpe === null || (typeof rpe === "number" && Number.isInteger(rpe) && rpe >= 1 && rpe <= 10)) ||
    typeof intensity.description !== "string" ||
    !isStringArray(workout.details) ||
    !isStringArray(answer.reason) ||
    !isStringArray(answer.precautions) ||
    !["normal", "caution", "stop_and_check"].includes(String(answer.safety_level)) ||
    !isStringArray(answer.follow_up_questions) ||
    answer.follow_up_questions.length > 2
  ) {
    return null;
  }

  return answer as unknown as CoachAnswer;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "계정 저장 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Google 로그인 후 AI 코치를 이용해 주세요." }, { status: 401 });
  }

  const apiKey = process.env.CODYSSEY_API_KEY;
  const baseUrl = process.env.CODYSSEY_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.CODYSSEY_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    return NextResponse.json({ error: "AI 코치 서버 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  let body: { question?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 내용을 읽지 못했어요." }, { status: 400 });
  }

  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 1000) {
    return NextResponse.json({ error: "질문을 입력해 주세요. (최대 1,000자)" }, { status: 400 });
  }

  if (!body.context || typeof body.context !== "object" || Array.isArray(body.context)) {
    return NextResponse.json({ error: "코칭 정보와 동의 여부를 확인해 주세요." }, { status: 400 });
  }
  const rawContext = body.context as Record<string, unknown>;
  if (rawContext.consent !== true) {
    return NextResponse.json({ error: "기록과 컨디션 정보를 AI API로 보내는 데 동의해 주세요." }, { status: 400 });
  }

  const validNullableNumber = (value: unknown, min: number, max: number) =>
    value === null || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
  const goal = rawContext.goal === null || (typeof rawContext.goal === "string" && rawContext.goal.length <= 120) ? rawContext.goal : undefined;
  const ageGroup = rawContext.age_group;
  const experience = rawContext.experience === null || ["초보", "중급", "숙련"].includes(String(rawContext.experience)) ? rawContext.experience : undefined;
  const painStatus = rawContext.pain_status;
  const painDetails = rawContext.pain_details;
  if (
    goal === undefined ||
    !(ageGroup === null || ["20대 이하", "30대", "40대", "50대", "60대 이상"].includes(String(ageGroup))) ||
    experience === undefined ||
    !validNullableNumber(rawContext.fatigue, 1, 10) ||
    !validNullableNumber(rawContext.sleep_hours, 0, 24) ||
    !validNullableNumber(rawContext.available_minutes, 1, 360) ||
    !["none", "mild", "pain"].includes(String(painStatus)) ||
    !(painDetails === null || (typeof painDetails === "string" && painDetails.length <= 200))
  ) {
    return NextResponse.json({ error: "코칭 정보의 입력 범위를 확인해 주세요." }, { status: 400 });
  }

  const { data: savedProfile } = await supabase.from("coach_profiles").select("goal, experience").eq("user_id", user.id).maybeSingle();
  const retrievedKnowledge = searchFitnessKnowledge(body.question.trim());
  const promptPath = join(process.cwd(), "docs", "ai", "system-prompt.md");
  let systemPrompt: string;
  try {
    systemPrompt = await readFile(promptPath, "utf8");
  } catch {
    return NextResponse.json({ error: "코치 프롬프트 파일을 읽지 못했어요." }, { status: 500 });
  }

  const input = {
    question: body.question.trim(),
    context: {
      goal: goal ?? savedProfile?.goal ?? null,
      age_group: ageGroup,
      experience: experience ?? savedProfile?.experience ?? null,
      fatigue: rawContext.fatigue,
      sleep_hours: rawContext.sleep_hours,
      pain_status: painStatus,
      pain_details: painDetails,
      available_minutes: rawContext.available_minutes,
    },
    reference_material: retrievedKnowledge.chunks.map(({ id, title, publisher, content }) => ({ id, title, publisher, content })),
    note: "Saved goal and experience belong to the authenticated user. Recent workout records are not included; call get_recent_activities when they are needed. Missing context values are null; do not assume them.",
  };
  const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
  const tools = [{
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "Retrieve the authenticated user's 10 most recent workout records when their history is relevant to the coaching question.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  }];
  const messages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `다음 JSON 입력을 바탕으로 코칭해 주세요. JSON 이외의 텍스트는 출력하지 마세요.\n${JSON.stringify(input)}` },
  ];

  type Completion = {
    choices?: {
      finish_reason?: string;
      message?: {
        content?: unknown;
        tool_calls?: { id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  let completion: Completion | null = null;
  let usedRecentActivities = false;
  try {
    for (let turn = 0; turn < 2; turn += 1) {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          ...(turn === 0 ? { tools, tool_choice: "auto" } : {}),
          max_tokens: 1200,
          temperature: 0.2,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      });

      if (!upstream.ok) {
        const status = upstream.status === 401 || upstream.status === 403 ? 503 : upstream.status === 429 ? 429 : 502;
        return NextResponse.json({ error: status === 429 ? "요청이 잠시 몰렸어요. 조금 뒤 다시 시도해 주세요." : "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status });
      }

      try {
        completion = await upstream.json();
      } catch {
        return NextResponse.json({ error: "AI 응답을 읽지 못했어요." }, { status: 502 });
      }

      const toolCalls = completion?.choices?.[0]?.message?.tool_calls ?? [];
      if (toolCalls.length === 0) break;
      if (turn !== 0 || toolCalls.length !== 1) {
        return NextResponse.json({ error: "AI 도구 요청 형식이 올바르지 않아요." }, { status: 502 });
      }

      const toolCall = toolCalls[0];
      if (toolCall.type !== "function" || toolCall.function?.name !== "get_recent_activities" || !toolCall.id) {
        return NextResponse.json({ error: "지원하지 않는 AI 도구 요청이에요." }, { status: 502 });
      }

      let toolArguments: unknown;
      try {
        toolArguments = JSON.parse(toolCall.function.arguments ?? "");
      } catch {
        return NextResponse.json({ error: "AI 도구 입력 형식이 올바르지 않아요." }, { status: 502 });
      }
      if (!toolArguments || typeof toolArguments !== "object" || Array.isArray(toolArguments) || Object.keys(toolArguments).length > 0) {
        return NextResponse.json({ error: "AI 도구 입력값이 올바르지 않아요." }, { status: 502 });
      }

      const { data: activityRows, error: activityError } = await supabase
        .from("activity_records")
        .select("activity_type, title, distance_km, duration_minutes, rpe, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(10);
      if (activityError) {
        return NextResponse.json({ error: "계정 운동 기록을 불러오지 못했어요. Supabase SQL 설정을 확인해 주세요." }, { status: 503 });
      }
      usedRecentActivities = true;

      const activities = (activityRows ?? []).map((activity) => ({
        kind: activity.activity_type,
        title: activity.title,
        distance_km: activity.distance_km,
        duration_minutes: activity.duration_minutes,
        rpe: activity.rpe,
        occurred_at: activity.occurred_at,
      }));
      messages.push({ role: "assistant", content: completion?.choices?.[0]?.message?.content ?? null, tool_calls: toolCalls });
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ activities }) });
    }
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: unknown } | undefined : undefined;
    console.error("Codyssey API transport failure", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof cause?.code === "string" ? cause.code : undefined,
      message: error instanceof Error
        ? error.message.replaceAll(apiKey, "[redacted]").replaceAll(baseUrl, "[base-url]")
        : "Unknown transport error",
    });
    return NextResponse.json({ error: "AI 코치 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  const answer = parseCoachAnswer(completion?.choices?.[0]?.message?.content);
  if (!answer) {
    return NextResponse.json({ error: "AI 응답 형식이 올바르지 않아요. 다시 요청해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ answer, used_recent_activities: usedRecentActivities, knowledge_sources: retrievedKnowledge.sources });
}
