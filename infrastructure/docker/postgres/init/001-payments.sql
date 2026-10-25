CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  merchant_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('APPROVED', 'DECLINED')),
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  decision_reason TEXT NOT NULL,
  route TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments (created_at DESC);
