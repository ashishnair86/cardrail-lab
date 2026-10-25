# CardRail Wallet & SRE Lab

CardRail is an educational wallet and payment-platform simulation designed as an SRE/DevOps portfolio project. It uses synthetic funds only and does not connect to real banks or card networks.

## Wallet experience

- Demo wallets for Alex Morgan, Maya Patel, and Jordan Lee
- Wallet balance and transaction history
- Transfers between demo wallets, with both balances updated in one PostgreSQL transaction
- Simulated utility bill payments
- Idempotency keys and a double-entry-style ledger record for wallet movements
- A separate operations area to exercise the existing card authorization, risk, routing, and issuer simulation flow

This is a learning sandbox, not a real financial product. It has no production authentication, KYC, regulated money movement, real biller integration, or PCI certification. Do not enter real personal or payment information.

## Stack

- React + TypeScript + Vite
- Node.js + TypeScript + Express
- PostgreSQL
- Python + FastAPI risk simulation
- Network router and issuer simulator
- Docker Compose for local development

## Run locally

```bash
docker compose up --build
```

- Wallet: http://localhost:5173
- API health: http://localhost:3000/health
- Wallet list: http://localhost:3000/api/wallets

The wallet tables and demo accounts are created by the SQL init scripts on first database initialization. If you already have a persistent PostgreSQL volume, the new init script will not run automatically; see the migration note below.

### Existing database volume

For an existing local volume, apply the new schema manually:

```bash
docker compose exec -T postgres psql -U cardrail -d cardrail < infrastructure/docker/postgres/init/002-wallet.sql
```

This command creates wallet tables and seeds the demo accounts. It does not delete existing payment data.

## SRE learning goals

1. Validate transaction integrity and idempotency.
2. Add automated integration tests and CI.
3. Instrument latency, errors, and dependency health.
4. Build SLOs, dashboards, alerts, and incident runbooks.
5. Inject controlled failures and demonstrate safe recovery.
6. Add deployment automation and later deploy to local Kubernetes.

## Safety boundary

All balances and transactions are synthetic. The application is not a bank, wallet provider, or payment processor. It does not implement production-grade authentication or authorization; the demo account selector is for local learning only.
