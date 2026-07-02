import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setChecking(false);
    }, 5000);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        window.clearTimeout(timeout);
        if (!data.session?.user) {
          navigate({ to: "/auth", replace: true });
          return;
        }
        setChecking(false);
      })
      .catch((error) => {
        console.error("Falha ao verificar login", error);
        if (!active) return;
        window.clearTimeout(timeout);
        navigate({ to: "/auth", replace: true });
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
        Carregando acesso...
      </div>
    );
  }

  return <Outlet />;
}
