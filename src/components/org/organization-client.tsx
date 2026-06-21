"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Loading } from "@/components/ui/states";

type Member = { userId: string; email: string | null; role: string };
type Invite = { id: string; email: string; role: string };
type Data = {
  org: { id: string; name: string };
  role: "owner" | "manager" | "member";
  currentUserId: string | null;
  members: Member[];
  invites: Invite[];
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Gerente",
  member: "Membro",
};

export function OrganizationClient({ multiTenant }: { multiTenant: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [inviting, setInviting] = useState(false);

  async function load() {
    const res = await fetch("/api/org");
    if (res.ok) {
      const d: Data = await res.json();
      setData(d);
      setName(d.org.name);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const isOwner = data?.role === "owner";

  async function saveName() {
    setSavingName(true);
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(false);
    if (!res.ok) {
      toast.error("Erro ao salvar o nome");
      return;
    }
    toast.success("Organização atualizada");
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const d = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) {
      toast.error(d.error ?? "Erro ao convidar");
      return;
    }
    toast.success(`Convite enviado para ${invite.email}`);
    setInvite({ email: "", role: "member" });
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/org/invites/${id}`, { method: "DELETE" });
    load();
  }
  async function changeRole(userId: string, role: string) {
    const res = await fetch(`/api/org/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao alterar papel");
    }
    load();
  }
  async function removeMember(userId: string) {
    const res = await fetch(`/api/org/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao remover");
    }
    load();
  }

  if (!data) return <Loading label="Carregando organização…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Organização"
        description="Nome, equipe e papéis desta organização."
      />

      <Card>
        <CardContent className="space-y-3 p-5">
          <Label htmlFor="orgname">Nome da organização</Label>
          <div className="flex items-center gap-2">
            <Input
              id="orgname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
            />
            {isOwner && (
              <Button onClick={saveName} disabled={savingName || !name.trim()}>
                {savingName && <Loader2 className="size-4 animate-spin" />} Salvar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!multiTenant ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            A gestão de equipe fica disponível quando o login multi-tenant
            (Supabase Auth) está ligado.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="font-medium">Equipe</p>
              <ul className="divide-y">
                {data.members.map((mb) => (
                  <li
                    key={mb.userId}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {mb.email ?? mb.userId.slice(0, 8)}
                        {mb.userId === data.currentUserId ? " (você)" : ""}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      {isOwner && mb.userId !== data.currentUserId ? (
                        <>
                          <Select
                            value={mb.role}
                            onValueChange={(v) => changeRole(mb.userId, v)}
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="manager">Gerente</SelectItem>
                              <SelectItem value="member">Membro</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remover"
                            onClick={() => removeMember(mb.userId)}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary">
                          {ROLE_LABEL[mb.role] ?? mb.role}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {isOwner && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <p className="font-medium">Convidar para a equipe</p>
                <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="invemail">E-mail</Label>
                    <Input
                      id="invemail"
                      type="email"
                      value={invite.email}
                      onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
                      placeholder="pessoa@empresa.com"
                      required
                    />
                  </div>
                  <Select
                    value={invite.role}
                    onValueChange={(v) => setInvite((i) => ({ ...i, role: v }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    Convidar
                  </Button>
                </form>

                {data.invites.length > 0 && (
                  <ul className="divide-y border-t pt-2">
                    {data.invites.map((iv) => (
                      <li
                        key={iv.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Mail className="size-4 text-muted-foreground" />
                          {iv.email}
                          <Badge variant="outline">{ROLE_LABEL[iv.role] ?? iv.role}</Badge>
                          <span className="text-xs text-muted-foreground">pendente</span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revoke(iv.id)}
                        >
                          Revogar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
