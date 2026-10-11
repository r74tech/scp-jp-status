-- Migration number: 0001 	 2026-10-11T14:31:31.079Z
CREATE TABLE IF NOT EXISTS uptimeflare (
    key VARCHAR(255) PRIMARY KEY,
    value BLOB NOT NULL
);
