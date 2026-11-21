import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  Users,
} from 'lucide-react';
import { LoginCredentials, UserRole } from '../types/auth';
import { STORE_SEGMENT_SUGGESTIONS } from '../data/templates';
import { AuraButton } from './ui/AuraPrimitives';

export interface RegisterStoreFormData {
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
  storeName: string;
  segment: string;
}

export interface RegisterSellerFormData {
  name: string;
  email: string;
  password?: string;
}

interface LoginViewProps {
  onLogin: (credentials: LoginCredentials) => void | Promise<void>;
  onDemoLogin: (role: UserRole) => void;
  onOpenCreateStore: (initialStoreName?: string) => void;
  onRegisterStore?: (data: RegisterStoreFormData) => void | Promise<void>;
  onRegisterSeller?: (data: RegisterSellerFormData) => void | Promise<void>;
  onGoogleLogin?: (idToken: string) => void | Promise<void>;
}

export function LoginView({
  onLogin,
  onDemoLogin,
  onOpenCreateStore,
  onRegisterStore,
  onRegisterSeller,
  onGoogleLogin,
}: LoginViewProps) {
  const [authMode, setAuthMode] = React.useState<'login' | 'register'>('login');
  const [regRole, setRegRole] = React.useState<'admin' | 'seller'>('admin');

  // Login form state
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  // Register form state
  const [regName, setRegName] = React.useState('');
  const [regEmail, setRegEmail] = React.useState('');
  const [regPassword, setRegPassword] = React.useState('');
  const [regStoreName, setRegStoreName] = React.useState('');
  const [regSegment, setRegSegment] = React.useState(
    STORE_SEGMENT_SUGGESTIONS[0] || 'Celulares & Assistência'
  );

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleClientId = Boolean(googleClientId);

  // Leitura de query params para preenchimento automático (?modo=cadastro&perfil=vendedor&email=...)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const modo = (params.get('modo') || params.get('mode') || '').toLowerCase();
      const perfil = (params.get('perfil') || params.get('role') || '').toLowerCase();
      const urlEmail = params.get('email');
      const urlName = params.get('nome') || params.get('name');

      if (modo === 'cadastro' || modo === 'register') {
        setAuthMode('register');
      }
      if (perfil === 'vendedor' || perfil === 'seller') {
        setRegRole('seller');
      } else if (perfil === 'admin' || perfil === 'administrador') {
        setRegRole('admin');
      }
      if (urlEmail) {
        setEmail(urlEmail.trim());
        setRegEmail(urlEmail.trim());
      }
      if (urlName) {
        setRegName(urlName.trim());
      }
    } catch {
      // Ignora erro de parsing em ambientes sem URL válida
    }
  }, []);

  React.useEffect(() => {
    if (!hasGoogleClientId || typeof window === 'undefined') return;

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
      onGoogleLogin('simulated-google-token');
    }
  };

  const formatFriendlyError = (err: any): string => {
    const raw = String(err?.message || err || '');
    if (/não existe|not found|usuário não encontrado|credenciais não reconhecidas/i.test(raw)) {
      return 'Essa conta não existe.';
    }
    if (/senha incorreta|invalid password|senha inválida/i.test(raw)) {
      return 'Senha incorreta.';
    }
    if (/google|oauth|gsi/i.test(raw)) {
      return 'Esta conta usa acesso pelo Google.';
    }
    return raw || 'Não foi possível completar a operação. Verifique seus dados.';
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await onLogin({ email, password });
    } catch (err) {
      setErrorMsg(formatFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (regRole === 'admin') {
      if (!regName.trim() || !regEmail.trim() || !regStoreName.trim()) {
        setErrorMsg('Preencha seu nome, e-mail e o nome da loja.');
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        if (onRegisterStore) {
          await onRegisterStore({
            adminName: regName.trim(),
            adminEmail: regEmail.trim(),
            adminPassword: regPassword.trim(),
            storeName: regStoreName.trim(),
            segment: regSegment,
          });
        } else {
          onOpenCreateStore(regStoreName.trim());
        }
      } catch (err) {
        setErrorMsg(formatFriendlyError(err));
      } finally {
        setLoading(false);
      }
    } else {
      // Vendedor
      if (!regName.trim() || !regEmail.trim()) {
        setErrorMsg('Preencha seu nome completo e e-mail.');
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        if (onRegisterSeller) {
          await onRegisterSeller({
            name: regName.trim(),
            email: regEmail.trim(),
            password: regPassword.trim(),
          });
        } else {
          setErrorMsg('Cadastro de vendedor não configurado no momento.');
        }
      } catch (err) {
        setErrorMsg(formatFriendlyError(err));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1F1E1B] flex flex-col justify-between p-6">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Boutique Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center font-serif text-2xl mx-auto shadow-sm">
            O
          </div>
          <h1 className="font-serif text-[34px] leading-tight text-[#1F1E1B]">
            Open CRM
          </h1>
          <p className="text-xs text-[#6E6B63]">
            Plataforma CRM &amp; Gestão Multi-Segmento
          </p>
        </div>

        {/* Auth Mode Switcher */}
        <div className="flex bg-[#EAE7DE] p-1 rounded-xl border border-[#DCD8CD]">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              authMode === 'login'
                ? 'bg-white text-[#1F1E1B] shadow-sm font-semibold'
                : 'text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            Entrar na Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              authMode === 'register'
                ? 'bg-white text-[#1F1E1B] shadow-sm font-semibold'
                : 'text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            Criar Conta Gratuita
          </button>
        </div>

        {/* Main Card Surface */}
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

          {/* Continuar com Google fixo no topo */}
          {hasGoogleClientId && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleClick}
                className="w-full h-11 px-4 rounded-xl border border-[#E5E2D9] bg-white text-[#1F1E1B] hover:bg-[#F4F2EC] hover:border-[#D5D2C8] flex items-center justify-center gap-3 text-sm font-medium transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
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
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#EFECE6]"></div>
                <span className="flex-shrink mx-3 text-[11px] text-[#8C887E] uppercase tracking-wider font-medium">
                  ou com e-mail e senha
                </span>
                <div className="flex-grow border-t border-[#EFECE6]"></div>
              </div>
            </div>
          )}

          {authMode === 'login' ? (
            /* --- FLUXO DE LOGIN --- */
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-[#4A4842] mb-1.5"
                  >
                    E-mail corporativo ou pessoal
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@suaempresa.com.br"
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>

                <AuraButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full justify-center"
                >
                  {loading ? 'Entrando...' : 'Entrar no Sistema'}
                  <ArrowRight className="h-4 w-4" />
                </AuraButton>
              </form>

              {/* Botão claro para criar conta */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#4F5A47] hover:text-[#2E472D] hover:underline cursor-pointer"
                >
                  <Store className="h-3.5 w-3.5" />
                  Não tem conta? Criar conta gratuita
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Discreet Demo Role Access */}
              <div className="pt-4 border-t border-[#EFECE6] space-y-2">
                <p className="text-[11px] text-[#6E6B63] text-center">
                  Acesso rápido de demonstração por perfil
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <AuraButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onDemoLogin('ADMIN')}
                    className="w-full justify-center text-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
                    Demo Admin
                  </AuraButton>
                  <AuraButton
                    variant="outline"
                    size="sm"
                    onClick={() => onDemoLogin('VENDEDOR')}
                    className="w-full justify-center text-xs"
                  >
                    <User className="h-3.5 w-3.5 text-[#6E6B63]" />
                    Demo Vendedor
                  </AuraButton>
                </div>
              </div>
            </>
          ) : (
            /* --- FLUXO DE CRIAR CONTA (ADMIN OU VENDEDOR) --- */
            <div className="space-y-4">
              <div className="text-left pb-1">
                <h2 className="font-serif text-lg text-[#1F1E1B]">
                  Criar Conta no Open CRM
                </h2>
                <p className="text-[11px] text-[#6E6B63]">
                  Selecione seu perfil de acesso para começar
                </p>
              </div>

              {/* Seletor Visual Claro entre Admin e Vendedor */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setRegRole('admin');
                    setErrorMsg(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    regRole === 'admin'
                      ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]'
                      : 'bg-[#FAF9F6] border-[#E5E2D9] hover:border-[#C5C0B3]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1B]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
                    Administrador
                  </div>
                  <p className="text-[10px] text-[#6E6B63] mt-0.5 leading-tight">
                    Criar minha loja e gerenciar equipe
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRegRole('seller');
                    setErrorMsg(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    regRole === 'seller'
                      ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]'
                      : 'bg-[#FAF9F6] border-[#E5E2D9] hover:border-[#C5C0B3]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1B]">
                    <User className="h-3.5 w-3.5 text-[#4F5A47]" />
                    Vendedor
                  </div>
                  <p className="text-[10px] text-[#6E6B63] mt-0.5 leading-tight">
                    Entrar em loja existente da minha equipe
                  </p>
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 pt-1">
                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-xs font-medium text-[#4A4842] mb-1"
                  >
                    Seu nome completo
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex: Carlos Silveira"
                    className="w-full h-9.5 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-medium text-[#4A4842] mb-1"
                  >
                    E-mail corporativo ou pessoal
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="voce@suaempresa.com.br"
                    className="w-full h-9.5 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-medium text-[#4A4842] mb-1"
                  >
                    Senha de acesso
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full h-9.5 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>

                {regRole === 'admin' && (
                  <>
                    <div>
                      <label
                        htmlFor="reg-store-name"
                        className="block text-xs font-medium text-[#4A4842] mb-1"
                      >
                        Nome da sua loja ou negócio
                      </label>
                      <input
                        id="reg-store-name"
                        type="text"
                        required
                        value={regStoreName}
                        onChange={(e) => setRegStoreName(e.target.value)}
                        placeholder="Ex: Alpha Cell, Studio Linho, Burger House..."
                        className="w-full h-9.5 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-segment"
                        className="block text-xs font-medium text-[#4A4842] mb-1"
                      >
                        Segmento de atuação
                      </label>
                      <select
                        id="reg-segment"
                        value={regSegment}
                        onChange={(e) => setRegSegment(e.target.value)}
                        className="w-full h-9.5 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                      >
                        {STORE_SEGMENT_SUGGESTIONS.map((seg) => (
                          <option key={seg} value={seg}>
                            {seg}
                          </option>
                        ))}
                        <option value="other">Outros / Personalizado</option>
                      </select>
                    </div>
                  </>
                )}

                <AuraButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full mt-2 justify-center"
                >
                  {loading
                    ? 'Criando conta...'
                    : regRole === 'admin'
                    ? 'Criar Minha Loja & Entrar'
                    : 'Criar Conta de Vendedor & Entrar'}
                  <Sparkles className="h-4 w-4" />
                </AuraButton>

                <div className="pt-2 text-center flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs text-[#4F5A47] hover:underline cursor-pointer"
                  >
                    Já tem uma conta? Voltar ao login
                  </button>
                  {regRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => onOpenCreateStore(regStoreName.trim())}
                      className="text-[11px] text-[#8C887E] hover:text-[#4A4842] hover:underline cursor-pointer"
                    >
                      Ou personalizar template avançado no assistente
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#7A776E] text-center flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          Acessos seguros isolados por loja com criptografia ponta a ponta.
        </p>
      </div>

      <footer className="text-center text-[11px] text-[#8C887E] pt-4">
        Open CRM · Plataforma Multi-Segmento · Arquitetura Segura &amp; Multi-Tenant
      </footer>
    </div>
  );
}
