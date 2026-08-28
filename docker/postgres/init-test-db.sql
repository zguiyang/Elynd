-- Created on first Postgres container init (empty volume only).
-- Existing dev volumes: run manually —
--   psql -h 127.0.0.1 -p 5433 -U root -d gloaming_backend -c "CREATE DATABASE gloaming_test;"
SELECT 'CREATE DATABASE gloaming_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gloaming_test')\gexec
