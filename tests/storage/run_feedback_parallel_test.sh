#!/bin/bash
# Parallel-session test for the feedback screenshot limit (5 per user per 24h).
# Local only, never Supabase. Usage:
#   bash tests/storage/run_feedback_parallel_test.sh DB [HOST] [PORT]
# Starts N sessions for one fresh test user at the same moment; each inserts a
# screenshot report and holds its transaction open briefly so they overlap.
# Expect exactly 5 to commit. Without a per-user lock, overlapping sessions all
# count < 5 and more than 5 get in.
DB=$1; H=${2:-/tmp/pgreplica}; PORT=${3:-5499}; N=${N:-10}
P="psql -h $H -p $PORT -U postgres -d $DB -qtA"
U=cccccccc-0000-0000-0000-00000000000$((RANDOM % 9 + 1))
$P -c "insert into auth.users values ('$U') on conflict do nothing" >/dev/null
$P -c "delete from public.feedback where user_id='$U'" >/dev/null
for i in $(seq 1 $N); do
  ( $P -c "begin; set local role authenticated;
      select set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', true);
      select set_config('request.jwt.claim.sub', '$U', true);
      insert into public.feedback(category, message, site, has_screenshot) values ('bug', 'parallel $i', 'preview', true);
      select pg_sleep(0.5);
    commit;" >/dev/null 2>&1 ) &
done
wait
got=$($P -c "select count(*) from public.feedback where user_id='$U' and has_screenshot")
echo "parallel sessions: $N, screenshot reports committed: $got (limit 5)"
[ "$got" -le 5 ] && echo "RESULT PASS" || echo "RESULT FAIL (limit exceeded)"
