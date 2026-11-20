import React from 'react';
import { AlertCircle, ArrowRight, Lock, Plus, ShieldCheck, Store, User } from 'lucide-react';
import { LoginCredentials, UserRole } from '../types/auth';
import { AuraButton } from './ui/AuraPrimitives';

interface LoginViewProps {
  onLogin: (credentials: LoginCredentials) => void;
  onDemoLogin: (role: UserRole) => void;
  onOpenCreateStore: () => void;
  onGoogleLogin?: (idToken: string) => void | Promise<void>;
}

export function LoginView({
  onLogin,
  onDemoLogin,
  onOpenCreateStore,
  onGoogleLogin,
}: LoginViewProps) {
  const [email, setEmail] = React.useState('thiago@auracell.com.br');
  const [password, setPassword] = React.useState('auracell2026');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleClientId = Boolean(googleClientId);

  React.useEffect(() => {
    if (!hasGoogleClientId || typeof window === 'undefined') return;

    // Carrega dinamicamente a SDK do Google se necessário
    if (!(window as any).google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleGsi();
      };
      document.head.appendChild(script);
    } else {
      initGoogleGsi();
    }

    function initGoogleGsi() {
      try {
        (window as any).google?.accounts?.id.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
            if (response?.credential && onGoogleLogin) {
              onGoogleLogin(response.credential);
            }
          },
        });
      } catch (err) {
        console.warn('Falha ao inicializar Google Sign-In:', err);
      }
    }
  }, [hasGoogleClientId, googleClientId, onGoogleLogin]);

  const handleGoogleClick = () => {
    if (!hasGoogleClientId) return;
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt();
    } else if (onGoogleLogin) {
      // Fallback
      onGoogleLogin('simulated-google-token');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      onLogin({ email, password });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1F1E1B] flex flex-col justify-between p-6">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Boutique Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center font-serif text-2xl mx-auto">
            O
          </div>
          <h1 className="font-serif text-[34px] leading-tight text-[#1F1E1B]">
            Open CRM
          </h1>
          <p className="text-xs text-[#6E6B63]">
            Plataforma CRM Multi-Segmento · Workspace padrão: AuraCell
          </p>
        </div>

        {/* Login Surface */}
        <div className="bg-white border border-[#E5E2D9] rounded-2xl p-6 sm:p-7 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-3.5 py-2.5 text-xs text-[#9B3B2B] flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Continuar com Google (OAuth 2.0 / OIDC) */}
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={!hasGoogleClientId}
              title={
                !hasGoogleClientId
                  ? 'Configure VITE_GOOGLE_CLIENT_ID para habilitar login com Google'
                  : 'Entrar com conta Google'
              }
              onClick={handleGoogleClick}
              className={`w-full h-11 px-4 rounded-xl border flex items-center justify-center gap-3 text-sm font-medium transition-all ${
                hasGoogleClientId
                  ? 'bg-white border-[#E5E2D9] text-[#1F1E1B] hover:bg-[#F4F2EC] hover:border-[#D5D2C8] cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                  : 'bg-[#F4F2EC]/60 border-[#E5E2D9] text-[#9A968D] cursor-not-allowed opacity-70'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continuar com Google</span>
            </button>
            {!hasGoogleClientId && (
              <p className="text-[11px] text-[#8C887E] text-center">
                Configure VITE_GOOGLE_CLIENT_ID para habilitar login com Google
              </p>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#EFECE6]"></div>
            <span className="flex-shrink mx-3 text-[11px] text-[#8C887E] uppercase tracking-wider font-medium">
              ou com e-mail
            </span>
            <div className="flex-grow border-t border-[#EFECE6]"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-[#4A4842] mb-1.5"
              >
                E-mail corporativo
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@auracell.com.br"
                className="w-full h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-[#4A4842] mb-1.5"
              >
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
              />
            </div>

            <AuraButton type="submit" variant="primary" size="lg" className="w-full">
              Entrar no Sistema
              <ArrowRight className="h-4 w-4" />
            </AuraButton>
          </form>

          {/* Discreet Demo Role Access */}
          <div className="pt-4 border-t border-[#EFECE6] space-y-2.5">
            <p className="text-[11px] text-[#6E6B63] text-center">
              Acesso rápido de demonstração por perfil
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <AuraButton
                variant="secondary"
                size="sm"
                onClick={() => onDemoLogin('ADMIN')}
                className="w-full"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
                Entrar como Admin
              </AuraButton>
              <AuraButton
                variant="outline"
                size="sm"
                onClick={() => onDemoLogin('VENDEDOR')}
                className="w-full"
              >
                <User className="h-3.5 w-3.5 text-[#6E6B63]" />
                Entrar como Vendedor
              </AuraButton>
            </div>
          </div>

          {/* Discreet New Store / Template Onboarding */}
          <div className="pt-3 border-t border-[#EFECE6] text-center">
            <button
              type="button"
              onClick={onOpenCreateStore}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#4F5A47] hover:text-[#2E472D] hover:underline cursor-pointer"
            >
              <Store className="h-3.5 w-3.5" />
              Criar nova loja gratuita
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#7A776E] text-center flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          Acessos a lojas existentes são provisionados pelo administrador.
        </p>
      </div>

      <footer className="text-center text-[11px] text-[#8C887E] pt-4">
        Open CRM · Templates Multi-Segmento · AuraCell, Sabor &amp; Brasa, Atelier Linho
      </footer>
    </div>
  );
}
