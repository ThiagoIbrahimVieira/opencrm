# LAUDO DE HOMOLOGAÇÃO E2E AO VIVO EM PRODUÇÃO — OPENCRM V2
**Autor:** Steve Rogers (QA Engineer)  
**Data:** 20/11/2026  
**Alvo de Produção:** [https://opencrm-ashy.vercel.app](https://opencrm-ashy.vercel.app)  
**Backend Oficial:** [https://opencrm-api.onrender.com](https://opencrm-api.onrender.com)  
**Banco de Dados:** Supabase PostgreSQL 17 (`strzjawgrmdefpjioqcj`)  
**Status Geral:** `partial` (Homologado com 2 apontamentos de infraestrutura/configuração de ambiente)

---

## 1. RESUMO EXECUTIVO DOS 5 CENÁRIOS CRÍTICOS

| # | Cenário | Status | Evidência / Diagnóstico Técnico |
|---|---|---|---|
| **1** | Login com e-mail inexistente (deve retornar 404 e exibir "Essa conta não existe.") | **APROVADO NO BACKEND / ALERTA DE REWRITE NA VERCEL** | No Render backend oficial: `HTTP 404 {"statusCode":404,"error":"AppError","message":"Essa conta não existe."}`. Na Vercel, o rewrite `/api` chama Lambda sem envs em vez do proxy Render. |
| **2** | Botão "Continuar com Google" no topo da LoginView | **ALERTA DE CONFIGURAÇÃO DE ENV** | Código 100% implementado em `LoginView.tsx`. Botão oculto por design (`hasGoogleClientId = false`) devido à ausência de `VITE_GOOGLE_CLIENT_ID` na Vercel. |
| **3** | Cadastro de Vendedor -> Redirecionamento para `AwaitingStoreAccessView` | **100% APROVADO (PASS)** | Usuário vendedor sem vínculo é direcionado para tela `"Aguardando Vínculo à Loja"` com orientações de balcão e botão de logout. |
| **4** | Acesso como Admin -> Convidar vendedor na aba Equipe (Pendente + link) | **100% APROVADO (PASS)** | Painel de equipe funcional: listagem de membros, modal de convite com função/e-mail, status `Pendente` e botão `Copiar Link de Convite`. |
| **5** | Checkout com Busca de CPF Blind Index & Comprovante com QR Code e WhatsApp | **100% APROVADO (PASS)** | Busca por CPF localiza titular via Blind Index; checkout gera termo com código `AC-2026-0155`, QR Code vetorial SVG, WhatsApp e CPF mascarado/revelável. |

---

## 2. DETALHAMENTO TÉCNICO POR CENÁRIO

### Cenário 1: Tratamento de Erro no Login com E-mail Inexistente
- **Comportamento Esperado:** Resposta HTTP 404 informando `"Essa conta não existe."`, sem vazamento de stacktrace e sem crash 500.
- **Teste Direto na API do Render (`https://opencrm-api.onrender.com/api/auth/login`):**
  - Requisição: `POST /api/auth/login` com payload `{"email":"naoexiste_qa_production@opencrm.com.br","password":"senha123456"}`.
  - Resposta recebida:
    ```json
    HTTP/1.1 404 Not Found
    {
      "statusCode": 404,
      "error": "AppError",
      "message": "Essa conta não existe."
    }
    ```
  - **Veredito Backend:** **APROVADO**. A camada de serviço `server/src/services/auth.service.ts` e o handler global de erros `server/src/middlewares/error.middleware.ts` funcionam exatamente conforme a especificação.
- **Diagnóstico da Rota `/api/*` na Vercel:**
  - No commit `3e91f53`, `vercel.json` alterou a rota de rewrite para `/api` (chamando `api/index.ts` serverless na Vercel). Como a Vercel não possui `DATABASE_URL` nem chaves JWT, o arquivo `server/src/config/env.ts` executa fail-fast (`process.exit(1)`), gerando `HTTP 500 FUNCTION_INVOCATION_FAILED`.
  - **Correção Recomendada:** Restaurar `destination: "https://opencrm-api.onrender.com/api/:path*"` em `vercel.json` ou configurar as variáveis no painel da Vercel.

---

### Cenário 2: Botão "Continuar com Google"
- **Comportamento Esperado:** Exibição do botão corporativo do Google no topo da tela de Login.
- **Código Frontend (`src/components/LoginView.tsx`):**
  - Implementado com condicional segura:
    ```tsx
    const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
    // ...
    {hasGoogleClientId && (
      <AuraButton variant="secondary" onClick={handleGoogleLogin}>
        Continuar com Google
      </AuraButton>
    )}
    ```
- **Constatação ao Vivo:** O botão não aparece porque a variável de build `VITE_GOOGLE_CLIENT_ID` não está preenchida nas variáveis de ambiente da Vercel.
- **Ação:** Inserir a credencial do Google OAuth no dashboard da Vercel e disparar novo deploy.

---

### Cenário 3: Cadastro de Vendedor & Tela de Aguardo de Vínculo
- **Execução:** Playwright preencheu o formulário de cadastro com o perfil `Vendedor` (`carlos.vendedor.qa@empresa.com.br`).
- **Resultado:** A aplicação redirecionou imediatamente para a `AwaitingStoreAccessView`:
  - Título H1: `"Aguardando Vínculo à Loja"`.
  - Badge: `"Aguardando Vínculo"`.
  - Explicação contextual: *"Seu cadastro de vendedor foi criado com sucesso, mas você ainda não está associado a nenhuma loja física."*
  - Instruções de desbloqueio e botão *"Sair da conta"*.
- **Evidência Visual:** [cenario-3-awaiting-store.png](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/cenario-3-awaiting-store.png).

---

### Cenário 4: Gestão de Equipe e Convites pelo Administrador
- **Execução:** Login com credencial administrativa (`Demo Admin`).
- **Navegação:** Acesso à aba de Configurações / Equipe.
- **Resultado:**
  - Listagem dos membros da loja AuraCell com funções (`ADMIN`, `VENDEDOR`).
  - Modal de convite de novo membro (`Adicionar à Equipe`) preenchendo nome e e-mail.
  - Exibição de convites pendentes e ação `Copiar Link de Convite`.
- **Evidência Visual:** [cenario-4-equipe-admin.png](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/cenario-4-equipe-admin.png).

---

### Cenário 5: Checkout com Busca CPF Blind Index, QR Code e WhatsApp
- **Execução:**
  1. No balcão de checkout (`Saída & Garantia`), busca rápida por CPF: `394.821.508-42`.
  2. Blind Index localizou o cliente em memória: `"Cliente localizado: Helena Vasconcelos"`.
  3. Selecionado o aparelho serializado `iPhone 16 Pro Max · 256GB Titânio Deserto (IMEI 354829•••••1040)`.
  4. Clicado em `"Confirmar Saída e Gerar Termo"`.
- **Validações no Modal do Termo (`WarrantyCertificateModal`):**
  - **Código de Garantia:** Gerado com sucesso (`Nº AC-2026-0155`).
  - **Botão WhatsApp:** Visível e acoplado a `buildWhatsAppWarrantyShareUrl` (`"Enviar Garantia no WhatsApp"`).
  - **QR Code Vetorial:** Renderizado via SVG nativo com matriz de bits nítida apontando para a consulta pública do cliente.
  - **Privacidade / Blind Index:** CPF exibido com máscara segura (`CPF: •••.821.508-••`).
  - **Interatividade:** Botão `"Exibir CPF"` revelou com sucesso o documento completo `394.821.508-42` sem recarregar a tela.
- **Evidências Visuais:**
  - Tela de montagem do checkout: [cenario-5-checkout-ready.png](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/cenario-5-checkout-ready.png)
  - Comprovante/Termo com QR Code e WhatsApp: [cenario-5-comprovante-qr.png](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/cenario-5-comprovante-qr.png)

---

## 3. ARTEFATOS E SCRIPTS GERADOS
- Script E2E Cenários 3 e 4: [test-scenarios-3-4-5.mjs](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/test-scenarios-3-4-5.mjs)
- Script E2E Cenário 5: [test-scenario-5-checkout.mjs](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/test-scenario-5-checkout.mjs)
- Dados consolidados JSON do Cenário 5: [cenario-5-result.json](file:///C:/Users/thiag/Documents/Projetos/openCRM-—-crm-&-gestão-de-loja/tools/cenario-5-result.json)

---
*Laudo emitido com total independência técnica por Steve Rogers (QA Engineer).*
