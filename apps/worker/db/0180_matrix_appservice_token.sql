-- Matrix appservice webhook auth (Bearer token per bridge)

ALTER TABLE matrix_bridge_configs ADD COLUMN appservice_token TEXT;
