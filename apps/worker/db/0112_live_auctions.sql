-- Live Auctions: sub-second bidding with lot management

CREATE TABLE IF NOT EXISTS auction_lots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starting_price REAL NOT NULL DEFAULT 0,
  current_price REAL NOT NULL DEFAULT 0,
  reserve_price REAL,
  bid_increment REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'extended', 'sold', 'unsold')),
  winner_id TEXT,
  start_at TEXT,
  end_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auction_room_status
  ON auction_lots (room_id, status);

CREATE TABLE IF NOT EXISTS auction_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  is_winning INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_lot
  ON auction_bids (lot_id, amount DESC);

CREATE TABLE IF NOT EXISTS auction_watchers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_watchers_unique
  ON auction_watchers (lot_id, user_id);
