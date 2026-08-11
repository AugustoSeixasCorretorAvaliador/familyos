"use client";

import { FormEvent, useRef, useState } from "react";
import {
  executiveQuestionGroups,
  quickExecutiveQuestions,
} from "@/lib/ai/suggested-questions";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
};

type ChatResponse = {
  answer?: string;
  tools?: string[];
  error?: string;
};

export function AIExecutiveChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json().catch(() => ({}))) as ChatResponse;

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Não foi possível obter uma resposta.");
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: payload.answer as string,
          tools: payload.tools ?? [],
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível falar com o AI Executive."
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function chooseSuggestion(suggestion: string) {
    setQuestion(suggestion);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="executive-question-library"
          className="text-sm font-semibold text-slate-900"
        >
          Biblioteca de perguntas por módulo
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Escolha uma pergunta pronta. Ela será colocada no campo abaixo para você revisar ou enviar.
        </p>
        <select
          id="executive-question-library"
          value=""
          onChange={(event) => chooseSuggestion(event.target.value)}
          disabled={loading}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
        >
          <option value="" disabled>
            Selecione um módulo e uma pergunta…
          </option>
          {executiveQuestionGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.questions.map((suggestion) => (
                <option key={suggestion} value={suggestion}>
                  {suggestion}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Sugestões de perguntas">
        {quickExecutiveQuestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => chooseSuggestion(suggestion)}
            disabled={loading}
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <section
        aria-label="Conversa com AI Executive"
        aria-live="polite"
        className="min-h-80 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl text-white shadow-sm">
              AI
            </div>
            <p className="mt-4 font-medium text-slate-900">Seu panorama familiar, com fatos e prioridades.</p>
            <p className="mt-2 text-sm text-slate-600">
              Escolha uma sugestão ou consulte a biblioteca por módulo para analisar finanças, patrimônio, tarefas, documentos, saúde, processos, timeline e agenda.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-3xl rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "ml-auto bg-[#075fc7] text-white"
                  : "mr-auto border border-slate-200 bg-white text-slate-800 shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              {message.role === "assistant" && message.tools && message.tools.length > 0 && (
                <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                  Fontes consultadas: {message.tools.join(", ")}
                </p>
              )}
            </article>
          ))
        )}

        {loading && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            Analisando dados autorizados da família…
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label htmlFor="executive-question" className="sr-only">
          Pergunta para o AI Executive
        </label>
        <textarea
          ref={inputRef}
          id="executive-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={1000}
          rows={3}
          disabled={loading}
          placeholder="Pergunte o que merece sua atenção hoje…"
          className="w-full resize-none rounded-xl border-0 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">{question.length}/1000</span>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-xl bg-gradient-to-r from-[#0877e8] to-[#6d36d7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analisando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
