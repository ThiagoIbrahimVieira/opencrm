import React from 'react';
import { Check, Search, Smartphone as SmartphoneIcon, Package, Users, X } from 'lucide-react';
import { Accessory, ChecklistItem, Customer, Smartphone } from '../../types/crm';
import { formatCurrencyBRL, maskIMEI } from '../../utils/imei';

export type AuraButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type AuraButtonSize = 'sm' | 'md' | 'lg';

interface AuraButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AuraButtonVariant;
  size?: AuraButtonSize;
  children: React.ReactNode;
}

const BUTTON_VARIANTS: Record<AuraButtonVariant, string> = {
  primary:
    'bg-[#4F5A47] text-white hover:bg-[#3E4738] active:bg-[#343C2F] border border-transparent',
  secondary:
    'bg-[#E8E3D9] text-[#2C2A25] hover:bg-[#DDD7CA] active:bg-[#D4CDBE] border border-transparent',
  ghost:
    'bg-transparent text-[#2C2A25] hover:bg-[#EFECE6] active:bg-[#E6E2D8] border border-transparent',
  outline:
    'bg-white text-[#1F1E1B] border border-[#D4D0C5] hover:border-[#ABA596] hover:bg-[#FAF9F6]',
};

const BUTTON_SIZES: Record<AuraButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-[13px] rounded-xl gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
};

export function AuraButton({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: AuraButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface AuraToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export function AuraToggle({ checked, onChange, label, id }: AuraToggleProps) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-2.5 cursor-pointer select-none whitespace-nowrap shrink-0"
    >
      {label && <span className="text-[13px] font-medium text-[#4A4842]">{label}</span>}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ?? 'Alternar opção'}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40 ${
          checked ? 'bg-[#4F5A47]' : 'bg-[#CBC7BC]'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
            checked ? 'translate-x-5.5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

export type BadgeTone = 'olive' | 'amber' | 'stone' | 'terracotta';

const BADGE_STYLES: Record<BadgeTone, string> = {
  olive: 'bg-[#E6ECE3] text-[#2E472D]',
  amber: 'bg-[#F6ECD9] text-[#855312]',
  stone: 'bg-[#EFECE6] text-[#5C5850]',
  terracotta: 'bg-[#F8E5E2] text-[#9B3B2B]',
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${BADGE_STYLES[tone]}`}
    >
      {label}
    </span>
  );
}

export function getSmartphoneStatusTone(status: string): BadgeTone {
  if (status === 'Disponível') return 'olive';
  if (status === 'Reservado' || status === 'Em Avaliação') return 'amber';
  return 'stone';
}

export function getAccessoryStockBadge(stock: number, minStock: number): {
  label: string;
  tone: BadgeTone;
} {
  if (stock === 0) return { label: 'Esgotado', tone: 'terracotta' };
  if (stock <= minStock) return { label: 'Estoque Baixo', tone: 'amber' };
  return { label: 'Disponível', tone: 'olive' };
}

interface AuraChecklistProps {
  title?: string;
  items: ChecklistItem[];
  onToggle?: (itemId: string) => void;
  onAddItem?: (label: string) => void;
  readOnly?: boolean;
}

/**
 * Styled directly after Image 5's "Today — 3 of 5" checklist card,
 * with optional inline "+ Adicionar item ao checklist" input.
 */
export function AuraChecklist({
  title = 'Inspeção Física',
  items,
  onToggle,
  onAddItem,
  readOnly = false,
}: AuraChecklistProps) {
  const [newItemText, setNewItemText] = React.useState('');
  const checkedCount = items.filter((i) => i.checked).length;

  const handleAdd = () => {
    const clean = newItemText.trim();
    if (!clean || !onAddItem) return;
    onAddItem(clean);
    setNewItemText('');
  };

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-sm font-medium text-[#1F1E1B]">{title}</span>
        <span className="text-xs text-[#6E6B63] tabular-nums">
          {checkedCount} de {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const inner = (
            <>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                  item.checked
                    ? 'bg-[#4F5A47] border-[#4F5A47] text-white'
                    : 'bg-white border-[#C9C5B9] text-transparent'
                }`}
              >
                <Check className="h-3 w-3 stroke-[2.5]" />
              </span>
              <span
                className={`text-[13px] transition-colors ${
                  item.checked ? 'text-[#1F1E1B]' : 'text-[#6E6B63]'
                }`}
              >
                {item.label}
              </span>
            </>
          );

          if (readOnly || !onToggle) {
            return (
              <div key={item.id} className="flex items-center gap-3 py-0.5">
                {inner}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={item.checked}
              className="w-full flex items-center gap-3 py-1 px-1 -mx-1 rounded-lg hover:bg-[#F4F2EC]/70 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40"
            >
              {inner}
            </button>
          );
        })}
      </div>

      {!readOnly && onAddItem && (
        <div className="mt-3.5 pt-3 border-t border-[#EFECE6] flex items-center gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="+ Adicionar item ao checklist..."
            aria-label="Adicionar item ao checklist"
            className="flex-1 h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
          />
          <AuraButton
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={!newItemText.trim()}
          >
            Adicionar
          </AuraButton>
        </div>
      )}
    </div>
  );
}

interface ProgressRingProps {
  percent: number;
  valueLabel: string;
  subLabel: string;
  caption?: string;
  title: string;
  tone?: 'olive' | 'amber' | 'terracotta';
}

export function ProgressRing({
  percent,
  valueLabel,
  subLabel,
  caption,
  title,
  tone = 'olive',
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const size = 88;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    tone === 'terracotta'
      ? '#9B3B2B'
      : tone === 'amber'
        ? '#B3741E'
        : '#4F5A47';

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 flex flex-col items-center text-center shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
      <span className="text-xs font-medium text-[#6E6B63] mb-3 truncate max-w-full">
        {title}
      </span>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ECEAE2"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span className="text-[15px] font-semibold text-[#1F1E1B] tabular-nums leading-tight">
            {valueLabel}
          </span>
          <span className="text-[10px] text-[#6E6B63] leading-tight mt-0.5 truncate max-w-full">
            {subLabel}
          </span>
        </div>
      </div>
      {caption && (
        <span className="text-[11px] text-[#6E6B63] mt-2.5 truncate max-w-full">
          {caption}
        </span>
      )}
    </div>
  );
}

export interface ToastMessage {
  id: string;
  message: string;
  detail?: string;
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-4 lg:left-[280px] z-[70] flex flex-col gap-2 max-w-[310px] w-[calc(100vw-2rem)] pointer-events-none no-print"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto bg-[#1F1E1B] text-[#F4F2EC] rounded-xl px-4 py-3 shadow-lg border border-[#383631] flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-snug">{toast.message}</p>
            {toast.detail && (
              <p className="text-xs text-[#C6C2B8] mt-0.5 leading-snug">{toast.detail}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={() => onDismiss(toast.id)}
            className="text-[#A8A49B] hover:text-white p-0.5 rounded cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface CommandSearchModalProps {
  open: boolean;
  onClose: () => void;
  smartphones: Smartphone[];
  accessories: Accessory[];
  customers: Customer[];
  onSelectSmartphone: (sp: Smartphone) => void;
  onSelectAccessory: (acc: Accessory) => void;
  onSelectCustomer: (customer: Customer) => void;
}

export function CommandSearchModal({
  open,
  onClose,
  smartphones,
  accessories,
  customers,
  onSelectSmartphone,
  onSelectAccessory,
  onSelectCustomer,
}: CommandSearchModalProps) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matchedPhones = smartphones
    .filter(
      (s) =>
        !q ||
        s.model.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        s.imei1.includes(q) ||
        s.color.toLowerCase().includes(q)
    )
    .slice(0, 4);

  const matchedAccessories = accessories
    .filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    )
    .slice(0, 4);

  const matchedCustomers = customers
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    )
    .slice(0, 4);

  const hasAny =
    matchedPhones.length > 0 || matchedAccessories.length > 0 || matchedCustomers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1E1B]/35 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4 no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida AuraCell"
        className="w-full max-w-xl bg-white border border-[#E5E2D9] rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E2D9]">
          <Search className="h-4 w-4 text-[#6E6B63] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar aparelho, IMEI, SKU de acessório ou cliente..."
            className="w-full text-[16px] md:text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="text-xs text-[#6E6B63] bg-[#F4F2EC] border border-[#E5E2D9] rounded-md px-2.5 py-1 min-h-[36px] hover:text-[#1F1E1B] cursor-pointer shrink-0"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!hasAny && (
            <p className="text-center text-sm text-[#6E6B63] py-8">
              Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
            </p>
          )}

          {matchedPhones.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-[#6E6B63] px-2 mb-1.5">Aparelhos</p>
              <div className="space-y-1">
                {matchedPhones.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      onSelectSmartphone(sp);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-[#F4F2EC] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-7 w-7 rounded-lg bg-[#ECEAE2] flex items-center justify-center text-[#4F5A47] shrink-0">
                        <SmartphoneIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                          {sp.model} · {sp.storage} · {sp.color}
                        </p>
                        <p className="text-[11px] font-mono text-[#6E6B63]">
                          IMEI {maskIMEI(sp.imei1)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#1F1E1B] tabular-nums shrink-0">
                      {formatCurrencyBRL(sp.salePrice)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedAccessories.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-[#6E6B63] px-2 mb-1.5">Acessórios</p>
              <div className="space-y-1">
                {matchedAccessories.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      onSelectAccessory(acc);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-[#F4F2EC] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-7 w-7 rounded-lg bg-[#ECEAE2] flex items-center justify-center text-[#4F5A47] shrink-0">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                          {acc.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#6E6B63]">{acc.sku}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#6E6B63] tabular-nums shrink-0">
                      {acc.stock} un.
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedCustomers.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-[#6E6B63] px-2 mb-1.5">Clientes</p>
              <div className="space-y-1">
                {matchedCustomers.map((cu) => (
                  <button
                    key={cu.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(cu);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-[#F4F2EC] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-7 w-7 rounded-full bg-[#E8E3D9] flex items-center justify-center text-[11px] font-medium text-[#2C2A25] shrink-0">
                        {cu.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                          {cu.name}
                        </p>
                        <p className="text-[11px] text-[#6E6B63] truncate">{cu.city}</p>
                      </div>
                    </div>
                    <Users className="h-3.5 w-3.5 text-[#6E6B63] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
