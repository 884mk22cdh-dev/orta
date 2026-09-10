// ORTA · ИИ-помощник — Supabase Edge Function «ai»
// Как установить:
//   1. Dashboard → Edge Functions → Deploy a new function → via Editor → имя: ai → вставить этот файл → Deploy
//   2. Edge Functions → Secrets → добавить ANTHROPIC_API_KEY (ключ с console.anthropic.com)
import Anthropic from "npm:@anthropic-ai/sdk";

const SYSTEM = `Ты — ИИ-помощник студенческого приложения ORTA (Казахстан).
Отвечай кратко и дружелюбно, на языке вопроса (русский / қазақша / English).
Тебе передают данные студента: расписание пар, экзамены, задачи, афишу, группу.
Отвечай ТОЛЬКО на основе этих данных и общих знаний об учёбе.
Если данных не хватает — скажи честно. Не выдумывай пары и даты.
Формат: 1-4 предложения или короткий список, без markdown-заголовков.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      },
    });
  }
  try {
    const { question, context } = await req.json();
    if (!question || String(question).length > 1000) {
      return Response.json({ error: "bad question" }, { status: 400 });
    }
    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Данные студента:\n${String(context || "").slice(0, 8000)}\n\nВопрос: ${question}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ text: "Я не могу ответить на этот вопрос." });
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    return Response.json({ text }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
