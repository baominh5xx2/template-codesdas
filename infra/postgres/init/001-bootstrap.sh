#!/bin/sh
set -eu

# Runs once for a fresh starter volume; never modifies an existing database.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=database="$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" \
  --set=mcp_password="$MCP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE starter_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password') \gexec
SELECT format('CREATE ROLE starter_mcp LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'mcp_password') \gexec

REVOKE ALL ON DATABASE :"database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database" TO starter_app, starter_mcp;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app AUTHORIZATION starter_app;
CREATE SCHEMA analytics AUTHORIZATION starter_app;
GRANT USAGE ON SCHEMA analytics TO starter_mcp;
ALTER DEFAULT PRIVILEGES FOR ROLE starter_app IN SCHEMA analytics
  GRANT SELECT ON TABLES TO starter_mcp;
ALTER ROLE starter_app SET search_path = app, analytics, pg_catalog;
ALTER ROLE starter_mcp SET search_path = analytics, pg_catalog;
ALTER ROLE starter_mcp SET default_transaction_read_only = on;
ALTER ROLE starter_mcp SET statement_timeout = '5s';
ALTER ROLE starter_mcp SET lock_timeout = '1s';
ALTER ROLE starter_mcp SET idle_in_transaction_session_timeout = '10s';

-- Explicit synthetic probes for infrastructure smoke checks, not app data.
SET ROLE starter_app;
CREATE TABLE analytics.setup_probe (
  id integer PRIMARY KEY,
  note text NOT NULL,
  synthetic boolean NOT NULL DEFAULT true
);
INSERT INTO analytics.setup_probe (id, note) VALUES (1, 'starter infrastructure probe');
CREATE TABLE app.setup_probe (id integer PRIMARY KEY);
INSERT INTO app.setup_probe (id) VALUES (1);
RESET ROLE;
SQL
