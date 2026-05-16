-- Migration 0030: Add manually_overridden flag to project_plans
-- Prevents Stripe webhook plan updates from clobbering manually-set quota limits.

ALTER TABLE project_plans
  ADD COLUMN manually_overridden INTEGER NOT NULL DEFAULT 0;