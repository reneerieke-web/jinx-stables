#!/bin/bash
# Real Supabase Storage API integration test for the feedback screenshot SQL.
# LOCAL ONLY: throwaway Postgres + the official supabase/storage-api image with
# file-backed storage and a fake JWT secret. Never touches Supabase.
#
# Needs: Docker, psql, a local Postgres superuser reachable at 127.0.0.1:5499
# (e.g. pg_ctl ... -o '-p 5499 -c listen_addresses=127.0.0.1'), Node 18+.
#   bash tests/storage/run_storage_api_it.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PG="-h 127.0.0.1 -p 5499 -U postgres"; DB=${DB:-storage_it}
IMAGE=supabase/storage-api@sha256:b393ac5759a45a934557a150ecdb97157bbdd419e0193e4c5dc5770b9ddd7ee1  # v1.11.2
FREEZE=drop-bucketid-objname-index   # newest Storage migration on the live project (Sept 27)
SECRET=$(node -pe 'require("./tests/storage/storage_api_jwt.js").SECRET')
ANON=$(node -pe 'require("./tests/storage/storage_api_jwt.js").sign({role:"anon"})')
SVC=$(node -pe 'require("./tests/storage/storage_api_jwt.js").sign({role:"service_role"})')

docker rm -f jinx-storage-it >/dev/null 2>&1 || true
dropdb $PG --if-exists $DB; createdb $PG $DB
psql $PG -d $DB -q -v ON_ERROR_STOP=1 -f tests/storage/storage_api_auth_stub.sql
FILES=$(mktemp -d)
docker run -d --name jinx-storage-it --network host -v "$FILES":/var/lib/storage \
  -e SERVER_PORT=5555 -e DATABASE_URL=postgres://postgres@127.0.0.1:5499/$DB -e DB_INSTALL_ROLES=false \
  -e DB_MIGRATIONS_FREEZE_AT=$FREEZE -e AUTH_JWT_SECRET=$SECRET -e PGRST_JWT_SECRET=$SECRET \
  -e ANON_KEY=$ANON -e SERVICE_KEY=$SVC -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
  -e GLOBAL_S3_BUCKET=stub -e STORAGE_S3_BUCKET=stub -e TENANT_ID=stub -e REGION=local \
  -e FILE_SIZE_LIMIT=52428800 -e UPLOAD_FILE_SIZE_LIMIT=52428800 -e IMAGE_TRANSFORMATION_ENABLED=false \
  -e PG_QUEUE_ENABLE=false -e MULTI_TENANT=false -e LOG_LEVEL=warn "$IMAGE" >/dev/null
for i in $(seq 1 60); do
  last=$(psql $PG -d $DB -tA -c "select name from storage.migrations order by id desc limit 1" 2>/dev/null || true)
  [ "$last" = "$FREEZE" ] && curl -sf http://127.0.0.1:5555/status >/dev/null && break; sleep 1
done
echo "storage-api ready; migrations at: $last"
# Same storage grants as the live project (checked read-only Sept 27); RLS decides access.
psql $PG -d $DB -q -v ON_ERROR_STOP=1 -c "grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
  grant execute on all functions in schema storage to anon, authenticated, service_role;"
psql $PG -d $DB -q -v ON_ERROR_STOP=1 -f supabase/review/20260927_feedback.sql
psql $PG -d $DB -q -v ON_ERROR_STOP=1 -f supabase/review/20260927_feedback_screenshots.sql
DB=$DB node tests/storage/storage_api_it.js
bash tests/storage/run_feedback_parallel_test.sh $DB 127.0.0.1 5499
docker rm -f jinx-storage-it >/dev/null
