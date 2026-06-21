import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIText } from "@/lib/ai.router";

type ExtractedSearchProfile = {
  primary_title: string;
  keywords: string[];
  industry: string;
};

// ─── Extract a fallback search profile from the user's most recent CV ─────
// Used by fetchJobs when the user hasn't typed a keyword (or a primary
// search returned nothing). Reads the user's own most-recently-updated CV
// row via the RLS-scoped client — never another user's data.
export const extractSearchProfileFromCV = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cvRow, error } = await context.supabase
      .from("cvs")
      .select("raw_json_data")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!cvRow) return null;

    const cv = cvRow.raw_json_data as any;
    const cvText = [
      cv?.profile?.title,
      cv?.profile?.summary,
      ...(cv?.experiences ?? []).map((e: any) => `${e.role} at ${e.company}: ${e.bullets}`),
      cv?.skills,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 12_000); // AI models support far more, but this is plenty for a query extraction task.

    if (!cvText.trim()) return null;

    const systemInstruction = `You extract a job-search profile from CV text.
Return ONLY a valid JSON object, no markdown, no backticks, no preamble.
Shape: { "primary_title": "<best-fit job title, 2-5 words>", "keywords": ["<3-6 core skill/framework keywords>"], "industry": "<1-3 word industry/domain>" }
Base this only on what's actually in the CV text — do not invent experience.`;

    const raw = await callAIText(`CV TEXT:\n${cvText}`, systemInstruction, { maxOutputTokens: 512 });
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: ExtractedSearchProfile;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("Could not extract a search profile from your CV — try entering a keyword manually.");
    }

    return parsed;
  });
