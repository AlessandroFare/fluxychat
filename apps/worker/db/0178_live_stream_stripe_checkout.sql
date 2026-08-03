-- Live commerce: Stripe Checkout Sessions (native payment path)

ALTER TABLE live_stream_products ADD COLUMN stripe_price_id TEXT;
ALTER TABLE live_stream_products ADD COLUMN checkout_provider TEXT NOT NULL DEFAULT 'external';

ALTER TABLE live_stream_checkout_clicks ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE live_stream_checkout_clicks ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE live_stream_checkout_clicks ADD COLUMN checkout_provider TEXT NOT NULL DEFAULT 'external';

CREATE INDEX IF NOT EXISTS idx_live_stream_checkout_clicks_stripe_session
  ON live_stream_checkout_clicks (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
