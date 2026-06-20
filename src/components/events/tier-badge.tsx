import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Cores por categoria de ingresso (#5). Categorias livres caem no estilo neutro.
const STYLES: Record<string, string> = {
  vip: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
  imprensa: "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400",
  press: "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400",
  staff: "border-transparent bg-purple-500/15 text-purple-600 dark:text-purple-400",
  equipe: "border-transparent bg-purple-500/15 text-purple-600 dark:text-purple-400",
};

export function TierBadge({
  tier,
  className,
}: {
  tier?: string | null;
  className?: string;
}) {
  if (!tier) return null;
  const style = STYLES[tier.trim().toLowerCase()];
  if (style) return <Badge className={cn("text-xs", style, className)}>{tier}</Badge>;
  return (
    <Badge variant="secondary" className={cn("text-xs", className)}>
      {tier}
    </Badge>
  );
}
