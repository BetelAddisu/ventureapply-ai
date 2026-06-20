import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, CircleDashed, ArrowUpRight } from "lucide-react";
import { getTrialStatus, expireTrialIfNeeded } from "@/lib/trial.functions";

type TrialStatus = {
  current_tier: string;
  trial_tier: string;
  trial_ends_at: string | null;
  is_trial_active: boolean;
};

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  scale: "Premium Agent",
};

function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function TrialStatusBadge({
  compact,
  showUpgradeCta,
}: {
  compact?: boolean;
  showUpgradeCta?: boolean;
}) {
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const getFn = useServerFn(getTrialStatus);
  const expireFn = useServerFn(expireTrialIfNeeded);

  useEffect(() => {
    (async () => {
      try {
        // Best-effort: flip any expired trial back to free before reading.
        await expireFn();
      } catch {
        /* non-critical — read will just reflect pre-expiry state */
      }
      try {
        const res = await getFn();
        setStatus(res as TrialStatus);
      } catch {
        /* swallow — badge simply won't render */
      }
    })();
  }, []);

  if (!status) return null;

  if (status.is_trial_active && status.trial_ends_at) {
    const left = daysLeft(status.trial_ends_at);
    return (
      <Badge
        variant="outline"
        className={`border-primary/40 bg-primary/10 text-primary ${compact ? "text-[10px]" : ""}`}
      >
        <Sparkles className={compact ? "mr-1 h-2.5 w-2.5" : "mr-1 h-3 w-3"} />
        {TIER_LABEL[status.trial_tier] ?? "Premium"} trial · {left}d left
      </Badge>
    );
  }

  if (status.current_tier !== "free") {
    return (
      <Badge variant="outline" className={`border-border ${compact ? "text-[10px]" : ""}`}>
        <Clock className={compact ? "mr-1 h-2.5 w-2.5" : "mr-1 h-3 w-3"} />
        {TIER_LABEL[status.current_tier] ?? status.current_tier}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`border-border text-muted-foreground ${compact ? "text-[10px]" : ""}`}
      >
        <CircleDashed className={compact ? "mr-1 h-2.5 w-2.5" : "mr-1 h-3 w-3"} />
        Free plan
      </Badge>
      {showUpgradeCta && (
        <Link to="/pricing">
          <Button
            size="sm"
            variant="outline"
            className={`border-primary/40 text-primary hover:bg-primary/10 ${compact ? "h-6 px-2 text-[10px]" : ""}`}
          >
            Upgrade <ArrowUpRight className={compact ? "ml-1 h-2.5 w-2.5" : "ml-1 h-3 w-3"} />
          </Button>
        </Link>
      )}
    </div>
  );
}
