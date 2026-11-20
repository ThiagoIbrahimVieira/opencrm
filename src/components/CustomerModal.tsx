import React from 'react';
import { AlertCircle, Plus, Tag, UserCheck, UserPlus, X } from 'lucide-react';
import {
  CreateCustomerInput,
  Customer,
  CustomerSegment,
  CustomerStatus,
  DeviceModel,
  UpdateCustomerInput,
} from '../types/crm';
import { AuraButton } from './ui/AuraPrimitives';
import { CreatableMultiSelect, CreatableSelect } from './ui/CreatableSelect';

interface CustomerModalProps {
  open: boolean;
  editingCustomer: Customer | null;
  deviceModels: DeviceModel[];
  onClose: () => void;
  onAddDeviceModel: (params: { name: string; brand?: string }) => DeviceModel;
  onCreateCustomer: (input: CreateCustomerInput) => void;
  onUpdateCustomer: (customerId: string, input: UpdateCustomerInput) => void;
}

const STATUS_OPTIONS = [
  { value: 'ATIVO', label: 'Ativo', sublabel: 'Cliente com relacionamento ativo' },
  { value: 'LEAD', label: 'Lead / Interessado', sublabel: 'Em cotação ou aguardando aparelho' },
  { value: 'INATIVO', label: 'Inativo', sublabel: 'Sem compras recentes' },
];

const SEGMENT_OPTIONS = [
  { value: 'Varejo', label: 'Varejo' },
  { value: 'VIP', label: 'VIP' },
  { value: 'Corporativo', label: 'Corporativo' },
  { value: 'Revenda', label: 'Revenda' },
];

const CONTACT_OPTIONS = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Ligação', label: 'Ligação' },
  { value: 'E-mail', label: 'E-mail' },
];

const SUGGESTED_TAGS = [
  'iPhone',
  'Samsung',
  'Trade-in',
  'Prefere Película Privacidade',
  'MagSafe',
  'Nota Fiscal',
];

function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCpfInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function CustomerModal({
  open,
  editingCustomer,
  deviceModels,
  onClose,
  onAddDeviceModel,
  onCreateCustomer,
  onUpdateCustomer,
}: CustomerModalProps) {
  const isEdit = Boolean(editingCustomer);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [city, setCity] = React.useState('São Paulo, SP');
  const [status, setStatus] = React.useState<CustomerStatus>('ATIVO');
  const [segment, setSegment] = React.useState<CustomerSegment>('Varejo');
  const [preferredContact, setPreferredContact] = React.useState<
    'WhatsApp' | 'Ligação' | 'E-mail'
  >('WhatsApp');
  const [ownedModelIds, setOwnedModelIds] = React.useState<string[]>([]);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setTagInput('');
    if (editingCustomer) {
      setName(editingCustomer.name);
      setEmail(editingCustomer.email);
      setPhone(editingCustomer.phone);
      setCpf(editingCustomer.cpf);
      setCity(editingCustomer.city);
      setStatus(editingCustomer.status);
      setSegment(editingCustomer.segment);
      setPreferredContact(editingCustomer.preferredContact);
      setOwnedModelIds([...editingCustomer.ownedModelIds]);
      setTags([...editingCustomer.tags]);
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setCpf('');
      setCity('São Paulo, SP');
      setStatus('ATIVO');
      setSegment('Varejo');
      setPreferredContact('WhatsApp');
      setOwnedModelIds([]);
      setTags([]);
    }
  }, [open, editingCustomer]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addTag = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const payload = {
        name,
        email,
        phone,
        cpf,
        city,
        status,
        segment,
        preferredContact,
        tags,
        ownedModelIds,
      };
      if (editingCustomer) {
        onUpdateCustomer(editingCustomer.id, payload);
      } else {
        onCreateCustomer(payload);
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível salvar os dados do cliente.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1E1B]/45 backdrop-blur-[2px] flex justify-end no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar Cliente' : 'Novo Cliente'}
        className="w-full max-w-xl bg-[#F4F2EC] h-full shadow-2xl border-l border-[#DFDDD3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-[#E5E2D9] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
              {isEdit ? <UserCheck className="h-4.5 w-4.5" /> : <UserPlus className="h-4.5 w-4.5" />}
            </span>
            <div>
              <h2 className="font-serif text-2xl text-[#1F1E1B] leading-tight">
                {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                {isEdit
                  ? 'Atualize contato, segmento, tags e modelos — alteração registrada na auditoria.'
                  : 'Cadastre um cliente ou lead no CRM para acompanhamento e pós-venda.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de cliente"
            className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#F4F2EC] hover:text-[#1F1E1B] cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="customer-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-3.5 py-2.5 text-xs text-[#9B3B2B] flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Identification Card */}
          <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#7A776E]">
              Identificação & Contato
            </p>

            <div>
              <label
                htmlFor="cust-name"
                className="block text-xs font-medium text-[#4A4842] mb-1.5"
              >
                Nome Completo *
              </label>
              <input
                id="cust-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marina Alencar"
                className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="cust-email"
                  className="block text-xs font-medium text-[#4A4842] mb-1.5"
                >
                  E-mail *
                </label>
                <input
                  id="cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@dominio.com.br"
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
              </div>

              <div>
                <label
                  htmlFor="cust-phone"
                  className="block text-xs font-medium text-[#4A4842] mb-1.5"
                >
                  Telefone / WhatsApp *
                </label>
                <input
                  id="cust-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(11) 99999-0000"
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm font-mono text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="cust-cpf"
                  className="block text-xs font-medium text-[#4A4842] mb-1.5"
                >
                  CPF *
                </label>
                <input
                  id="cust-cpf"
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm font-mono text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
              </div>

              <div>
                <label
                  htmlFor="cust-city"
                  className="block text-xs font-medium text-[#4A4842] mb-1.5"
                >
                  Cidade / UF
                </label>
                <input
                  id="cust-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo, SP"
                  className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
              </div>
            </div>
          </div>

          {/* Classification Card */}
          <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#7A776E]">
              Classificação & Relacionamento
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <CreatableSelect
                id="cust-status"
                label="Status *"
                value={status}
                creatable={false}
                searchPlaceholder="Buscar status..."
                options={STATUS_OPTIONS}
                onChange={(val) => setStatus(val as CustomerStatus)}
              />

              <CreatableSelect
                id="cust-segment"
                label="Segmento *"
                value={segment}
                creatable={false}
                searchPlaceholder="Buscar segmento..."
                options={SEGMENT_OPTIONS}
                onChange={(val) => setSegment(val as CustomerSegment)}
              />

              <CreatableSelect
                id="cust-contact"
                label="Canal Preferido"
                value={preferredContact}
                creatable={false}
                searchPlaceholder="Buscar canal..."
                options={CONTACT_OPTIONS}
                onChange={(val) =>
                  setPreferredContact(val as 'WhatsApp' | 'Ligação' | 'E-mail')
                }
              />
            </div>

            {/* Dynamic Tags */}
            <div className="space-y-2 pt-1">
              <label
                htmlFor="cust-tag-input"
                className="block text-xs font-medium text-[#4A4842]"
              >
                Tags do Cliente
              </label>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#4F5A47] text-[#F4F2EC] text-xs font-medium"
                    >
                      <Tag className="h-3 w-3 opacity-80" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remover tag ${tag}`}
                        className="ml-0.5 hover:text-white cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="cust-tag-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Ex: iPhone, Prefere Película Privacidade, Trade-in..."
                  className="flex-1 h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
                <AuraButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </AuraButton>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {SUGGESTED_TAGS.filter(
                  (sug) => !tags.some((t) => t.toLowerCase() === sug.toLowerCase())
                ).map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => addTag(sug)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#FAF9F6] border border-[#E5E2D9] text-[#5E5B54] hover:border-[#4F5A47] hover:text-[#1F1E1B] transition-colors cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Owned Models (feeds Smart Compatible Accessories Engine) */}
          <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5">
            <CreatableMultiSelect
              label="Modelos de Aparelho do Cliente (para cruzar acessórios compatíveis)"
              selectedValues={ownedModelIds}
              options={deviceModels.map((m) => ({
                value: m.id,
                label: m.tagLabel,
              }))}
              placeholder="Buscar modelo (ex: iPhone 15 Pro, S24 Ultra)..."
              addButtonLabel="Adicionar modelo/tag"
              onChange={setOwnedModelIds}
              onCreateOption={(label) => {
                const created = onAddDeviceModel({ name: label });
                return created.id;
              }}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5E2D9] flex items-center justify-end gap-2.5 shrink-0">
          <AuraButton variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </AuraButton>
          <AuraButton type="submit" form="customer-form" variant="primary" size="md">
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </AuraButton>
        </div>
      </div>
    </div>
  );
}
