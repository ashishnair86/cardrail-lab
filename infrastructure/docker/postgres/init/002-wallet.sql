CREATE TABLE IF NOT EXISTS wallet_accounts (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('TRANSFER', 'BILL_PAYMENT')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED')),
  description TEXT NOT NULL,
  from_user TEXT NOT NULL REFERENCES wallet_accounts(user_id),
  to_user TEXT REFERENCES wallet_accounts(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'TRANSFER' AND to_user IS NOT NULL AND from_user <> to_user) OR (kind = 'BILL_PAYMENT' AND to_user IS NULL))
);
CREATE INDEX IF NOT EXISTS wallet_transactions_created_at_idx ON wallet_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_transactions_from_user_idx ON wallet_transactions (from_user, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_transactions_to_user_idx ON wallet_transactions (to_user, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES wallet_transactions(id),
  account_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO wallet_accounts (user_id, display_name, initials, balance, currency) VALUES
  ('alex', 'Alex Morgan', 'AM', 1250.00, 'USD'),
  ('maya', 'Maya Patel', 'MP', 840.00, 'USD'),
  ('jordan', 'Jordan Lee', 'JL', 460.00, 'USD')
ON CONFLICT (user_id) DO NOTHING;
