import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, Trash2, Users, Save, CalendarDays, ClipboardList, Shirt, Plus, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  status: z.enum(["Ativo", "Afastado", "Bloqueado"]).optional(),
});

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Diaristas — Gestão" },
      { name: "description", content: "Cadastro, escala, EPIs e financeiro dos seus diaristas." },
    ],
  }),
  component: HomePage,
});

type Status = "Ativo" | "Afastado" | "Bloqueado";
type Turno = "Manhã" | "Tarde" | "Noite";
type EpiTipo = "bota" | "colete";

interface Uniforme {
  bota?: { tamanho?: string; entregue?: boolean; autorizado_levar?: boolean };
  colete?: { entregue?: boolean; autorizado_levar?: boolean };
}
interface Diarista {
  id: string; nome: string; cpf: string; endereco: string; localidade: string; lider: string;
  turno: Turno; telefone: string; email: string; status: Status; foto: string | null; uniforme: Uniforme;
}
interface Demanda { id: string; nome: string; data_inicio: string | null; data_fim: string | null; observacao: string; }
interface Escala {
  id: string; diarista_id: string; demanda_id: string | null; data: string;
  valor_diaria: number; valor_passagem: number; eh_feriado: boolean; observacao: string;
}
interface Advertencia { id: string; diarista_id: string; data: string; motivo: string; }
interface EpiEstoque { id: string; tipo: EpiTipo; tamanho: string; quantidade_total: number; }
interface EpiEntrega { id: string; tipo: EpiTipo; tamanho: string; diarista_id: string; entregue_em: string; devolvido_em: string | null; observacao: string; }

const empty = {
  nome: "", cpf: "", endereco: "", localidade: "", lider: "",
  turno: "Manhã" as Turno, telefone: "", email: "",
  status: "Ativo" as Status, foto: "", uniforme: {} as Uniforme,
};

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}
function statusVariant(s: Status): "default" | "secondary" | "destructive" | "outline" {
  if (s === "Ativo") return "default";
  if (s === "Afastado") return "secondary";
  return "destructive";
}
function isDomingo(dateStr: string) {
  // dateStr YYYY-MM-DD — evitar shift de fuso: parse local
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function calcularValor(dateStr: string, ehFeriado: boolean) {
  const diariaAlta = isDomingo(dateStr) || ehFeriado;
  return { valor_diaria: diariaAlta ? 130 : 100, valor_passagem: 20 };
}

function HomePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [items, setItems] = useState<Diarista[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("lista");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("diaristas").select("*").order("nome");
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as unknown as Diarista[]);
  }

  const filtered = useMemo(() => {
    let list = items;
    if (search.status) list = list.filter(i => i.status === search.status);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(i => i.nome.toLowerCase().includes(q) || i.cpf.includes(q));
    return list;
  }, [items, query, search.status]);

  const selected = useMemo(() => items.find(i => i.id === selectedId) ?? null, [items, selectedId]);

  const stats = useMemo(() => ({
    total: items.length,
    ativos: items.filter(i => i.status === "Ativo").length,
    afastados: items.filter(i => i.status === "Afastado").length,
    bloqueados: items.filter(i => i.status === "Bloqueado").length,
  }), [items]);

  function goStatus(s?: Status) {
    navigate({ to: "/", search: s ? { status: s } : {} });
    setTab("lista");
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Foto deve ter no máximo 10MB");
    // Comprimir para no máx 1600px de largura
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.onload = () => {
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setForm(f => ({ ...f, foto: dataUrl })); return; }
      ctx.drawImage(img, 0, 0, w, h);
      setForm(f => ({ ...f, foto: canvas.toDataURL("image/jpeg", 0.85) }));
    };
    img.onerror = () => setForm(f => ({ ...f, foto: dataUrl }));
    img.src = dataUrl;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    const { error } = await supabase.from("diaristas").insert({
      ...form, foto: form.foto || null, uniforme: form.uniforme as never,
    });
    if (error) return toast.error(error.message);
    toast.success("Diarista cadastrada");
    setForm(empty);
    if (fileRef.current) fileRef.current.value = "";
    setTab("lista");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover este diarista?")) return;
    const { error } = await supabase.from("diaristas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSelectedId(null);
    load();
    toast.success("Removido");
  }

  async function updateSelected(patch: Partial<Diarista>): Promise<void> {
    if (!selected) return;
    const { error } = await supabase.from("diaristas").update(patch as never).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => prev.map(i => i.id === selected.id ? { ...i, ...patch } : i));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-4 border-primary bg-foreground text-background">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Gestão de Diaristas</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} active={!search.status} onClick={() => goStatus(undefined)} />
          <StatCard label="Ativos" value={stats.ativos} active={search.status === "Ativo"} onClick={() => goStatus("Ativo")} />
          <StatCard label="Afastados" value={stats.afastados} active={search.status === "Afastado"} onClick={() => goStatus("Afastado")} />
          <StatCard label="Bloqueados" value={stats.bloqueados} active={search.status === "Bloqueado"} onClick={() => goStatus("Bloqueado")} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="lista"><Users className="h-4 w-4 mr-1" />Diaristas</TabsTrigger>
            <TabsTrigger value="cadastrar"><UserPlus className="h-4 w-4 mr-1" />Cadastrar</TabsTrigger>
            <TabsTrigger value="escala"><CalendarDays className="h-4 w-4 mr-1" />Escala</TabsTrigger>
            <TabsTrigger value="demandas"><ClipboardList className="h-4 w-4 mr-1" />Demandas</TabsTrigger>
            <TabsTrigger value="epis"><Shirt className="h-4 w-4 mr-1" />EPIs</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{search.status ? `Status: ${search.status}` : "Todas as Diaristas"}</CardTitle>
                  <CardDescription>Clique em uma linha para ver todos os dados</CardDescription>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Pesquisar por nome ou CPF..." value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && (
                        <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                      )}
                      {!loading && filtered.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum diarista encontrado.</TableCell></TableRow>
                      )}
                      {filtered.map(c => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(c.id)}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={c.foto ?? undefined} alt={c.nome} />
                              <AvatarFallback className="text-xs">{initials(c.nome)}</AvatarFallback>
                            </Avatar>
                            {c.nome}
                          </TableCell>
                          <TableCell>{c.cpf || "—"}</TableCell>
                          <TableCell>{c.turno}</TableCell>
                          <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cadastrar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Nova Diarista</CardTitle>
                <CardDescription>Preencha os dados abaixo</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={form.foto} alt="preview" />
                      <AvatarFallback>{initials(form.nome) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Label htmlFor="foto">Foto</Label>
                      <Input id="foto" ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="mt-1" />
                    </div>
                  </div>
                  <Field label="Nome" id="nome"><Input id="nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} maxLength={100} required /></Field>
                  <Field label="CPF" id="cpf"><Input id="cpf" value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" /></Field>
                  <Field label="Endereço" id="end" className="sm:col-span-2"><Textarea id="end" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} rows={2} /></Field>
                  <Field label="SC / Localidade" id="loc"><Input id="loc" value={form.localidade} onChange={e => setForm({ ...form, localidade: e.target.value })} /></Field>
                  <Field label="Líder" id="lider"><Input id="lider" value={form.lider} onChange={e => setForm({ ...form, lider: e.target.value })} /></Field>
                  <Field label="Turno" id="turno">
                    <Select value={form.turno} onValueChange={v => setForm({ ...form, turno: v as Turno })}>
                      <SelectTrigger id="turno"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manhã">Manhã</SelectItem>
                        <SelectItem value="Tarde">Tarde</SelectItem>
                        <SelectItem value="Noite">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Telefone" id="tel"><Input id="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: maskTel(e.target.value) })} placeholder="(00) 00000-0000" /></Field>
                  <Field label="Email" id="email"><Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Status" id="status">
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Status })}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Afastado">Afastado</SelectItem>
                        <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setForm(empty)}>Limpar</Button>
                    <Button type="submit"><UserPlus className="mr-2 h-4 w-4" />Cadastrar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="escala" className="mt-4">
            <EscalaTab diaristas={items} />
          </TabsContent>

          <TabsContent value="demandas" className="mt-4">
            <DemandasTab diaristas={items} />
          </TabsContent>

          <TabsContent value="epis" className="mt-4">
            <EpiTab diaristas={items} />
          </TabsContent>
        </Tabs>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && <DetailPanel key={selected.id} d={selected} onSave={updateSelected} onRemove={() => remove(selected.id)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-left rounded-lg border bg-card p-4 transition-colors hover:bg-accent ${active ? "ring-2 ring-primary" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </button>
  );
}

function Field({ label, id, className = "", children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/* ============ DETAIL PANEL (com foto grande, advertências, financeiro) ============ */
function DetailPanel({ d, onSave, onRemove }: { d: Diarista; onSave: (p: Partial<Diarista>) => Promise<void>; onRemove: () => void }) {
  const [local, setLocal] = useState<Diarista>(d);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  const [novaAdv, setNovaAdv] = useState({ data: today(), motivo: "" });

  useEffect(() => { setLocal(d); }, [d.id]);

  const loadFin = useCallback(async () => {
    const [e, a] = await Promise.all([
      supabase.from("escalas").select("*").eq("diarista_id", d.id).order("data", { ascending: false }),
      supabase.from("advertencias").select("*").eq("diarista_id", d.id).order("data", { ascending: false }),
    ]);
    if (!e.error) setEscalas((e.data ?? []) as unknown as Escala[]);
    if (!a.error) setAdvertencias((a.data ?? []) as unknown as Advertencia[]);
  }, [d.id]);

  useEffect(() => { loadFin(); }, [loadFin]);

  function set<K extends keyof Diarista>(k: K, v: Diarista[K]) { setLocal(p => ({ ...p, [k]: v })); }
  function setUni(patch: Uniforme) { setLocal(p => ({ ...p, uniforme: { ...p.uniforme, ...patch } })); }

  async function save() {
    setSaving(true);
    await onSave({
      nome: local.nome, cpf: local.cpf, endereco: local.endereco, localidade: local.localidade,
      lider: local.lider, turno: local.turno, telefone: local.telefone, email: local.email,
      status: local.status, uniforme: local.uniforme,
    });
    setSaving(false);
    toast.success("Salvo");
  }

  async function addAdv() {
    if (!novaAdv.motivo.trim()) return toast.error("Descreva o motivo");
    const { error } = await supabase.from("advertencias").insert({
      diarista_id: d.id, data: novaAdv.data, motivo: novaAdv.motivo.trim(),
    });
    if (error) return toast.error(error.message);
    setNovaAdv({ data: today(), motivo: "" });
    loadFin();
  }
  async function delAdv(id: string) {
    const { error } = await supabase.from("advertencias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadFin();
  }

  const totalReceber = escalas.reduce((sum, e) => sum + Number(e.valor_diaria) + Number(e.valor_passagem), 0);

  const bota = local.uniforme?.bota ?? {};
  const colete = local.uniforme?.colete ?? {};

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
            <Avatar className="h-16 w-16 cursor-zoom-in">
              <AvatarImage src={local.foto ?? undefined} alt={local.nome} />
              <AvatarFallback>{initials(local.nome)}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1">
            <SheetTitle>{local.nome}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(local.status)}>{local.status}</Badge>
                {advertencias.length > 0 && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{advertencias.length} adv.</Badge>
                )}
              </div>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{local.nome}</DialogTitle></DialogHeader>
          {local.foto ? (
            <img src={local.foto} alt={local.nome} className="w-full h-auto rounded-md object-contain" />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Sem foto cadastrada</div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="ficha" className="py-4">
        <TabsList className="w-full">
          <TabsTrigger value="ficha" className="flex-1">Ficha</TabsTrigger>
          <TabsTrigger value="fin" className="flex-1">Financeiro</TabsTrigger>
          <TabsTrigger value="adv" className="flex-1">Advertências</TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="space-y-4 mt-4">
          <Field label="Nome" id="d-nome"><Input id="d-nome" value={local.nome} onChange={e => set("nome", e.target.value)} /></Field>
          <Field label="Endereço" id="d-end"><Textarea id="d-end" value={local.endereco} onChange={e => set("endereco", e.target.value)} rows={2} /></Field>
          <Field label="CPF" id="d-cpf"><Input id="d-cpf" value={local.cpf} onChange={e => set("cpf", maskCPF(e.target.value))} /></Field>
          <Field label="SC / Localidade" id="d-loc"><Input id="d-loc" value={local.localidade} onChange={e => set("localidade", e.target.value)} /></Field>
          <Field label="Líder" id="d-lider"><Input id="d-lider" value={local.lider} onChange={e => set("lider", e.target.value)} /></Field>
          <Field label="Turno" id="d-turno">
            <Select value={local.turno} onValueChange={v => set("turno", v as Turno)}>
              <SelectTrigger id="d-turno"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Manhã">Manhã</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                <SelectItem value="Noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Telefone" id="d-tel"><Input id="d-tel" value={local.telefone} onChange={e => set("telefone", maskTel(e.target.value))} /></Field>
          <Field label="Email" id="d-email"><Input id="d-email" type="email" value={local.email} onChange={e => set("email", e.target.value)} /></Field>
          <Field label="Status" id="d-status">
            <Select value={local.status} onValueChange={v => set("status", v as Status)}>
              <SelectTrigger id="d-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Afastado">Afastado</SelectItem>
                <SelectItem value="Bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="font-medium">Controle de Uniforme</div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Bota</div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <Field label="Tamanho" id="bt-tam">
                  <Input id="bt-tam" value={bota.tamanho ?? ""} onChange={e => setUni({ bota: { ...bota, tamanho: e.target.value } })} placeholder="Ex: 42" />
                </Field>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Checkbox checked={!!bota.entregue} onCheckedChange={v => setUni({ bota: { ...bota, entregue: !!v } })} />Entregue
                </label>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Checkbox checked={!!bota.autorizado_levar} onCheckedChange={v => setUni({ bota: { ...bota, autorizado_levar: !!v } })} />Autorizado a levar
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Colete</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!colete.entregue} onCheckedChange={v => setUni({ colete: { ...colete, entregue: !!v } })} />Entregue
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!colete.autorizado_levar} onCheckedChange={v => setUni({ colete: { ...colete, autorizado_levar: !!v } })} />Autorizado a levar
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="destructive" onClick={onRemove}><Trash2 className="h-4 w-4 mr-1" />Remover</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </TabsContent>

        <TabsContent value="fin" className="mt-4 space-y-3">
          <div className="rounded-lg border p-4 bg-primary/5">
            <div className="text-xs text-muted-foreground uppercase">Total a receber</div>
            <div className="text-2xl font-bold">{fmtBRL(totalReceber)}</div>
            <div className="text-xs text-muted-foreground mt-1">{escalas.length} {escalas.length === 1 ? "dia trabalhado" : "dias trabalhados"}</div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Diária</TableHead>
                  <TableHead>Passag.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalas.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum dia escalado</TableCell></TableRow>
                )}
                {escalas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {fmtDate(e.data)}
                      {(isDomingo(e.data) || e.eh_feriado) && <Badge variant="secondary" className="ml-1 text-[10px]">{e.eh_feriado && !isDomingo(e.data) ? "Feriado" : "Domingo"}</Badge>}
                    </TableCell>
                    <TableCell>{fmtBRL(Number(e.valor_diaria))}</TableCell>
                    <TableCell>{fmtBRL(Number(e.valor_passagem))}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(Number(e.valor_diaria) + Number(e.valor_passagem))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="adv" className="mt-4 space-y-3">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium text-sm">Registrar advertência</div>
            <div className="flex gap-2">
              <Input type="date" value={novaAdv.data} onChange={e => setNovaAdv({ ...novaAdv, data: e.target.value })} className="w-40" />
              <Input placeholder="Motivo" value={novaAdv.motivo} onChange={e => setNovaAdv({ ...novaAdv, motivo: e.target.value })} />
              <Button onClick={addAdv} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            {advertencias.length === 0 && <div className="text-center text-muted-foreground text-sm py-6">Sem advertências</div>}
            {advertencias.map(a => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
                <div>
                  <div className="text-xs text-muted-foreground">{fmtDate(a.data)}</div>
                  <div className="text-sm">{a.motivo}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delAdv(a.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* =========================== ESCALA TAB =========================== */
function EscalaTab({ diaristas }: { diaristas: Diarista[] }) {
  const [data, setData] = useState(today());
  const [ehFeriado, setEhFeriado] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [demandaId, setDemandaId] = useState<string>("nenhuma");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [buscaDiarista, setBuscaDiarista] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, d] = await Promise.all([
      supabase.from("escalas").select("*").eq("data", data).order("created_at"),
      supabase.from("demandas").select("*").order("nome"),
    ]);
    setLoading(false);
    if (e.error) toast.error(e.error.message);
    else setEscalas((e.data ?? []) as unknown as Escala[]);
    if (!d.error) setDemandas((d.data ?? []) as unknown as Demanda[]);
  }, [data]);

  useEffect(() => { load(); setSelecionados(new Set()); }, [load]);

  const escaladosMap = useMemo(() => new Map(escalas.map(e => [e.diarista_id, e])), [escalas]);
  const disponiveis = useMemo(() => {
    const q = buscaDiarista.trim().toLowerCase();
    return diaristas
      .filter(d => !escaladosMap.has(d.id))
      .filter(d => !q || d.nome.toLowerCase().includes(q));
  }, [diaristas, escaladosMap, buscaDiarista]);

  function toggle(id: string) {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleTodos() {
    const elegiveis = disponiveis.filter(d => d.status !== "Bloqueado").map(d => d.id);
    if (elegiveis.every(id => selecionados.has(id))) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(elegiveis));
    }
  }

  async function escalarSelecionados() {
    if (selecionados.size === 0) return toast.error("Selecione ao menos uma diarista");
    const escolhidos = diaristas.filter(d => selecionados.has(d.id));
    const bloqueados = escolhidos.filter(d => d.status === "Bloqueado");
    const validos = escolhidos.filter(d => d.status !== "Bloqueado");
    bloqueados.forEach(b => toast.error(`${b.nome} está bloqueado e não pode ser escalado`));
    if (validos.length === 0) return;
    if (escalas.length + validos.length > 500) {
      return toast.error("Limite de 500 pessoas por dia atingido");
    }
    const { valor_diaria, valor_passagem } = calcularValor(data, ehFeriado);
    const rows = validos.map(v => ({
      diarista_id: v.id,
      demanda_id: demandaId === "nenhuma" ? null : demandaId,
      data, valor_diaria, valor_passagem, eh_feriado: ehFeriado,
    }));
    const { error } = await supabase.from("escalas").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${validos.length} escalado(s)`);
    setSelecionados(new Set());
    load();
  }

  async function desescalar(id: string) {
    const { error } = await supabase.from("escalas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const totalDia = escalas.reduce((s, e) => s + Number(e.valor_diaria) + Number(e.valor_passagem), 0);
  const domingo = isDomingo(data);
  const bloqueadosCount = diaristas.filter(d => d.status === "Bloqueado" && !escaladosMap.has(d.id)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escala do dia</CardTitle>
        <CardDescription>Domingos e feriados: R$ 130 + R$ 20 passagem = R$ 150. Dias normais: R$ 100 + R$ 20 = R$ 120.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data" id="esc-data"><Input id="esc-data" type="date" value={data} onChange={e => setData(e.target.value)} /></Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm h-9">
              <Checkbox checked={ehFeriado} onCheckedChange={v => setEhFeriado(!!v)} />
              É feriado {domingo && <Badge variant="secondary">Domingo</Badge>}
            </label>
          </div>
          <div className="text-right self-end">
            <div className="text-xs text-muted-foreground">Total do dia</div>
            <div className="text-xl font-semibold">{fmtBRL(totalDia)}</div>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-sm">Escalar diaristas (selecione vários)</div>
            {bloqueadosCount > 0 && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{bloqueadosCount} bloqueado(s) na lista</Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar diarista..." value={buscaDiarista} onChange={e => setBuscaDiarista(e.target.value)} className="pl-9" />
            </div>
            <Select value={demandaId} onValueChange={setDemandaId}>
              <SelectTrigger><SelectValue placeholder="Demanda (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem demanda</SelectItem>
                {demandas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {disponiveis.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {diaristas.length === 0 ? "Nenhuma diarista cadastrada" : "Todas já foram escaladas nesse dia"}
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-sm cursor-pointer">
                  <Checkbox
                    checked={disponiveis.filter(d => d.status !== "Bloqueado").every(d => selecionados.has(d.id)) && disponiveis.some(d => d.status !== "Bloqueado")}
                    onCheckedChange={toggleTodos}
                  />
                  Selecionar todos (exceto bloqueados)
                </label>
                {disponiveis.map(d => {
                  const bloq = d.status === "Bloqueado";
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${bloq ? "opacity-60" : ""}`}
                      onClick={(e) => {
                        if (bloq) {
                          e.preventDefault();
                          toast.error(`${d.nome} está bloqueado e não pode ser escalado`);
                        }
                      }}
                    >
                      <Checkbox
                        checked={selecionados.has(d.id)}
                        onCheckedChange={() => {
                          if (bloq) { toast.error(`${d.nome} está bloqueado e não pode ser escalado`); return; }
                          toggle(d.id);
                        }}
                        disabled={bloq}
                      />
                      <Avatar className="h-7 w-7"><AvatarImage src={d.foto ?? undefined} /><AvatarFallback className="text-[10px]">{initials(d.nome)}</AvatarFallback></Avatar>
                      <span className="flex-1">{d.nome}</span>
                      {bloq && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                      {d.status === "Afastado" && <Badge variant="secondary" className="text-[10px]">Afastado</Badge>}
                    </label>
                  );
                })}
              </>
            )}
          </div>

          <Button onClick={escalarSelecionados} disabled={selecionados.size === 0} className="w-full">
            <Plus className="h-4 w-4 mr-1" />Escalar selecionados ({selecionados.size})
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Diarista</TableHead>
                <TableHead>Demanda</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!loading && escalas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Ninguém escalado nesse dia</TableCell></TableRow>}
              {escalas.map((e, i) => {
                const p = diaristas.find(x => x.id === e.diarista_id);
                const dem = demandas.find(x => x.id === e.demanda_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{p?.nome ?? "—"}</TableCell>
                    <TableCell>{dem?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{fmtBRL(Number(e.valor_diaria) + Number(e.valor_passagem))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => desescalar(e.id)}><X className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="text-xs text-muted-foreground text-right">{escalas.length} pessoa(s) nesse dia</div>
      </CardContent>
    </Card>
  );
}

/* =========================== DEMANDAS TAB =========================== */
function DemandasTab({ diaristas }: { diaristas: Diarista[] }) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [nova, setNova] = useState({ nome: "", data_inicio: "", data_fim: "", observacao: "" });
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, e] = await Promise.all([
      supabase.from("demandas").select("*").order("created_at", { ascending: false }),
      supabase.from("escalas").select("*").not("demanda_id", "is", null),
    ]);
    if (!d.error) setDemandas((d.data ?? []) as unknown as Demanda[]);
    if (!e.error) setEscalas((e.data ?? []) as unknown as Escala[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function criar() {
    if (!nova.nome.trim()) return toast.error("Nome da demanda é obrigatório");
    const { error } = await supabase.from("demandas").insert({
      nome: nova.nome.trim(),
      data_inicio: nova.data_inicio || null,
      data_fim: nova.data_fim || null,
      observacao: nova.observacao,
    });
    if (error) return toast.error(error.message);
    setNova({ nome: "", data_inicio: "", data_fim: "", observacao: "" });
    load();
    toast.success("Demanda criada");
  }
  async function remover(id: string) {
    if (!confirm("Excluir demanda? Os dias escalados perderão o vínculo.")) return;
    const { error } = await supabase.from("demandas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selId === id) setSelId(null);
    load();
  }

  const selecionada = demandas.find(d => d.id === selId);
  const escalasDaDemanda = selecionada ? escalas.filter(e => e.demanda_id === selecionada.id) : [];
  const totalDemanda = escalasDaDemanda.reduce((s, e) => s + Number(e.valor_diaria) + Number(e.valor_passagem), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nova demanda</CardTitle>
          <CardDescription>Ex: "Evento X", "Obra Y"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Nome" id="dem-nome"><Input id="dem-nome" value={nova.nome} onChange={e => setNova({ ...nova, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início" id="dem-ini"><Input id="dem-ini" type="date" value={nova.data_inicio} onChange={e => setNova({ ...nova, data_inicio: e.target.value })} /></Field>
            <Field label="Fim" id="dem-fim"><Input id="dem-fim" type="date" value={nova.data_fim} onChange={e => setNova({ ...nova, data_fim: e.target.value })} /></Field>
          </div>
          <Field label="Observação" id="dem-obs"><Textarea id="dem-obs" value={nova.observacao} onChange={e => setNova({ ...nova, observacao: e.target.value })} rows={2} /></Field>
          <Button onClick={criar} className="w-full"><Plus className="h-4 w-4 mr-1" />Criar demanda</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandas</CardTitle>
          <CardDescription>Clique para ver detalhes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {demandas.length === 0 && <div className="text-center text-muted-foreground py-6">Nenhuma demanda</div>}
          {demandas.map(d => {
            const count = escalas.filter(e => e.demanda_id === d.id).length;
            return (
              <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left rounded-md border p-3 hover:bg-accent ${selId === d.id ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.data_inicio ? fmtDate(d.data_inicio) : "—"} → {d.data_fim ? fmtDate(d.data_fim) : "—"}
                    </div>
                  </div>
                  <Badge variant="secondary">{count} dias</Badge>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selecionada && (
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{selecionada.nome}</CardTitle>
              <CardDescription>Total gasto na demanda: <strong>{fmtBRL(totalDemanda)}</strong> · {escalasDaDemanda.length} escala(s)</CardDescription>
            </div>
            <Button variant="destructive" size="sm" onClick={() => remover(selecionada.id)}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <BulkEscalarDemanda
              demanda={selecionada}
              diaristas={diaristas}
              onDone={load}
            />
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Diarista</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalasDaDemanda.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Ninguém escalado ainda. Use o formulário acima ou a aba Escala.</TableCell></TableRow>}
                  {escalasDaDemanda
                    .slice()
                    .sort((a, b) => a.data.localeCompare(b.data))
                    .map(e => {
                      const p = diaristas.find(x => x.id === e.diarista_id);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>{fmtDate(e.data)} {(isDomingo(e.data) || e.eh_feriado) && <Badge variant="secondary" className="ml-1 text-[10px]">{e.eh_feriado && !isDomingo(e.data) ? "Feriado" : "Domingo"}</Badge>}</TableCell>
                          <TableCell>{p?.nome ?? "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(e.valor_diaria) + Number(e.valor_passagem))}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---- Bulk escalar dentro da demanda (múltiplos diaristas × múltiplos dias) ---- */
function BulkEscalarDemanda({ demanda, diaristas, onDone }: { demanda: Demanda; diaristas: Diarista[]; onDone: () => void }) {
  const [inicio, setInicio] = useState(demanda.data_inicio ?? today());
  const [fim, setFim] = useState(demanda.data_fim ?? demanda.data_inicio ?? today());
  const [modo, setModo] = useState<"todos" | "uteis" | "domingos">("todos");
  const [ehFeriado, setEhFeriado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return diaristas.filter(d => !q || d.nome.toLowerCase().includes(q));
  }, [diaristas, busca]);

  function gerarDias(): string[] {
    if (!inicio || !fim) return [];
    const [y1, m1, d1] = inicio.split("-").map(Number);
    const [y2, m2, d2] = fim.split("-").map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    if (end < start) return [];
    const dias: string[] = [];
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const dow = dt.getDay();
      if (modo === "uteis" && (dow === 0 || dow === 6)) continue;
      if (modo === "domingos" && dow !== 0) continue;
      dias.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
    }
    return dias;
  }

  function toggle(id: string) {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function escalarBulk() {
    const dias = gerarDias();
    if (dias.length === 0) return toast.error("Intervalo de datas inválido");
    if (selecionados.size === 0) return toast.error("Selecione ao menos uma diarista");
    const escolhidos = diaristas.filter(d => selecionados.has(d.id));
    const bloqueados = escolhidos.filter(d => d.status === "Bloqueado");
    const validos = escolhidos.filter(d => d.status !== "Bloqueado");
    bloqueados.forEach(b => toast.error(`${b.nome} está bloqueado e não pode ser escalado`));
    if (validos.length === 0) return;

    setEnviando(true);
    // Buscar escalas já existentes nesse intervalo para os diaristas selecionados (evitar violação de unique)
    const { data: jaExistem } = await supabase
      .from("escalas")
      .select("diarista_id, data")
      .in("diarista_id", validos.map(v => v.id))
      .in("data", dias);
    const existentes = new Set((jaExistem ?? []).map(x => `${x.diarista_id}|${x.data}`));

    const rows: Array<{ diarista_id: string; demanda_id: string; data: string; valor_diaria: number; valor_passagem: number; eh_feriado: boolean }> = [];
    for (const dia of dias) {
      const { valor_diaria, valor_passagem } = calcularValor(dia, ehFeriado);
      for (const v of validos) {
        if (existentes.has(`${v.id}|${dia}`)) continue;
        rows.push({
          diarista_id: v.id,
          demanda_id: demanda.id,
          data: dia,
          valor_diaria, valor_passagem,
          eh_feriado: ehFeriado && isDomingo(dia) === false ? true : ehFeriado,
        });
      }
    }

    if (rows.length === 0) {
      setEnviando(false);
      return toast.error("Todos já estavam escalados nesses dias");
    }
    const { error } = await supabase.from("escalas").insert(rows);
    setEnviando(false);
    if (error) return toast.error(error.message);
    const puladas = validos.length * dias.length - rows.length;
    toast.success(`${rows.length} escala(s) criada(s)${puladas > 0 ? ` (${puladas} já existiam)` : ""}`);
    setSelecionados(new Set());
    onDone();
  }

  const preview = gerarDias();

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="font-medium text-sm">Escalar em lote nessa demanda</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="De" id="bd-ini"><Input id="bd-ini" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
        <Field label="Até" id="bd-fim"><Input id="bd-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} /></Field>
        <Field label="Dias" id="bd-mod">
          <Select value={modo} onValueChange={v => setModo(v as typeof modo)}>
            <SelectTrigger id="bd-mod"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os dias</SelectItem>
              <SelectItem value="uteis">Só dias úteis (seg–sex)</SelectItem>
              <SelectItem value="domingos">Só domingos</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm h-9">
            <Checkbox checked={ehFeriado} onCheckedChange={v => setEhFeriado(!!v)} />
            Marcar todos como feriado
          </label>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar diarista..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border bg-background">
        {lista.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma diarista</div>}
        {lista.map(d => {
          const bloq = d.status === "Bloqueado";
          return (
            <label
              key={d.id}
              className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40 cursor-pointer ${bloq ? "opacity-60" : ""}`}
            >
              <Checkbox
                checked={selecionados.has(d.id)}
                onCheckedChange={() => {
                  if (bloq) { toast.error(`${d.nome} está bloqueado e não pode ser escalado`); return; }
                  toggle(d.id);
                }}
                disabled={bloq}
              />
              <span className="flex-1">{d.nome}</span>
              {bloq && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
              {d.status === "Afastado" && <Badge variant="secondary" className="text-[10px]">Afastado</Badge>}
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {preview.length} dia(s) × {selecionados.size} diarista(s) = <strong>{preview.length * selecionados.size}</strong> escala(s)
        </div>
        <Button onClick={escalarBulk} disabled={enviando || selecionados.size === 0 || preview.length === 0}>
          <Plus className="h-4 w-4 mr-1" />{enviando ? "Escalando..." : "Escalar em lote"}
        </Button>
      </div>
    </div>
  );
}


/* =========================== EPI TAB =========================== */
function EpiTab({ diaristas }: { diaristas: Diarista[] }) {
  const [estoque, setEstoque] = useState<EpiEstoque[]>([]);
  const [entregas, setEntregas] = useState<EpiEntrega[]>([]);
  const [novo, setNovo] = useState({ tipo: "bota" as EpiTipo, tamanho: "", quantidade: 1 });
  const [entrega, setEntrega] = useState({ tipo: "bota" as EpiTipo, tamanho: "", diarista_id: "" });

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([
      supabase.from("epi_estoque").select("*").order("tipo").order("tamanho"),
      supabase.from("epi_entregas").select("*").order("entregue_em", { ascending: false }),
    ]);
    if (!s.error) setEstoque((s.data ?? []) as unknown as EpiEstoque[]);
    if (!e.error) setEntregas((e.data ?? []) as unknown as EpiEntrega[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const ativas = useMemo(() => entregas.filter(e => !e.devolvido_em), [entregas]);
  function emUso(tipo: EpiTipo, tamanho: string) {
    return ativas.filter(e => e.tipo === tipo && e.tamanho === tamanho);
  }

  async function addEstoque() {
    if (!novo.tamanho.trim()) return toast.error("Informe o tamanho");
    if (novo.quantidade < 1) return toast.error("Quantidade inválida");
    const existente = estoque.find(x => x.tipo === novo.tipo && x.tamanho === novo.tamanho.trim());
    if (existente) {
      const { error } = await supabase.from("epi_estoque").update({
        quantidade_total: existente.quantidade_total + novo.quantidade,
      }).eq("id", existente.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("epi_estoque").insert({
        tipo: novo.tipo, tamanho: novo.tamanho.trim(), quantidade_total: novo.quantidade,
      });
      if (error) return toast.error(error.message);
    }
    setNovo({ tipo: novo.tipo, tamanho: "", quantidade: 1 });
    load();
  }
  async function setQtd(row: EpiEstoque, delta: number) {
    const q = Math.max(0, row.quantidade_total + delta);
    const emUsoCount = emUso(row.tipo, row.tamanho).length;
    if (q < emUsoCount) return toast.error(`Não dá para reduzir: ${emUsoCount} em uso`);
    const { error } = await supabase.from("epi_estoque").update({ quantidade_total: q }).eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  }
  async function delEstoque(id: string) {
    if (!confirm("Remover esse item do estoque?")) return;
    const { error } = await supabase.from("epi_estoque").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function registrarEntrega() {
    if (!entrega.tamanho || !entrega.diarista_id) return toast.error("Preencha tamanho e diarista");
    const row = estoque.find(x => x.tipo === entrega.tipo && x.tamanho === entrega.tamanho);
    if (!row) return toast.error("Tamanho não cadastrado no estoque");
    const disponivel = row.quantidade_total - emUso(row.tipo, row.tamanho).length;
    if (disponivel < 1) return toast.error("Sem estoque disponível");
    const { error } = await supabase.from("epi_entregas").insert({
      tipo: entrega.tipo, tamanho: entrega.tamanho, diarista_id: entrega.diarista_id,
    });
    if (error) return toast.error(error.message);
    setEntrega({ ...entrega, tamanho: "", diarista_id: "" });
    load();
    toast.success("Entrega registrada");
  }
  async function devolver(id: string) {
    const { error } = await supabase.from("epi_entregas").update({ devolvido_em: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  function renderEstoque(tipo: EpiTipo) {
    const lista = estoque.filter(e => e.tipo === tipo);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{tipo === "bota" ? "Botas" : "Coletes"}</CardTitle>
          <CardDescription>Estoque por tamanho, disponível e em uso</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tamanho</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Em uso</TableHead>
                <TableHead>Disponível</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum tamanho cadastrado</TableCell></TableRow>}
              {lista.map(r => {
                const u = emUso(r.tipo, r.tamanho).length;
                const disp = r.quantidade_total - u;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.tamanho}</TableCell>
                    <TableCell>{r.quantidade_total}</TableCell>
                    <TableCell>{u}</TableCell>
                    <TableCell>
                      <Badge variant={disp === 0 ? "destructive" : "default"}>{disp}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setQtd(r, -1)}><X className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setQtd(r, 1)}><Plus className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => delEstoque(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar ao estoque</CardTitle>
          <CardDescription>Ex: 4 botas tamanho 42</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_140px_auto]">
            <Select value={novo.tipo} onValueChange={v => setNovo({ ...novo, tipo: v as EpiTipo })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bota">Bota</SelectItem>
                <SelectItem value="colete">Colete</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={novo.tipo === "bota" ? "Tamanho (ex: 42)" : "Tamanho (ex: M)"} value={novo.tamanho} onChange={e => setNovo({ ...novo, tamanho: e.target.value })} />
            <Input type="number" min={1} value={novo.quantidade} onChange={e => setNovo({ ...novo, quantidade: Number(e.target.value) || 1 })} />
            <Button onClick={addEstoque}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {renderEstoque("bota")}
        {renderEstoque("colete")}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar entrega</CardTitle>
          <CardDescription>Marque a bota/colete que uma diarista está usando</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[140px_140px_1fr_auto]">
            <Select value={entrega.tipo} onValueChange={v => setEntrega({ ...entrega, tipo: v as EpiTipo, tamanho: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bota">Bota</SelectItem>
                <SelectItem value="colete">Colete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entrega.tamanho} onValueChange={v => setEntrega({ ...entrega, tamanho: v })}>
              <SelectTrigger><SelectValue placeholder="Tamanho" /></SelectTrigger>
              <SelectContent>
                {estoque.filter(e => e.tipo === entrega.tipo).map(e => (
                  <SelectItem key={e.id} value={e.tamanho}>{e.tamanho} ({e.quantidade_total - emUso(e.tipo, e.tamanho).length} disp.)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entrega.diarista_id} onValueChange={v => setEntrega({ ...entrega, diarista_id: v })}>
              <SelectTrigger><SelectValue placeholder="Diarista" /></SelectTrigger>
              <SelectContent>
                {diaristas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={registrarEntrega}><Plus className="h-4 w-4 mr-1" />Entregar</Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Com quem</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ativas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum item em uso</TableCell></TableRow>}
                {ativas.map(e => {
                  const p = diaristas.find(x => x.id === e.diarista_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="capitalize">{e.tipo}</TableCell>
                      <TableCell>{e.tamanho}</TableCell>
                      <TableCell>{p?.nome ?? "—"}</TableCell>
                      <TableCell>{new Date(e.entregue_em).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => devolver(e.id)}>Devolver</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
