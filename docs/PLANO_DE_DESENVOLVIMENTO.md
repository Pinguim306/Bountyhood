# Bountyhood — Plano de Desenvolvimento

Plataforma de bounties na **Robinhood Chain**, inspirada no **pump.fun GO** (https://pump.fun/go): usuários criam bounties com recompensa travada em escrow on-chain, outros usuários executam a tarefa, enviam prova e recebem o pagamento. Sem trading, sem launchpad — só o sistema de bounties.

---

## 1. Entendimento da demanda

O que o pump.fun GO faz (modelo de referência):

- **Criação de bounty**: o criador conecta carteira (e conta X no caso deles), publica título, descrição, entregáveis e prazo. A recompensa (mínimo ~US$ 5) é **depositada em escrow no ato da criação** e não pode ser sacada depois de publicada.
- **Submissão**: qualquer usuário conectado executa a tarefa e envia **prova** (links, mídia, texto).
- **Aprovação e pagamento**: a plataforma (no caso do pump.fun, com autoridade exclusiva) aprova uma submissão e o escrow paga direto ao executor. Se o bounty expira sem aprovação, o criador **resgata os fundos após uma janela de disputa**.
- **UI**: tema escuro, acento verde-limão, grid de cards com recompensa em destaque, contagem regressiva, contador de submissões, feed de atividade.

Adaptação para o Bountyhood: em vez de moderação centralizada total, o **criador aprova** a submissão vencedora; a plataforma atua como **árbitro apenas em disputa** (mais alinhado a um produto on-chain e reduz a carga operacional inicial).

## 2. Pesquisa — Robinhood Chain

| Item | Valor |
|---|---|
| Tipo | Ethereum L2 (Arbitrum Orbit), 100% EVM-compatível |
| Mainnet | Live desde 01/07/2026 — Chain ID **4663** |
| Testnet | Chain ID **46630**, RPC `https://rpc.testnet.chain.robinhood.com/rpc` |
| Gas token | **ETH** (bridged) |
| Explorer | Blockscout (testnet e mainnet) |
| Faucet | `faucet.testnet.chain.robinhood.com` |
| Tooling | Solidity, Foundry, Hardhat, viem, wagmi funcionam sem modificação |

Consequência prática: **todo o stack EVM padrão serve**. Desenvolvemos e testamos na testnet (46630) e promovemos para mainnet (4663) sem mudança de código — só de configuração.

## 3. Arquitetura proposta

```
┌────────────────────────────────────────────────────────┐
│ Frontend — Next.js 15 (App Router) + Tailwind          │
│ wagmi v2 + viem + RainbowKit (conexão de carteira)     │
│ Tema dark estilo pump.fun (fundo #0d0e12, verde-lima)  │
└──────────────┬─────────────────────┬───────────────────┘
               │ leitura/escrita     │ metadados & provas
┌──────────────▼──────────────┐  ┌───▼────────────────────┐
│ BountyEscrow.sol            │  │ API (Next.js routes)   │
│ Robinhood Chain (ETH nativo)│  │ Postgres + Prisma      │
│ escrow, payout, reclaim     │  │ indexer de eventos     │
└─────────────────────────────┘  └────────────────────────┘
```

**Divisão on-chain / off-chain (modelo híbrido, igual ao GO):**

- **On-chain (fonte de verdade do dinheiro)**: escrow da recompensa em ETH, aprovação/pagamento, expiração/resgate, taxa da plataforma, hash dos metadados (integridade).
- **Off-chain (fonte de verdade do conteúdo)**: título, descrição, entregáveis, imagens, submissões e provas em Postgres, vinculados ao ID on-chain. Um indexer (watcher viem) sincroniza eventos do contrato com o banco.

Justificativa: provas são mídia/links volumosos e editáveis — não fazem sentido on-chain; o dinheiro e o estado do ciclo de vida, sim.

### Contrato `BountyEscrow.sol`

Ciclo de vida de um bounty:

```
create(deadline, metadataHash) + msg.value
        │
        ▼
      OPEN ──── submissões registradas off-chain (hash opcional on-chain)
        │
        ├─ approve(bountyId, hunter)  → paga hunter (menos taxa) → PAID
        ├─ cancel() antes da 1ª submissão → devolve criador → CANCELLED
        └─ deadline vencido → janela de disputa (ex.: 72h)
                 ├─ sem disputa → reclaim() pelo criador → RECLAIMED
                 └─ disputa aberta → árbitro decide → PAID ou RECLAIMED
```

Regras de segurança: checks-effects-interactions, `ReentrancyGuard`, pull-payment para casos de falha de transferência, recompensa mínima, taxa configurável com teto (ex.: máx. 5%), sem função de saque arbitrário pelo owner.

## 4. Fases de desenvolvimento

### Fase 0 — Fundação (repo e infra) ✦ pequena
- Monorepo pnpm: `apps/web` (Next.js) + `packages/contracts` (Foundry).
- CI (GitHub Actions): lint, testes de contrato (`forge test`), build do front.
- Configuração das chains (46630 testnet / 4663 mainnet) como definição viem customizada.

### Fase 1 — Smart contract ✦ núcleo
- `BountyEscrow.sol` com o ciclo acima + testes Foundry (unidade, fuzz de valores, casos de expiração/disputa).
- Deploy na **testnet 46630** com script `forge script`; verificação no Blockscout.
- Entregável: endereço do contrato na testnet + suíte de testes verde.

### Fase 2 — Frontend core (leitura + criação)
- Layout dark estilo GO: header com conexão de carteira, grid de cards de bounty (recompensa em ETH em destaque, countdown, nº de submissões, status).
- Página de criação: formulário → grava metadados na API → `create()` on-chain com o hash.
- Página de detalhe do bounty (descrição, entregáveis, prazo, submissões).
- Indexer: watcher de eventos `BountyCreated/Approved/Reclaimed` → Postgres.

### Fase 3 — Submissões e pagamento
- Fluxo do hunter: conectar carteira → enviar prova (texto + links + upload de mídia).
- Fluxo do criador: revisar submissões → `approve()` → payout automático do escrow.
- Expiração: reclaim pelo criador após janela de disputa; abertura de disputa pelo hunter.
- Notificações in-app básicas (nova submissão, aprovação, expiração).

### Fase 4 — Descoberta e reputação
- Busca, filtros (valor, prazo, status) e categorias/tags.
- Perfil público por endereço: bounties criados/concluídos, total ganho.
- Leaderboard de hunters e feed de atividade (estilo pump.fun).

### Fase 5 — Moderação e disputa
- Painel admin: ocultar bounties ilegais/abusivos (só oculta na UI — o escrow segue as regras do contrato), fila de disputas com decisão do árbitro.
- Termos de uso e política de conteúdo (aprendizado do GO: houve backlash por bounties extremos — moderação de conteúdo é obrigatória desde o dia 1).

### Fase 6 — Mainnet
- Revisão de segurança do contrato (self-audit + ferramentas: Slither, revisão externa se houver orçamento).
- Deploy na mainnet 4663, monitoramento (alertas de eventos anômalos), config de taxa.

## 5. Stack (resumo)

| Camada | Escolha |
|---|---|
| Contratos | Solidity 0.8.x + Foundry + OpenZeppelin |
| Front | Next.js 15, TypeScript, Tailwind CSS |
| Web3 | wagmi v2 + viem + RainbowKit |
| Dados | Postgres + Prisma; indexer viem (polling de eventos) |
| Upload de provas | armazenamento S3-compatível (ou IPFS numa fase futura) |
| Deploy web | Vercel (ou similar) |

## 6. Riscos e decisões em aberto

1. **Moeda da recompensa**: MVP em **ETH nativo** (gas token da chain). Suporte a ERC-20/stablecoin fica para depois — depende de quais stables existirão na Robinhood Chain.
2. **Quem aprova**: MVP = criador aprova; árbitro da plataforma só em disputa. Alternativa futura: júri/stake.
3. **Conteúdo**: bounties são conteúdo gerado por usuário com dinheiro envolvido — política de conteúdo e botão de report desde o MVP.
4. **Login social (X)**: o GO exige conta X; no MVP usaremos só carteira, com verificação social como fase futura.
5. **Preço em USD**: exibir conversão ETH→USD via oráculo/API de preço (cosmético no MVP).

## 7. Fontes da pesquisa

- [Robinhood Chain — docs de conexão](https://docs.robinhood.com/chain/connecting/)
- [Robinhood Chain testnet — anúncio Arbitrum](https://blog.arbitrum.io/robinhood-chain-testnet/)
- [Robinhood Chain mainnet — thirdweb](https://blog.thirdweb.com/robinhood-chain-inside-the-ethereum-l2-bringing-tokenized-stocks-to-120-countries/)
- [Pump.fun GO — Bankless](https://www.bankless.com/read/news/pump-fun-launches-go-a-bounty-platform-for-any-task)
- [Pump.fun GO — crypto.news](https://crypto.news/pump-fun-launches-go-as-users-race-to-complete-bizarre-bounties/)
- [Pump.fun GO backlash — The Defiant](https://thedefiant.io/news/nfts-and-web3/pump-fun-launches-go-bounty-platform-backlash-extreme-listings)
