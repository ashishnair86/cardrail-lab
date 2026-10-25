# Local development

## Recommended: run the full stack

From the repository root:

```bash
docker compose up --build
```

Wait for services to become healthy. Open the operations dashboard at `http://localhost:5173`. The gateway API is at `http://localhost:3000`.

The stack includes PostgreSQL, the Node.js payment gateway, a Python risk service, a network router, an issuer simulator, and the React operations dashboard.

## Exercise the flow as a merchant

Create an approval:

```bash
curl -sS -X POST http://localhost:3000/api/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-001' \
  -d '{"amount":125.50,"currency":"USD","merchantId":"merchant-demo","scenario":"approve"}'
```

Repeat the exact request with the same idempotency key to see the stored response rather than create another payment.

Create an issuer decline:

```bash
curl -sS -X POST http://localhost:3000/api/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-002' \
  -d '{"amount":125.50,"currency":"USD","merchantId":"merchant-demo","scenario":"decline"}'
```

Create a risk decline (risk service rejects IDs beginning with `risk-`):

```bash
curl -sS -X POST http://localhost:3000/api/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-003' \
  -d '{"amount":125.50,"currency":"USD","merchantId":"risk-demo","scenario":"approve"}'
```

List recorded payments:

```bash
curl -sS http://localhost:3000/api/payments
```

## Stop the stack

```bash
docker compose down
```

This preserves the database volume. To delete all local CardRail database data too, use `docker compose down -v` only when you intentionally want a clean reset.

## Security and scope

Use synthetic data only. Do not submit real card numbers, CVVs, PINs, production credentials, or sensitive Mastercard information. This educational project is not a real payment processor, does not connect to Visa/Mastercard, and is not PCI-certified.
