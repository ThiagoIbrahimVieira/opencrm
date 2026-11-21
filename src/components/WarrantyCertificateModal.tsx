import React from 'react';
import { Printer, X, ShieldCheck, Check, QrCode, ExternalLink, Receipt, MessageSquare } from 'lucide-react';
import { Customer, Order } from '../types/crm';
import { StoreTemplate } from '../types/template';
import { formatCurrencyBRL, formatDateBR, formatIMEI, maskCPF } from '../utils/imei';
import { generateQrMatrix, buildWhatsAppWarrantyShareUrl } from '../utils/qrAndWhatsapp';
import { AuraButton } from './ui/AuraPrimitives';

interface WarrantyCertificateModalProps {
  order: Order | null;
  customer: Customer | null;
  template?: StoreTemplate;
  onClose: () => void;
  onPreviewPublicWarranty: (publicToken: string) => void;
}

export function WarrantyCertificateModal({
  order,
  customer,
  template,
  onClose,
  onPreviewPublicWarranty,
}: WarrantyCertificateModalProps) {
  const [showFullCpf, setShowFullCpf] = React.useState(false);

  const hasWarrantyQr = template ? template.features.hasWarrantyQr : true;
  const hasSerializedItems = template ? template.features.hasSerializedItems : true;
  const storeName = template?.storeName ?? 'AuraCell';
  const primarySingular = template?.labels.primaryItemSingular ?? 'Aparelho Serializado';
  const secondaryPlural = template?.labels.secondaryTabName ?? 'Acessórios';

  const qrMatrix = React.useMemo(
    () =>
      order && hasWarrantyQr
        ? generateQrMatrix(`https://opencrm-ashy.vercel.app/garantia/${order.publicToken}`)
        : [],
    [order, hasWarrantyQr]
  );

  if (!order || !customer) return null;

  const docTitle = hasWarrantyQr ? 'Termo de Garantia' : 'Comprovante de Pedido';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1E1B]/45 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${docTitle} ${order.code}`}
        className="w-full max-w-2xl bg-[#F4F2EC] rounded-2xl border border-[#E5E2D9] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Controls (hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-white border-b border-[#E5E2D9] no-print shrink-0">
          <div className="flex items-center gap-2.5">
            {hasWarrantyQr ? (
              <ShieldCheck className="h-4.5 w-4.5 text-[#4F5A47]" />
            ) : (
              <Receipt className="h-4.5 w-4.5 text-[#4F5A47]" />
            )}
            <span className="text-sm font-medium text-[#1F1E1B]">
              {docTitle} · <span className="font-mono text-xs">{order.code}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasWarrantyQr && (
              <>
                <AuraButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const waUrl = buildWhatsAppWarrantyShareUrl({
                      phone: customer.phone,
                      customerName: customer.name,
                      storeName,
                      publicToken: order.publicToken,
                    });
                    window.open(waUrl, '_blank', 'noopener,noreferrer');
                  }}
                  title="Enviar link público no WhatsApp do cliente"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#2E472D]" />
                  Enviar Garantia no WhatsApp
                </AuraButton>
                <AuraButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onPreviewPublicWarranty(order.publicToken)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Pré-visualizar página pública do cliente
                </AuraButton>
              </>
            )}
            <AuraButton
              variant="ghost"
              size="sm"
              onClick={() => setShowFullCpf((v) => !v)}
            >
              {showFullCpf ? 'Mascarar CPF' : 'Exibir CPF'}
            </AuraButton>
            <AuraButton variant="primary" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              {hasWarrantyQr ? 'Imprimir Termo' : 'Imprimir Comprovante'}
            </AuraButton>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar documento"
              className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] hover:text-[#1F1E1B] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Editorial Sheet */}
        <div className="overflow-y-auto p-5 sm:p-8 flex-1">
          <div
            id="auracell-printable-document"
            className="bg-white border border-[#E5E2D9] rounded-2xl p-6 sm:p-9 text-[#1F1E1B] space-y-6"
          >
            {/* Letterhead */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#E5E2D9]">
              <div>
                <p className="text-[11px] tracking-widest uppercase text-[#6E6B63] mb-1">
                  {hasWarrantyQr
                    ? 'Certificado de Procedência & Cobertura'
                    : 'Comprovante de Pedido no Balcão'}
                </p>
                <h2 className="font-serif text-3xl text-[#1F1E1B] leading-tight">
                  {storeName}
                </h2>
                <p className="text-xs text-[#6E6B63] mt-1">
                  {template?.segment ?? 'Loja Jardins · São Paulo · SP'} · Open CRM
                </p>
              </div>
              <div className="sm:text-right space-y-1">
                <p className="font-mono text-xs text-[#1F1E1B] font-medium">
                  Nº {order.code}
                </p>
                <p className="text-xs text-[#6E6B63] tabular-nums">
                  Emissão: {formatDateBR(order.issuedAt)}
                </p>
                {hasWarrantyQr && (
                  <p className="text-xs font-medium text-[#2E472D] bg-[#E6ECE3] inline-block px-2.5 py-0.5 rounded-full tabular-nums">
                    Válido até {formatDateBR(order.warrantyExpiresAt)} ({order.warrantyDays} dias)
                  </p>
                )}
              </div>
            </div>

            {/* Customer Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-[#6E6B63]">
                  {hasWarrantyQr ? 'Titular da Garantia' : 'Cliente'}
                </p>
                <p className="text-sm font-medium text-[#1F1E1B]">{customer.name}</p>
                <p className="text-[#6E6B63]">{customer.email}</p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p className="text-[#6E6B63]">Documento & Cidade</p>
                <p className="font-mono text-xs text-[#1F1E1B]">
                  CPF: {showFullCpf ? customer.cpf : maskCPF(customer.cpf)}
                </p>
                <p className="text-[#6E6B63]">{customer.city}</p>
              </div>
            </div>

            {/* Primary Item Block */}
            {order.smartphoneSnapshot && (
              <div className="rounded-xl bg-[#F8F7F3] border border-[#E5E2D9] p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-[#6E6B63]">
                      {hasSerializedItems ? 'Aparelho Serializado' : primarySingular}
                    </p>
                    <p className="font-serif text-xl text-[#1F1E1B]">
                      {order.smartphoneSnapshot.brand} {order.smartphoneSnapshot.model}
                    </p>
                    <p className="text-xs text-[#6E6B63]">
                      {[
                        order.smartphoneSnapshot.storage,
                        order.smartphoneSnapshot.color,
                        order.smartphoneSnapshot.condition,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      {hasSerializedItems && (
                        <>
                          {' '}
                          · Bateria{' '}
                          <span className="tabular-nums font-medium text-[#1F1E1B]">
                            {order.smartphoneSnapshot.batteryHealth}%
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-[#1F1E1B]">
                    {formatCurrencyBRL(order.smartphoneSnapshot.unitPrice)}
                  </p>
                </div>

                {hasSerializedItems && order.smartphoneSnapshot.imei1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E5E2D9]">
                    <div>
                      <p className="text-[11px] text-[#6E6B63]">IMEI 1 (Validado Luhn)</p>
                      <p className="font-mono text-xs font-medium text-[#1F1E1B] mt-0.5">
                        {formatIMEI(order.smartphoneSnapshot.imei1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6E6B63]">IMEI 2</p>
                      <p className="font-mono text-xs text-[#1F1E1B] mt-0.5">
                        {order.smartphoneSnapshot.imei2
                          ? formatIMEI(order.smartphoneSnapshot.imei2)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6E6B63]">Número de Série</p>
                      <p className="font-mono text-xs font-medium text-[#1F1E1B] mt-0.5">
                        {order.smartphoneSnapshot.serialNumber}
                      </p>
                    </div>
                  </div>
                )}

                {/* Verified Physical Checklist (only if present) */}
                {order.smartphoneSnapshot.checklist.length > 0 && (
                  <div className="pt-3 border-t border-[#E5E2D9]">
                    <p className="text-[11px] font-medium text-[#6E6B63] mb-2">
                      Checklist Físico Conferido na Entrega
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {order.smartphoneSnapshot.checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
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
              </div>
            )}

            {/* Secondary Items Table if any */}
            {order.accessories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#6E6B63] mb-2">
                  {secondaryPlural} Inclusos no Pedido
                </p>
                <div className="border border-[#E5E2D9] rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8F7F3] text-[#6E6B63] border-b border-[#E5E2D9]">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Produto</th>
                        <th className="text-left font-medium px-3 py-2">SKU</th>
                        <th className="text-right font-medium px-3 py-2">Qtd</th>
                        <th className="text-right font-medium px-3 py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {order.accessories.map((acc) => (
                        <tr key={acc.accessoryId}>
                          <td className="px-3 py-2 text-[#1F1E1B]">{acc.name}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-[#6E6B63]">
                            {acc.sku}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{acc.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatCurrencyBRL(acc.unitPrice * acc.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Public QR Code Verification Block (ONLY when hasWarrantyQr is active) */}
            {hasWarrantyQr && (
              <div className="rounded-xl bg-[#FAF9F6] border border-[#E5E2D9] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl border border-[#E5E2D9] shrink-0">
                    <svg
                      width={76}
                      height={76}
                      viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                      shapeRendering="crispEdges"
                      role="img"
                      aria-label={`QR Code de consulta pública da garantia ${order.code}`}
                    >
                      <rect
                        width={qrMatrix.length}
                        height={qrMatrix.length}
                        fill="#FFFFFF"
                      />
                      {qrMatrix.map((row, rIdx) =>
                        row.map((cell, cIdx) =>
                          cell ? (
                            <rect
                              key={`${rIdx}-${cIdx}`}
                              x={cIdx}
                              y={rIdx}
                              width={1}
                              height={1}
                              fill="#1F1E1B"
                            />
                          ) : null
                        )
                      )}
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#1F1E1B] flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-[#4F5A47]" />
                      Consulta Pública de Garantia
                    </p>
                    <p className="text-[11px] text-[#6E6B63] leading-relaxed max-w-xs">
                      Escaneie para acompanhar dias restantes e os itens conferidos na saída (sem exposição de CPF ou valores internos).
                    </p>
                    <p className="font-mono text-[10px] text-[#6E6B63]">
                      UUID: {order.publicToken}
                    </p>
                  </div>
                </div>

                <div className="no-print shrink-0">
                  <AuraButton
                    variant="outline"
                    size="sm"
                    onClick={() => onPreviewPublicWarranty(order.publicToken)}
                  >
                    Abrir prévia mobile
                  </AuraButton>
                </div>
              </div>
            )}

            {/* Total & Payment */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E2D9] text-sm">
              <span className="text-[#6E6B63]">
                Pagamento via{' '}
                <strong className="font-medium text-[#1F1E1B]">
                  {order.paymentMethod}
                </strong>{' '}
                · Atendente {order.sellerName}
              </span>
              <span className="font-semibold text-base tabular-nums text-[#1F1E1B]">
                Total: {formatCurrencyBRL(order.totalAmount)}
              </span>
            </div>

            {/* Terms & Signatures */}
            <div className="pt-4 border-t border-[#E5E2D9] space-y-5">
              {hasWarrantyQr ? (
                <p className="text-[11px] leading-relaxed text-[#6E6B63]">
                  A {storeName} garante a cobertura contratada pelo prazo de{' '}
                  <strong className="text-[#1F1E1B]">{order.warrantyDays} dias</strong> a contar da data de emissão, mediante apresentação deste comprovante ou código QR.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-[#6E6B63]">
                  Comprovante de atendimento emitido pelo balcão {storeName}. Obrigado pela preferência!
                </p>
              )}

              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-[#6E6B63]">
                <div className="border-t border-[#CFCBC0] pt-2">
                  <p className="font-medium text-[#1F1E1B]">
                    {storeName} · {order.sellerName}
                  </p>
                  <p className="text-[11px]">Atendimento</p>
                </div>
                <div className="border-t border-[#CFCBC0] pt-2">
                  <p className="font-medium text-[#1F1E1B]">{customer.name}</p>
                  <p className="text-[11px]">Cliente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
