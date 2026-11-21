import React from 'react';
import { AlertCircle, Check, Copy, ShieldCheck, UserPlus } from 'lucide-react';
import { AuthUser, TeamMember, UserRole } from '../types/auth';
import { formatDateBR } from '../utils/imei';
import { AuraButton, StatusBadge } from './ui/AuraPrimitives';
import { CreatableSelect } from './ui/CreatableSelect';

interface TeamSettingsViewProps {
  currentUser: AuthUser;
  teamMembers: TeamMember[];
  onAddTeamMember: (input: { name: string; email: string; role: UserRole; password?: string }) => void;
  onToggleMemberActive: (memberId: string) => void;
}

export function TeamSettingsView({
  currentUser,
  teamMembers,
  onAddTeamMember,
  onToggleMemberActive,
}: TeamSettingsViewProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<UserRole>('VENDEDOR');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [copiedMemberEmail, setCopiedMemberEmail] = React.useState<string | null>(null);

  const handleCopyLink = (memberEmail: string, memberRole: UserRole) => {
    const roleParam = memberRole === 'ADMIN' ? 'admin' : 'vendedor';
    const url = `https://opencrm-ashy.vercel.app/?modo=cadastro&perfil=${roleParam}&email=${encodeURIComponent(
      memberEmail
    )}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedMemberEmail(memberEmail);
    setTimeout(() => setCopiedMemberEmail(null), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      onAddTeamMember({ name, email, role });
      setName('');
      setEmail('');
      setRole('VENDEDOR');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao adicionar membro.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[32px] leading-tight text-[#1F1E1B]">
          Configurações &amp; Equipe
        </h1>
        <p className="text-sm text-[#6E6B63] mt-0.5">
          Controle de acessos internos e permissões RBAC da loja AuraCell (exclusivo para Admin).
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Team Members List */}
        <section className="xl:col-span-8 bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EFECE6] flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
                Equipe Autorizada
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                Vendedores não visualizam custos de entrada, margens ou logs de auditoria.
              </p>
            </div>
            <span className="text-xs text-[#6E6B63] tabular-nums">
              {teamMembers.length} acessos
            </span>
          </div>

          <div className="divide-y divide-[#F0EDE6]">
            {teamMembers.map((member) => {
              const isSelf = member.id === currentUser.id;
              const isPending = member.isPendingInvite || (!member.active && member.role === 'VENDEDOR');
              return (
                <div
                  key={member.id}
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-9 w-9 rounded-full bg-[#ECEAE2] text-[#4F5A47] font-serif text-sm flex items-center justify-center shrink-0">
                      {member.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                        {member.name}
                        {isSelf && (
                          <span className="ml-2 text-[11px] font-normal text-[#6E6B63]">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#6E6B63] truncate">
                        {member.email} · desde {formatDateBR(member.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <StatusBadge
                      label={member.role === 'ADMIN' ? 'Admin' : 'Vendedor'}
                      tone={member.role === 'ADMIN' ? 'olive' : 'stone'}
                    />
                    <StatusBadge
                      label={isPending ? 'Convite Pendente' : member.active ? 'Ativo' : 'Desativado'}
                      tone={isPending ? 'amber' : member.active ? 'olive' : 'terracotta'}
                    />
                    <AuraButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(member.email, member.role)}
                      title="Copiar link de acesso para o vendedor"
                    >
                      {copiedMemberEmail === member.email ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#4F5A47]" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar link de acesso
                        </>
                      )}
                    </AuraButton>
                    {!isSelf && (
                      <AuraButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleMemberActive(member.id)}
                      >
                        {member.active ? 'Desativar' : 'Reativar'}
                      </AuraButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Provision New Team Member */}
        <section className="xl:col-span-4 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4.5 w-4.5 text-[#4F5A47]" />
            <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
              Novo Acesso Interno
            </h2>
          </div>

          <p className="text-xs text-[#6E6B63]">
            Cadastre novos membros sem exigir senha inicial. O vendedor receberá o link ou poderá criar a senha dele no primeiro acesso.
          </p>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-3 py-2.5 text-xs text-[#9B3B2B] flex items-center gap-2"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="team-name"
                className="block text-xs font-medium text-[#4A4842] mb-1.5"
              >
                Nome Completo
              </label>
              <input
                id="team-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Fernanda Lima"
                className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
              />
            </div>

            <div>
              <label
                htmlFor="team-email"
                className="block text-xs font-medium text-[#4A4842] mb-1.5"
              >
                E-mail Corporativo
              </label>
              <input
                id="team-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fernanda@auracell.com.br"
                className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
              />
            </div>

            <CreatableSelect
              id="team-role"
              label="Perfil de Permissão"
              value={role}
              creatable={false}
              searchPlaceholder="Buscar perfil..."
              options={[
                {
                  value: 'VENDEDOR',
                  label: 'Vendedor',
                  sublabel: 'Balcão, estoque e CRM (sem custos ou auditoria)',
                },
                {
                  value: 'ADMIN',
                  label: 'Admin',
                  sublabel: 'Acesso completo, custos, auditoria e equipe',
                },
              ]}
              onChange={(val) => setRole(val as UserRole)}
            />

            <AuraButton type="submit" variant="primary" size="md" className="w-full justify-center">
              <ShieldCheck className="h-4 w-4" />
              Liberar Acesso
            </AuraButton>
          </form>
        </section>
      </div>
    </div>
  );
}
