import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2, Sparkles, Zap, Bot, Phone, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const TIERS = [
  { id: "freemium", name: "Freemium", price: "$0", icon: Sparkles, perks: ["CV Builder", "1 AI Tailor / day", "Manual job search"] },
  { id: "paid", name: "Paid", price: "$19/mo", icon: Zap, perks: ["Unlimited AI Tailor", "24/7 Job Scanner", "Email + Telegram alerts"] },
  { id: "premium", name: "Premium Agent", price: "$49/mo", icon: Bot, perks: ["All Paid features", "Autonomous Agent", "Auto-apply to matched jobs"] },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [experience, setExperience] = useState("");
  const [tier, setTier] = useState("freemium");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [notifPref, setNotifPref] = useState<"email" | "telegram" | "whatsapp">("email");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        if (data.onboarded) navigate({ to: "/dashboard" });
      }
    })();
  }, [navigate]);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    // NOTE: current_tier is intentionally NOT written from the client.
    // Tier changes are server-controlled and require a verified payment;
    // a database trigger blocks client writes to current_tier.
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      target_title: targetTitle,
      experience_level: experience,
      phone_number: phoneNumber || null,
      telegram_handle: telegramHandle || null,
      notification_preference: notifPref,
      onboarded: true,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("You're all set!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)]" : "bg-muted"}`} />
        ))}
      </div>

      <Card className="glass-strong border-border p-8">
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold">Tell us about you</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll personalize your dashboard and job matches.</p>
            <div className="mt-6 space-y-4">
              <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" className="mt-1.5" /></div>
              <div><Label>Target job title</Label><Input value={targetTitle} onChange={(e) => setTargetTitle(e.target.value)} placeholder="Senior Product Designer" className="mt-1.5" /></div>
              <div>
                <Label>Experience level</Label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select your experience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry (0–2 yrs)</SelectItem>
                    <SelectItem value="mid">Mid (3–5 yrs)</SelectItem>
                    <SelectItem value="senior">Senior (6–9 yrs)</SelectItem>
                    <SelectItem value="lead">Lead / Staff (10+ yrs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold">Choose your tier</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can upgrade anytime.</p>
            <div className="mt-6 grid gap-3">
              {TIERS.map((t) => {
                const Icon = t.icon;
                const active = tier === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setTier(t.id)}
                    className={`group rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/10 glow" : "border-border hover:bg-card/80"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground" : "bg-muted"}`}><Icon className="h-4 w-4" /></div>
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.perks.join(" • ")}</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{t.price}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold">How should we reach you?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Job alerts and agent updates are delivered via your preferred channel.
              Telegram and WhatsApp are optional but recommended for real-time notifications.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone number (for WhatsApp)</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="mt-1.5"
                  maxLength={20}
                />
                <p className="mt-1 text-xs text-muted-foreground">Include country code. Used only for WhatsApp alerts.</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Telegram handle</Label>
                <Input
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value.replace(/^@/, ""))}
                  placeholder="your_username"
                  className="mt-1.5"
                  maxLength={32}
                />
                <p className="mt-1 text-xs text-muted-foreground">Without the @. Start a chat with our bot to receive alerts.</p>
              </div>
              <div>
                <Label>Preferred channel</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {([
                    { id: "email", label: "Email", icon: Mail },
                    { id: "telegram", label: "Telegram", icon: MessageCircle },
                    { id: "whatsapp", label: "WhatsApp", icon: Phone },
                  ] as const).map(({ id, label, icon: Icon }) => {
                    const active = notifPref === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setNotifPref(id)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm transition ${
                          active ? "border-primary bg-primary/10 text-foreground glow" : "border-border text-muted-foreground hover:bg-card/80"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-2xl font-semibold">Ready to launch</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review and confirm.</p>
            <ul className="mt-6 space-y-2 text-sm">
              <Row label="Name" value={fullName || "—"} />
              <Row label="Target role" value={targetTitle || "—"} />
              <Row label="Experience" value={experience || "—"} />
              <Row label="Tier" value={TIERS.find((t) => t.id === tier)?.name ?? tier} />
              <Row label="Phone" value={phoneNumber || "—"} />
              <Row label="Telegram" value={telegramHandle ? `@${telegramHandle}` : "—"} />
              <Row label="Notifications via" value={notifPref} />
            </ul>
          </>
        )}

        <div className="mt-8 flex justify-between">
          <Button variant="ghost" onClick={back} disabled={step === 1}>Back</Button>
          {step < 4 ? (
            <Button onClick={next} disabled={step === 1 && (!fullName || !targetTitle || !experience)} className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">Continue</Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Launch dashboard</>}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <li className="flex justify-between border-b border-border py-2"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></li>;
}