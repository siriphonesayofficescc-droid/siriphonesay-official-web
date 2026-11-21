# Deploying to your own server (13.140.77.148)

## Automatic deploys (CI/CD) — the normal way

**Push to `main` on GitHub → the site updates itself in a few minutes.**
GitHub Actions (`.github/workflows/deploy.yml`) runs typecheck, tests and the build, uploads the site,
then checks that https://siriphonesay.com serves the new version. Pull requests only run the checks.
Watch it on GitHub → **Actions**. To redeploy without a code change: Actions → *CI / Deploy* → **Run workflow**.

How it fits together on the server (Contabo, 13.140.77.148, user `deploy`):
- Caddy (from the hashang project, `/opt/hashang/deploy/caddy`) owns ports 80/443, gets HTTPS certificates
  and forwards `siriphonesay.com` to the `siriphonesay-web` container (Nginx, no public ports, `web` network).
- Site files: `~/siriphonesay/www/site` (live) and `www/site.old` (previous version).
- GitHub's SSH key can only run `~/siriphonesay/bin/receive-deploy.sh`
  (`command="…",restrict` in `~/.ssh/authorized_keys`), which unpacks the upload and swaps it in.

### One-time setup (already done on the server)
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   name `DEPLOY_SSH_KEY`, value = the whole private key (`pbcopy < ~/.ssh/siriphonesay_actions` copies it).
2. Optional, same page, **Variables** tab: `VITE_FORM_ENDPOINT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   Without them, forms fall back to email and the site works without Supabase.

### Roll back to the previous version
```bash
ssh deploy@13.140.77.148 'cd ~/siriphonesay/www && mv site site.bad && mv site.old site'
```

### Manual deploy (without GitHub)
`bash deploy/docker/deploy.sh` — also use it after changing `deploy/docker/nginx.conf`,
`docker-compose.yml` or `receive-deploy.sh`, because the automatic deploy only uploads the site files.

---

## Fresh, empty server only
The steps below (`deploy.sh` + `server-setup.sh`) install Nginx on port 80. **Do not use them on the Contabo server** — Caddy already uses port 80 there.

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
