import React from 'react';
import { Search, ShieldAlert, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import { AuditLogEntry, StockLedgerEntry } from '../types/crm';
import { StatusBadge } from './ui/AuraPrimitives';

interface AuditLedgerViewProps {
  auditLogs: AuditLogEntry[];
  stockLedger: StockLedgerEntry[];
}

type AuditTab = 'audit' | 'ledger';

function formatTimestampBR(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLedgerView({ auditLogs, stockLedger }: AuditLedgerViewProps) {
  const [activeTab, setActiveTab] = React.useState<AuditTab>('audit');
  const [query, setQuery] = React.useState('');

  const q = query.trim().toLowerCase();

  const filteredAudit = React.useMemo(() => {
    if (!q) return auditLogs;
    return auditLogs.filter(
      (entry) =>
        entry.actor.toLowerCase().includes(q) ||
        entry.actionLabel.toLowerCase().includes(q) ||
        entry.targetLabel.toLowerCase().includes(q) ||
        (entry.detail && entry.detail.toLowerCase().includes(q))
    );
  }, [auditLogs, q]);

  const filteredLedger = React.useMemo(() => {
    if (!q) return stockLedger;
    return stockLedger.filter(
      (entry) =>
        entry.actor.toLowerCase().includes(q) ||
        entry.itemLabel.toLowerCase().includes(q) ||
        entry.sku.toLowerCase().includes(q) ||
        entry.reason.toLowerCase().includes(q) ||
        (entry.note && entry.note.toLowerCase().includes(q))
    );
  }, [stockLedger, q]);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px] leading-tight text-[#1F1E1B]">
              Auditoria & Estoque (Ledger)
            </h1>
            <p className="text-sm text-[#6E6B63] mt-0.5">
              Rastreamento imutável de acessos sensíveis, alterações operacionais e movimentação de inventário.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar usuário, ação, SKU ou item..."
              aria-label="Filtrar auditoria e movimentações"
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-white border border-[#D4D0C5] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
            />
          </div>
        </div>

        {/* Clean Underlined Tabs */}
        <div className="flex items-center gap-7 border-b border-[#DFDDD3]" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-[#4F5A47] text-[#1F1E1B]'
                : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Log de Auditoria
            <span className="text-xs text-[#6E6B63] tabular-nums">
              ({auditLogs.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ledger'}
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'border-[#4F5A47] text-[#1F1E1B]'
                : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico de Movimentação (Stock Ledger)
            <span className="text-xs text-[#6E6B63] tabular-nums">
              ({stockLedger.length})
            </span>
          </button>
        </div>
      </header>

      <div className="bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'audit' ? (
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#E5E2D9] bg-[#FAF9F6] text-[11px] font-medium text-[#6E6B63]">
                  <th className="pl-5 pr-3 py-3">Horário</th>
                  <th className="px-3 py-3">Usuário</th>
                  <th className="px-3 py-3">Ação</th>
                  <th className="px-3 py-3">Alvo</th>
                  <th className="pl-3 pr-5 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6] text-[13px]">
                {filteredAudit.map((entry) => {
                  const isSensitive =
                    entry.actionType === 'REVEAL_IMEI' ||
                    entry.actionType === 'REVEAL_PII';
                  return (
                    <tr key={entry.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="pl-5 pr-3 py-3.5 font-mono text-xs text-[#6E6B63] whitespace-nowrap tabular-nums">
                        {formatTimestampBR(entry.timestamp)}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-[#1F1E1B]">{entry.actor}</span>
                        <span className="ml-2 text-[11px] text-[#6E6B63]">
                          {entry.actorRole === 'ADMIN' ? 'Admin' : 'Vendedor'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <StatusBadge
                          label={entry.actionLabel}
                          tone={
                            isSensitive
                              ? 'amber'
                              : entry.actionType === 'CREATE_ORDER'
                                ? 'olive'
                                : 'stone'
                          }
                        />
                      </td>
                      <td className="px-3 py-3.5 font-medium text-[#1F1E1B]">
                        {entry.targetLabel}
                      </td>
                      <td className="pl-3 pr-5 py-3.5 text-xs text-[#6E6B63]">
                        {entry.detail ?? '—'}
                      </td>
                    </tr>
                  );
                })}

                {filteredAudit.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-[#6E6B63]">
                      Nenhum evento de auditoria encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-[#E5E2D9] bg-[#FAF9F6] text-[11px] font-medium text-[#6E6B63]">
                  <th className="pl-5 pr-3 py-3">Horário</th>
                  <th className="px-3 py-3">Movimentação</th>
                  <th className="px-3 py-3">Item & SKU</th>
                  <th className="px-3 py-3">Responsável</th>
                  <th className="px-3 py-3 text-right">Saldo Resultante</th>
                  <th className="pl-3 pr-5 py-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6] text-[13px]">
                {filteredLedger.map((row) => {
                  const isPositive = row.delta > 0;
                  const deltaLabel = `${isPositive ? '+' : ''}${row.delta} ${row.reason}`;
                  return (
                    <tr key={row.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="pl-5 pr-3 py-3.5 font-mono text-xs text-[#6E6B63] whitespace-nowrap tabular-nums">
                        {formatTimestampBR(row.timestamp)}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                            row.reason === 'Trade-in'
                              ? 'bg-[#F6ECD9] text-[#855312]'
                              : isPositive
                                ? 'bg-[#E6ECE3] text-[#2E472D]'
                                : 'bg-[#EFECE6] text-[#5C5850]'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {deltaLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-medium text-[#1F1E1B]">{row.itemLabel}</p>
                        <p className="text-xs text-[#6E6B63]">
                          {row.itemType} · <span className="font-mono text-[11px]">{row.sku}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-[#4A4842] whitespace-nowrap">
                        {row.actor}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#1F1E1B] whitespace-nowrap">
                        {row.resultingStock} un.
                      </td>
                      <td className="pl-3 pr-5 py-3.5 text-xs text-[#6E6B63]">
                        {row.note ?? '—'}
                      </td>
                    </tr>
                  );
                })}

                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-[#6E6B63]">
                      Nenhuma movimentação registrada para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
