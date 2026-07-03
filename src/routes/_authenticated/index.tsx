import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, Trash2, Users, Save, CalendarDays, ClipboardList, Shirt, Plus, X, AlertTriangle, ShieldCheck, LogOut } from "lucide-react";
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
type Sexo = "M" | "F" | "";
type EpiTipo = "bota" | "colete";
type MainTab = "lista" | "cadastrar" | "escala" | "demandas" | "epis";
type DetailTab = "ficha" | "fin" | "adv";

interface Uniforme {
  bota?: { tamanho?: string; entregue?: boolean; autorizado_levar?: boolean };
  colete?: { entregue?: boolean; autorizado_levar?: boolean };
}
interface Diarista {
  id: string; nome: string; cpf: string; endereco: string; localidade: string; lider: string;
  turno: Turno; telefone: string; email: string; status: Status; sexo: Sexo; foto: string | null; uniforme: Uniforme;
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
  status: "Ativo" as Status, sexo: "" as Sexo, foto: "", uniforme: {} as Uniforme,
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
  return (name ?? "").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}
function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}
function asStatus(v: unknown): Status {
  return v === "Ativo" || v === "Afastado" || v === "Bloqueado" ? v : "Ativo";
}
function asTurno(v: unknown): Turno {
  return v === "Manhã" || v === "Tarde" || v === "Noite" ? v : "Manhã";
}
function asSexo(v: unknown): Sexo {
  return v === "M" || v === "F" ? v : "";
}
function normalizeDiarista(row: Partial<Diarista> & Record<string, unknown>): Diarista {
  return {
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    cpf: String(row.cpf ?? ""),
    endereco: String(row.endereco ?? ""),
    localidade: String(row.localidade ?? ""),
    lider: String(row.lider ?? ""),
    turno: asTurno(row.turno),
    telefone: String(row.telefone ?? ""),
    email: String(row.email ?? ""),
    status: asStatus(row.status),
    sexo: asSexo(row.sexo),
    foto: typeof row.foto === "string" && row.foto ? row.foto : null,
    uniforme: row.uniforme && typeof row.uniforme === "object" ? row.uniforme as Uniforme : {},
  };
}
function statusVariant(s: Status): "default" | "secondary" | "destructive" | "outline" {
  if (s === "Ativo") return "default";
  if (s === "Afastado") return "secondary";
  return "destructive";
}
function isDomingo(dateStr: string | null | undefined) {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.includes("-")) return false;
  // dateStr YYYY-MM-DD — evitar shift de fuso: parse local
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 0;
}
function fmtBRL(n: number) {
  const value = Number.isFinite(Number(n)) ? Number(n) : 0;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "—";
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
function parseISOLocal(iso: string): Date | null {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Semana: segunda→domingo. Pagamento: segunda-feira 8 dias após o fim (ex: 22/06 a 28/06 paga 06/07).
function semanaInfo(iso: string) {
  const d = parseISOLocal(iso);
  if (!d) return { inicio: "", fim: "", pagamento: "", chave: "" };
  // getDay(): 0=Dom, 1=Seg... queremos início na segunda-feira
  const dow = d.getDay();
  const offset = (dow + 6) % 7; // Seg=0, Ter=1,... Dom=6
  const inicio = new Date(d); inicio.setDate(d.getDate() - offset);
  const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); // domingo
  const pagamento = new Date(fim); pagamento.setDate(fim.getDate() + 8); // segunda seguinte + 1 semana
  return { inicio: toISO(inicio), fim: toISO(fim), pagamento: toISO(pagamento), chave: toISO(inicio) };
}
function useTabRuntimeGuard(title: string) {
  useEffect(() => {
    const protect = (error: unknown) => {
      console.error(`Erro protegido na aba ${title}`, error);
      toast.error(`A aba ${title} foi protegida contra uma falha.`);
    };
    const onError = (event: ErrorEvent) => {
      protect(event.error ?? event.message);
      event.preventDefault();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      protect(event.reason);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [title]);
}
function normalizeDemanda(row: Partial<Demanda> & Record<string, unknown>): Demanda {
  return {
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    data_inicio: typeof row.data_inicio === "string" && row.data_inicio ? row.data_inicio : null,
    data_fim: typeof row.data_fim === "string" && row.data_fim ? row.data_fim : null,
    observacao: String(row.observacao ?? ""),
  };
}
function normalizeEscala(row: Partial<Escala> & Record<string, unknown>): Escala {
  return {
    id: String(row.id ?? ""),
    diarista_id: String(row.diarista_id ?? ""),
    demanda_id: typeof row.demanda_id === "string" && row.demanda_id ? row.demanda_id : null,
    data: typeof row.data === "string" && row.data ? row.data : today(),
    valor_diaria: Number(row.valor_diaria ?? 0),
    valor_passagem: Number(row.valor_passagem ?? 0),
    eh_feriado: Boolean(row.eh_feriado),
    observacao: String(row.observacao ?? ""),
  };
}

class TabErrorBoundary extends Component<{ tabKey: string; title: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`Erro protegido na aba ${this.props.title}`, error);
    toast.error(`A aba ${this.props.title} foi protegida contra uma falha.`);
  }

  componentDidUpdate(prevProps: { tabKey: string }) {
    if (prevProps.tabKey !== this.props.tabKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Aba protegida</CardTitle>
          <CardDescription>O sistema impediu que uma falha na aba {this.props.title} derrubasse o site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => this.setState({ hasError: false })}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }
}

function HomePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [items, setItems] = useState<Diarista[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MainTab>("lista");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    supabase.rpc("my_access_status" as never).then(({ data }) => {
      setIsAdmin(String(data ?? "") === "admin");
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function load() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("diaristas").select("*").order("nome");
      if (error) return toast.error(error.message);
      setItems(((data ?? []) as Array<Partial<Diarista> & Record<string, unknown>>).map(normalizeDiarista));
    } catch (error) {
      toast.error("Falha ao carregar diaristas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = items || [];
    if (search.status) list = list.filter(i => i.status === search.status);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(i => safeLower(i.nome).includes(q) || String(i.cpf ?? "").includes(q));
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
    try {
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
        try {
          const maxW = 1600;
          const scale = Math.min(1, maxW / Math.max(img.width, 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { setForm(f => ({ ...f, foto: dataUrl })); return; }
          ctx.drawImage(img, 0, 0, w, h);
          setForm(f => ({ ...f, foto: canvas.toDataURL("image/jpeg", 0.85) }));
        } catch (error) {
          console.error(error);
          setForm(f => ({ ...f, foto: dataUrl }));
        }
      };
      img.onerror = () => setForm(f => ({ ...f, foto: dataUrl }));
      img.src = dataUrl;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar a foto");
    }
  }

  async function add(e: React.FormEvent) {
    try {
      e.preventDefault();
      if (!form.nome.trim()) return toast.error("Nome é obrigatório");
      if (form.sexo !== "M" && form.sexo !== "F") return toast.error("Selecione o sexo (Masculino ou Feminino)");
      const cpfDigits = String(form.cpf || "").replace(/\D/g, "");
      if (cpfDigits) {
        const { data: existing } = await supabase.from("diaristas").select("id").eq("cpf", form.cpf).maybeSingle();
        if (existing) return toast.error("Usuário já cadastrado");
      }
      const { error } = await supabase.from("diaristas").insert({
        ...form, foto: form.foto || null, uniforme: form.uniforme as never,
      } as never);
      if (error) {
        if (String(error.message || "").toLowerCase().includes("duplicate")) return toast.error("Usuário já cadastrado");
        return toast.error("Não foi possível cadastrar", { description: error.message });
      }
      toast.success("Diarista cadastrada");
      setForm(empty);
      if (fileRef.current) fileRef.current.value = "";
      setTab("lista");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível cadastrar. Tente novamente.");
    }
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
          {isAdmin && (
            <Link to="/admin">
              <Button size="sm" variant="secondary"><ShieldCheck className="h-4 w-4 mr-1" />Admin</Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Sair</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} active={!search.status} onClick={() => goStatus(undefined)} />
          <StatCard label="Ativos" value={stats.ativos} active={search.status === "Ativo"} onClick={() => goStatus("Ativo")} />
          <StatCard label="Afastados" value={stats.afastados} active={search.status === "Afastado"} onClick={() => goStatus("Afastado")} />
          <StatCard label="Bloqueados" value={stats.bloqueados} active={search.status === "Bloqueado"} onClick={() => goStatus("Bloqueado")} />
        </div>

        <div className="space-y-4">
          <div className="inline-flex h-auto flex-wrap items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground" role="tablist" aria-label="Navegação principal">
            <MainTabButton active={tab === "lista"} onClick={() => setTab("lista")}><Users className="h-4 w-4 mr-1" />Diaristas</MainTabButton>
            <MainTabButton active={tab === "cadastrar"} onClick={() => setTab("cadastrar")}><UserPlus className="h-4 w-4 mr-1" />Cadastrar</MainTabButton>
            <MainTabButton active={tab === "escala"} onClick={() => setTab("escala")}><CalendarDays className="h-4 w-4 mr-1" />Escala</MainTabButton>
            <MainTabButton active={tab === "demandas"} onClick={() => setTab("demandas")}><ClipboardList className="h-4 w-4 mr-1" />Demandas</MainTabButton>
            <MainTabButton active={tab === "epis"} onClick={() => setTab("epis")}><Shirt className="h-4 w-4 mr-1" />EPIs</MainTabButton>
          </div>

          {tab === "lista" && (
            <TabErrorBoundary tabKey={`${tab}-lista`} title="Diaristas">
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
            </TabErrorBoundary>
          )}

          {tab === "cadastrar" && (
            <TabErrorBoundary tabKey={`${tab}-cadastrar`} title="Cadastrar">
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
                    <select id="turno" value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value as Turno })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noite">Noite</option>
                    </select>
                  </Field>
                  <Field label="Telefone" id="tel"><Input id="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: maskTel(e.target.value) })} placeholder="(00) 00000-0000" /></Field>
                  <Field label="Email" id="email"><Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Sexo *" id="sexo">
                    <select id="sexo" value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value as Sexo })} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Selecione...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </Field>
                  <Field label="Status" id="status">
                    <select id="status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="Ativo">Ativo</option>
                      <option value="Afastado">Afastado</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </Field>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setForm(empty)}>Limpar</Button>
                    <Button type="submit"><UserPlus className="mr-2 h-4 w-4" />Cadastrar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            </TabErrorBoundary>
          )}

          {tab === "escala" && (
            <TabErrorBoundary tabKey={`${tab}-escala`} title="Escala"><EscalaTab diaristas={items} /></TabErrorBoundary>
          )}

          {tab === "demandas" && (
            <TabErrorBoundary tabKey={`${tab}-demandas`} title="Demandas"><DemandasTab diaristas={items} /></TabErrorBoundary>
          )}

          {tab === "epis" && (
            <TabErrorBoundary tabKey={`${tab}-epis`} title="EPIs"><EpiTab diaristas={items} /></TabErrorBoundary>
          )}
        </div>
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

function MainTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "bg-background text-foreground shadow" : "hover:bg-background/60"}`}
    >
      {children}
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
  const [detailTab, setDetailTab] = useState<DetailTab>("ficha");
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  const [novaAdv, setNovaAdv] = useState({ data: today(), motivo: "" });

  useEffect(() => { setLocal(d); }, [d.id]);

  const loadFin = useCallback(async () => {
    try {
      const [e, a] = await Promise.all([
        supabase.from("escalas").select("*").eq("diarista_id", d.id).order("data", { ascending: false }),
        supabase.from("advertencias").select("*").eq("diarista_id", d.id).order("data", { ascending: false }),
      ]);
      if (!e.error) setEscalas(((e.data ?? []) as Array<Partial<Escala> & Record<string, unknown>>).map(normalizeEscala));
      if (!a.error) setAdvertencias((a.data ?? []) as unknown as Advertencia[]);
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar ficha financeira");
    }
  }, [d.id]);

  useEffect(() => { loadFin(); }, [loadFin]);

  function set<K extends keyof Diarista>(k: K, v: Diarista[K]) { setLocal(p => ({ ...p, [k]: v })); }
  function setUni(patch: Uniforme) { setLocal(p => ({ ...p, uniforme: { ...p.uniforme, ...patch } })); }

  async function save() {
    if (local.sexo !== "M" && local.sexo !== "F") {
      toast.error("Selecione o sexo (Masculino ou Feminino)");
      return;
    }
    setSaving(true);
    await onSave({
      nome: local.nome, cpf: local.cpf, endereco: local.endereco, localidade: local.localidade,
      lider: local.lider, turno: local.turno, telefone: local.telefone, email: local.email,
      status: local.status, sexo: local.sexo, uniforme: local.uniforme,
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

      <div className="py-4">
        <div className="grid w-full grid-cols-3 rounded-lg bg-muted p-1 text-muted-foreground" role="tablist" aria-label="Abas da ficha">
          <button type="button" role="tab" aria-selected={detailTab === "ficha"} onClick={() => setDetailTab("ficha")} className={`rounded-md px-3 py-1 text-sm font-medium ${detailTab === "ficha" ? "bg-background text-foreground shadow" : "hover:bg-background/60"}`}>Ficha</button>
          <button type="button" role="tab" aria-selected={detailTab === "fin"} onClick={() => setDetailTab("fin")} className={`rounded-md px-3 py-1 text-sm font-medium ${detailTab === "fin" ? "bg-background text-foreground shadow" : "hover:bg-background/60"}`}>Financeiro</button>
          <button type="button" role="tab" aria-selected={detailTab === "adv"} onClick={() => setDetailTab("adv")} className={`rounded-md px-3 py-1 text-sm font-medium ${detailTab === "adv" ? "bg-background text-foreground shadow" : "hover:bg-background/60"}`}>Advertências</button>
        </div>

        {detailTab === "ficha" && <div className="space-y-4 mt-4">
          <Field label="Nome" id="d-nome"><Input id="d-nome" value={local.nome} onChange={e => set("nome", e.target.value)} /></Field>
          <Field label="Endereço" id="d-end"><Textarea id="d-end" value={local.endereco} onChange={e => set("endereco", e.target.value)} rows={2} /></Field>
          <Field label="CPF" id="d-cpf"><Input id="d-cpf" value={local.cpf} onChange={e => set("cpf", maskCPF(e.target.value))} /></Field>
          <Field label="SC / Localidade" id="d-loc"><Input id="d-loc" value={local.localidade} onChange={e => set("localidade", e.target.value)} /></Field>
          <Field label="Líder" id="d-lider"><Input id="d-lider" value={local.lider} onChange={e => set("lider", e.target.value)} /></Field>
          <Field label="Turno" id="d-turno">
            <select id="d-turno" value={local.turno} onChange={e => set("turno", e.target.value as Turno)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
            </select>
          </Field>
          <Field label="Telefone" id="d-tel"><Input id="d-tel" value={local.telefone} onChange={e => set("telefone", maskTel(e.target.value))} /></Field>
          <Field label="Email" id="d-email"><Input id="d-email" type="email" value={local.email} onChange={e => set("email", e.target.value)} /></Field>
          <Field label="Status" id="d-status">
            <select id="d-status" value={local.status} onChange={e => set("status", e.target.value as Status)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="Ativo">Ativo</option>
              <option value="Afastado">Afastado</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>
          </Field>
          <Field label="Sexo *" id="d-sexo">
            <select id="d-sexo" value={local.sexo} onChange={e => set("sexo", e.target.value as Sexo)} className={`flex h-9 w-full rounded-md border ${local.sexo ? "border-input" : "border-destructive"} bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}>
              <option value="">Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
            {!local.sexo && <div className="text-xs text-destructive">Obrigatório</div>}
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
        </div>}

        {detailTab === "fin" && (() => {
          // Agrupar por semana (Dom-Sáb)
          type Grupo = { chave: string; inicio: string; fim: string; pagamento: string; itens: Escala[]; total: number };
          const mapa = new Map<string, Grupo>();
          for (const e of escalas) {
            const info = semanaInfo(e.data);
            if (!info.chave) continue;
            let g = mapa.get(info.chave);
            if (!g) {
              g = { chave: info.chave, inicio: info.inicio, fim: info.fim, pagamento: info.pagamento, itens: [], total: 0 };
              mapa.set(info.chave, g);
            }
            g.itens.push(e);
            g.total += Number(e.valor_diaria) + Number(e.valor_passagem);
          }
          const grupos = Array.from(mapa.values()).sort((a, b) => b.chave.localeCompare(a.chave));
          return (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border p-4 bg-primary/5">
                <div className="text-xs text-muted-foreground uppercase">Total a receber</div>
                <div className="text-2xl font-bold">{fmtBRL(totalReceber)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {escalas.length} {escalas.length === 1 ? "dia trabalhado" : "dias trabalhados"} · {grupos.length} semana{grupos.length === 1 ? "" : "s"}
                </div>
              </div>
              {grupos.length === 0 && (
                <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">Nenhum dia escalado</div>
              )}
              {grupos.map(g => (
                <div key={g.chave} className="rounded-lg border overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 px-3 py-2 border-b">
                    <div className="text-sm font-medium">Semana {fmtDate(g.inicio)} – {fmtDate(g.fim)}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{g.itens.length} dia(s)</Badge>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Pagar em {fmtDate(g.pagamento)}</Badge>
                      <span className="font-semibold">{fmtBRL(g.total)}</span>
                    </div>
                  </div>
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
                      {g.itens.map(e => (
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
              ))}
            </div>
          );
        })()}

        {detailTab === "adv" && <div className="mt-4 space-y-3">
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
        </div>}
      </div>
    </>
  );
}

/* =========================== ESCALA TAB =========================== */
function EscalaTab({ diaristas }: { diaristas: Diarista[] }) {
  useTabRuntimeGuard("Escala");
  const diaristasSafe = Array.isArray(diaristas) ? diaristas : [];
  const [data, setData] = useState(today());
  const [ehFeriado, setEhFeriado] = useState(false);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [demandaId, setDemandaId] = useState<string>("nenhuma");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [buscaDiarista, setBuscaDiarista] = useState("");
  const [loading, setLoading] = useState(false);

  const [demandaEscaladosIds, setDemandaEscaladosIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [e, d] = await Promise.all([
        supabase.from("escalas").select("*").eq("data", data).order("created_at"),
        supabase.from("demandas").select("*").order("nome"),
      ]);
      if (e.error) toast.error("Falha ao carregar escala", { description: e.error.message });
      else setEscalas(((e.data ?? []) as Array<Partial<Escala> & Record<string, unknown>>).map(normalizeEscala));
      if (d.error) toast.error("Falha ao carregar demandas", { description: d.error.message });
      else setDemandas(((d.data ?? []) as Array<Partial<Demanda> & Record<string, unknown>>).map(normalizeDemanda));
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar escala");
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => { load(); setSelecionados(new Set()); }, [load]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (demandaId === "nenhuma") { setDemandaEscaladosIds(new Set()); return; }
      const { data: rows } = await supabase.from("escalas").select("diarista_id").eq("demanda_id", demandaId);
      if (cancel) return;
      setDemandaEscaladosIds(new Set((rows ?? []).map(r => String(r.diarista_id))));
    })();
    return () => { cancel = true; };
  }, [demandaId, escalas]);

  const escalasSafe = Array.isArray(escalas) ? escalas : [];
  const demandasSafe = Array.isArray(demandas) ? demandas : [];
  const escaladosMap = useMemo(() => new Map(escalasSafe.map(e => [e.diarista_id, e])), [escalasSafe]);
  const disponiveis = useMemo(() => {
    const q = buscaDiarista.trim().toLowerCase();
    return diaristasSafe
      .filter(d => !escaladosMap.has(d.id))
      .filter(d => !demandaEscaladosIds.has(d.id))
      .filter(d => !q || safeLower(d.nome).includes(q));
  }, [diaristasSafe, escaladosMap, demandaEscaladosIds, buscaDiarista]);


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
    try {
      if (selecionados.size === 0) return toast.error("Selecione ao menos uma diarista");
      const escolhidos = diaristasSafe.filter(d => selecionados.has(d.id));
      const bloqueados = escolhidos.filter(d => d.status === "Bloqueado");
      const validos = escolhidos.filter(d => d.status !== "Bloqueado");
      bloqueados.forEach(b => toast.error(`${b.nome} bloqueado`));
      if (validos.length === 0) return;
      if (escalasSafe.length + validos.length > 500) {
        return toast.error("Limite de 500 pessoas por dia atingido");
      }
      const { valor_diaria, valor_passagem } = calcularValor(data, ehFeriado);
      const rows = validos.map(v => ({
        diarista_id: v.id,
        demanda_id: demandaId === "nenhuma" ? null : demandaId,
        data, valor_diaria, valor_passagem, eh_feriado: ehFeriado,
        observacao: "",
      }));
      const { error } = await supabase.from("escalas").insert(rows);
      if (error) return toast.error("Não foi possível escalar", { description: error.message });
      toast.success(`${validos.length} escalado(s)`);
      setSelecionados(new Set());
      load();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível escalar. Tente novamente.");
    }
  }

  async function desescalar(id: string) {
    try {
      const { error } = await supabase.from("escalas").delete().eq("id", id);
      if (error) return toast.error(error.message);
      load();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível remover da escala");
    }
  }

  const totalDia = escalasSafe.reduce((s, e) => s + Number(e.valor_diaria) + Number(e.valor_passagem), 0);
  const domingo = isDomingo(data);
  const bloqueadosCount = diaristasSafe.filter(d => d.status === "Bloqueado" && !escaladosMap.has(d.id)).length;

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
            <select value={demandaId} onChange={e => setDemandaId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="nenhuma">Sem demanda</option>
              {demandasSafe.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {disponiveis.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {diaristasSafe.length === 0 ? "Nenhuma diarista cadastrada" : "Todas já foram escaladas nesse dia"}
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
                          toast.error(`${d.nome} bloqueado`);
                        }
                      }}
                    >
                      <Checkbox
                        checked={selecionados.has(d.id)}
                        onCheckedChange={() => {
                          if (bloq) { toast.error(`${d.nome} bloqueado`); return; }
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

          {selecionados.size > 0 && (() => {
            const sel = diaristasSafe.filter(d => selecionados.has(d.id));
            const m = sel.filter(d => d.sexo === "M").length;
            const f = sel.filter(d => d.sexo === "F").length;
            const semSexo = sel.length - m - f;
            return (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="gap-1">Total: {sel.length}</Badge>
                <Badge className="bg-blue-500 hover:bg-blue-500 text-white gap-1">♂ {m} homem{m === 1 ? "" : "s"}</Badge>
                <Badge className="bg-pink-500 hover:bg-pink-500 text-white gap-1">♀ {f} mulher{f === 1 ? "" : "es"}</Badge>
                {semSexo > 0 && <Badge variant="destructive">{semSexo} sem sexo</Badge>}
              </div>
            );
          })()}

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
              {!loading && escalasSafe.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Ninguém escalado nesse dia</TableCell></TableRow>}
              {escalasSafe.map((e, i) => {
                const p = diaristasSafe.find(x => x.id === e.diarista_id);
                const dem = demandasSafe.find(x => x.id === e.demanda_id);
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
        {escalasSafe.length > 0 && (() => {
          const escalados = escalasSafe.map(e => diaristasSafe.find(d => d.id === e.diarista_id)).filter(Boolean) as Diarista[];
          const m = escalados.filter(d => d.sexo === "M").length;
          const f = escalados.filter(d => d.sexo === "F").length;
          return (
            <div className="flex flex-wrap gap-2 text-xs justify-end">
              <Badge className="bg-blue-500 hover:bg-blue-500 text-white">♂ {m} escalado{m === 1 ? "" : "s"}</Badge>
              <Badge className="bg-pink-500 hover:bg-pink-500 text-white">♀ {f} escalada{f === 1 ? "" : "s"}</Badge>
            </div>
          );
        })()}
        <div className="text-xs text-muted-foreground text-right">{escalasSafe.length} pessoa(s) nesse dia</div>
      </CardContent>
    </Card>
  );
}

/* =========================== DEMANDAS TAB =========================== */
function DemandasTab({ diaristas }: { diaristas: Diarista[] }) {
  useTabRuntimeGuard("Demandas");
  const diaristasSafe = Array.isArray(diaristas) ? diaristas : [];
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [nova, setNova] = useState({ nome: "", data_inicio: "", data_fim: "", observacao: "" });
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([
        supabase.from("demandas").select("*").order("created_at", { ascending: false }),
        supabase.from("escalas").select("*").not("demanda_id", "is", null),
      ]);
      if (d.error) toast.error("Falha ao carregar demandas", { description: d.error.message });
      else setDemandas(((d.data ?? []) as Array<Partial<Demanda> & Record<string, unknown>>).map(normalizeDemanda));
      if (e.error) toast.error("Falha ao carregar escalas", { description: e.error.message });
      else setEscalas(((e.data ?? []) as Array<Partial<Escala> & Record<string, unknown>>).map(normalizeEscala));
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar demandas");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function criar() {
    try {
      if (!nova.nome.trim()) return toast.error("Nome da demanda é obrigatório");
      const { error } = await supabase.from("demandas").insert({
        nome: nova.nome.trim(),
        data_inicio: nova.data_inicio || null,
        data_fim: nova.data_fim || null,
        observacao: nova.observacao,
      });
      if (error) return toast.error("Não foi possível criar demanda", { description: error.message });
      setNova({ nome: "", data_inicio: "", data_fim: "", observacao: "" });
      load();
      toast.success("Demanda criada");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível criar demanda. Tente novamente.");
    }
  }
  async function remover(id: string) {
    try {
      if (!confirm("Excluir demanda? Os dias escalados perderão o vínculo.")) return;
      const { error } = await supabase.from("demandas").delete().eq("id", id);
      if (error) return toast.error(error.message);
      if (selId === id) setSelId(null);
      load();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir demanda");
    }
  }

  const demandasSafe = Array.isArray(demandas) ? demandas : [];
  const escalasSafe = Array.isArray(escalas) ? escalas : [];
  const selecionada = demandasSafe.find(d => d.id === selId);
  const escalasDaDemanda = selecionada ? escalasSafe.filter(e => e.demanda_id === selecionada.id) : [];
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
          {demandasSafe.length === 0 && <div className="text-center text-muted-foreground py-6">Nenhuma demanda</div>}
          {demandasSafe.map(d => {
            const count = new Set(escalasSafe.filter(e => e.demanda_id === d.id).map(e => e.diarista_id)).size;
            return (
              <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left rounded-md border p-3 hover:bg-accent ${selId === d.id ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.data_inicio ? fmtDate(d.data_inicio) : "—"} → {d.data_fim ? fmtDate(d.data_fim) : "—"}
                    </div>
                  </div>
                  <Badge variant="secondary">{count} {count === 1 ? "diarista" : "diaristas"}</Badge>
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
            <TabErrorBoundary tabKey={`pdf-${selecionada.id}`} title="Gerar listagem">
              <GerarListagemDemanda demanda={selecionada} escalas={escalasDaDemanda} diaristas={diaristasSafe} />
            </TabErrorBoundary>
            <TabErrorBoundary tabKey={`bulk-${selecionada.id}`} title="Escala em lote">
              <BulkEscalarDemanda
                demanda={selecionada}
                diaristas={diaristasSafe}
                onDone={load}
              />
            </TabErrorBoundary>

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
                    .sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")))
                    .map(e => {
                      const p = diaristasSafe.find(x => x.id === e.diarista_id);
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

/* ---- Gerar listagem PDF ---- */
function GerarListagemDemanda({ demanda, escalas, diaristas }: { demanda: Demanda; escalas: Escala[]; diaristas: Diarista[] }) {
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidadeUf, setCidadeUf] = useState("");
  const [turno, setTurno] = useState("T3");
  const [entrada, setEntrada] = useState("22:00");
  const [saida, setSaida] = useState("08:00");
  const [dataListagem, setDataListagem] = useState(demanda.data_inicio ?? today());
  const [ausentes, setAusentes] = useState<Set<string>>(new Set());

  const diaristasNaData = useMemo(() => {
    const ids = new Set(escalas.filter(e => !dataListagem || e.data === dataListagem).map(e => e.diarista_id));
    return diaristas.filter(d => ids.has(d.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [escalas, diaristas, dataListagem]);

  const presentes = useMemo(
    () => diaristasNaData.filter(d => !ausentes.has(d.id)),
    [diaristasNaData, ausentes]
  );

  function toggleAusente(id: string) {
    setAusentes(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function gerar() {
    if (presentes.length === 0) return toast.error("Nenhum diarista presente para gerar a listagem");
    try {
      const { gerarListagemPDF } = await import("@/lib/pdf-listagem");
      await gerarListagemPDF({
        cliente, endereco, cidadeUf, turno, entrada, saida,
        data: dataListagem,
        diaristas: presentes.map(d => ({ cpf: d.cpf, nome: d.nome })),
      });
      toast.success("Listagem PDF gerada");
    } catch (err) {
      console.error("[gerarListagemPDF] falhou:", err);
      toast.error("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function gerarExcel() {
    if (presentes.length === 0) return toast.error("Nenhum diarista presente para gerar a listagem");
    try {
      const { gerarListagemXLSX } = await import("@/lib/xlsx-listagem");
      await gerarListagemXLSX({
        cliente, endereco, cidadeUf, turno, entrada, saida,
        data: dataListagem,
        diaristas: presentes.map(d => ({ cpf: d.cpf, nome: d.nome })),
      });
      toast.success("Planilha Excel gerada");
    } catch (err) {
      console.error("[gerarListagemXLSX] falhou:", err);
      toast.error("Erro ao gerar Excel: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="text-sm font-medium">Gerar listagem (modelo de controle)</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="Cliente" id="pdf-cli"><Input id="pdf-cli" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="J&T EXPRESS" /></Field>
        <Field label="Endereço" id="pdf-end"><Input id="pdf-end" value={endereco} onChange={e => setEndereco(e.target.value)} /></Field>
        <Field label="Cidade/UF" id="pdf-uf"><Input id="pdf-uf" value={cidadeUf} onChange={e => setCidadeUf(e.target.value)} /></Field>
        <Field label="Data" id="pdf-data"><Input id="pdf-data" type="date" value={dataListagem} onChange={e => { setDataListagem(e.target.value); setAusentes(new Set()); }} /></Field>
        <Field label="Turno" id="pdf-turno"><Input id="pdf-turno" value={turno} onChange={e => setTurno(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Entrada" id="pdf-ent"><Input id="pdf-ent" value={entrada} onChange={e => setEntrada(e.target.value)} /></Field>
          <Field label="Saída" id="pdf-sai"><Input id="pdf-sai" value={saida} onChange={e => setSaida(e.target.value)} /></Field>
        </div>
      </div>

      {diaristasNaData.length > 0 && (
        <div className="rounded-md border bg-background">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-xs font-medium">Marque quem NÃO compareceu (será excluído da listagem)</div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setAusentes(new Set())}
            >Limpar</button>
          </div>
          <div className="max-h-56 overflow-auto divide-y">
            {diaristasNaData.map(d => {
              const ausente = ausentes.has(d.id);
              return (
                <label key={d.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 ${ausente ? "opacity-60 line-through" : ""}`}>
                  <Checkbox checked={ausente} onCheckedChange={() => toggleAusente(d.id)} />
                  <span className="flex-1 truncate">{d.nome}</span>
                  <span className="text-xs text-muted-foreground">{d.cpf}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {presentes.length} presente(s){ausentes.size > 0 ? ` · ${ausentes.size} ausente(s)` : ""} de {diaristasNaData.length}
        </div>
        <div className="flex gap-2">
          <Button onClick={gerarExcel} size="sm" variant="secondary" disabled={presentes.length === 0}>Gerar Excel (.xlsx)</Button>
          <Button onClick={gerar} size="sm" disabled={presentes.length === 0}>Gerar PDF</Button>
        </div>
      </div>

    </div>
  );
}


/* ---- Bulk escalar dentro da demanda (múltiplos diaristas × múltiplos dias) ---- */

function BulkEscalarDemanda({ demanda, diaristas, onDone }: { demanda: Demanda; diaristas: Diarista[]; onDone: () => void }) {
  useTabRuntimeGuard("Escala em lote");
  const diaristasSafe = Array.isArray(diaristas) ? diaristas : [];
  const [inicio, setInicio] = useState(demanda.data_inicio ?? today());
  const [fim, setFim] = useState(demanda.data_fim ?? demanda.data_inicio ?? today());
  const [modo, setModo] = useState<"todos" | "uteis" | "domingos">("todos");
  const [ehFeriado, setEhFeriado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return diaristasSafe.filter(d => !q || safeLower(d.nome).includes(q));
  }, [diaristasSafe, busca]);

  function gerarDias(): string[] {
    if (!inicio || !fim) return [];
    const [y1, m1, d1] = inicio.split("-").map(Number);
    const [y2, m2, d2] = fim.split("-").map(Number);
    if (![y1, m1, d1, y2, m2, d2].every(Number.isFinite)) return [];
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
    try {
      const dias = gerarDias();
      if (dias.length === 0) return toast.error("Intervalo de datas inválido");
      if (selecionados.size === 0) return toast.error("Selecione ao menos uma diarista");
      const escolhidos = diaristasSafe.filter(d => selecionados.has(d.id));
      const bloqueados = escolhidos.filter(d => d.status === "Bloqueado");
      const validos = escolhidos.filter(d => d.status !== "Bloqueado");
      bloqueados.forEach(b => toast.error(`${b.nome} bloqueado`));
      if (validos.length === 0) return;

      setEnviando(true);
      // Buscar escalas já existentes nesse intervalo para os diaristas selecionados (evitar violação de unique)
      const { data: jaExistem, error: existentesError } = await supabase
        .from("escalas")
        .select("diarista_id, data")
        .in("diarista_id", validos.map(v => v.id))
        .in("data", dias);
      if (existentesError) return toast.error("Não foi possível conferir escalas existentes", { description: existentesError.message });
      const existentes = new Set((jaExistem ?? []).map(x => `${x.diarista_id}|${x.data}`));

      const rows: Array<{ diarista_id: string; demanda_id: string; data: string; valor_diaria: number; valor_passagem: number; eh_feriado: boolean; observacao: string }> = [];
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
            observacao: "",
          });
        }
      }

      if (rows.length === 0) return toast.error("Todos já estavam escalados nesses dias");
      const { error } = await supabase.from("escalas").insert(rows);
      if (error) return toast.error("Não foi possível criar escala em lote", { description: error.message });
      const puladas = validos.length * dias.length - rows.length;
      toast.success(`${rows.length} escala(s) criada(s)${puladas > 0 ? ` (${puladas} já existiam)` : ""}`);
      setSelecionados(new Set());
      onDone();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível escalar em lote. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const preview = gerarDias();

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="font-medium text-sm">Escalar em lote nessa demanda</div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="De" id="bd-ini"><Input id="bd-ini" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
        <Field label="Até" id="bd-fim"><Input id="bd-fim" type="date" value={fim} onChange={e => setFim(e.target.value)} /></Field>
        <Field label="Dias" id="bd-mod">
          <select id="bd-mod" value={modo} onChange={e => setModo(e.target.value as typeof modo)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="todos">Todos os dias</option>
            <option value="uteis">Só dias úteis (seg–sex)</option>
            <option value="domingos">Só domingos</option>
          </select>
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
              onClick={(e) => {
                if (bloq) {
                  e.preventDefault();
                  toast.error(`${d.nome} bloqueado`);
                }
              }}
            >
              <Checkbox
                checked={selecionados.has(d.id)}
                onCheckedChange={() => {
                  if (bloq) { toast.error(`${d.nome} bloqueado`); return; }
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
    try {
      const [s, e] = await Promise.all([
        supabase.from("epi_estoque").select("*").order("tipo").order("tamanho"),
        supabase.from("epi_entregas").select("*").order("entregue_em", { ascending: false }),
      ]);
      if (!s.error) setEstoque((s.data ?? []) as unknown as EpiEstoque[]);
      if (!e.error) setEntregas((e.data ?? []) as unknown as EpiEntrega[]);
    } catch (error) {
      console.error(error);
      toast.error("Falha ao carregar EPIs");
    }
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
            <select value={novo.tipo} onChange={e => setNovo({ ...novo, tipo: e.target.value as EpiTipo })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="bota">Bota</option>
              <option value="colete">Colete</option>
            </select>
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
            <select value={entrega.tipo} onChange={e => setEntrega({ ...entrega, tipo: e.target.value as EpiTipo, tamanho: "" })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="bota">Bota</option>
              <option value="colete">Colete</option>
            </select>
            <select value={entrega.tamanho} onChange={e => setEntrega({ ...entrega, tamanho: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Tamanho</option>
              {estoque.filter(e => e.tipo === entrega.tipo).map(e => (
                <option key={e.id} value={e.tamanho}>{e.tamanho} ({e.quantidade_total - emUso(e.tipo, e.tamanho).length} disp.)</option>
              ))}
            </select>
            <select value={entrega.diarista_id} onChange={e => setEntrega({ ...entrega, diarista_id: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Diarista</option>
              {diaristas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
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
