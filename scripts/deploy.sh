#!/usr/bin/env bash
# Выкатка Word Drill на VM apps-tokyo: сборка → пакет .deploy/ → rsync → npm install (только better-sqlite3) → перезапуск → проверка.
#   VM_HOST=13.114.11.53 VM_KEY=~/.ssh/apps_tokyo_deploy bash scripts/deploy.sh   — с Mac
#   В CI (.github/workflows/deploy.yml) — то же, ключ из секрета, сборка уже сделана (SKIP_BUILD=1).
# Сервис и сайт на VM заводит один раз scripts/server/add-project.sh из binance-dashboard (README → «Выкатка»).
set -euo pipefail

PROJECT=words
PORT=5010
: "${VM_HOST:?нужен VM_HOST}"
VM_USER=${VM_USER:-deploy}
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)
[ -n "${VM_KEY:-}" ] && SSH_OPTS+=(-i "$VM_KEY" -o IdentitiesOnly=yes)
REMOTE="$VM_USER@$VM_HOST"
APP="/srv/$PROJECT/app"

[ "${SKIP_BUILD:-}" = 1 ] || pnpm build

stage=.deploy
rm -rf "$stage"
mkdir -p "$stage/data"
cp -R dist "$stage/dist"
cp -R drizzle "$stage/drizzle"
cp data/dictionary.json "$stage/data/dictionary.json"
cp data/wiktionary.tsv.gz "$stage/data/wiktionary.tsv.gz"
sqlite_version=$(node -p 'require("./node_modules/better-sqlite3/package.json").version')
cat >"$stage/package.json" <<JSON
{
  "name": "word-drill-server",
  "private": true,
  "type": "module",
  "dependencies": { "better-sqlite3": "$sqlite_version" }
}
JSON
du -sh "$stage"

# Код открытый (секреты — в /etc/words/app.env): права 755/644 ставим заранее — rsync в macOS не знает --chmod.
chmod -R u=rwX,go=rX "$stage"
# --delete: на VM ровно этот пакет; node_modules ставится на самой VM (нативный модуль под её Linux) и не трогается.
rsync -rlptz --delete --exclude node_modules \
  -e "ssh ${SSH_OPTS[*]}" "$stage/" "$REMOTE:$APP/"

ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s <<EOF
set -e
cd $APP
npm install --omit=dev --no-audit --no-fund --loglevel=error
sudo /usr/bin/systemctl enable $PROJECT
sudo /usr/bin/systemctl restart $PROJECT
for i in \$(seq 1 30); do
  code=\$(curl -s -o /tmp/$PROJECT-health.json -w '%{http_code}' --max-time 5 http://127.0.0.1:$PORT/api/health || true)
  if [ "\$code" = 200 ]; then echo "OK: $PROJECT → 127.0.0.1:$PORT/api/health 200 \$(cat /tmp/$PROJECT-health.json)"; exit 0; fi
  sleep 2
done
sudo /usr/bin/journalctl -u $PROJECT -n 80 --no-pager
echo "$PROJECT не ответил 200 за минуту (последний код: \$code)"
exit 1
EOF
