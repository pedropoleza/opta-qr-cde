"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Modal de ajuda "Como funciona" — gatilho discreto + conteúdo explicativo.
export function HelpModal({
  title = "Como funciona",
  description,
  triggerLabel = "Como funciona",
  children,
}: {
  title?: string;
  description?: string;
  triggerLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <HelpCircle className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
