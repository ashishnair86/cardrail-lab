# CardRail Lab

CardRail is an educational payment-processing simulation for learning application architecture, distributed systems, SRE, DevOps, Kubernetes, and cloud operations. It uses synthetic data only and is not a real payment processor or card network.

## Current end-to-end flow

Merchant-style API request → Payment Gateway API → Risk Service → Network Router → Issuer Simulator → PostgreSQL persistence → API response. The React operations dashboard can create and list simulated payments.

## Stack

- React + TypeScript + Vite operations dashboard
- Node.js + TypeScript payment gateway
- Python + FastAPI synthetic risk service
- Node.js network router and issuer simulator
- PostgreSQL for durable payment records and idempotency keys
- Docker Compose for local orchestration
- Later milestones: Kafka, Redis, OpenTelemetry, Prometheus/Grafana, Kubernetes, Helm, Jenkins, Argo CD, and selected Floci/AWS labs

## Run locally

```bash
docker compose up --build
```

- Dashboard: http://localhost:5173
- Payment API: http://localhost:3000
- Health: http://localhost:3000/health

See [Architecture](docs/ARCHITECTURE.md) and [Local development](docs/LOCAL-DEVELOPMENT.md) for flow explanations and test requests.

## Safety and scope

Use synthetic data only. Do not use real card numbers, CVVs, PINs, production credentials, or sensitive Mastercard information. This project does not connect to Visa or Mastercard, does not implement real acquiring/issuing, and is not PCI-certified. Risk rules and issuer decisions are intentionally simulated.
