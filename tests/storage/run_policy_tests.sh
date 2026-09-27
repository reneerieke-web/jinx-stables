#!/bin/bash
# Storage policy tests for supabase/review/20260927_screenshot_storage.sql (revision 3: versioned names).
# Runs against a LOCAL throwaway Postgres only, never Supabase. Setup:
#   createdb -h HOST -p 5499 -U postgres newdb
#   psql ... -d newdb -f tests/storage/replica_base.sql
#   psql ... -d newdb -f supabase/review/20260927_screenshot_storage.sql
#   tests/storage/run_policy_tests.sh newdb   (expects socket dir /tmp/pgreplica, port 5499)
# usage: run.sh DB ; each case: expect(ok|deny) user label sql
DB=$1; P="psql -h /tmp/pgreplica -p 5499 -U postgres -d $DB -qtA -v ON_ERROR_STOP=1"
A=aaaaaaaa-0000-0000-0000-000000000001; B=bbbbbbbb-0000-0000-0000-000000000002
pass=0; fail=0
t(){ exp=$1; who=$2; label=$3; sql=$4
  if [ "$who" = anon ]; then pre="set role anon;"; else pre="set role authenticated; set request.jwt.claim.sub='$who';"; fi
  out=$($P -c "begin; $pre $sql; commit;" 2>&1); rc=$?
  if [ $rc -eq 0 ] && ! grep -q '^0$' <<<"$out"; then got=ok; else got=deny; fi
  [ -n "$FORCE_OUT" ] && echo "   -> $out"
  if [ "$got" = "$exp" ]; then pass=$((pass+1)); r=PASS; else fail=$((fail+1)); r=FAIL; fi
  printf '%s  %-4s %-58s %s\n' "$r" "$exp" "$label" "$(grep -m1 -o 'ERROR:.*' <<<"$out" | cut -c1-70)"; }
ins(){ echo "insert into storage.objects(bucket_id,name) values ('horse-screenshots','$1') returning 1"; }
ups(){ echo "insert into storage.objects(bucket_id,name,metadata) values ('horse-screenshots','$1','{\"v\":2}') on conflict (bucket_id,name) do update set metadata=excluded.metadata returning 1"; }
cnt(){ echo "select count(*) from storage.objects where bucket_id='horse-screenshots' and name like '$1'"; }
t ok   $A "A first upload full.jpg (own live horse)"          "$(ins $A/h_alive/v1-full.jpg)"
t ok   $A "A first upload thumb.jpg (own live horse)"         "$(ins $A/h_alive/v1-thumb.jpg)"
t ok   $A "A overwrite full.jpg via upsert"                   "$(ups $A/h_alive/v1-full.jpg)"
t ok   $A "A overwrite thumb.jpg via plain update"            "with x as (update storage.objects set metadata='{\"v\":3}' where name='$A/h_alive/v1-thumb.jpg' returning 1) select count(*) from x"
t deny $A "A upload for horse id not in any stable"           "$(ins $A/h_nope/v1-full.jpg)"
t deny $A "A upload for soft-deleted horse"                   "$(ins $A/h_gone/v1-full.jpg)"
t deny $A "A upload using B's horse id in A's folder"         "$(ins $A/h_bonly/v1-full.jpg)"
t deny $A "A upload into B's folder"                          "$(ins $B/h_bonly/v1-full.jpg)"
t deny $A "path trick ../"                                    "$(ins $A/../$B/h_bonly/v1-full.jpg)"
t deny $A "path trick extra folder"                           "$(ins $A/h_alive/x/v1-full.jpg)"
t deny $A "path trick empty horse folder"                     "$(ins $A//v1-full.jpg)"
t ok   $A "A uploads a second version (new version name)"         "$(ins $A/h_alive/v2-full.jpg)"
t deny $A "old fixed name full.jpg (no version)"             "$(ins $A/h_alive/full.jpg)"
t deny $A "version with bad characters"                      "$(ins $A/h_alive/v%3A1-full.jpg)"
t deny $A "version too long"                                 "$(ins $A/h_alive/$(printf a%.0s {1..41})-full.jpg)"
t deny $A "other file name"                                   "$(ins $A/h_alive/evil.jpg)"
t deny $A "png extension"                                     "$(ins $A/h_alive/v1-full.png)"
t deny $A "A renames own file into B's folder"                "with x as (update storage.objects set name='$B/h_bonly/v1-full.jpg' where name='$A/h_alive/v1-full.jpg' returning 1) select count(*) from x"
t ok   $B "B first upload own horse"                          "$(ins $B/h_bonly/v1-full.jpg)"
t deny $B "B lists A's files"                                 "$(cnt $A/%)"
t deny $B "B overwrites A's file (upsert)"                    "$(ups $A/h_alive/v1-full.jpg)"
t deny $B "B updates A's file"                                "with x as (update storage.objects set metadata='{}' where name like '$A/%' returning 1) select count(*) from x"
t deny $B "B deletes A's file"                                "with x as (delete from storage.objects where name like '$A/%' returning 1) select count(*) from x"
t deny anon "anon lists bucket"                               "select count(*) from storage.objects"
t deny anon "anon uploads"                                    "$(ins $A/h_alive/v1-full.jpg)"
t ok   $A "A reads own files"                                 "$(cnt $A/%)"
$P -c "insert into storage.objects(bucket_id,name) values ('horse-screenshots','$A/h_gone/v1-full.jpg')"  # file kept from before soft delete
t ok   $A "A reads deleted horse's kept file (Restore)"       "$(cnt $A/h_gone/%)"
t ok   $A "A deletes own file"                                "with x as (delete from storage.objects where name='$A/h_alive/v1-thumb.jpg' returning 1) select count(*) from x"
# fill A to the 2,000-horse limit with 2 files each, then test overwrite at max
$P -c "insert into public.horses(stable_id,id) select 'aaaaaaaa-1111-0000-0000-000000000001','m'||g from generate_series(1,1998) g;
       insert into storage.objects(bucket_id,name) select 'horse-screenshots','$A/'||h.id||'/'||f from public.horses h, (values('v1-full.jpg'),('v1-thumb.jpg')) v(f)
       where h.stable_id='aaaaaaaa-1111-0000-0000-000000000001' and h.id<>'h_gone' on conflict do nothing;
       insert into storage.objects(bucket_id,name) values ('horse-screenshots','$A/h_gone/v1-thumb.jpg');"
echo "   A horse rows: $($P -c "select count(*) from public.horses where stable_id='aaaaaaaa-1111-0000-0000-000000000001'")  A objects: $($P -c "$(cnt $A/%)")"
t ok   $A "overwrite existing version at 2,000-horse limit"         "$(ups $A/m1998/v1-full.jpg)"
t deny $A "2,001st horse row refused by existing trigger"     "insert into public.horses(stable_id,id) values ('aaaaaaaa-1111-0000-0000-000000000001','m9999') returning 1"
t deny $A "so no upload for a 2,001st horse"                  "$(ins $A/m9999/v1-full.jpg)"
echo "TOTAL pass=$pass fail=$fail"
