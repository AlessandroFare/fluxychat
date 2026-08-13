-- CP-002: FCM HTTP v1 service account JSON per project/environment
ALTER TABLE project_push_config ADD COLUMN fcm_service_account_json TEXT;
