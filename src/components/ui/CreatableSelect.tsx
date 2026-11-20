import React from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  searchKeywords?: string;
}

interface CreatableSelectProps {
  id?: string;
  label?: string;
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  creatable?: boolean;
  createLabelPrefix?: string;
  onChange: (value: string) => void;
  onCreateOption?: (newLabel: string) => string | void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Custom Warm Editorial Boutique searchable & creatable combobox.
 * Replaces all native browser <select> menus cleanly with keyboard navigation.
 */
export function CreatableSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar ou digitar novo...',
  creatable = true,
  createLabelPrefix = 'Criar',
  onChange,
  onCreateOption,
  className = '',
  size = 'md',
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.searchKeywords && opt.searchKeywords.toLowerCase().includes(q))
    );
  }, [options, query]);

  const trimmedQuery = query.trim();
  const exactExists = options.some(
    (opt) =>
      opt.label.toLowerCase() === trimmedQuery.toLowerCase() ||
      opt.value.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canCreate = creatable && trimmedQuery.length > 0 && !exactExists;

  React.useEffect(() => {
    if (!open) return;
    setHighlightIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setQuery('');
    setOpen(false);
  };

  const handleCreate = () => {
    if (!trimmedQuery) return;
    const createdValue = onCreateOption?.(trimmedQuery);
    onChange(typeof createdValue === 'string' ? createdValue : trimmedQuery);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = filtered.length + (canCreate ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalItems > 0) setHighlightIndex((i) => (i + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalItems > 0) setHighlightIndex((i) => (i - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex < filtered.length) {
        handleSelect(filtered[highlightIndex].value);
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const triggerHeight = size === 'sm' ? 'h-9 text-xs' : 'h-10 text-sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[#4A4842] mb-1.5"
        >
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`w-full ${triggerHeight} px-3 rounded-xl bg-[#FAF9F6] border transition-colors flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40 ${
          open ? 'border-[#4F5A47] bg-white' : 'border-[#DDDAD0] hover:border-[#BDB8AA]'
        }`}
      >
        <span
          className={`truncate ${
            selectedOption || value ? 'text-[#1F1E1B]' : 'text-[#9A968D]'
          }`}
        >
          {selectedOption?.label ?? (value || placeholder)}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#6E6B63] shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-[#4F5A47]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 z-40 bg-white border border-[#E5E2D9] rounded-xl shadow-lg overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#EFECE6] bg-[#FAF9F6]">
            <Search className="h-3.5 w-3.5 text-[#8C887E] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full text-xs text-[#1F1E1B] placeholder:text-[#9A968D] bg-transparent focus:outline-none"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQuery('')}
                className="text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EEF2EB] text-[#2E472D] font-medium'
                      : isHighlighted
                        ? 'bg-[#F4F2EC] text-[#1F1E1B]'
                        : 'text-[#2C2A25] hover:bg-[#F4F2EC]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs truncate">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-[11px] text-[#6E6B63] truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0" />}
                </button>
              );
            })}

            {canCreate && (
              <button
                type="button"
                onMouseEnter={() => setHighlightIndex(filtered.length)}
                onClick={handleCreate}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                  highlightIndex === filtered.length
                    ? 'bg-[#4F5A47] text-white'
                    : 'text-[#4F5A47] hover:bg-[#EEF2EB]'
                }`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {createLabelPrefix} &ldquo;{trimmedQuery}&rdquo;
                </span>
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <p className="px-3 py-4 text-center text-xs text-[#6E6B63]">
                Nenhuma opção encontrada.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CreatableMultiSelectProps {
  label: string;
  selectedValues: string[];
  options: ComboboxOption[];
  placeholder?: string;
  addButtonLabel?: string;
  onChange: (nextValues: string[]) => void;
  onCreateOption: (newLabel: string) => string;
}

/**
 * Searchable + Creatable Multi-Select for Compatible Device Models / Tags.
 */
export function CreatableMultiSelect({
  label,
  selectedValues,
  options,
  placeholder = 'Buscar modelos (ex: iPhone 15, S24, Redmi, USB-C)...',
  addButtonLabel = 'Adicionar modelo/tag',
  onChange,
  onCreateOption,
}: CreatableMultiSelectProps) {
  const [query, setQuery] = React.useState('');
  const [addingInline, setAddingInline] = React.useState(false);
  const [inlineDraft, setInlineDraft] = React.useState('');

  const optionMap = React.useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options]
  );

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        (o.searchKeywords && o.searchKeywords.toLowerCase().includes(q))
    );
  }, [options, query]);

  const trimmedQuery = query.trim();
  const queryExists = options.some(
    (o) => o.label.toLowerCase() === trimmedQuery.toLowerCase()
  );

  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleCreateFromName = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;
    const newId = onCreateOption(clean);
    if (!selectedValues.includes(newId)) {
      onChange([...selectedValues, newId]);
    }
  };

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#4A4842]">{label}</span>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[#6E6B63] tabular-nums">
            {selectedValues.length} selecionado{selectedValues.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setAddingInline((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#4F5A47] hover:text-[#3E4738] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {addButtonLabel}
          </button>
        </div>
      </div>

      {/* Inline quick-add model/tag input */}
      {addingInline && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F8F7F3] border border-[#E5E2D9]">
          <input
            type="text"
            value={inlineDraft}
            onChange={(e) => setInlineDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (inlineDraft.trim()) {
                  handleCreateFromName(inlineDraft);
                  setInlineDraft('');
                  setAddingInline(false);
                }
              }
            }}
            placeholder="Ex: iPhone 17 Air, Galaxy A56, MagSafe..."
            aria-label="Novo modelo ou tag compatível"
            className="flex-1 h-8 px-2.5 rounded-lg bg-white border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
          />
          <button
            type="button"
            onClick={() => {
              if (inlineDraft.trim()) {
                handleCreateFromName(inlineDraft);
                setInlineDraft('');
                setAddingInline(false);
              }
            }}
            className="h-8 px-3 rounded-lg bg-[#4F5A47] text-white text-xs font-medium hover:bg-[#3E4738] cursor-pointer whitespace-nowrap"
          >
            Criar e marcar
          </button>
        </div>
      )}

      {/* Selected tags summary */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {selectedValues.map((val) => {
            const labelText = optionMap.get(val)?.label ?? val;
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-[#4F5A47] text-white"
              >
                {labelText}
                <button
                  type="button"
                  aria-label={`Remover ${labelText}`}
                  onClick={() => toggleValue(val)}
                  className="p-0.5 rounded-full hover:bg-white/20 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search box */}
      <div className="relative">
        <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmedQuery && !queryExists) {
              e.preventDefault();
              handleCreateFromName(trimmedQuery);
              setQuery('');
            }
          }}
          placeholder={placeholder}
          aria-label="Buscar modelos compatíveis"
          className="w-full h-9 pl-8 pr-8 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar busca de modelos"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable interactive grid */}
      <div className="max-h-44 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
        {filteredOptions.map((opt) => {
          const active = selectedValues.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleValue(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#EEF2EB] text-[#2E472D] border-[#4F5A47]/40'
                  : 'bg-[#FAF9F6] text-[#4A4842] border-[#E5E2D9] hover:border-[#BDB8AA]'
              }`}
            >
              {active && <span className="mr-1">✓</span>}
              {opt.label}
            </button>
          );
        })}

        {trimmedQuery && !queryExists && (
          <button
            type="button"
            onClick={() => {
              handleCreateFromName(trimmedQuery);
              setQuery('');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8E3D9] text-[#2C2A25] hover:bg-[#DDD7CA] cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            Criar &ldquo;{trimmedQuery}&rdquo;
          </button>
        )}
      </div>
    </div>
  );
}
