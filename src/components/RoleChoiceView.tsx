import React from 'react';
import { ArrowRight, LogOut, ShieldCheck, Store, UserCheck } from 'lucide-react';
import { AuthUser } from '../types/auth';
import { AuraButton } from './ui/AuraPrimitives';

interface RoleChoiceViewProps {
  currentUser: AuthUser;
  onChooseAdmin: () => void | Promise<void>;
  onChooseSeller: () => void | Promise<void>;
  onLogout: () => void;
}

export function RoleChoiceView({
  currentUser,
  onChooseAdmin,
  onChooseSeller,
  onLogout,
}: RoleChoiceViewProps) {
  const [submittingRole, setSubmittingRole] = React.useState<'ADMIN' | 'VENDEDOR' | null>(null);

  const handleSelect = async (role: 'ADMIN' | 'VENDEDOR') => {
    setSubmittingRole(role);
    try {
      if (role === 'ADMIN') {
        await onChooseAdmin();
      } else {
        await onChooseSeller();
      }
    } finally {
      setSubmittingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1F1E1B] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl w-full mx-auto my-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center font-serif text-2xl mx-auto shadow-sm">
            O
          </div>
          <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#7A776E]">
            Open CRM · Primeiro Acesso
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#1F1E1B] leading-tight">
            Como você deseja utilizar o Open CRM?
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6B63] max-w-md mx-auto">
            Olá, <strong className="text-[#1F1E1B]">{currentUser.name}</strong>. Escolha como quer operar para prepararmos seu workspace sob medida.
          </p>
        </div>

        {/* 2 Options Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Option 1: Administrador */}
          <div
            className="group relative bg-white border border-[#E5E2D9] hover:border-[#4F5A47] rounded-2xl p-6 shadow-[0_1px_3px_rgba(28,25,23,0.03)] hover:shadow-md transition-all flex flex-col justify-between space-y-6 text-left cursor-pointer"
            onClick={() => handleSelect('ADMIN')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-11 w-11 rounded-xl bg-[#4F5A47]/10 text-[#4F5A47] group-hover:bg-[#4F5A47] group-hover:text-white transition-colors flex items-center justify-center">
                  <Store className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium tracking-wide px-2.5 py-1 rounded-full bg-[#FAF9F6] border border-[#E5E2D9] text-[#4F5A47]">
                  Gestão &amp; Criação
                </span>
              </div>

              <div>
                <h2 className="font-serif text-xl font-medium text-[#1F1E1B] group-hover:text-[#4F5A47] transition-colors">
                  Sou Administrador
                </h2>
                <p className="text-xs font-medium text-[#7A776E] mt-0.5">
                  Criar e gerenciar minha loja
                </p>
                <p className="text-xs text-[#6E6B63] leading-relaxed mt-2.5">
                  Configure o template da sua loja do zero ou com presets, controle estoque, cadastre produtos, emita pedidos e convide sua equipe de vendas.
                </p>
              </div>
            </div>

            <AuraButton
              variant="primary"
              size="md"
              className="w-full justify-center group-hover:shadow-sm"
              disabled={submittingRole !== null}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('ADMIN');
              }}
            >
              {submittingRole === 'ADMIN' ? 'Preparando...' : 'Criar minha loja'}
              <ArrowRight className="h-4 w-4" />
            </AuraButton>
          </div>

          {/* Option 2: Vendedor */}
          <div
            className="group relative bg-white border border-[#E5E2D9] hover:border-[#8C887E] rounded-2xl p-6 shadow-[0_1px_3px_rgba(28,25,23,0.03)] hover:shadow-md transition-all flex flex-col justify-between space-y-6 text-left cursor-pointer"
            onClick={() => handleSelect('VENDEDOR')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-11 w-11 rounded-xl bg-[#EAE7DE] text-[#4A4842] group-hover:bg-[#2C2A25] group-hover:text-white transition-colors flex items-center justify-center">
                  <UserCheck className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium tracking-wide px-2.5 py-1 rounded-full bg-[#FAF9F6] border border-[#E5E2D9] text-[#6E6B63]">
                  Operação &amp; Balcão
                </span>
              </div>

              <div>
                <h2 className="font-serif text-xl font-medium text-[#1F1E1B] group-hover:text-[#2C2A25] transition-colors">
                  Sou Vendedor
                </h2>
                <p className="text-xs font-medium text-[#7A776E] mt-0.5">
                  Aguardar convite da minha empresa
                </p>
                <p className="text-xs text-[#6E6B63] leading-relaxed mt-2.5">
                  Acesse o balcão de vendas, registre saídas de produtos e consulte certificados de garantia após receber o convite do seu administrador.
                </p>
              </div>
            </div>

            <AuraButton
              variant="outline"
              size="md"
              className="w-full justify-center text-[#4A4842] hover:text-[#1F1E1B]"
              disabled={submittingRole !== null}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('VENDEDOR');
              }}
            >
              {submittingRole === 'VENDEDOR' ? 'Aguardando...' : 'Aguardar convite'}
              <ArrowRight className="h-4 w-4" />
            </AuraButton>
          </div>
        </div>

        {/* Footer info & Logout */}
        <div className="pt-2 text-center space-y-4">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs text-[#6E6B63] hover:text-[#9B3B2B] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta ({currentUser.email})
          </button>

          <p className="text-[11px] text-[#7A776E] flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
            Você poderá alterar permissões ou vincular novas unidades a qualquer momento.
          </p>
        </div>
      </div>

      <footer className="text-center text-[11px] text-[#8C887E] pt-4">
        Open CRM · Plataforma Multi-Segmento · Arquitetura Segura &amp; Multi-Tenant
      </footer>
    </div>
  );
}
