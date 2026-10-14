import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

/** Login / cadastro / esqueci a senha. redirectPath = para onde o e-mail de confirmação volta. */
export function AuthForm({ redirectPath, title, subtitle }: { redirectPath: string; title: string; subtitle: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${redirectPath}` } });
    setBusy(false);
    if (error) {
      if (mode === "login") {
        toast.error(/confirm/i.test(error.message) ? "Esse e-mail ainda não foi confirmado. Abra o link que enviamos." : "E-mail ou senha inválidos.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    if (mode === "signup") {
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        toast.error("Esse e-mail já tem conta. Entre com a sua senha.");
      } else if (!data.session) {
        toast.success("Conta criada! Confirme o e-mail (veja o spam) e depois volte e clique em “Entrar”.");
      }
      setMode("login");
    }
  }

  async function forgotPassword() {
    if (!/.+@.+\..+/.test(email)) {
      toast.error("Digita seu e-mail no campo acima primeiro.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${redirectPath}`,
    });
    setBusy(false);
    if (error) {
      toast.error("Não consegui enviar o e-mail de redefinição.");
      return;
    }
    setResetSent(true);
    toast.success("Enviamos um link pra redefinir a senha.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-8 card-soft">
        <Link to="/" className="inline-flex items-center">
          <img src={logoTransparente} alt="GCard-PRÓ" className="h-10 w-auto" draggable={false} />
        </Link>
        <h1 className="mt-4 text-xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="e">E-mail</Label>
            <Input id="e" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className="mt-1 h-11" required />
          </div>
          <div>
            <Label htmlFor="p">Senha</Label>
            <Input id="p" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} className="mt-1 h-11" required minLength={6} />
          </div>
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="mt-3 h-11 w-full rounded-2xl border-2 border-foreground/30 text-center text-sm font-bold text-foreground transition-colors hover:border-foreground"
        >
          {mode === "login" ? "Primeira vez? Criar conta" : "Já tenho conta — entrar"}
        </button>
        {mode === "login" &&
          (resetSent ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Link enviado pro seu e-mail. Confere a caixa de entrada (e o spam).
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void forgotPassword()}
              disabled={busy}
              className="mt-2 w-full text-center text-xs text-muted-foreground underline hover:text-foreground"
            >
              Esqueci minha senha
            </button>
          ))}
      </form>
    </div>
  );
}
