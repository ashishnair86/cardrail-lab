import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

type Payment = {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  status: "APPROVED" | "DECLINED";
  createdAt: string;
};

const payments: Payment[] = [];

app.get("/health", (_req, res) => {
  res.json({ status: "UP", service: "cardrail-payment-api" });
});

app.get("/api/payments", (_req, res) => {
  res.json({ items: payments });
});

app.post("/api/payments", (req, res) => {
  const { amount, currency = "USD", merchantId = "merchant-demo", scenario = "approve" } = req.body ?? {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: "currency must be a 3-letter uppercase code" });
  }
  if (scenario !== "approve" && scenario !== "decline") {
    return res.status(400).json({ error: "scenario must be approve or decline" });
  }

  const payment: Payment = {
    id: randomUUID(),
    amount,
    currency,
    merchantId: String(merchantId),
    status: scenario === "decline" ? "DECLINED" : "APPROVED",
    createdAt: new Date().toISOString()
  };
  payments.unshift(payment);
  return res.status(201).json(payment);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CardRail payment API listening on port ${port}`);
});
