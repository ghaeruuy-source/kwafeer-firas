#!/usr/bin/env bash
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists booking_test" -c "create database booking_test"
$P -d booking_test -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do $P -d booking_test -f "$f" 2>/dev/null; done
$P -d booking_test -f supabase/tests/booking_logic.test.sql
./supabase/tests/concurrency.sh booking_test
