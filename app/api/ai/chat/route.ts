import { NextRequest, NextResponse } from "next/server";
import { OpenAIConfigurationError } from "@/lib/ai/openai-client";
import { runExecutive } from "@/lib/ai/run-executive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 1_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

type RateBucket = { count: number; resetAt: number };
type GlobalWithRateLimit = typeof globalThis & {
  __familyOSAIRateLimit?: Map<string, RateBucket>;
};

const rateBuckets =
  (globalThis as GlobalWithRateLimit).__familyOSAIRateLimit ?? new Map<string, RateBucket>();
(globalThis as GlobalWithRateLimit).__familyOSAIRateLimit = rateBuckets;

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = rateBuckets.get(userId);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= RATE_LIMIT) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } }
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return jsonError("A solicitação excede o tamanho permitido.", 413);
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Faça login para usar o AI Executive.", 401);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Envie uma pergunta válida.", 400);
  }

  const payload = body as Record<string, unknown>;
  if ("family_id" in payload || "familyId" in payload) {
    return jsonError("A família é definida pela sessão autenticada.", 400);
  }

  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) {
    return jsonError("Digite uma pergunta para o AI Executive.", 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return jsonError(`A pergunta deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres.`, 400);
  }

  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return jsonError("Muitas perguntas em pouco tempo. Aguarde e tente novamente.", 429, {
      "Retry-After": String(rateLimit.retryAfter),
    });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("ai_executive.audit", {
      userId: user.id,
      status: "membership_error",
      durationMs: Date.now() - startedAt,
    });
    return jsonError("Não foi possível validar sua família neste momento.", 503);
  }

  if (!membership?.family_id) {
    return jsonError("Nenhuma família ativa está vinculada a este usuário.", 403);
  }

  try {
    const output = await runExecutive(question, {
      supabase,
      userId: user.id,
      familyId: membership.family_id,
      now: new Date(),
    });

    // A tabela mcp_audit_logs pertence ao backend MCP e nao e reutilizada aqui.
    // O log abaixo contem apenas metadados, nunca o prompt ou os resultados das ferramentas.
    console.info("ai_executive.audit", {
      userId: user.id,
      familyId: membership.family_id,
      status: "success",
      durationMs: Date.now() - startedAt,
      tools: output.tools,
    });

    return NextResponse.json(output, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const configurationError = error instanceof OpenAIConfigurationError;
    console.error("ai_executive.audit", {
      userId: user.id,
      familyId: membership.family_id,
      status: configurationError ? "configuration_error" : "provider_error",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "unknown",
    });

    if (configurationError) {
      return jsonError(
        "O AI Executive ainda não foi configurado neste ambiente. Contate o administrador.",
        503
      );
    }

    return jsonError(
      "O AI Executive não conseguiu responder agora. Tente novamente em instantes.",
      502
    );
  }
}
