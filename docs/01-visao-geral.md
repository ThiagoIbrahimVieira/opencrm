# 1. Visão Geral e Problema Resolvido — OpenCRM

> **Módulo de Documentação Oficial:** Este documento detalha a fundamentação, problemas crônicos de mercado e a solução arquitetural implementada no **OpenCRM**.

---

## 1. O Problema dos Sistemas Legados de Gestão e CRM

Sistemas de gestão tradicionais voltados ao varejo e pequenas/médias empresas sofrem de dois extremos crônicos de arquitetura:

### 1.1 Engessamento e Sobrecarga de Esquema (Monolitos Rígidos)
* **Estruturas rígidas:** Um sistema desenhado para revenda de celulares impõe campos como `IMEI`, `Bateria`, `Checklist de Tela` e `Garantia de 90 dias`. Ao tentar utilizar o mesmo sistema para uma lanchonete ou confecção de roupas, os usuários são forçados a lidar com dezenas de campos inúteis ou "gambiarra" de observações em texto livre.
* **Débito técnico em migrações:** Adicionar novas propriedades operacionais exige alterações de DDL no banco de dados (`ALTER TABLE ... ADD COLUMN`), demandando janelas de manutenção, migrações arriscadas e risco de quebra de compatibilidade em produção.

### 1.2 Fragilidade de Soluções No-Code / Low-Code
* **Isolamento de mentira:** Planilhas compartilhadas e ferramentas no-code populares não possuem isolamento relacional de dados em nível de engine.
* **Riscos de integridade e concorrência:** Vendas simultâneas causam *race conditions*, gerando estoque negativo e cancelamentos de pedidos.
* **Violações graves da LGPD:** Dados sensíveis de clientes (CPF, telefone, histórico de compras) são armazenados em texto plano, sem criptografia de ponta a ponta, sem controle de acesso por linha e sem trilha de auditoria para justificar a coleta.

---

## 2. A Solução do OpenCRM: Arquitetura Metadata-Driven

O **OpenCRM** resolve essa dicotomia através de uma abordagem orientada a metadados (*Metadata-Driven Architecture*), unindo a flexibilidade dinâmica de esquemas JSON ao rigor de um banco relacional **PostgreSQL 17** com isolamento obrigatório de banco de dados:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITETURA METADATA-DRIVEN                        │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│    Segmento Celulares        │     Segmento Alimentação     │  Moda/Roupas  │
├──────────────────────────────┼──────────────────────────────┼───────────────┤
│ • Serializado (IMEI 1 & 2)   │ • Por Lote e Validade        │ • Grade Tam.  │
│ • Validação Algoritmo Luhn   │ • Tempo de Preparo           │ • Tecido/Cor  │
│ • Termo de Garantia QR Code  │ • Sem serialização           │ • Troca 30 d  │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCHEMA RELACIONAL UNIFICADO (POSTGRESQL 17)            │
│               • Colunas Core: id, store_id, title, prices, stock_qty        │
│               • Colunas Dinâmicas: custom_attributes (JSONB + GIN Index)    │
│               • Políticas de RLS: FORCE ROW LEVEL SECURITY (app.current_store)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pilares Estruturais da Solução

### 3.1 Multi-Tenancy Nativo com RLS (Supabase PostgreSQL 17)
* Isolamento forçado no nível de banco de dados via role restrita `opencrm_app`.
* A engine do PostgreSQL avalia a política `store_id = current_setting('app.current_store_id')::uuid` antes de processar qualquer instrução `SELECT`, `INSERT`, `UPDATE` ou `DELETE`.
* Mesmo sob falha lógica na camada de aplicação ou tentativa de injeção de SQL, um tenant **nunca** acessa dados de outro tenant.

### 3.2 Motor Dinâmico de Templates (`JSONB` + Zod)
* Cada loja define seu próprio catálogo de atributos customizados sem alterar o schema do banco.
* O frontend valida os formulários em tempo de execução via esquemas dinâmicos Zod gerados a partir do `template_config` da loja ativa.
* A persistência utiliza índices `GIN` no PostgreSQL para consultas de alta performance dentro das chaves de metadados.

### 3.3 AppSec e Privacidade (LGPD By Design)
* **Criptografia Simétrica AES-256-GCM:** CPF e telefone são cifrados com vetores de inicialização (IV) únicos e autenticados por Tag de 16 bytes.
* **Blind Index HMAC-SHA256:** Permite buscas exatas `O(1)` e verificação de duplicidade de CPF/Telefone sem jamais descriptografar o banco inteiro.
* **Trilha Imutável de Auditoria (Art. 18):** Toda ação de revelação de PII gera log obrigatório com IP, ator, timestamp e justificativa.

### 3.4 Checkout Transacional ACID & Anti-Concorrência
* A baixa de estoque é atômica e condicional (`stock_qty >= $qty`), prevenindo vendas duplicadas sob concorrência intensa.
* Suporte nativo a chave de idempotência (`Idempotency-Key` no header HTTP), garantindo que retentativas de rede não gerem transações duplicadas.
* Emissão de comprovante e termo de garantia com QR Code vetorial e compartilhamento nativo via WhatsApp.
