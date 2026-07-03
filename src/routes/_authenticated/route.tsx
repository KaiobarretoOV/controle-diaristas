import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

type Status = "loading" | "allowed" | "pending" | "signed_out";

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active && status === "loading") setStatus("signed_out");
    }, 8000);

    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.user) {
          if (!active) return;
          window.clearTimeout(timeout);
          setStatus("signed_out");
          navigate({ to: "/auth", replace: true });
          return;
        }
        setEmail(session.session.user.email ?? "");
        const { data: statusData, error } = await supabase.rpc("my_access_status" as never);
        if (!active) return;
        window.clearTimeout(timeout);
        if (error) {
          console.error(error);
          setStatus("pending");
          return;
        }
        const s = String(statusData ?? "pending");
        setStatus(s === "admin" || s === "leader" ? "allowed" : "pending");
      } catch (e) {
        console.error(e);
        if (!active) return;
        window.clearTimeout(timeout);
        setStatus("signed_out");
        navigate({ to: "/auth", replace: true });
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Carregando acesso...
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle>Aguardando aprovação</CardTitle>
            <CardDescription>
              Sua solicitação de acesso foi enviada para o administrador.
              Você poderá entrar assim que ele aprovar seu cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Conectado como <span className="font-medium">{email}</span>
            </p>
            <Button className="w-full" variant="outline" onClick={logout}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
