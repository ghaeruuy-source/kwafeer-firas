#!/usr/bin/env bash
# 20 customers race for the same barber + time. Exactly one must win.
set -uo pipefail
DB=${1:-booking_test}
TS=$(psql -d "$DB" -Atqc "select ((select d::date from generate_series(current_date+1, current_date+8, '1 day') d where extract(dow from d)=3 limit 1) + time '18:30') at time zone 'Asia/Baghdad'")
for i in $(seq 10 29); do
  psql -d "$DB" -Atqc "set role anon; select create_booking('test-shop','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b2','$TS','زبون $i','077000000$i')->>'code'" >/tmp/race_$i.out 2>&1 &
done
wait
WIN=$(grep -lE '^[A-Z0-9]{6}$' /tmp/race_*.out | wc -l)
TAKEN=$(grep -l 'SLOT_TAKEN' /tmp/race_*.out | wc -l)
rm -f /tmp/race_*.out
echo "winners=$WIN slot_taken=$TAKEN"
[ "$WIN" = 1 ] && [ "$TAKEN" = 19 ] && echo "CONCURRENCY TEST PASSED" || { echo "CONCURRENCY TEST FAILED"; exit 1; }
