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
type Org = {
  id: string;
  name: string;
  brandName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};
type Data = {
  org: Org;
  role: "owner" | "manager" | "member";
  currentUserId: string | null;
  members: Member[];
  invites: Invite[];
};
type AuditEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  "org.update": "Atualizou a organização",
  "member.role": "Alterou papel de membro",
  "member.remove": "Removeu membro",
  "invite.create": "Convidou",
  "invite.revoke": "Revogou convite",
  "ghl.connect": "Conectou o Spark",
  "ghl.disconnect": "Desconectou o Spark",
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
  const [brand, setBrand] = useState({ brandName: "", logoUrl: "", primaryColor: "" });
  const [savingBrand, setSavingBrand] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  async function load() {
    const res = await fetch("/api/org");
    if (res.ok) {
      const d: Data = await res.json();
      setData(d);
      setName(d.org.name);
      setBrand({
        brandName: d.org.brandName ?? "",
        logoUrl: d.org.logoUrl ?? "",
        primaryColor: d.org.primaryColor ?? "",
      });
      if (d.role !== "member") {
        fetch("/api/org/audit")
          .then((r) => (r.ok ? r.json() : { logs: [] }))
          .then((a) => setAudit(a.logs ?? []))
          .catch(() => {});
      }
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function saveBrand() {
    setSavingBrand(true);
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });
    setSavingBrand(false);
    if (!res.ok) {
      toast.error("Erro ao salvar a marca");
      return;
    }
    toast.success("Marca atualizada");
    load();
  }

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

      {/* White-label: marca exibida no ingresso público do convidado */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-medium">Marca (white-label)</p>
            <span
              className="size-6 rounded-md border"
              style={{ backgroundColor: brand.primaryColor || "#171717" }}
              aria-hidden
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Aparece no ingresso do convidado (a página do QR Code).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brandName">Nome da marca</Label>
              <Input
                id="brandName"
                value={brand.brandName}
                onChange={(e) => setBrand((b) => ({ ...b, brandName: e.target.value }))}
                placeholder="Ex.: Opta Finance"
                disabled={!isOwner}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryColor">Cor primária (hex)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  value={brand.primaryColor}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, primaryColor: e.target.value }))
                  }
                  placeholder="#4f46e5"
                  disabled={!isOwner}
                />
                <input
                  type="color"
                  aria-label="Selecionar cor"
                  value={brand.primaryColor || "#171717"}
                  onChange={(e) =>
                    setBrand((b) => ({ ...b, primaryColor: e.target.value }))
                  }
                  disabled={!isOwner}
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="logoUrl">URL do logo</Label>
              <Input
                id="logoUrl"
                value={brand.logoUrl}
                onChange={(e) => setBrand((b) => ({ ...b, logoUrl: e.target.value }))}
                placeholder="https://…/logo.png"
                disabled={!isOwner}
              />
            </div>
          </div>
          {isOwner && (
            <Button onClick={saveBrand} disabled={savingBrand}>
              {savingBrand && <Loader2 className="size-4 animate-spin" />} Salvar marca
            </Button>
          )}
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

          {data.role !== "member" && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="font-medium">Atividade recente</p>
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma ação registrada ainda.
                  </p>
                ) : (
                  <ul className="divide-y text-sm">
                    {audit.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">
                            <span className="font-medium">
                              {ACTION_LABEL[a.action] ?? a.action}
                            </span>
                            {a.target ? (
                              <span className="text-muted-foreground"> · {a.target}</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {a.actorEmail ?? "sistema"}
                          </span>
                        </span>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
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
