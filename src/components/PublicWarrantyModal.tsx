import React from 'react';
import { Check, ShieldCheck, Smartphone, X } from 'lucide-react';
import { PublicWarrantyViewData } from '../types/crm';
import { formatDateBR } from '../utils/imei';
import { AuraButton, ProgressRing, StatusBadge } from './ui/AuraPrimitives';

interface PublicWarrantyModalProps {
  data: PublicWarrantyViewData | null;
  onClose: () => void;
}

/**
 * Simulates the public mobile verification page scanned via QR Code on the Warranty Certificate.
 * Intentionally excludes CPF, phone number, e-mail, and cost prices.
 */
export function PublicWarrantyModal({ data, onClose }: PublicWarrantyModalProps) {
  if (!data) return null;

  const isExpired = data.daysRemaining <= 0;
  const isExpiringSoon = data.daysRemaining > 0 && data.daysRemaining <= 15;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#1F1E1B]/55 backdrop-blur-[3px] flex items-center justify-center p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Consulta Pública de Garantia AuraCell"
        className="w-full max-w-[410px] bg-[#F4F2EC] rounded-[28px] border border-[#D8D4C9] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simulated Mobile Header Bar */}
        <div className="px-5 py-3.5 bg-[#ECEAE2] border-b border-[#DFDDD3] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-6 w-6 rounded-full bg-[#4F5A47] text-[#F4F2EC] font-serif text-xs flex items-center justify-center shrink-0">
              A
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#1F1E1B] truncate">
                Consulta Pública · AuraCell
              </p>
              <p className="font-mono text-[10px] text-[#6E6B63] truncate">
                auracell.com.br/garantia/{data.publicToken.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização pública"
            className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#DFDDD3] hover:text-[#1F1E1B] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Public Customer Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Verified Authenticity Hero */}
          <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6ECE3] text-[#2E472D] text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              Garantia Autenticada
            </div>

            <div>
              <h2 className="font-serif text-2xl text-[#1F1E1B] leading-tight">
                {data.deviceBrand} {data.deviceModel}
              </h2>
              {(data.deviceStorage || data.deviceColor) && (
                <p className="text-xs text-[#6E6B63] mt-1">
                  {[data.deviceStorage, data.deviceColor, data.deviceCondition]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8F7F3] border border-[#EAE7DF] text-xs">
              <Smartphone className="h-3.5 w-3.5 text-[#4F5A47]" />
              <span className="text-[#6E6B63]">IMEI final</span>
              <span className="font-mono font-semibold text-[#1F1E1B]">
                •••••••••••{data.imeiLast4}
              </span>
            </div>
          </div>

          {/* Remaining Warranty Ring + Progress Bar */}
          <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F1E1B]">
                Cobertura de Garantia
              </span>
              <StatusBadge
                label={
                  isExpired
                    ? 'Encerrada'
                    : isExpiringSoon
                      ? 'Vence em breve'
                      : 'Ativa'
                }
                tone={isExpired ? 'stone' : isExpiringSoon ? 'amber' : 'olive'}
              />
            </div>

            <div className="flex justify-center">
              <ProgressRing
                title={`Certificado ${data.orderCode}`}
                percent={data.percentRemaining}
                valueLabel={`${data.daysRemaining}d`}
                subLabel={`de ${data.warrantyDays}d`}
                caption={`Válida até ${formatDateBR(data.warrantyExpiresAt)}`}
                tone={isExpired ? 'terracotta' : isExpiringSoon ? 'amber' : 'olive'}
              />
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-[#ECEAE2] overflow-hidden">
                <div
                  style={{ width: `${data.percentRemaining}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isExpired
                      ? 'bg-[#9B3B2B]'
                      : isExpiringSoon
                        ? 'bg-[#B3741E]'
                        : 'bg-[#4F5A47]'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#6E6B63] tabular-nums">
                <span>Emissão: {formatDateBR(data.issuedAt)}</span>
                <span>Término: {formatDateBR(data.warrantyExpiresAt)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Physical Checklist */}
          {data.checklist.length > 0 && (
            <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1F1E1B]">
                  Checklist de Saída Conferido
                </span>
                <span className="text-[11px] text-[#6E6B63] tabular-nums">
                  {data.checklist.filter((c) => c.checked).length} de {data.checklist.length}
                </span>
              </div>

              <div className="space-y-2">
                {data.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 text-xs">
                    <span
                      className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                        item.checked
                          ? 'bg-[#4F5A47] text-white'
                          : 'border border-[#C9C5B9] text-transparent'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                    </span>
                    <span
                      className={
                        item.checked ? 'text-[#1F1E1B]' : 'text-[#9A968D] line-through'
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Guarantee Footer */}
          <p className="text-[11px] text-[#6E6B63] text-center leading-relaxed px-2">
            Por privacidade (LGPD), esta consulta pública exibe apenas dados técnicos do aparelho e o status da garantia.
          </p>
        </div>

        <div className="px-5 py-3.5 bg-white border-t border-[#E5E2D9] shrink-0">
          <AuraButton variant="secondary" size="md" className="w-full" onClick={onClose}>
            Voltar ao Termo
          </AuraButton>
        </div>
      </div>
    </div>
  );
}
