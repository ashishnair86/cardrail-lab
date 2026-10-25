# CardRail Lab

Educational payment-network-inspired platform for learning full-stack development, event-driven systems, Kubernetes, CI/CD, and observability. Uses synthetic data only; not a real payment system.

## Planned stack
- React + TypeScript frontend
- Node.js + TypeScript payment API
- Python + FastAPI risk service
- PostgreSQL, Redis, Kafka, MongoDB
- kind, Helm, Jenkins, Argo CD
- Prometheus and Grafana
- Floci for supported AWS API emulation

## Development approach
Build and test locally first, then validate selected AWS integrations. Keep business logic independent of infrastructure adapters and verify emulator API support before relying on it.

Never use real cardholder data or production secrets in this learning project.
