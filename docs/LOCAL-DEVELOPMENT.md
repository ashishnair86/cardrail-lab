# Local development

## Payment API

```bash
cd services/payment-api
npm install
npm run dev
```

Health check: `http://localhost:3000/health`

Create a synthetic payment:

```bash
curl -sS http://localhost:3000/api/payments \
  -H 'Content-Type: application/json' \
  -d '{"amount":125,"currency":"USD","merchantId":"merchant-demo","scenario":"approve"}'
```

## Web frontend

In a second terminal:

```bash
cd services/web
npm install
npm run dev
```

Open `http://localhost:5173`. The API defaults to `http://localhost:3000`; set `VITE_API_BASE_URL` if needed.

## Current limitations

- Payment records are held in memory and disappear when the API restarts.
- This is a synthetic learning demo, not a payment processor.
- No real card data, credentials, or production secrets should be used.
- Docker images are starter examples; Kubernetes manifests and CI will be added in later milestones.
