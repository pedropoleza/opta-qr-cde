"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Abas superiores do painel do organizador (sem sidebar — app embutido como
// iframe no CRM). Cada aba marca estado ativo pela rota atual.
const items = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    isActive: (p: string) => p === "/",
  },
  {
    href: "/events",
    label: "Eventos",
    icon: Calendar,
    isActive: (p: string) => p === "/events" || p.startsWith("/events/"),
  },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Navegação principal">
      {items.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-active={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
