import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";
import { checkSignupEmail } from "@/lib/auth-check.functions";
import { suggestEmailDomain } from "@/lib/email-typo";
import { getFirstTouch } from "@/lib/first-touch";
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, MARUSSO_CONSENT_TEXT } from "@/lib/consent";

/** Login / cadastro / esqueci a senha. redirectPath = para onde o e-mail de confirmação volta. */
export function AuthForm({ redirectPath, title, subtitle }: { redirectPath: string; title: string; subtitle: string }) {
  const checkEmail = useServerFn(checkSignupEmail);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [resetSent, setResetSent] = useState(false);
  // Aceite de novidades: nunca marcado de antemão.
  const [marketing, setMarketing] = useState(false);
  // Segundo aceite (Marusso): caixa separada, também nunca marcada de antemão.
  const [marusso, setMarusso] = useState(false);
  // E-mail com conta criada e ainda não confirmada: permite reenviar ou corrigir.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);

  const emailFix = suggestEmailDomain(email);
  const redirectTo = () => `${window.location.origin}${redirectPath}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      // Evita conta duplicada com e-mail quase igual (ponto/+etiqueta do gmail). Na dúvida, deixa criar.
      try {
        const check = await checkEmail({ data: { email } });
        if (check.similar) {
          setBusy(false);
          toast.error("Já existe uma conta com um e-mail muito parecido. Entre com ela ou use “Esqueci minha senha”.");
          setMode("login");
          return;
        }
      } catch {
        /* segue */
      }
    }
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectTo(),
              // O gatilho do banco lê isto: origem da primeira visita e a escolha de marketing (com a versão do texto).
              data: { first_touch: getFirstTouch(), marketing_consent: marketing, consent_version: CONSENT_TEXT_VERSION, marusso_consent: marusso },
            },
          });
    setBusy(false);
    if (error) {
      if (mode === "login") {
        if (/confirm/i.test(error.message)) {
          setUnconfirmed(email);
          toast.error("Esse e-mail ainda não foi confirmado. Abra o link que enviamos.");
        } else {
          toast.error("E-mail ou senha inválidos.");
        }
      } else {
        toast.error(error.message);
      }
      return;
    }
    if (mode === "signup") {
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        toast.error("Esse e-mail já tem conta. Entre com a sua senha.");
      } else if (!data.session) {
        setUnconfirmed(email);
        toast.success("Conta criada! Confirme o e-mail (veja o spam) e depois volte e clique em “Entrar”.");
      }
      setMode("login");
    }
  }

  async function resendConfirmation() {
    if (!unconfirmed) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: unconfirmed, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) toast.error("Não consegui reenviar agora. Tente de novo em instantes.");
    else toast.success("Reenviamos o e-mail de confirmação. Veja a caixa de entrada e o spam.");
  }

  function wrongEmail() {
    // Conta ainda não confirmada: o jeito seguro é criar de novo com o e-mail certo (a antiga expira sozinha).
    setUnconfirmed(null);
    setMode("signup");
    setEmail("");
    setPassword("");
  }

  async function forgotPassword() {
    if (!/.+@.+\..+/.test(email)) {
      toast.error("Digita seu e-mail no campo acima primeiro.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
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
            {emailFix && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Você quis dizer{" "}
                <button type="button" className="font-semibold text-foreground underline" onClick={() => setEmail(emailFix)}>
                  {emailFix}
                </button>
                ?
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="p">Senha</Label>
            <Input id="p" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} className="mt-1 h-11" required minLength={6} />
          </div>
          {mode === "signup" && (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={marketing} onChange={(ev) => setMarketing(ev.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>{CONSENT_TEXT}</span>
            </label>
          )}
          {mode === "signup" && (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={marusso} onChange={(ev) => setMarusso(ev.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span>{MARUSSO_CONSENT_TEXT}</span>
            </label>
          )}
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
        {unconfirmed && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p>
              Falta confirmar <strong>{unconfirmed}</strong>. Abra o link que enviamos (veja o spam).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => void resendConfirmation()}>
                Reenviar e-mail
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-xs underline" onClick={wrongEmail}>
                Digitei o e-mail errado
              </Button>
            </div>
          </div>
        )}
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
