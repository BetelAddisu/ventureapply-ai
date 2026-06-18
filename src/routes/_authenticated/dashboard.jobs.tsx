import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Mail, MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  component: Jobs,
});

const MOCK = [
  { id: "1", title: "Senior Product Engineer", company: "Linear", date: "2h ago", status: "matched" },
  { id: "2", title: "Staff Frontend Engineer", company: "Vercel", date: "5h ago", status: "tailored" },
  { id: "3", title: "Full-Stack Engineer", company: "Supabase", date: "1d ago", status: "applied" },
  { id: "4", title: "Senior React Engineer", company: "Stripe", date: "1d ago", status: "matched" },
  { id: "5", title: "Lead UI Engineer", company: "Notion", date: "2d ago", status: "matched" },
];

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-primary/15 text-primary border-primary/30",
  tailored: "bg-[oklch(0.70_0.20_295)]/15 text-[oklch(0.78_0.18_295)] border-[oklch(0.70_0.20_295)]/30",
  applied: "bg-[oklch(0.72_0.18_155)]/15 text-[oklch(0.78_0.16_155)] border-[oklch(0.72_0.18_155)]/30",
};

function Jobs() {
  const [channels, setChannels] = useState({ email: true, telegram: false, whatsapp: false });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Tracker & Scanner</h1>
          <p className="text-sm text-muted-foreground">Live matches across hundreds of job boards.</p>
        </div>
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          <Activity className="h-3.5 w-3.5 animate-pulse text-[oklch(0.72_0.18_155)]" />
          <span>Scanning <span className="font-semibold text-foreground">4× daily</span></span>
        </div>
      </div>

      <Card className="glass border-border p-5">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Notification Channels</p>
        <div className="grid gap-3 md:grid-cols-3">
          <ChannelRow icon={<Mail className="h-4 w-4" />} label="Email" enabled={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} />
          <ChannelRow icon={<MessageCircle className="h-4 w-4" />} label="Telegram" enabled={channels.telegram} onChange={(v) => setChannels({ ...channels, telegram: v })} />
          <ChannelRow icon={<Phone className="h-4 w-4" />} label="WhatsApp" enabled={channels.whatsapp} onChange={(v) => setChannels({ ...channels, whatsapp: v })} />
        </div>
      </Card>

      <Card className="glass overflow-hidden border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Job Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Date Found</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK.map((j) => (
              <TableRow key={j.id} className="border-border">
                <TableCell className="font-medium">{j.title}</TableCell>
                <TableCell className="text-muted-foreground">{j.company}</TableCell>
                <TableCell className="text-muted-foreground">{j.date}</TableCell>
                <TableCell><Badge variant="outline" className={`capitalize ${STATUS_STYLE[j.status]}`}>{j.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ChannelRow({ icon, label, enabled, onChange }: { icon: React.ReactNode; label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><span className="text-sm">{label}</span></div>
      <Switch checked={enabled} onCheckedChange={onChange} />
    </div>
  );
}