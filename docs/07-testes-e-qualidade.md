# 7. Execução da Suíte de Testes & Validação de Qualidade — OpenCRM

> **Módulo de Documentação Oficial:** Este documento descreve os procedimentos de testes unitários, testes de integração de segurança/AppSec, verificação de tipagem estrita e testes E2E no **OpenCRM**.

---

## 1. Filosofia de Testes do Projeto

O OpenCRM segue o princípio de **Qualidade Comprovada por Evidências Reais**:
* **Zero Mocks de Segurança:** Os testes de banco validam políticas reais de RLS e o isolamento de tenants diretamente contra instâncias PostgreSQL.
* **Criptografia Auditada:** Cada função criptográfica (AES-256-GCM e HMAC-SHA256 Blind Index) possui testes de integridade, rejeição de adulteração e normalização de chaves.
* **Isolamento de Contas Reais vs. Demo:** Testes específicos asseguram que dados mock (`mockData`) nunca vazem para usuários reais do sistema.

---

## 2. Comandos de Execução da Suíte de Testes

### 2.1 Verificação Estática de Tipagem (TypeScript Strict Mode)
Garante que não há violações de tipagem (`any` implícito, propriedades indefinidas ou incoerências em contratos de DTOs):

```bash
npm run lint
```
*Critério de aprovação:* `0 errors, 0 warnings`.

---

### 2.2 Suíte de Testes Automatizados do Frontend (Vitest)
Executa a validação de componentes React, formulários dinâmicos Zod, regras do Store Template Builder e isolamento de estado:

```bash
npm test
```

#### Cenários Cobertos (24 testes):
1. **Zero-Mock Isolation:** Verifica que contas reais iniciam com lista de lojas vazia e nunca exibem lojas mock (`AuraCell`, `Sabor & Brasa`, `Atelier Linho`) fora do modo de demonstração.
2. **Dynamic Store Wizard:** Garante que abrir o construtor com o perfil "Outros / Personalizado" inicializa o segmento em branco sem pré-selecionar opções do preset de Pet Shop.
3. **Role Switcher Protection:** Confirma que a barra lateral bloqueia a troca manual de papéis em contas reais, exibindo um badge estático de identificação.
4. **Form Validation:** Validação em tempo de execução de esquemas Zod gerados dinamicamente.

---

### 2.3 Suíte de Testes de Integração, RLS e AppSec do Backend
Executa a bateria de testes de regras de banco de dados, criptografia LGPD, concorrência ACID e controle de acesso:

```bash
cd server
npm test
cd ..
```

#### Cenários Cobertos (33 testes):
1. **Multi-Tenant RLS Enforcement:** Garante que a role `opencrm_app` com `SET LOCAL app.current_store_id` rejeita estritamente qualquer tentativa de leitura ou escrita entre lojas diferentes.
2. **AES-256-GCM Integrity:** Valida que alterações de um único bit no ciphertext ou na auth tag lançam exceções de integridade e não descriptografam dados corrompidos.
3. **HMAC-SHA256 Blind Index:** Comprova que CPFs com pontuações distintas (`123.456.789-00` vs `12345678900`) produzem o mesmo hash canônico, viabilizando busca exata.
4. **ACID Concurrency & Race Conditions:** Simula requisições simultâneas de venda sobre um item com estoque unitário, garantindo que apenas 1 transação seja aceita e a outra seja rejeitada com erro de estoque insuficiente.
5. **Anti-Leak em DTOs:** Valida que respostas para usuários com role `VENDEDOR` omitem estritamente colunas de preço de custo e margem de lucro.

---

### 2.4 Build de Produção
Valida o empacotamento completo do bundle de produção:

```bash
npm run build
```
*Resultado esperado:* Geração limpa do diretório `dist/` com chunks otimizados para distribuição na CDN.
