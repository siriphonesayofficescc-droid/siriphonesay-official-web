#!/usr/bin/env bash
# Build the website and upload it to the server. Run from the project folder on YOUR computer:
#   bash deploy/deploy.sh ubuntu@13.140.77.148 ~/.ssh/your-key.pem
set -euo pipefail
TARGET="${1:-ubuntu@13.140.77.148}"
KEY="${2:-}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY")

echo "1/4 Building…"
npm ci
npm run build

echo "2/4 Packing…"
tar -czf /tmp/siriphonesay-dist.tgz -C dist .

echo "3/4 Uploading to $TARGET…"
scp "${SSH_OPTS[@]}" /tmp/siriphonesay-dist.tgz deploy/nginx-siriphonesay.conf deploy/server-setup.sh "$TARGET:/tmp/"

echo "4/4 Installing on the server…"
ssh "${SSH_OPTS[@]}" "$TARGET" 'set -e
  command -v nginx >/dev/null || sudo bash /tmp/server-setup.sh
  sudo mkdir -p /var/www/siriphonesay.new
  sudo tar -xzf /tmp/siriphonesay-dist.tgz -C /var/www/siriphonesay.new
  # keep the previous version for a quick rollback
  sudo rm -rf /var/www/siriphonesay.old
  [ -d /var/www/siriphonesay ] && sudo mv /var/www/siriphonesay /var/www/siriphonesay.old
  sudo mv /var/www/siriphonesay.new /var/www/siriphonesay
  sudo chown -R www-data:www-data /var/www/siriphonesay
  sudo nginx -t && sudo systemctl reload nginx'
echo "Done → http://${TARGET#*@}/"
