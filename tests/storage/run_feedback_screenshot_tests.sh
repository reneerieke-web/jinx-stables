#!/bin/bash
# Local-only tests for supabase/review/20260927_feedback_screenshots.sql (never Supabase).
#   createdb fbs
#   psql -d fbs -f tests/storage/replica_base.sql
#   psql -d fbs -f supabase/review/20260927_screenshot_storage.sql
#   psql -d fbs -f supabase/review/20260927_feedback.sql
#   psql -d fbs -f supabase/review/20260927_feedback_screenshots.sql
#   bash tests/storage/run_feedback_screenshot_tests.sh fbs   (socket /tmp/pgreplica, port 5499)
DB=$1; P="psql -h /tmp/pgreplica -p 5499 -U postgres -d $DB -qtA"
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002
R1=a1000000-0000-4000-8000-000000000001   # A's report with a screenshot
R2=a2000000-0000-4000-8000-000000000002   # A's report without one
R3=a3000000-0000-4000-8000-000000000003   # A's report, flagged, but two hours old
RB=b1000000-0000-4000-8000-000000000001   # B's report with a screenshot
pass=0; fail=0
t(){ exp=$1; who=$2; label=$3; sql=$4
  if [ "$who" = anon ]; then pre="set role anon;"; else pre="set role authenticated; set request.jwt.claim.sub='$who';"; fi
  out=$($P -c "begin; $pre $sql; commit;" 2>&1); rc=$?
  if [ $rc -eq 0 ] && ! grep -q '^0$' <<<"$out"; then got=ok; else got=deny; fi
  if [ "$got" = "$exp" ]; then pass=$((pass+1)); r=PASS; else fail=$((fail+1)); r=FAIL; fi
  printf '%s  %-4s %-60s %s\n' "$r" "$exp" "$label" "$(grep -m1 -o 'ERROR:.*' <<<"$out" | cut -c1-60)"; }
rep(){ echo "insert into public.feedback(id,category,message,site,has_screenshot) values ('$1','bug','it broke','preview',$2)"; }
up(){ echo "insert into storage.objects(bucket_id,name) values ('${2:-feedback-screenshots}','$1') returning 1"; }
asroot(){ $P -c "$1" >/dev/null; }

# Reports
t ok   $A "A files a report with its own id + has_screenshot"          "$(rep $R1 true)"
t ok   $A "A files a report without a screenshot"                       "$(rep $R2 false)"
t ok   $B "B files a report with a screenshot"                          "$(rep $RB true)"
t ok   $A "A files a flagged report (made old below)"                   "$(rep $R3 true)"
asroot "update public.feedback set created_at = now() - interval '2 hours' where id='$R3'"
t deny $A "A sets screenshot_path directly (generated column)"          "insert into public.feedback(category,message,site,has_screenshot,screenshot_path) values ('bug','x','preview',true,'$B/$RB.jpg')"
t deny $A "A files a flagged report as B (user_id)"                     "insert into public.feedback(category,message,site,has_screenshot,user_id) values ('bug','x','preview',true,'$B')"
t deny $A "A reuses B's report id (primary key)"                        "$(rep $RB true)"
t deny $A "A reads any feedback (still insert-only)"                    "select count(*) from public.feedback"
t deny $A "A flips has_screenshot on an existing report"                "with x as (update public.feedback set has_screenshot=true where id='$R2' returning 1) select count(*) from x"
echo "   stored path for R1: $($P -c "select screenshot_path from public.feedback where id='$R1'")  R2: '$($P -c "select coalesce(screenshot_path,'(null)') from public.feedback where id='$R2'")'"

# Uploads
t ok   $A "A uploads A/R1.jpg (own flagged report, within the hour)"   "$(up $A/$R1.jpg)"
t deny $A "A uploads A/R1.jpg a second time"                            "$(up $A/$R1.jpg)"
t deny $A "A overwrites A/R1.jpg via upsert"                            "insert into storage.objects(bucket_id,name,metadata) values ('feedback-screenshots','$A/$R1.jpg','{\"x\":1}') on conflict (bucket_id,name) do update set metadata=excluded.metadata returning 1"
t deny $A "A updates its own feedback picture"                          "with x as (update storage.objects set metadata='{}' where bucket_id='feedback-screenshots' returning 1) select count(*) from x"
t deny $A "A deletes its own feedback picture"                          "with x as (delete from storage.objects where bucket_id='feedback-screenshots' returning 1) select count(*) from x"
t deny $A "A lists/reads feedback pictures (own included)"              "select count(*) from storage.objects where bucket_id='feedback-screenshots'"
t deny $A "A uploads for a report without a screenshot flag"            "$(up $A/$R2.jpg)"
t deny $A "A uploads for a report id that does not exist"               "$(up $A/c0000000-0000-4000-8000-00000000000c.jpg)"
t deny $A "A uploads for a flagged report older than an hour"           "$(up $A/$R3.jpg)"
t deny $A "A uploads into B's folder"                                   "$(up $B/$RB.jpg)"
t deny $A "A uploads B's report id into A's folder"                     "$(up $A/$RB.jpg)"
t deny $A "path trick ../"                                              "$(up $A/../$B/$RB.jpg)"
t deny $A "extra folder level"                                          "$(up $A/x/$R1.jpg)"
t deny $A "different extension"                                         "$(up $A/$R1.png)"
t deny $A "feedback path into the horse bucket"                         "$(up $A/$R1.jpg horse-screenshots)"
t deny $A "helper answers only for the caller's own report"            "select count(*) where public.feedback_screenshot_upload_allowed('$B/$RB.jpg')"
t ok   $B "B uploads its own picture"                                   "$(up $B/$RB.jpg)"
t deny $A "A reads B's picture"                                         "select count(*) from storage.objects where name='$B/$RB.jpg'"
t deny anon "anon uploads"                                              "$(up $A/$R1.jpg)"
t deny anon "anon reads feedback pictures"                              "select count(*) from storage.objects where bucket_id='feedback-screenshots'"
t deny anon "anon calls the helper"                                     "select count(*) where public.feedback_screenshot_upload_allowed('$A/$R1.jpg')"
t deny $A "A calls the screenshot-limit trigger function directly"      "select public.enforce_feedback_screenshot_limit()"

# Screenshot limit: 5 flagged reports per 24h (R1 and R3 already count).
for i in 4 5 6; do $P -c "begin; set role authenticated; set request.jwt.claim.sub='$A'; $(rep a900000$i-0000-4000-8000-000000000000 true); commit;" >/dev/null; done
echo "   A flagged reports in 24h: $($P -c "select count(*) from public.feedback where user_id='$A' and has_screenshot")"
t deny $A "6th screenshot report in 24h refused"                        "$(rep a9000009-0000-4000-8000-000000000000 true)"
t ok   $A "a report without a screenshot still goes through"            "$(rep a9000010-0000-4000-8000-000000000000 false)"
t ok   $B "B unaffected by A's screenshot limit"                        "$(rep b9000001-0000-4000-8000-000000000000 true)"
echo "TOTAL pass=$pass fail=$fail"
