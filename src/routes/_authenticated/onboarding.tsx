import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrialStatusBadge } from "@/components/trial-status-badge";
import {
  User, Briefcase, Zap, Bot, Sparkles, Check,
  ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Server function ──────────────────────────────────────────────────────────
// NOTE: current_tier is intentionally NOT accepted here. Tier is granted
// automatically at signup (see handle_new_user() in the trial migration) and
// can only ever change via a server-side/service-role write — never from
// this form. The "Choose Plan" step below is purely informational.

const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    full_name: string;
    target_title: string;
    experience_level: string;
    search_urgency: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { full_name, target_title, experience_level, search_urgency } = data;
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name, target_title, experience_level, search_urgency })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

// ─── Tier definitions (display only — see note above) ─────────────────────

const TIERS = [
  {
    id: "free",
    label: "Freemium",
    price: "$0",
    icon: Sparkles,
    color: "border-border",
    badge: null,
    perks: ["5 AI CV tailors/month", "1 CV stored", "AI CV parser", "Manual job search"],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$19/mo",
    icon: Zap,
    color: "border-primary",
    badge: "Most Popular",
    perks: ["Unlimited AI tailors", "10 CVs", "24/7 Job Scanner", "50 auto-applications/mo", "Telegram alerts"],
  },
  {
    id: "scale",
    label: "Premium Agent",
    price: "$49/mo",
    icon: Bot,
    color: "border-[oklch(0.70_0.20_295)]",
    badge: "Full Autonomy",
    perks: ["Everything in Pro", "Unlimited applications", "Priority AI queue", "WhatsApp + Telegram", "Dedicated support"],
  },
];

const EXPERIENCE_LEVELS = [
  { id: "entry", label: "Entry Level", sub: "0–2 years" },
  { id: "mid", label: "Mid Level", sub: "2–5 years" },
  { id: "senior", label: "Senior", sub: "5–10 years" },
  { id: "lead", label: "Lead / Principal", sub: "8+ years" },
  { id: "executive", label: "Executive", sub: "Director, VP, C-Suite" },
];

const URGENCY_OPTIONS = [
  { id: "active", label: "Actively Applying", sub: "Looking for something new now" },
  { id: "open", label: "Open to Opportunities", sub: "Not urgent, but interested" },
  { id: "exploring", label: "Just Exploring", sub: "Researching the market" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Your Details", "Experience", "Search Goal", "Your Plan"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-all ${
              i < current
                ? "bg-[oklch(0.72_0.18_155)] text-white"
                : i === current
                  ? "bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}>
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-[10px] sm:block ${i === current ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mx-2 mb-4 h-px w-8 sm:w-12 ${i < current ? "bg-[oklch(0.72_0.18_155)]" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function Onboarding() {
  const navigate = useNavigate();
  const saveFn = useServerFn(saveProfile);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [searchUrgency, setSearchUrgency] = useState("");

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    if (!fullName.trim()) return toast.error("Please enter your name");
    setSaving(true);
    try {
      await saveFn({
        data: {
          full_name: fullName,
          target_title: targetTitle,
          experience_level: experienceLevel,
          search_urgency: searchUrgency,
        },
      });
      toast.success("Profile saved — welcome to VentureApply!");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] glow">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-semibold tracking-tight">VentureApply</span>
      </div>

      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

        <Card className="glass border-border p-8">
          {/* ── Step 0: Details ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Welcome — let's set up your profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">This helps our AI tailor your applications more accurately.</p>
              </div>
              <div className="space-y-1">
                <Label>Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Betel Asfaw"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Target job title(s)</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="e.g. Frontend Engineer, Product Manager"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Separate multiple titles with a comma.</p>
              </div>
            </div>
          )}

          {/* ── Step 1: Experience ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">What's your experience level?</h2>
                <p className="mt-1 text-sm text-muted-foreground">This calibrates the language and tone of your tailored CVs.</p>
              </div>
              <div className="grid gap-2">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setExperienceLevel(lvl.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/50 ${
                      experienceLevel === lvl.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/40"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{lvl.label}</div>
                      <div className="text-xs text-muted-foreground">{lvl.sub}</div>
                    </div>
                    {experienceLevel === lvl.id && (
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Search goal ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">How urgently are you looking?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This feeds the autonomous agent's matching criteria — active seekers get higher scan frequency.
                </p>
              </div>
              <div className="grid gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSearchUrgency(opt.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/50 ${
                      searchUrgency === opt.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/40"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.sub}</div>
                    </div>
                    {searchUrgency === opt.id && (
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                💡 You can change this at any time from your profile settings.
              </p>
            </div>
          )}

          {/* ── Step 3: Plan (read-only / informational) ──
               No selection here writes anything. current_tier is granted
               automatically at signup and changes only via server-side logic. */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Your plan</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every new account starts on a full-access trial automatically — no card, no setup.
                  </p>
                </div>
                <TrialStatusBadge />
              </div>
              <div className="grid gap-3">
                {TIERS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.id}
                      className="relative rounded-xl border border-border bg-card/40 p-4 text-left"
                    >
                      {t.badge && (
                        <Badge className="absolute right-3 top-3 bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 text-[10px]">
                          {t.badge}
                        </Badge>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold">{t.label}</span>
                            <span className="text-sm text-muted-foreground">{t.price}</span>
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {t.perks.map((p) => (
                              <li key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Check className="h-3 w-3 shrink-0 text-[oklch(0.72_0.18_155)]" /> {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                ✨ You currently have full Premium Agent access as part of your trial. This list is just so you
                know what each tier includes going forward.
              </p>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="mt-8 flex justify-between">
            <Button variant="outline" onClick={back} disabled={step === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={next}
                disabled={step === 0 && !fullName.trim()}
                className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={finish}
                disabled={saving}
                className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0 glow"
              >
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  : <><Zap className="mr-2 h-4 w-4" /> Launch VentureApply</>}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can update all of these from your profile settings at any time.
        </p>
      </div>
    </div>
  );
}
