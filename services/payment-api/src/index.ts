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


app.get("/api/wallets", async (_req, res) => {
  try {
    const result = await pool.query("SELECT user_id AS id, display_name AS \"displayName\", initials, balance::float8 AS balance, currency FROM wallet_accounts ORDER BY user_id");
    res.json({ items: result.rows });
  } catch (error) {
    console.error("list wallets failed", error);
    res.status(503).json({ error: "Wallet storage is unavailable" });
  }
});

app.get("/api/wallet-activity", async (req, res) => {
  const userId = String(req.query.userId ?? "alex");
  try {
    const result = await pool.query(\`SELECT id, kind, amount::float8 AS amount, currency, status, description, from_user AS "fromUser", to_user AS "toUser", created_at AS "createdAt" FROM wallet_transactions WHERE from_user = $1 OR to_user = $1 ORDER BY created_at DESC LIMIT 100\`, [userId]);
    res.json({ items: result.rows });
  } catch (error) {
    console.error("list wallet activity failed", error);
    res.status(503).json({ error: "Wallet activity is unavailable" });
  }
});

app.post("/api/wallet-transfers", async (req, res) => {
  const { fromUser, toUser, amount } = req.body ?? {};
  if (typeof fromUser !== "string" || typeof toUser !== "string" || !fromUser || !toUser || fromUser === toUser) return res.status(400).json({ error: "Choose two different demo accounts" });
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100 || amount > 5000) return res.status(400).json({ error: "Amount must be positive, have at most two decimals, and not exceed $5,000" });
  const key = req.header("Idempotency-Key")?.trim() || randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prior = await client.query(\`SELECT id, kind, amount::float8 AS amount, currency, status, description, from_user AS "fromUser", to_user AS "toUser", created_at AS "createdAt" FROM wallet_transactions WHERE idempotency_key=$1\`, [key]);
    if (prior.rowCount) { await client.query("COMMIT"); return res.status(200).json({ ...prior.rows[0], idempotentReplay: true }); }
    const result = await client.query("SELECT user_id, balance, currency FROM wallet_accounts WHERE user_id = ANY($1::text[]) ORDER BY user_id FOR UPDATE", [[fromUser, toUser]]);
    if (result.rowCount !== 2) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Demo wallet not found" }); }
    const sender = result.rows.find((w: { user_id: string }) => w.user_id === fromUser);
    const receiver = result.rows.find((w: { user_id: string }) => w.user_id === toUser);
    if (sender.currency !== receiver.currency) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Wallet currencies do not match" }); }
    if (Number(sender.balance) < amount) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Insufficient wallet balance" }); }
    const id = randomUUID();
    await client.query("UPDATE wallet_accounts SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2", [amount, fromUser]);
    await client.query("UPDATE wallet_accounts SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2", [amount, toUser]);
    const saved = await client.query(\`INSERT INTO wallet_transactions (id,idempotency_key,kind,amount,currency,status,description,from_user,to_user) VALUES ($1,$2,'TRANSFER',$3,$4,'COMPLETED',$5,$6,$7) RETURNING id,kind,amount::float8 AS amount,currency,status,description,from_user AS "fromUser",to_user AS "toUser",created_at AS "createdAt"\`, [id,key,amount,sender.currency,\`Transfer to \${toUser}\`,fromUser,toUser]);
    await client.query("INSERT INTO wallet_ledger_entries (transaction_id,account_id,direction,amount,currency) VALUES ($1,$2,'DEBIT',$3,$4),($1,$5,'CREDIT',$3,$4)", [id,fromUser,amount,sender.currency,toUser]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ event: "wallet_transfer_completed", transactionId: id, fromUser, toUser, amount }));
    return res.status(201).json(saved.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string }).code === "23505") {
      const replay = await pool.query(\`SELECT id,kind,amount::float8 AS amount,currency,status,description,from_user AS "fromUser",to_user AS "toUser",created_at AS "createdAt" FROM wallet_transactions WHERE idempotency_key=$1\`, [key]);
      if (replay.rowCount) return res.status(200).json({ ...replay.rows[0], idempotentReplay: true });
    }
    console.error("wallet transfer failed", error);
    return res.status(503).json({ error: "Transfer could not be completed; retry with the same Idempotency-Key" });
  } finally { client.release(); }
});

app.post("/api/bill-payments", async (req, res) => {
  const { userId, amount, billType, reference } = req.body ?? {};
  if (typeof userId !== "string" || !userId) return res.status(400).json({ error: "Choose a demo wallet" });
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100 || amount > 5000) return res.status(400).json({ error: "Amount must be positive, have at most two decimals, and not exceed $5,000" });
  if (!["Electricity","Internet","Water","Mobile"].includes(billType)) return res.status(400).json({ error: "Unsupported utility type" });
  if (typeof reference !== "string" || !reference.trim() || reference.length > 80) return res.status(400).json({ error: "Enter a valid account reference" });
  const key = req.header("Idempotency-Key")?.trim() || randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prior = await client.query(\`SELECT id,kind,amount::float8 AS amount,currency,status,description,from_user AS "fromUser",to_user AS "toUser",created_at AS "createdAt" FROM wallet_transactions WHERE idempotency_key=$1\`, [key]);
    if (prior.rowCount) { await client.query("COMMIT"); return res.status(200).json({ ...prior.rows[0], idempotentReplay: true }); }
    const result = await client.query("SELECT user_id,balance,currency FROM wallet_accounts WHERE user_id=$1 FOR UPDATE", [userId]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Demo wallet not found" }); }
    const wallet = result.rows[0];
    if (Number(wallet.balance) < amount) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Insufficient wallet balance" }); }
    const id = randomUUID();
    const description = \`\${billType} · \${reference.trim()}\`;
    await client.query("UPDATE wallet_accounts SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2", [amount,userId]);
    const saved = await client.query(\`INSERT INTO wallet_transactions (id,idempotency_key,kind,amount,currency,status,description,from_user,to_user) VALUES ($1,$2,'BILL_PAYMENT',$3,$4,'COMPLETED',$5,$6,NULL) RETURNING id,kind,amount::float8 AS amount,currency,status,description,from_user AS "fromUser",to_user AS "toUser",created_at AS "createdAt"\`, [id,key,amount,wallet.currency,description,userId]);
    await client.query("INSERT INTO wallet_ledger_entries (transaction_id,account_id,direction,amount,currency) VALUES ($1,$2,'DEBIT',$3,$4),($1,'utility-clearing','CREDIT',$3,$4)", [id,userId,amount,wallet.currency]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ event: "wallet_bill_payment_completed", transactionId: id, userId, amount, billType }));
    return res.status(201).json(saved.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string }).code === "23505") {
      const replay = await pool.query(\`SELECT id,kind,amount::float8 AS amount,currency,status,description,from_user AS "fromUser",to_user AS "toUser",created_at AS "createdAt" FROM wallet_transactions WHERE idempotency_key=$1\`, [key]);
      if (replay.rowCount) return res.status(200).json({ ...replay.rows[0], idempotentReplay: true });
    }
    console.error("bill payment failed", error);
    return res.status(503).json({ error: "Bill payment could not be completed; retry with the same Idempotency-Key" });
  } finally { client.release(); }
});

app.get("/api/payments", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, amount::float8 AS amount, currency, merchant_id AS \"merchantId\", status, created_at AS \"createdAt\", risk_score AS \"riskScore\", decision_reason AS \"decisionReason\", route FROM payments ORDER BY created_at DESC LIMIT 100"
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
      "SELECT id, amount::float8 AS amount, currency, merchant_id AS \"merchantId\", status, created_at AS \"createdAt\", risk_score AS \"riskScore\", decision_reason AS \"decisionReason\", route FROM payments WHERE idempotency_key = $1",
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
       RETURNING id, amount::float8 AS amount, currency, merchant_id AS "merchantId", status, created_at AS "createdAt", risk_score AS "riskScore", decision_reason AS "decisionReason", route, issuer_id AS "issuerId"`,
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
