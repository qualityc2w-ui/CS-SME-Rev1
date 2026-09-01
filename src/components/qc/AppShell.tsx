import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, PencilLine, Database, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/input", label: "Input Data", icon: PencilLine, adminOnly: false },
  { to: "/master", label: "Master Data", icon: Database, adminOnly: true },
] as const;

const roleLabel: Record<string, string> = {
  admin: "Admin",
  qc: "QC",
  karyawan: "Karyawan",
};

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { user, role, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const items = nav.filter((n) => !n.adminOnly || isAdmin);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            QC
          </div>
          <div className="leading-tight">
            <strong className="block text-sm">QC Inspect</strong>
            <span className="text-xs text-muted-foreground">Quality Inspection System</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-border pt-4">
          <div className="leading-tight">
            <span className="block truncate text-xs font-medium">{user?.email ?? "—"}</span>
            <span className="text-xs text-muted-foreground">
              {role ? roleLabel[role] : "Tanpa peran"}
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <nav className="flex items-center gap-2 md:hidden">
            {items.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-md border border-border px-2 py-1 text-xs [&.active]:bg-primary [&.active]:text-primary-foreground"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-border px-2 py-1 text-xs"
            >
              Keluar
            </button>
          </nav>
        </header>
        <div className="space-y-6 p-6">{children}</div>
      </main>
    </div>
  );
}
