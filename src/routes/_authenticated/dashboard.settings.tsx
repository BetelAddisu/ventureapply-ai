import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Mail, MessageCircle, Bell, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    id: "",
    email: "",
    full_name: "",
    phone: "",
    title: "",
    summary: "",
    location: "",
    search_urgency: "active",
    notify_email: true,
    notify_telegram: false,
    notify_whatsapp: false,
    telegram_chat_id: "",
  } as any);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({
        id: data.id,
        email: user.email || "",
        full_name: data.full_name || "",
        phone: (data as any).phone || "",
        title: (data as any).title || "",
        summary: (data as any).summary || "",
        location: (data as any).location || "",
        search_urgency: data.search_urgency || "active",
        notify_email: (data as any).notify_email ?? true,
        notify_telegram: (data as any).notify_telegram ?? false,
        notify_whatsapp: (data as any).notify_whatsapp ?? false,
        telegram_chat_id: (data as any).telegram_chat_id || "",
      });
    } else {
      // Create profile if doesn't exist
      const newProfile = {
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || "",
      } as any;
      await supabase.from("profiles").insert(newProfile);
      setProfile((prev: any) => ({ ...prev, email: user.email || "" }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          title: profile.title,
          summary: profile.summary,
          location: profile.location,
          search_urgency: profile.search_urgency,
          notify_email: profile.notify_email,
          notify_telegram: profile.notify_telegram,
          notify_whatsapp: profile.notify_whatsapp,
          telegram_chat_id: profile.telegram_chat_id,
        } as any)
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Profile saved successfully!");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Console</p>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and notification preferences</p>
      </div>

      {/* Personal Information */}
      <Card className="glass border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
        
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="San Francisco, CA"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Professional Title</Label>
            <Input
              id="title"
              value={profile.title}
              onChange={(e) => setProfile({ ...profile, title: e.target.value })}
              placeholder="Senior Software Engineer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Professional Summary</Label>
            <Textarea
              id="summary"
              value={profile.summary}
              onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
              placeholder="Brief summary of your experience and goals..."
              rows={4}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </Card>

      {/* Job Search Preferences */}
      <Card className="glass border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Job Search Preferences</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search Urgency</Label>
            <div className="flex gap-2">
              {["active", "open", "exploring"].map((urgency) => (
                <Button
                  key={urgency}
                  variant={profile.search_urgency === urgency ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProfile({ ...profile, search_urgency: urgency })}
                >
                  {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Active = immediately looking, Open = open to opportunities, Exploring = casually browsing
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </Card>

      {/* Notification Channels */}
      <Card className="glass border-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Channels
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how you want to receive job alerts. The agent runs job searches twice daily.
        </p>

        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive job alerts via email</p>
              </div>
            </div>
            <Switch
              checked={profile.notify_email}
              onCheckedChange={(checked) => setProfile({ ...profile, notify_email: checked })}
            />
          </div>

          {/* Telegram Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-[#0088cc]" />
              <div>
                <p className="font-medium">Telegram</p>
                <p className="text-xs text-muted-foreground">
                  {profile.notify_telegram 
                    ? `Connected: ${profile.telegram_chat_id || 'Chat ID pending'}`
                    : 'Get instant alerts via Telegram bot'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={profile.notify_telegram}
              onCheckedChange={(checked) => setProfile({ ...profile, notify_telegram: checked })}
            />
          </div>

          {profile.notify_telegram && (
            <div className="ml-8 space-y-2">
              <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
              <Input
                id="telegram_chat_id"
                value={profile.telegram_chat_id}
                onChange={(e) => setProfile({ ...profile, telegram_chat_id: e.target.value })}
                placeholder="e.g., 123456789"
              />
              <p className="text-xs text-muted-foreground">
                Message @userinfobot on Telegram to get your Chat ID, then enter it here.
              </p>
            </div>
          )}

          {/* WhatsApp Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Coming soon - free notifications via WhatsApp</p>
              </div>
            </div>
            <Switch
              checked={profile.notify_whatsapp}
              onCheckedChange={(checked) => setProfile({ ...profile, notify_whatsapp: checked })}
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground ml-2">
            WhatsApp integration requires additional setup. Contact support for early access.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Notification Settings
        </Button>
      </Card>

      {/* Telegram Bot Info */}
      <Card className="glass border-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Telegram Bot Setup
        </h2>
        <div className="space-y-2 text-sm">
          <p><strong>Bot Username:</strong> @VentureApply_AIBot</p>
          <p className="text-muted-foreground">
            To receive notifications via Telegram:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Open Telegram and search for @VentureApply_AIBot</li>
            <li>Start a chat with the bot by typing /start</li>
            <li>Get your Chat ID by messaging @userinfobot</li>
            <li>Enter your Chat ID in the field above</li>
            <li>Enable Telegram notifications above</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
