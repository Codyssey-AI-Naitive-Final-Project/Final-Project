import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CoachAnswer = {
  summary: string;
  coaching_message: string;
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
  const apiKey = process.env.CODYSSEY_API_KEY;
  const baseUrl = process.env.CODYSSEY_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.CODYSSEY_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    return NextResponse.json({ error: "AI 코치 서버 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  let body: { question?: unknown; activities?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 내용을 읽지 못했어요." }, { status: 400 });
  }

  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 1000) {
    return NextResponse.json({ error: "질문을 입력해 주세요. (최대 1,000자)" }, { status: 400 });
  }

  const activities = Array.isArray(body.activities) ? body.activities.slice(0, 20) : [];
  const promptPath = join(process.cwd(), "docs", "ai", "system-prompt.md");
  let systemPrompt: string;
  try {
    systemPrompt = await readFile(promptPath, "utf8");
  } catch {
    return NextResponse.json({ error: "코치 프롬프트 파일을 읽지 못했어요." }, { status: 500 });
  }

  const input = {
    question: body.question.trim(),
    activities,
    note: "goal, fatigue, sleep, pain, and available exercise time were not separately collected. Do not assume them. Some activity entries may be demo data; check their source field.",
  };
  const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `다음 JSON 입력을 바탕으로 코칭해 주세요. JSON 이외의 텍스트는 출력하지 마세요.\n${JSON.stringify(input)}` },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
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

  if (!upstream.ok) {
    const status = upstream.status === 401 || upstream.status === 403 ? 503 : upstream.status === 429 ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? "요청이 잠시 몰렸어요. 조금 뒤 다시 시도해 주세요." : "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status });
  }

  let completion: { choices?: { message?: { content?: unknown } }[] };
  try {
    completion = await upstream.json();
  } catch {
    return NextResponse.json({ error: "AI 응답을 읽지 못했어요." }, { status: 502 });
  }

  const answer = parseCoachAnswer(completion.choices?.[0]?.message?.content);
  if (!answer) {
    return NextResponse.json({ error: "AI 응답 형식이 올바르지 않아요. 다시 요청해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ answer });
}
