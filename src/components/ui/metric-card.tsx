import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Accent = "muted" | "primary" | "success" | "amber" | "violet" | "destructive";

const ACCENT: Record<Accent, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  amber: "bg-amber-500/10 text-amber-600",
  violet: "bg-violet-500/10 text-violet-600",
  destructive: "bg-destructive/10 text-destructive",
};

// Cartão de métrica reutilizável: rótulo + valor + ícone em chip colorido.
export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "muted",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 transition-shadow hover:shadow-sm", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              ACCENT[accent],
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
