import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase, hasSupabaseBrowserConfig } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!hasSupabaseBrowserConfig()) throw redirect({ to: "/" });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
