import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Gestão de Diaristas" }] }),
  component: AdminPage,
});

type Row = {
  user_id: string;
  email: string;
  role: "admin" | "leader" | "user" | null;
  created_at: string;
  last_sign_in_at: string | null;
  request_status: "pending" | "approved" | "rejected" | null;
  requested_at: string | null;
  reviewed_at: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
}

function AdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_users_overview" as never);
    setLoading(false);
    if (error) {
      toast.error("Acesso negado", { description: error.message });
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(userId: string) {
    const { error } = await supabase.rpc("approve_access_request" as never, { _user_id: userId } as never);
    if (error) return toast.error(error.message);
    toast.success("Acesso aprovado como líder");
    void load();
  }

  async function revoke(userId: string) {
    if (!confirm("Remover o acesso deste usuário?")) return;
    const { error } = await supabase.rpc("revoke_access" as never, { _user_id: userId } as never);
    if (error) return toast.error(error.message);
    toast.success("Acesso removido");
    void load();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/"><Button>Voltar</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendentes = rows.filter(r => r.request_status === "pending" && r.role !== "admin");
  const ativos = rows.filter(r => r.role === "admin" || r.role === "leader");
  const historico = rows.filter(r => r.request_status === "rejected" || (r.request_status === "approved" && r.role !== "leader" && r.role !== "admin"));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-4 border-primary bg-foreground text-background">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Painel do Administrador</h1>
            <p className="text-xs opacity-80">Aprove, remova e gerencie os acessos ao sistema</p>
          </div>
          <Link to="/"><Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button></Link>
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Sair</Button>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Solicitações pendentes ({pendentes.length})</CardTitle>
            <CardDescription>Novos cadastros aguardando sua aprovação</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && pendentes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>}
            {pendentes.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map(r => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-medium">{r.email}</TableCell>
                      <TableCell>{fmt(r.requested_at)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => approve(r.user_id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar como líder
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => revoke(r.user_id)}>
                          <XCircle className="h-4 w-4 mr-1" />Rejeitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários ativos ({ativos.length})</CardTitle>
            <CardDescription>Administradores e líderes com acesso completo aos dados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ativos.map(r => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell>
                      {r.role === "admin"
                        ? <Badge className="bg-primary">Administrador</Badge>
                        : <Badge variant="secondary">Líder</Badge>}
                    </TableCell>
                    <TableCell>{fmt(r.created_at)}</TableCell>
                    <TableCell>{fmt(r.last_sign_in_at)}</TableCell>
                    <TableCell className="text-right">
                      {r.role === "leader" && (
                        <Button size="sm" variant="destructive" onClick={() => revoke(r.user_id)}>
                          <XCircle className="h-4 w-4 mr-1" />Remover acesso
                        </Button>
                      )}
                      {r.role === "admin" && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {historico.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico ({historico.length})</CardTitle>
              <CardDescription>Solicitações rejeitadas ou revogadas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Revisado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map(r => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.request_status ?? "sem solicitação"}</Badge>
                      </TableCell>
                      <TableCell>{fmt(r.reviewed_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => approve(r.user_id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar agora
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
