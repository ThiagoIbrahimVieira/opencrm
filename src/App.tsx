import React, { useSyncExternalStore } from 'react';
import { AlertCircle, Check, Menu, Search, Store } from 'lucide-react';
import { authService } from './services/authService';
import { crmService } from './services/crmService';
import { LoginCredentials, UserRole } from './types/auth';
import {
  AppSection,
  CreateAccessoryInput,
  CreateCustomerInput,
  CreateOrderInput,
  CreateSmartphoneInput,
  Customer,
  DynamicCatalog,
  InventoryTab,
  Order,
  PublicWarrantyViewData,
  Smartphone,
  SmartphoneStatus,
  UpdateCustomerInput,
} from './types/crm';
import { StoreTemplate } from './types/template';
import { buildDefaultTemplateForStore } from './data/templates';
import { LoginView, RegisterSellerFormData, RegisterStoreFormData } from './components/LoginView';
import { AwaitingStoreAccessView } from './components/AwaitingStoreAccessView';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { CustomersView } from './components/CustomersView';
import { CheckoutView } from './components/CheckoutView';
import { AuditLedgerView } from './components/AuditLedgerView';
import { TeamSettingsView } from './components/TeamSettingsView';
import { AddItemModal } from './components/AddItemModal';
import { StoreWizardModal } from './components/StoreWizardModal';
import { WarrantyCertificateModal } from './components/WarrantyCertificateModal';
import { PublicWarrantyModal } from './components/PublicWarrantyModal';
import {
  AuraButton,
  CommandSearchModal,
  ToastMessage,
  ToastViewport,
} from './components/ui/AuraPrimitives';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OpenCRM Global Catch:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F2EC] flex flex-col items-center justify-center p-6 text-[#1F1E1B]">
          <div className="max-w-md w-full bg-white border border-[#E5E2D9] rounded-2xl p-7 shadow-sm text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-[#9B3B2B]/10 text-[#9B3B2B] flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="font-serif text-2xl font-medium">Ops, algo não saiu como esperado</h2>
            <p className="text-xs text-[#6E6B63] leading-relaxed">
              Ocorreu uma instabilidade inesperada na interface. Seus dados continuam intactos e preservados.
            </p>
            {this.state.error?.message && (
              <pre className="text-[11px] text-[#9B3B2B] bg-[#F8E5E2] p-3 rounded-xl overflow-x-auto text-left font-mono">
                {this.state.error.message}
              </pre>
            )}
            <AuraButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Recarregar aplicação
            </AuraButton>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const auth = useSyncExternalStore(
    (cb) => authService.subscribe(cb),
    () => authService.getSnapshot()
  );

  const store = useSyncExternalStore(
    (cb) => crmService.subscribe(cb),
    () => crmService.getSnapshot()
  );

  const [activeSection, setActiveSection] = React.useState<AppSection>('dashboard');
  const [inventoryTab, setInventoryTab] = React.useState<InventoryTab>('smartphones');
  const [onlyLowStock, setOnlyLowStock] = React.useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [selectedSmartphoneDetailId, setSelectedSmartphoneDetailId] = React.useState<
    string | null
  >(null);

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [addModalMode, setAddModalMode] = React.useState<InventoryTab>('smartphones');
  const [storeWizardOpen, setStoreWizardOpen] = React.useState(false);
  const [wizardInitialStoreName, setWizardInitialStoreName] = React.useState<string | undefined>(
    undefined
  );
  const [wizardInitialStartMode, setWizardInitialStartMode] = React.useState<
    'preset' | 'scratch' | undefined
  >(undefined);

  const [commandSearchOpen, setCommandSearchOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const [warrantyPreview, setWarrantyPreview] = React.useState<{
    order: Order;
    customer: Customer;
  } | null>(null);

  const [publicWarrantyToken, setPublicWarrantyToken] = React.useState<string | null>(null);
  const [apiWarrantyData, setApiWarrantyData] = React.useState<PublicWarrantyViewData | null>(null);

  // Pre-selections when jumping to Checkout from Device Drawer or Customer Profile
  const [preselectedCustomerId, setPreselectedCustomerId] = React.useState<string | null>(
    null
  );
  const [preselectedSmartphoneId, setPreselectedSmartphoneId] = React.useState<
    string | null
  >(null);
  const [preselectedAccessoryId, setPreselectedAccessoryId] = React.useState<
    string | null
  >(null);

  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const pushToast = React.useCallback((message: string, detail?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Optional ?autostart=1 query param for automated preview entry & direct /garantia/:token route
  React.useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/garantia\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      setPublicWarrantyToken(match[1]);
    }

    authService.hydrateSession();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !authService.getCurrentUser()) {
      authService.loginDemo('ADMIN');
    }
  }, []);

  const currentUser = auth.currentUser;
  const isAdmin = currentUser?.role === 'ADMIN';

  // Enforce RBAC navigation guard when switching from ADMIN to VENDEDOR
  React.useEffect(() => {
    if (!isAdmin && (activeSection === 'audit' || activeSection === 'settings')) {
      setActiveSection('dashboard');
    }
  }, [isAdmin, activeSection]);

  // Global Cmd+K / Ctrl+K shortcut (only when logged in)
  React.useEffect(() => {
    if (!currentUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUser]);

  // Carrega dados da garantia pública via API quando houver token na URL
  React.useEffect(() => {
    if (publicWarrantyToken) {
      fetch(`/api/public/warranty/${publicWarrantyToken}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setApiWarrantyData(data);
        })
        .catch(() => {});
    } else {
      setApiWarrantyData(null);
    }
  }, [publicWarrantyToken]);

  // Se o usuário for ADMIN e ainda não possuir lojas, abre o Wizard de criação (NUNCA para VENDEDOR)
  React.useEffect(() => {
    if (currentUser && currentUser.role === 'ADMIN' && (!store?.stores || store.stores.length === 0)) {
      setStoreWizardOpen(true);
    }
  }, [currentUser, store?.stores]);

  const [receivedInvite, setReceivedInvite] = React.useState<{
    storeId: string;
    storeName: string;
    role: string;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const inviteStoreId = params.get('invite_store') || params.get('loja_id');
      const inviteStoreName = params.get('store_name') || params.get('loja_nome');
      if (inviteStoreId && inviteStoreName) {
        setReceivedInvite({
          storeId: inviteStoreId,
          storeName: inviteStoreName,
          role: params.get('role') === 'ADMIN' ? 'ADMIN' : 'VENDEDOR',
        });
      }
    } catch {
      // Ignora erro de parsing
    }
  }, []);

  const handleLogin = React.useCallback(
    async (credentials: LoginCredentials) => {
      const user = await authService.loginWithBackend(credentials);
      crmService.logAuditEvent({
        actor: user.name,
        actorRole: user.role,
        actionType: 'AUTH_SWITCH',
        actionLabel: 'Início de sessão',
        targetLabel: user.email,
        detail: `Acesso autenticado como ${user.role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
      });
      pushToast(`Bem-vindo(a), ${user.name.split(' ')[0]}`, `Perfil ${user.role === 'ADMIN' ? 'Admin' : 'Vendedor'} ativo.`);
    },
    [pushToast]
  );

  const handleDemoLogin = React.useCallback(
    (role: UserRole) => {
      const user = authService.loginDemo(role);
      crmService.logAuditEvent({
        actor: user.name,
        actorRole: user.role,
        actionType: 'AUTH_SWITCH',
        actionLabel: 'Acesso demonstração',
        targetLabel: user.email,
        detail: `Sessão iniciada como ${role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
      });
      pushToast(
        `Sessão iniciada como ${role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
        role === 'VENDEDOR'
          ? 'Custos, margens e auditoria ocultos por RBAC.'
          : 'Acesso completo habilitado.'
      );
    },
    [pushToast]
  );

  const handleSwitchRole = React.useCallback(
    (role: UserRole) => {
      if (currentUser?.role === role) return;
      const user = authService.switchRole(role);
      crmService.logAuditEvent({
        actor: user.name,
        actorRole: user.role,
        actionType: 'AUTH_SWITCH',
        actionLabel: 'Troca de perfil',
        targetLabel: user.name,
        detail: `Perfil alterado para ${role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
      });
      if (role !== 'ADMIN' && (activeSection === 'audit' || activeSection === 'settings')) {
        setActiveSection('dashboard');
      }
      pushToast(
        `Perfil alterado para ${role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
        role === 'VENDEDOR'
          ? 'Custos de entrada, margens e auditoria foram ocultados.'
          : 'Visão gerencial completa reativada.'
      );
    },
    [activeSection, currentUser?.role, pushToast]
  );

  const handleLogout = React.useCallback(() => {
    setCommandSearchOpen(false);
    setAddModalOpen(false);
    setWarrantyPreview(null);
    setPublicWarrantyToken(null);
    setSelectedSmartphoneDetailId(null);
    setActiveSection('dashboard');
    setStoreWizardOpen(false);
    setWizardInitialStoreName(undefined);
    setWizardInitialStartMode(undefined);
    authService.logout();
  }, []);

  const handleNavigate = React.useCallback(
    (
      section: AppSection,
      opts?: { inventoryTab?: InventoryTab; onlyLowStock?: boolean }
    ) => {
      if (!isAdmin && (section === 'audit' || section === 'settings')) {
        pushToast('Acesso restrito', 'Esta seção é exclusiva para o perfil Admin.');
        return;
      }
      setActiveSection(section);
      if (opts?.inventoryTab) setInventoryTab(opts.inventoryTab);
      if (typeof opts?.onlyLowStock === 'boolean') {
        setOnlyLowStock(opts.onlyLowStock);
      } else if (section === 'inventory') {
        setOnlyLowStock(false);
      }
      if (section !== 'customers') {
        setSelectedCustomerId(null);
      }
    },
    [isAdmin, pushToast]
  );

  const handleOpenCustomer = React.useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveSection('customers');
  }, []);

  const handleOpenSmartphone = React.useCallback((sp: Smartphone) => {
    setInventoryTab('smartphones');
    setActiveSection('inventory');
    setSelectedSmartphoneDetailId(sp.id);
  }, []);

  const handleClearPreselections = React.useCallback(() => {
    setPreselectedCustomerId(null);
    setPreselectedSmartphoneId(null);
    setPreselectedAccessoryId(null);
  }, []);

  const handleSwitchStore = React.useCallback(
    (storeId: string) => {
      if (storeId === store.activeStoreId) return;
      const switched = crmService.switchStore(storeId);
      authService.switchStore(storeId);
      setSelectedCustomerId(null);
      setSelectedSmartphoneDetailId(null);
      setWarrantyPreview(null);
      setPublicWarrantyToken(null);
      setPreselectedCustomerId(null);
      setPreselectedSmartphoneId(null);
      setPreselectedAccessoryId(null);
      setOnlyLowStock(false);
      setInventoryTab('smartphones');
      pushToast(
        `Workspace alternado para ${switched.template.storeName}`,
        `Template ${switched.template.segment} carregado com dados isolados.`
      );
    },
    [store.activeStoreId, pushToast]
  );

  const handleGoogleLogin = React.useCallback(
    async (idToken: string) => {
      try {
        const res = await authService.loginGoogle(idToken);
        if (res.needsOnboarding) {
          pushToast(
            'Bem-vindo(a)! Conclua o Onboarding',
            'Crie sua primeira loja para configurar os dados e templates.'
          );
          setStoreWizardOpen(true);
        } else {
          pushToast(
            `Bem-vindo(a), ${res.user.name.split(' ')[0]}`,
            `Autenticado com Google no workspace ${res.user.storeUnit}.`
          );
        }
      } catch (err: any) {
        pushToast(
          'Falha no login com Google',
          err.message || 'Não foi possível validar o token Google.'
        );
      }
    },
    [pushToast]
  );

  const handleCreateStore = React.useCallback(
    (newTemplate: StoreTemplate) => {
      const activeUser = authService.getCurrentUser() ?? authService.loginDemo('ADMIN');
      const created = crmService.createStoreFromTemplate(newTemplate, activeUser.name);
      setSelectedCustomerId(null);
      setSelectedSmartphoneDetailId(null);
      setWarrantyPreview(null);
      setPublicWarrantyToken(null);
      setPreselectedCustomerId(null);
      setPreselectedSmartphoneId(null);
      setPreselectedAccessoryId(null);
      setOnlyLowStock(false);
      setInventoryTab('smartphones');
      setActiveSection('dashboard');
      setStoreWizardOpen(false);
      setWizardInitialStoreName(undefined);
      setWizardInitialStartMode(undefined);
      pushToast(
        `Loja "${created.template.storeName}" criada no Open CRM`,
        `Segmento ${created.template.segment} pronto para operação.`
      );
    },
    [pushToast]
  );

  const handleRegisterStore = React.useCallback(
    async (data: RegisterStoreFormData) => {
      const user = await authService.registerStore({
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        storeName: data.storeName,
        segment: data.segment,
      });

      const isOther = data.segment === 'other' || data.segment === 'Outros / Personalizado';

      if (isOther) {
        setSelectedCustomerId(null);
        setSelectedSmartphoneDetailId(null);
        setWarrantyPreview(null);
        setPublicWarrantyToken(null);
        setPreselectedCustomerId(null);
        setPreselectedSmartphoneId(null);
        setPreselectedAccessoryId(null);
        setOnlyLowStock(false);
        setInventoryTab('smartphones');
        setActiveSection('dashboard');

        setWizardInitialStoreName(data.storeName);
        setWizardInitialStartMode('scratch');
        setStoreWizardOpen(true);

        pushToast(
          `Conta criada com sucesso!`,
          `Configure os módulos e campos da sua nova loja no assistente.`
        );
        return;
      }

      const template = buildDefaultTemplateForStore(data.storeName, data.segment);
      const created = crmService.createStoreFromTemplate(template, user.name);

      setSelectedCustomerId(null);
      setSelectedSmartphoneDetailId(null);
      setWarrantyPreview(null);
      setPublicWarrantyToken(null);
      setPreselectedCustomerId(null);
      setPreselectedSmartphoneId(null);
      setPreselectedAccessoryId(null);
      setOnlyLowStock(false);
      setInventoryTab('smartphones');
      setActiveSection('dashboard');
      setStoreWizardOpen(false);
      setWizardInitialStoreName(undefined);
      setWizardInitialStartMode(undefined);

      pushToast(
        `Loja "${created.template.storeName}" criada no Open CRM`,
        `Bem-vindo(a), ${user.name.split(' ')[0]}! Você é o Administrador deste workspace.`
      );
    },
    [pushToast]
  );

  const handleRegisterSeller = React.useCallback(
    async (data: RegisterSellerFormData) => {
      const user = await authService.registerSeller({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      setSelectedCustomerId(null);
      setSelectedSmartphoneDetailId(null);
      setWarrantyPreview(null);
      setPublicWarrantyToken(null);
      setPreselectedCustomerId(null);
      setPreselectedSmartphoneId(null);
      setPreselectedAccessoryId(null);
      setOnlyLowStock(false);
      setInventoryTab('smartphones');
      setActiveSection('dashboard');
      setStoreWizardOpen(false);

      pushToast(
        'Conta criada com sucesso',
        `Bem-vindo(a), ${user.name.split(' ')[0]}! Aguardando vinculação de loja.`
      );
    },
    [pushToast]
  );

  if (!currentUser) {
    return (
      <>
        <LoginView
          onLogin={handleLogin}
          onDemoLogin={handleDemoLogin}
          onOpenCreateStore={(storeName) => {
            if (storeName) setWizardInitialStoreName(storeName);
            setStoreWizardOpen(true);
          }}
          onRegisterStore={handleRegisterStore}
          onRegisterSeller={handleRegisterSeller}
          onGoogleLogin={handleGoogleLogin}
        />
        <StoreWizardModal
          open={storeWizardOpen}
          onClose={() => {
            setStoreWizardOpen(false);
            setWizardInitialStoreName(undefined);
            setWizardInitialStartMode(undefined);
          }}
          onCreateStore={handleCreateStore}
          initialStoreName={wizardInitialStoreName}
          initialStartMode={wizardInitialStartMode}
        />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Se o usuário for VENDEDOR e não possuir lojas vinculadas, exibe tela de espera
  if (
    currentUser.role === 'VENDEDOR' &&
    (!store?.stores || store.stores.length === 0 || currentUser.storeUnit === 'Aguardando vínculo')
  ) {
    return (
      <>
        <AwaitingStoreAccessView
          currentUser={currentUser}
          onLogout={handleLogout}
          onRefreshAccess={async () => {
            const res = await authService.refreshUserAndStores();
            if (res.storesCount > 0) {
              pushToast('Acesso liberado!', 'Você foi vinculado a uma loja com sucesso.');
              await authService.hydrateSession();
            } else {
              pushToast(
                'Ainda sem vínculo',
                'Nenhuma loja encontrada para este e-mail. Peça ao Administrador para confirmar seu cadastro.'
              );
            }
          }}
        />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeTemplate = store?.activeTemplate;

  if (!activeTemplate || !store) {
    return (
      <div className="min-h-screen bg-[#F4F2EC] flex flex-col items-center justify-center p-6 text-[#1F1E1B]">
        <div className="h-10 w-10 rounded-full border-2 border-[#4F5A47] border-t-transparent animate-spin mb-3" />
        <p className="font-serif text-sm text-[#4F5A47]">Carregando seu workspace...</p>
      </div>
    );
  }

  const summary = crmService.getDashboardSummary();
  const selectedSmartphoneDetail = selectedSmartphoneDetailId
    ? (store.smartphones.find((s) => s.id === selectedSmartphoneDetailId) ?? null)
    : null;

  const publicWarrantyData =
    apiWarrantyData ||
    (publicWarrantyToken ? crmService.getPublicWarrantyByToken(publicWarrantyToken) : null);

  const handleCreateSmartphone = (input: CreateSmartphoneInput) => {
    const created = crmService.createSmartphone({
      ...input,
      actorName: currentUser.name,
      actorRole: currentUser.role,
    });
    setInventoryTab('smartphones');
    setActiveSection('inventory');
    pushToast(
      created.origin === 'Troca de Cliente (Trade-in)'
        ? 'Trade-in registrado no estoque'
        : `${activeTemplate.labels.primaryItemSingular} cadastrado no estoque`,
      activeTemplate.features.hasSerializedItems
        ? `${created.brand} ${created.model} · ${created.storage} (${created.status}).`
        : `${created.model} (${created.status}).`
    );
  };

  const handleCreateAccessory = (input: CreateAccessoryInput) => {
    const created = crmService.createAccessory({
      ...input,
      actorName: currentUser.name,
      actorRole: currentUser.role,
    });
    setInventoryTab('accessories');
    setActiveSection('inventory');
    pushToast(
      `${activeTemplate.labels.secondaryItemSingular} cadastrado`,
      `${created.name} (${created.sku}) adicionado.`
    );
  };

  const handleAddCatalogOption = (field: keyof DynamicCatalog, label: string) => {
    const saved = crmService.addCatalogOption(field, label);
    pushToast('Nova opção adicionada ao catálogo', `"${saved}" disponível na sessão.`);
    return saved;
  };

  const handleAddDeviceModel = (params: { name: string; brand?: string }) => {
    const created = crmService.addDeviceModel(params);
    pushToast('Novo modelo salvo no catálogo', `${created.brand} · ${created.name}`);
    return created;
  };

  const handleBulkUpdateStatus = (ids: string[], status: SmartphoneStatus) => {
    crmService.updateSmartphonesStatus(ids, status, currentUser.name, currentUser.role);
    pushToast(
      'Status atualizado em lote',
      `${ids.length} aparelho(s) marcados como ${status}.`
    );
  };

  const handleUpdateSmartphonePrice = (smartphoneId: string, newPrice: number) => {
    crmService.updateSmartphonePrice(
      smartphoneId,
      newPrice,
      currentUser.name,
      currentUser.role
    );
    pushToast('Preço atualizado', 'Alteração registrada no log de auditoria.');
  };

  const handleRestockSmartphones = (
    ids: string[],
    delta: number,
    opts?: { setAvailable?: boolean }
  ) => {
    crmService.restockSmartphones(ids, delta, {
      setAvailable: opts?.setAvailable,
      actorName: currentUser.name,
      actorRole: currentUser.role,
    });
    const first = store.smartphones.find((s) => s.id === ids[0]);
    const unit = first?.stockUnit || 'un.';
    pushToast(
      'Reposição registrada no estoque',
      ids.length === 1 && first
        ? `+${delta} ${unit} adicionadas em ${first.model}.`
        : `+${delta} adicionadas em ${ids.length} itens selecionados.`
    );
  };

  const handleRestockAccessory = (accessoryId: string, delta: number) => {
    const acc = store.accessories.find((a) => a.id === accessoryId);
    crmService.restockAccessory(accessoryId, delta, currentUser.name, currentUser.role);
    if (acc) {
      pushToast('Reposição registrada', `+${delta} un. adicionadas em ${acc.name}.`);
    }
  };

  const handleRestockAccessoriesBulk = (ids: string[], delta: number) => {
    crmService.restockAccessories(ids, delta, currentUser.name, currentUser.role);
    pushToast(
      'Reposição em lote registrada',
      `+${delta} un. adicionadas em ${ids.length} ${
        ids.length === 1 ? 'item selecionado' : 'itens selecionados'
      }.`
    );
  };

  const handleRevealIMEI = (sp: Smartphone) => {
    crmService.logSensitiveAccess(
      'IMEI',
      sp.id,
      `${sp.model} (${sp.sku})`,
      currentUser.name,
      currentUser.role
    );
    pushToast(
      'Acesso ao dado registrado no log de auditoria',
      `IMEI de ${sp.model} revelado na sessão.`
    );
  };

  const handleRevealCustomerPii = (customer: Customer) => {
    crmService.logSensitiveAccess(
      'CPF',
      customer.id,
      customer.name,
      currentUser.name,
      currentUser.role
    );
    pushToast(
      'Acesso ao dado registrado no log de auditoria',
      `CPF e telefone de ${customer.name} revelados.`
    );
  };

  const handleCreateCustomer = (input: CreateCustomerInput): Customer => {
    const created = crmService.createCustomer({
      ...input,
      actorName: currentUser.name,
      actorRole: currentUser.role,
    });
    pushToast(
      'Cliente cadastrado no CRM',
      `${created.name} adicionado e registrado na auditoria.`
    );
    return created;
  };

  const handleUpdateCustomer = (
    customerId: string,
    input: UpdateCustomerInput
  ): Customer => {
    const updated = crmService.updateCustomer(customerId, {
      ...input,
      actorName: currentUser.name,
      actorRole: currentUser.role,
    });
    pushToast(
      'Cadastro do cliente atualizado',
      `Alterações de ${updated.name} salvas e registradas na auditoria.`
    );
    return updated;
  };

  const handleConfirmOrder = (input: CreateOrderInput): Order => {
    const order = crmService.createOrder({
      ...input,
      sellerName: currentUser.name,
      actorRole: currentUser.role,
    });
    pushToast(
      activeTemplate.features.hasWarrantyQr
        ? 'Saída registrada e estoque atualizado'
        : 'Pedido registrado no balcão',
      activeTemplate.features.hasWarrantyQr
        ? `Pedido ${order.code} confirmado com garantia de ${order.warrantyDays} dias.`
        : `Pedido ${order.code} confirmado em ${activeTemplate.storeName}.`
    );
    return order;
  };

  const handleAddTeamMember = (input: {
    name: string;
    email: string;
    role: UserRole;
  }) => {
    const member = authService.addTeamMember(input);
    crmService.logAuditEvent({
      actor: currentUser.name,
      actorRole: currentUser.role,
      actionType: 'TEAM_CHANGE',
      actionLabel: 'Novo acesso interno',
      targetLabel: member.name,
      detail: `${member.email} · Perfil ${member.role === 'ADMIN' ? 'Admin' : 'Vendedor'}`,
    });
    pushToast('Acesso liberado', `${member.name} adicionado à equipe.`);
  };

  const handleToggleMemberActive = (memberId: string) => {
    const updated = authService.toggleTeamMemberActive(memberId);
    crmService.logAuditEvent({
      actor: currentUser.name,
      actorRole: currentUser.role,
      actionType: 'TEAM_CHANGE',
      actionLabel: updated.active ? 'Acesso reativado' : 'Acesso desativado',
      targetLabel: updated.name,
      detail: `${updated.email} · Status: ${updated.active ? 'Ativo' : 'Desativado'}`,
    });
    pushToast(
      updated.active ? 'Acesso reativado' : 'Acesso desativado',
      `${updated.name} atualizado com sucesso.`
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#1F1E1B] flex flex-col lg:flex-row">
      {/* Compact Mobile Top Bar (<= 56px, strictly hidden on desktop) */}
      <div className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-[#ECEAE2] border-b border-[#DFDDD3] flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-[#1F1E1B] hover:bg-[#E2DED4] cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-xl text-[#1F1E1B] truncate">
            {activeTemplate.storeName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCommandSearchOpen(true)}
          aria-label="Busca rápida"
          className="h-9 w-9 rounded-xl flex items-center justify-center text-[#4A4842] hover:bg-[#E2DED4] cursor-pointer"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Persistent Desktop Sidebar / Mobile Drawer */}
      <Sidebar
        currentUser={currentUser}
        activeTemplate={activeTemplate}
        stores={store.stores}
        activeSection={activeSection}
        activeInventoryTab={inventoryTab}
        lowStockFilterActive={onlyLowStock}
        counts={{
          availableSmartphones: summary.availableSmartphones,
          totalSmartphones: store.smartphones.length,
          totalAccessoryUnits: summary.totalAccessoryUnits,
          lowStockAccessories: summary.lowStockAccessories,
          customers: summary.customerCounts.total,
          activeCustomers: summary.customerCounts.active,
          leadCustomers: summary.customerCounts.lead,
          inactiveCustomers: summary.customerCounts.inactive,
          activeWarranties: summary.activeWarranties,
          auditLogs: store.auditLogs.length,
        }}
        onNavigate={handleNavigate}
        onSwitchStore={handleSwitchStore}
        onOpenCreateStore={() => setStoreWizardOpen(true)}
        onOpenCommandSearch={() => setCommandSearchOpen(true)}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 px-4 sm:px-7 lg:px-9 py-6 lg:py-8">
        <div
          className={`mx-auto ${
            activeSection === 'customers' ? 'max-w-[1320px]' : 'max-w-[1200px]'
          }`}
        >
          {/* Banner de convite de nova loja */}
          {receivedInvite && (
            <div className="mb-6 bg-white border border-[#E5E2D9] rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#4F5A47]/10 text-[#4F5A47] flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1F1E1B]">
                    Convite de Equipe Recebido
                  </h3>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    Você foi convidado(a) para fazer parte da equipe da loja <strong className="text-[#1F1E1B]">{receivedInvite.storeName}</strong> ({receivedInvite.role === 'ADMIN' ? 'Admin' : 'Vendedor'}).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <AuraButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleSwitchStore(receivedInvite.storeId);
                    pushToast('Convite aceito!', `Você agora opera na loja ${receivedInvite.storeName}.`);
                    setReceivedInvite(null);
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Aceitar Convite
                </AuraButton>
                <AuraButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReceivedInvite(null);
                    pushToast('Convite dispensado', 'O convite foi arquivado.');
                  }}
                >
                  Recusar
                </AuraButton>
              </div>
            </div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardView
              template={activeTemplate}
              operatorFirstName={currentUser.name.split(' ')[0]}
              summary={summary}
              weeklyMovement={store.weeklyMovement}
              smartphones={store.smartphones}
              accessories={store.accessories}
              customers={store.customers}
              orders={store.orders}
              onNavigate={handleNavigate}
              onOpenCustomer={handleOpenCustomer}
              onOpenSmartphone={handleOpenSmartphone}
              onRestockAccessory={handleRestockAccessory}
              onOpenCommandSearch={() => setCommandSearchOpen(true)}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView
              template={activeTemplate}
              isAdmin={isAdmin}
              activeTab={inventoryTab}
              onTabChange={(tab) => {
                setInventoryTab(tab);
                setOnlyLowStock(false);
              }}
              smartphones={store.smartphones}
              accessories={store.accessories}
              customers={store.customers}
              deviceModels={store.deviceModels}
              catalog={store.catalog}
              onlyLowStock={onlyLowStock}
              onOnlyLowStockChange={setOnlyLowStock}
              selectedSmartphoneDetail={selectedSmartphoneDetail}
              onSelectSmartphoneDetail={(sp) => setSelectedSmartphoneDetailId(sp?.id ?? null)}
              onOpenAddModal={(mode) => {
                setAddModalMode(mode);
                setAddModalOpen(true);
              }}
              onRevealIMEI={handleRevealIMEI}
              onBulkUpdateSmartphoneStatus={handleBulkUpdateStatus}
              onUpdateSmartphonePrice={handleUpdateSmartphonePrice}
              onToggleSmartphoneChecklist={(spId, itemId, checked) =>
                crmService.updateSmartphoneChecklistItem(spId, itemId, checked)
              }
              onRestockSmartphones={handleRestockSmartphones}
              onRestockAccessory={handleRestockAccessory}
              onRestockAccessoriesBulk={handleRestockAccessoriesBulk}
              onStartCheckoutWithSmartphone={(spId) => {
                setPreselectedSmartphoneId(spId);
                setActiveSection('checkout');
              }}
              onNotify={pushToast}
            />
          )}

          {activeSection === 'customers' && (
            <CustomersView
              template={activeTemplate}
              customers={store.customers}
              orders={store.orders}
              deviceModels={store.deviceModels}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
              getCompatibleAccessories={(cuId) =>
                crmService.getCompatibleAccessoriesForCustomer(cuId)
              }
              onRevealSensitiveData={handleRevealCustomerPii}
              onAddNote={(cuId, content) => {
                crmService.addCustomerNote(cuId, content, currentUser.name);
                pushToast('Nota salva no perfil do cliente');
              }}
              onAddTag={(cuId, tag) => {
                crmService.addCustomerTag(cuId, tag, currentUser.name);
                pushToast('Tag adicionada', `"${tag}" vinculada ao perfil.`);
              }}
              onRemoveTag={(cuId, tag) => {
                crmService.removeCustomerTag(cuId, tag);
              }}
              onAddDeviceModel={handleAddDeviceModel}
              onCreateCustomer={handleCreateCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onOpenWarrantyDocument={(order, customer) =>
                setWarrantyPreview({ order, customer })
              }
              onPreviewPublicWarranty={(token) => setPublicWarrantyToken(token)}
              onQuickSellAccessory={(cuId, accId) => {
                setPreselectedCustomerId(cuId);
                setPreselectedAccessoryId(accId);
                setActiveSection('checkout');
              }}
              onStartCheckoutForCustomer={(cuId) => {
                setPreselectedCustomerId(cuId);
                setActiveSection('checkout');
              }}
            />
          )}

          {activeSection === 'checkout' && (
            <CheckoutView
              template={activeTemplate}
              customers={store.customers}
              smartphones={store.smartphones}
              accessories={store.accessories}
              deviceModels={store.deviceModels}
              preselectedCustomerId={preselectedCustomerId}
              preselectedSmartphoneId={preselectedSmartphoneId}
              preselectedAccessoryId={preselectedAccessoryId}
              onClearPreselections={handleClearPreselections}
              onConfirmOrder={handleConfirmOrder}
              onOpenWarrantyCertificate={(order, customer) =>
                setWarrantyPreview({ order, customer })
              }
            />
          )}

          {isAdmin && activeSection === 'audit' && (
            <AuditLedgerView
              auditLogs={store.auditLogs}
              stockLedger={store.stockLedger}
            />
          )}

          {isAdmin && activeSection === 'settings' && (
            <TeamSettingsView
              currentUser={currentUser}
              teamMembers={auth.teamMembers}
              onAddTeamMember={handleAddTeamMember}
              onToggleMemberActive={handleToggleMemberActive}
            />
          )}
        </div>
      </main>

      {/* Modals & Overlays */}
      <AddItemModal
        template={activeTemplate}
        open={addModalOpen}
        initialMode={addModalMode}
        isAdmin={isAdmin}
        deviceModels={store.deviceModels}
        catalog={store.catalog}
        customers={store.customers}
        onClose={() => setAddModalOpen(false)}
        onAddCatalogOption={handleAddCatalogOption}
        onAddDeviceModel={handleAddDeviceModel}
        onCreateSmartphone={handleCreateSmartphone}
        onCreateAccessory={handleCreateAccessory}
      />

      <StoreWizardModal
        open={storeWizardOpen}
        onClose={() => {
          setStoreWizardOpen(false);
          setWizardInitialStoreName(undefined);
          setWizardInitialStartMode(undefined);
        }}
        onCreateStore={handleCreateStore}
        initialStoreName={wizardInitialStoreName}
        initialStartMode={wizardInitialStartMode}
      />

      <WarrantyCertificateModal
        template={activeTemplate}
        order={warrantyPreview?.order ?? null}
        customer={warrantyPreview?.customer ?? null}
        onClose={() => setWarrantyPreview(null)}
        onPreviewPublicWarranty={(token) => setPublicWarrantyToken(token)}
      />

      <PublicWarrantyModal
        data={publicWarrantyData}
        onClose={() => setPublicWarrantyToken(null)}
      />

      <CommandSearchModal
        open={commandSearchOpen}
        onClose={() => setCommandSearchOpen(false)}
        smartphones={store.smartphones}
        accessories={store.accessories}
        customers={store.customers}
        onSelectSmartphone={handleOpenSmartphone}
        onSelectAccessory={() => {
          setInventoryTab('accessories');
          setActiveSection('inventory');
        }}
        onSelectCustomer={(cu) => handleOpenCustomer(cu.id)}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
