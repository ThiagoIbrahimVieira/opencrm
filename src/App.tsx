import React, { useSyncExternalStore } from 'react';
import { Menu, Search } from 'lucide-react';
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
import { LoginView } from './components/LoginView';
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
  CommandSearchModal,
  ToastMessage,
  ToastViewport,
} from './components/ui/AuraPrimitives';

export default function App() {
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

  const [commandSearchOpen, setCommandSearchOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const [warrantyPreview, setWarrantyPreview] = React.useState<{
    order: Order;
    customer: Customer;
  } | null>(null);

  const [publicWarrantyToken, setPublicWarrantyToken] = React.useState<string | null>(null);

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

  const handleLogin = React.useCallback(
    (credentials: LoginCredentials) => {
      const user = authService.login(credentials);
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
      pushToast(
        `Loja "${created.template.storeName}" criada no Open CRM`,
        `Segmento ${created.template.segment} pronto para operação.`
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
          onOpenCreateStore={() => setStoreWizardOpen(true)}
          onGoogleLogin={handleGoogleLogin}
        />
        <StoreWizardModal
          open={storeWizardOpen}
          onClose={() => setStoreWizardOpen(false)}
          onCreateStore={handleCreateStore}
        />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const summary = crmService.getDashboardSummary();
  const selectedSmartphoneDetail = selectedSmartphoneDetailId
    ? (store.smartphones.find((s) => s.id === selectedSmartphoneDetailId) ?? null)
    : null;
  const [apiWarrantyData, setApiWarrantyData] = React.useState<PublicWarrantyViewData | null>(null);

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

  const publicWarrantyData =
    apiWarrantyData ||
    (publicWarrantyToken ? crmService.getPublicWarrantyByToken(publicWarrantyToken) : null);

  const activeTemplate = store.activeTemplate;

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
        onClose={() => setStoreWizardOpen(false)}
        onCreateStore={handleCreateStore}
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
