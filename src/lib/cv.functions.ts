import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Experience = { role: string; company: string; period: string; bullets: string };
type Education = { degree: string; school: string; year: string };
type CV = {
  profile: { name: string; title: string; email: string; phone: string; summary: string };
  experiences: Experience[];
  education: Education[];
  skills: string;
};

async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

// ─── Tailor CV ───────────────────────────────────────────────────────────────

export const tailorCV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cv_id: string; job_description: string }) => d)
  .handler(async ({ data, context }) => {
    // 1. Load CV from DB
    const { data: cvRow, error: cvError } = await context.supabase
      .from("cvs")
      .select("*")
      .eq("id", data.cv_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (cvError) throw new Error(cvError.message);
    if (!cvRow) throw new Error("CV not found.");

    const cv = cvRow.raw_json_data as CV;

    // 2. Call Gemini
    const systemInstruction = `You are a senior technical recruiter and CV specialist.
Your task is to tailor a candidate's CV to match a specific job description.
Rules:
- Only rewrite profile.summary and each experience's bullets field.
- Keep all facts accurate — do not invent roles, companies, dates or skills.
- Mirror the language, keywords, and priorities of the job description.
- Make the summary 3-4 impactful sentences.
- Rewrite bullet points to highlight impact and relevance using strong action verbs.
- Return ONLY a valid JSON object — no markdown, no backticks, no preamble.
- The JSON must exactly match this shape: { "tailored_cv": <CV object>, "changes_summary": "<2-3 sentence plain English explanation>" }`;

    const prompt = `JOB DESCRIPTION:\n${data.job_description}\n\nORIGINAL CV (JSON):\n${JSON.stringify(cv, null, 2)}`;

    const raw = await callGemini(prompt, systemInstruction);

    // 3. Parse JSON (strip any accidental markdown fences)
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: { tailored_cv: CV; changes_summary: string };
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("Gemini returned invalid JSON. Please try again.");
    }

    // 4. Save as new CV row
    const newTitle = `${cvRow.title} — Tailored`;
    const { data: saved, error: saveError } = await context.supabase
      .from("cvs")
      .insert({
        user_id: context.userId,
        title: newTitle,
        raw_json_data: parsed.tailored_cv as any,
      })
      .select()
      .single();
    if (saveError) throw new Error(saveError.message);

    return {
      cv_id: saved.id,
      title: newTitle,
      tailored_cv: parsed.tailored_cv,
      changes_summary: parsed.changes_summary,
    };
  });

// ─── Parse CV from raw text ───────────────────────────────────────────────────

export const parseCV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { raw_text: string }) => d)
  .handler(async ({ data }) => {
    const systemInstruction = `You are a CV parsing engine.
Extract structured information from raw CV text and return ONLY a valid JSON object.
No markdown, no backticks, no explanation — just the JSON.
Use this exact shape:
{
  "profile": { "name": "", "title": "", "email": "", "phone": "", "summary": "" },
  "experiences": [{ "role": "", "company": "", "period": "", "bullets": "" }],
  "education": [{ "degree": "", "school": "", "year": "" }],
  "skills": ""
}
Rules:
- bullets: join all bullet points for one role into a single string separated by newlines, each starting with "• "
- skills: comma-separated list of skills
- If a field cannot be found, use an empty string
- summary: write a 2-3 sentence professional summary based on the candidate's experience if none is present`;

    const prompt = `Parse this CV:\n\n${data.raw_text}`;
    const raw = await callGemini(prompt, systemInstruction);

    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: CV;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("Could not parse CV — please check the text and try again.");
    }

    return parsed;
  });

// ─── List user CVs (for tailor dropdown) ─────────────────────────────────────

export const listCVs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cvs")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
