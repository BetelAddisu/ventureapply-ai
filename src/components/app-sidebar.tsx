import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { FileText, Sparkles, Search, Bot, LogOut, Zap, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { TrialStatusBadge } from "@/components/trial-status-badge";
import { toast } from "sonner";

const items = [
  { title: "CV Builder", url: "/dashboard/cv-builder", icon: FileText, tier: "Free" },
  { title: "AI Tailor", url: "/dashboard/tailor", icon: Sparkles, tier: "Free" },
  { title: "Job Tracker", url: "/dashboard/jobs", icon: Search, tier: "Paid" },
  { title: "Agent Command", url: "/dashboard/agent", icon: Bot, tier: "Premium" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.20_295)] glow">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-semibold tracking-tight">VentureApply</span>}
        </div>
        {!collapsed && (
          <div className="px-2 pb-1.5">
            <TrialStatusBadge compact showUpgradeCta />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            <Badge variant="outline" className="h-5 border-border/60 text-[10px] font-normal text-muted-foreground">{item.tier}</Badge>
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard"><Settings className="h-4 w-4" />{!collapsed && <span>Settings</span>}</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}><LogOut className="h-4 w-4" />{!collapsed && <span>Sign out</span>}</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
