import React from 'react';
import {
  Clock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import { AuthUser } from '../types/auth';
import { AuraButton } from './ui/AuraPrimitives';

interface AwaitingStoreAccessViewProps {
  currentUser: AuthUser;
  onLogout: () => void;
  onRefreshAccess: () => Promise<void>;
}

export function AwaitingStoreAccessView({
  currentUser,
  onLogout,
  onRefreshAccess,
}: AwaitingStoreAccessViewProps) {
  const [checking, setChecking] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const handleRefresh = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      await onRefreshAccess();
    } catch {
      setFeedback('Não foi possível verificar no momento. Tente novamente em instantes.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1F1E1B] flex flex-col justify-between p-6">
      <div className="max-w-lg w-full mx-auto my-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center font-serif text-2xl mx-auto shadow-sm">
            O
          </div>
          <h1 className="font-serif text-[32px] leading-tight text-[#1F1E1B]">
            Aguardando Vínculo à Loja
          </h1>
          <p className="text-xs text-[#6E6B63]">
            Sua conta de Vendedor está ativa e pronta para operar
          </p>
        </div>

        {/* Card Surface */}
        <div className="bg-white border border-[#E5E2D9] rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-6">
          {/* User Profile Summary */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#FAF9F6] border border-[#EFECE6]">
            <div className="h-11 w-11 rounded-full bg-[#4F5A47]/10 text-[#4F5A47] flex items-center justify-center font-serif text-base shrink-0">
              {currentUser.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#1F1E1B] truncate">
                  {currentUser.name}
                </p>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EAE7DE] text-[#4F5A47]">
                  Vendedor
                </span>
              </div>
              <p className="text-xs text-[#6E6B63] flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                {currentUser.email}
              </p>
            </div>
          </div>

          {/* Friendly Guidance */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1F1E1B] flex items-center gap-2">
              <Store className="h-4 w-4 text-[#4F5A47]" />
              Como liberar seu acesso ao balcão:
            </h2>
            <ol className="text-xs text-[#6E6B63] space-y-2.5 list-decimal list-inside pl-1">
              <li className="leading-relaxed">
                Peça ao <strong className="text-[#1F1E1B]">Administrador</strong> da sua loja para acessar a aba <strong className="text-[#1F1E1B]">Configurações &amp; Equipe</strong>.
              </li>
              <li className="leading-relaxed">
                Ele deve cadastrar seu e-mail corporativo (<strong className="text-[#1F1E1B]">{currentUser.email}</strong>) na equipe de vendas.
              </li>
              <li className="leading-relaxed">
                Assim que você for vinculado à loja, seu painel de vendas, estoque e CRM será liberado imediatamente.
              </li>
            </ol>
          </div>

          {feedback && (
            <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E2D9] text-xs text-[#4F5A47] text-center">
              {feedback}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <AuraButton
              variant="primary"
              size="lg"
              className="w-full justify-center"
              onClick={handleRefresh}
              disabled={checking}
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Verificando acessos...' : 'Verificar acesso agora'}
            </AuraButton>

            <AuraButton
              variant="outline"
              size="md"
              className="w-full justify-center text-[#6E6B63] hover:text-[#9B3B2B]"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </AuraButton>
          </div>
        </div>

        <p className="text-[11px] text-[#7A776E] text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
          Acessos seguros com isolamento de dados por loja no Open CRM.
        </p>
      </div>

      <footer className="text-center text-[11px] text-[#8C887E] pt-4">
        Open CRM · Plataforma Multi-Segmento · Arquitetura Segura &amp; Multi-Tenant
      </footer>
    </div>
  );
}
