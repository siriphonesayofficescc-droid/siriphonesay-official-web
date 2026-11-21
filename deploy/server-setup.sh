#!/usr/bin/env bash
# Run ONCE on the server (Ubuntu/Debian):  sudo bash server-setup.sh
set -euo pipefail
apt-get update -y
apt-get install -y nginx unzip
mkdir -p /var/www/siriphonesay
cp "$(dirname "$0")/nginx-siriphonesay.conf" /etc/nginx/sites-available/siriphonesay
ln -sf /etc/nginx/sites-available/siriphonesay /etc/nginx/sites-enabled/siriphonesay
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
# open the web ports if the firewall is on
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 'Nginx Full'; ufw allow OpenSSH; fi
echo "Server ready. Now upload the website with deploy.sh (from your computer)."
