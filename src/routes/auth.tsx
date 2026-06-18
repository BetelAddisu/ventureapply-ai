import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap, Loader2, Mail, Lock, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — VentureApply" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — let's get you onboarded.");
    navigate({ to: "/onboarding" });
  };

  const handleMagicLink = async () => {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Magic link sent — check your inbox.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.22_0.10_280)] via-[oklch(0.18_0.08_265)] to-[oklch(0.20_0.12_195)]" />
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-[oklch(0.70_0.20_295)]/30 blur-3xl" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)]">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">VentureApply</span>
          </Link>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> AI-powered
            </div>
            <h2 className="max-w-md text-3xl font-bold leading-tight">
              The autonomous job-application platform that works while you sleep.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Tailor CVs, scan jobs 24/7, and deploy an AI agent that submits applications for you.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">© VentureApply</p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex items-center justify-center p-6">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="glass w-full max-w-md rounded-2xl p-8">
          <h1 className="text-2xl font-semibold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create your account to continue.</p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <Field id="si-email" label="Email" icon={<Mail className="h-4 w-4" />}>
                  <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
                </Field>
                <Field id="si-pass" label="Password" icon={<Lock className="h-4 w-4" />}>
                  <Input id="si-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                </Field>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
                <div className="relative my-2 flex items-center"><span className="flex-1 border-t border-border" /><span className="px-3 text-xs text-muted-foreground">or</span><span className="flex-1 border-t border-border" /></div>
                <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleMagicLink}>
                  <Sparkles className="mr-2 h-4 w-4" /> Send magic link
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignUp} className="space-y-4">
                <Field id="su-name" label="Full name">
                  <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ada Lovelace" />
                </Field>
                <Field id="su-email" label="Email" icon={<Mail className="h-4 w-4" />}>
                  <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                <Field id="su-pass" label="Password" icon={<Lock className="h-4 w-4" />}>
                  <Input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </Field>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-primary to-[oklch(0.70_0.20_295)] text-primary-foreground border-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, icon, children }: { id: string; label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</Label>
      {children}
    </div>
  );
}