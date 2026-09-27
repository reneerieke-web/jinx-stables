#!/bin/bash
# Local-only tests for supabase/review/20260927_feedback.sql (never Supabase).
#   createdb fb; psql -d fb -f tests/storage/replica_base.sql; psql -d fb -f supabase/review/20260927_feedback.sql
#   bash tests/storage/run_feedback_tests.sh fb
DB=$1; P="psql -h /tmp/pgreplica -p 5499 -U postgres -d $DB -qtA"
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002
pass=0; fail=0
t(){ exp=$1; who=$2; label=$3; sql=$4
  if [ "$who" = anon ]; then pre="set role anon;"; else pre="set role authenticated; set request.jwt.claim.sub='$who';"; fi
  out=$($P -c "begin; $pre $sql; commit;" 2>&1); rc=$?
  if [ $rc -eq 0 ] && ! grep -q '^0$' <<<"$out"; then got=ok; else got=deny; fi
  if [ "$got" = "$exp" ]; then pass=$((pass+1)); r=PASS; else fail=$((fail+1)); r=FAIL; fi
  printf '%s  %-4s %-52s %s\n' "$r" "$exp" "$label" "$(grep -m1 -o 'ERROR:.*' <<<"$out" | cut -c1-60)"; }
ins(){ echo "insert into public.feedback(category,message,site$1) values ('bug','it broke','preview'$2)"; }
t ok   $A "A submits feedback (content columns only)"      "$(ins ", doing, user_agent, viewport" ", 'adding a horse', 'Mozilla', '390x844'")"
t ok   $B "B submits feedback"                              "$(ins)"
t deny $A "A files feedback as B (user_id)"                 "$(ins ", user_id" ", '$B'")"
t deny $A "A sets status (pre-triage)"                      "$(ins ", status" ", 'done'")"
t deny $A "A sets created_at"                               "$(ins ", created_at" ", '2020-01-01'")"
t deny $A "A sets id"                                       "$(ins ", id" ", gen_random_uuid()")"
t deny $A "A reads any feedback"                            "select count(*) from public.feedback"
t deny $A "A reads own feedback"                            "select count(*) from public.feedback where user_id='$A'"
t deny $A "A edits B's feedback"                            "with x as (update public.feedback set message='x' returning 1) select count(*) from x"
t deny $A "A deletes feedback"                              "with x as (delete from public.feedback returning 1) select count(*) from x"
t deny $A "A inserts and returns rows (read via RETURNING)" "with x as ($(ins) returning message) select count(*) from x"
t deny $A "bad category"                                    "insert into public.feedback(category,message,site) values ('spam','x','preview')"
t deny $A "empty message"                                   "insert into public.feedback(category,message,site) values ('bug','   ','preview')"
t deny $A "message over 4000 chars"                         "insert into public.feedback(category,message,site) values ('bug',repeat('x',4001),'preview')"
t deny $A "bad site"                                        "insert into public.feedback(category,message,site) values ('bug','x','evil')"
t deny $A "user_agent over 512"                             "$(ins ", user_agent" ", repeat('x',513)")"
t deny anon "anon submits"                                  "$(ins)"
t deny anon "anon reads"                                    "select count(*) from public.feedback"
t deny $A "A calls rate-limit function directly"            "select public.enforce_feedback_rate_limit()"
for i in $(seq 1 19); do $P -c "begin; set role authenticated; set request.jwt.claim.sub='$A'; $(ins); commit;" >/dev/null; done
echo "   A rows now: $($P -c "select count(*) from public.feedback where user_id='$A'")"
t deny $A "21st report in 24h refused (rate limit)"         "$(ins)"
t ok   $B "B unaffected by A's limit"                       "$(ins)"
echo "   stored user_id for B rows: $($P -c "select string_agg(distinct user_id::text, ',') from public.feedback where user_id='$B'")"
echo "TOTAL pass=$pass fail=$fail"
