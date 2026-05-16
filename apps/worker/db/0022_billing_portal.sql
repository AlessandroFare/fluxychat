-- Add Stripe customer ID and subscription ID to project_plans for billing portal support

ALTER TABLE project_plans ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE project_plans ADD COLUMN stripe_subscription_id TEXT;
