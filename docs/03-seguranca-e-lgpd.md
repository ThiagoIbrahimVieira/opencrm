# 3. Segurança da Informação & Engenharia LGPD By Design — OpenCRM

> **Módulo de Documentação Oficial:** Este documento detalha os controles criptográficos, conformidade com a LGPD (Lei nº 13.709/2018), Blind Index, AES-256-GCM, proteção de sessão e auditoria no **OpenCRM**.

---

## 1. Matriz de Controles LGPD e AppSec

A conformidade com a **Lei Geral de Proteção de Dados (Lei nº 13.709/2018)** foi implementada como requisito fundamental de arquitetura no OpenCRM:

| Vetor de Segurança | Implementação no OpenCRM | Benefício Prático & Conformidade |
| :--- | :--- | :--- |
| **Isolamento de Tenants (RLS)** | `SET LOCAL ROLE opencrm_app` + `set_config('app.current_store_id')` | Mesmo sob injeção de código ou falha de filtro no backend, o banco veta acessos a lojas distintas. |
| **Proteção de PII (Art. 46)** | Criptografia simétrica `AES-256-GCM` com IV aleatório de 12 bytes + Auth Tag | Se o banco de dados for exfiltrado, dados sensíveis (CPF, telefone) permanecem matematicamente ilegíveis. |
| **Busca & Deduplicação Segura** | Blind Index determinístico via `HMAC-SHA256` (`PII_HMAC_KEY_HEX`) | Permite busca exata `O(1)` e verificação de duplicidade de CPF/Telefone sem jamais descriptografar a tabela inteira. |
| **Auditoria Imutável (Art. 18)** | Registro em `audit_logs` a cada ação de revelação de PII | Rastreia quem (`actor`), qual função (`role`), quando (`timestamp`), de onde (`ip_address`) e por quê visualizou o dado. |
| **Armazenamento de Senhas** | `Argon2id` (WebAssembly nativo) com parâmetros recomendados pela OWASP | Resistência extrema a ataques de dicionário, força bruta e aceleração via GPU/FPGA/ASIC. |
| **Sessão & Tokens** | Cookies `HttpOnly`, `SameSite=Lax`, `Secure` + Rotação RFC 6819 | Tokens inacessíveis via JavaScript (proteção total contra XSS). Reuso de token revogado derruba toda a família de sessões. |
| **Anti-Vazamento em DTOs** | Serialização condicional por RBAC (`ADMIN` vs `VENDEDOR`) | Vendedores recebem apenas dados de balcão e preço de venda; custos, margens e segredos fiscais são expurgados no backend. |
| **Consulta Pública Segura** | Rota pública de garantia isolada por UUID v4 criptográfico | Clientes consultam validade e termos via QR Code; o endpoint omite 100% de CPF, custos e dados pessoais de terceiros. |

---

## 2. Mecânica do Blind Index HMAC-SHA256

### 2.1 O Desafio
Em bancos de dados relacionais padrão, buscar clientes por CPF exige que a coluna seja indexada em texto plano. Porém, armazenar CPFs em texto plano viola o princípio da segurança e prevenção da LGPD (Art. 46). Por outro lado, criptografia simétrica com IV aleatório impede buscas diretas via `WHERE cpf = ?`.

### 2.2 O Algoritmo de Blind Index
Para conciliar busca indexada de alta performance e proteção criptográfica contra vazamento:
1. **Normalização Canônica:** O valor de entrada é limpo de qualquer máscara ou espaço (`\D` substituído por string vazia). Exemplo: `123.456.789-00` vira `12345678900`.
2. **Cálculo de Hash Criptográfico com Chave Isolada:**
   $$\text{cpf\_hmac} = \text{HMAC-SHA256}(K_{\text{hmac}}, \text{cpf\_limpo})$$
   A chave $K_{\text{hmac}}$ (`PII_HMAC_KEY_HEX`) possui 32 bytes criptograficamente aleatórios e reside estritamente nas variáveis de ambiente seguras do backend.
3. **Indexação B-Tree:** O valor resultante (64 caracteres hexadecimais) é gravado na coluna indexada `cpf_hmac`.
4. **Consulta no Balcão:** Ao buscar por CPF no balcão de vendas, o backend calcula o HMAC do termo digitado e emite a query:
   ```sql
   SELECT id, full_name, cpf_encrypted, cpf_last4 
   FROM customers 
   WHERE store_id = current_setting('app.current_store_id')::uuid 
     AND cpf_hmac = $hmac;
   ```
   A busca ocorre em tempo $O(1)$ pelo índice B-Tree, sem descriptografia e sem percorrer tabelas em memória.

---

## 3. Mecânica da Criptografia AES-256-GCM

Para a exibição autorizada do dado em tela (ex: emissão do termo de garantia ou exportação autorizada pelo Admin):
1. **Geração de IV Aleatório:** Para cada operação de escrita, gera-se um Vetor de Inicialização de 12 bytes (`crypto.randomBytes(12)`).
2. **Cifragem Autenticada (GCM):** A cifra utiliza a chave simétrica de 256 bits (`PII_ENCRYPTION_KEY_HEX`) e produz o texto cifrado e uma **Tag de Autenticação** de 16 bytes.
3. **Formato Serializado Canônico:**
   ```
   <iv_hex>:<auth_tag_hex>:<ciphertext_hex>
   ```
4. **Verificação de Integridade:** Durante a descriptografia, se um único byte do ciphertext for adulterado no banco, a verificação da tag falha imediatamente, impedindo ataques de injeção de texto cifrado.

---

## 4. Trilha de Auditoria e Governança de PII (Art. 18 LGPD)

Toda vez que uma função do sistema descriptografa um dado sensível (ação de *reveal*):
* Uma transação insere um registro na tabela `audit_logs` contendo:
  * `actor_user_id`: ID do usuário logado que solicitou a visualização.
  * `actor_role`: Papel do usuário no momento da ação (`ADMIN` ou `VENDEDOR`).
  * `action`: `REVEAL_PII_CPF` ou `REVEAL_PII_PHONE`.
  * `ip_address`: IP real do cliente obtido com `trustProxy: true`.
  * `user_agent`: Identificador do navegador do operador.
  * `timestamp`: Hora precisa da revelação em UTC.
* A tabela `audit_logs` possui políticas de RLS que impedem remoção ou alteração de registros (`INSERT` only), garantindo a imutabilidade da trilha forense.
