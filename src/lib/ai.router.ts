/**
 * AI Router — Unified LLM calling with automatic provider fallback
 *
 * Routing order:
 * 1. Gemini 3.1 Flash Lite (primary)
 * 2. Groq (backup)
 * 3. OpenRouter (backup)
 */

export interface AIResponse {
  text: string;
  provider: "gemini" | "groq" | "openrouter";
  model: string;
}

export interface AIOptions {
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

// ─── Gemini (Primary) ─────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  systemInstruction: string | undefined,
  options: AIOptions = {},
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Gemini API error: " + err);
  }

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");

  return { text, provider: "gemini", model: "gemini-3.1-flash-lite" };
}

// ─── Groq (Backup) ─────────────────────────────────────────────────────────────

async function callGroq(
  prompt: string,
  systemInstruction: string | undefined,
  options: AIOptions = {},
): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxOutputTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Groq API error: " + err);
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq returned an empty response.");

  return { text, provider: "groq", model: "llama-3.3-70b-versatile" };
}

// ─── OpenRouter (Backup) ───────────────────────────────────────────────────────

async function callOpenRouter(
  prompt: string,
  systemInstruction: string | undefined,
  options: AIOptions = {},
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ventureapply.ai",
      "X-Title": "VentureApply AI",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-haiku",
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxOutputTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("OpenRouter API error: " + err);
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter returned an empty response.");

  return { text, provider: "openrouter", model: "anthropic/claude-3-haiku" };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export class AIError extends Error {
  constructor(message: string, public providersTried: string[] = []) {
    super(message);
    this.name = "AIError";
  }
}

export async function callAI(
  prompt: string,
  systemInstruction?: string,
  options: AIOptions = {},
): Promise<AIResponse> {
  const providers = [
    { fn: callGemini, name: "Gemini" },
    { fn: callGroq, name: "Groq" },
    { fn: callOpenRouter, name: "OpenRouter" },
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await provider.fn(prompt, systemInstruction, options);
      return result;
    } catch (error: any) {
      errors.push(provider.name + ": " + error.message);
    }
  }

  throw new AIError("All AI providers failed:\n" + errors.join("\n"), providers.map(p => p.name));
}

export async function callAIText(
  prompt: string,
  systemInstruction?: string,
  options: AIOptions = {},
): Promise<string> {
  const result = await callAI(prompt, systemInstruction, options);
  return result.text;
}
