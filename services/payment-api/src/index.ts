import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT ?? 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ??
    "postgres://cardrail:cardrail-local-dev-only@localhost:5432/cardrail",
  connectionTimeoutMillis: 3000
});
const riskUrl = process.env.RISK_SERVICE_URL ?? "http://localhost:4001";
const networkUrl = process.env.NETWORK_SERVICE_URL ?? "http://localhost:4002";

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "UP", service: "cardrail-payment-api", database: "UP" });
  } catch {
    res.status(503).json({ status: "DEGRADED", service: "cardrail-payment-api", database: "DOWN" });
  }
});

app.get("/api/payments", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, amount, currency, merchant_id AS \"merchantId\", status, created_at AS \"createdAt\", risk_score AS \"riskScore\", decision_reason AS \"decisionReason\", route FROM payments ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error("list payments failed", error);
    res.status(503).json({ error: "Payment storage is unavailable" });
  }
});

app.get("/api/architecture", (_req, res) => {
  res.json({
    flow: ["merchant", "payment-gateway", "risk-service", "network-router", "issuer-simulator", "payment-database"],
    note: "Educational simulation only; no real card network or bank is contacted."
  });
});

app.post("/api/payments", async (req, res) => {
  const { amount, currency = "USD", merchantId = "merchant-demo", scenario = "approve" } = req.body ?? {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: "currency must be a 3-letter uppercase code" });
  }
  if (typeof merchantId !== "string" || merchantId.length < 1 || merchantId.length > 100) {
    return res.status(400).json({ error: "merchantId must be a non-empty string up to 100 characters" });
  }
  if (scenario !== "approve" && scenario !== "decline") {
    return res.status(400).json({ error: "scenario must be approve or decline" });
  }

  const id = randomUUID();
  const idempotencyKey = req.header("Idempotency-Key")?.trim() || id;

  try {
    const existing = await pool.query(
      "SELECT id, amount, currency, merchant_id AS \"merchantId\", status, created_at AS \"createdAt\", risk_score AS \"riskScore\", decision_reason AS \"decisionReason\", route FROM payments WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existing.rowCount) return res.status(200).json({ ...existing.rows[0], idempotentReplay: true });

    const riskResponse = await fetch(`${riskUrl}/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount, currency, merchantId }),
      signal: AbortSignal.timeout(3000)
    });
    if (!riskResponse.ok) throw new Error(`risk service returned ${riskResponse.status}`);
    const risk = await riskResponse.json() as { decision: string; score: number; reason: string };

    let outcome: { status: "APPROVED" | "DECLINED"; reason: string; route: string; issuerId: string };
    if (risk.decision === "DECLINE") {
      outcome = { status: "DECLINED", reason: `Risk rejected: ${risk.reason}`, route: "not-routed", issuerId: "not-contacted" };
    } else {
      const networkResponse = await fetch(`${networkUrl}/authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: id, amount, currency, merchantId, scenario }),
        signal: AbortSignal.timeout(5000)
      });
      if (!networkResponse.ok) throw new Error(`network service returned ${networkResponse.status}`);
      const networkResult = await networkResponse.json() as { status: "APPROVED" | "DECLINED"; reason: string; route: string; issuerId: string };
      outcome = networkResult;
    }

    const saved = await pool.query(
      `INSERT INTO payments (id, idempotency_key, amount, currency, merchant_id, status, risk_score, decision_reason, route, issuer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, amount, currency, merchant_id AS "merchantId", status, created_at AS "createdAt", risk_score AS "riskScore", decision_reason AS "decisionReason", route, issuer_id AS "issuerId"`,
      [id, idempotencyKey, amount, currency, merchantId, outcome.status, risk.score, outcome.reason, outcome.route, outcome.issuerId]
    );
    console.log(JSON.stringify({ event: "payment_decided", paymentId: id, status: outcome.status, riskScore: risk.score, route: outcome.route }));
    return res.status(201).json({ ...saved.rows[0], riskDecision: risk.decision });
  } catch (error) {
    console.error("payment orchestration failed", error);
    return res.status(503).json({ error: "Payment flow dependency failed; retry using the same Idempotency-Key" });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CardRail payment gateway listening on port ${port}`);
});
