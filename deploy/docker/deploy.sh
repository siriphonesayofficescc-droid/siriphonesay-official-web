#!/usr/bin/env bash
# MANUAL deploy from your computer. Normally you don't need this: pushing to main on GitHub
# deploys automatically (.github/workflows/deploy.yml). Use this to deploy without GitHub,
# or after changing nginx.conf / docker-compose.yml / receive-deploy.sh.
#   bash deploy/docker/deploy.sh [deploy@13.140.77.148]
set -euo pipefail
TARGET="${1:-deploy@13.140.77.148}"

echo "1/3 Building…"
npm run build

echo "2/3 Updating server config…"
ssh "$TARGET" 'mkdir -p ~/siriphonesay/bin ~/siriphonesay/www'
scp -q deploy/docker/docker-compose.yml deploy/docker/nginx.conf "$TARGET:siriphonesay/"
scp -q deploy/docker/receive-deploy.sh "$TARGET:siriphonesay/bin/"
ssh "$TARGET" 'cd ~/siriphonesay && docker compose -p siriphonesay up -d --quiet-pull && docker exec siriphonesay-web nginx -t -q && docker exec siriphonesay-web nginx -s reload'

echo "3/3 Uploading the site…"
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C dist . | ssh "$TARGET" siriphonesay/bin/receive-deploy.sh
echo "Done → https://siriphonesay.com/"
