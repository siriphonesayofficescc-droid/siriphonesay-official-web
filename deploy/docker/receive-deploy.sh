#!/usr/bin/env bash
# Runs ON THE SERVER. Reads a .tar.gz of the built site (the contents of dist/) on stdin
# and publishes it. The GitHub Actions SSH key is locked to this script in
# ~/.ssh/authorized_keys (command="...",restrict), so that key can do nothing else.
#
#   tar -czf - -C dist . | ssh deploy@13.140.77.148 siriphonesay/bin/receive-deploy.sh
set -euo pipefail
WWW="$HOME/siriphonesay/www"          # mounted read-only into the container at /srv
exec 9>"$WWW/../.deploy.lock"
flock -w 120 9 || { echo "Another deploy is still running." >&2; exit 1; }

rm -rf "$WWW/site.new"
mkdir -p "$WWW/site.new"
tar -xzf - -C "$WWW/site.new"
[ -s "$WWW/site.new/index.html" ] || { echo "Upload has no index.html: not published." >&2; rm -rf "$WWW/site.new"; exit 1; }

# Swap. Nginx serves /srv/site, so the new version is live as soon as it is renamed.
rm -rf "$WWW/site.old"
[ -d "$WWW/site" ] && mv "$WWW/site" "$WWW/site.old"   # previous version kept for rollback
mv "$WWW/site.new" "$WWW/site"
echo "Published $(grep -o 'assets/index-[^"]*\.js' "$WWW/site/index.html" | head -1) at $(date -u +%FT%TZ)"
