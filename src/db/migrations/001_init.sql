-- RemitAgent initial schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100),
  first_name VARCHAR(100),
  tron_address VARCHAR(100),
  arbitrum_address VARCHAR(100),
  wallet_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipients (
  id SERIAL PRIMARY KEY,
  owner_telegram_id VARCHAR(50) NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  name VARCHAR(100),
  wallet_address VARCHAR(100),
  phone VARCHAR(30),
  country VARCHAR(50),
  preferred_chain VARCHAR(20) DEFAULT 'tron',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  sender_telegram_id VARCHAR(50) NOT NULL,
  recipient_telegram_id VARCHAR(50),
  sender_address VARCHAR(100) NOT NULL,
  recipient_address VARCHAR(100) NOT NULL,
  amount_usdt DECIMAL(18,6) NOT NULL,
  chain VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tx_hash VARCHAR(200),
  error TEXT,
  notes TEXT,
  rate_source VARCHAR(50),
  fee_pct DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender_telegram_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_recipients_owner ON recipients(owner_telegram_id);
