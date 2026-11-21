# Deploying to your own server (13.140.77.148)

The website is a static site: build it once and Nginx serves the files. No Node.js is needed on the server.

## Before you start
- The server runs **Ubuntu or Debian** (for example AWS EC2 or Lightsail).
- You can log in with SSH, for example `ssh -i my-key.pem ubuntu@13.140.77.148`.
- The server firewall / AWS **Security Group** allows inbound **22 (SSH)**, **80 (HTTP)** and **443 (HTTPS)**.
- Optional: copy `.env.example` to `.env` and fill in the Supabase / Formspree keys **before building**. Without them, forms fall back to email/WhatsApp.

## Deploy (from your computer, in the project folder)
```bash
bash deploy/deploy.sh ubuntu@13.140.77.148 ~/.ssh/my-key.pem
```
The first run installs Nginx automatically. Every later run updates the site. The previous version is kept in `/var/www/siriphonesay.old`.

Open http://13.140.77.148/

## Already-built package (no build needed)
`siriphonesay-dist.tgz` is the built website. Upload and unpack it to `/var/www/siriphonesay`, then run `server-setup.sh` once.

## Add a domain + HTTPS (recommended)
1. Point your domain's **A record** to 13.140.77.148.
2. In `/etc/nginx/sites-available/siriphonesay`, set `server_name yourdomain.com www.yourdomain.com;` and run `sudo systemctl reload nginx`.
3. Install a free certificate:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

## Roll back
```bash
sudo rm -rf /var/www/siriphonesay && sudo mv /var/www/siriphonesay.old /var/www/siriphonesay
```
