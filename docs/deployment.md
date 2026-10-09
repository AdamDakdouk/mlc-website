# Deploying the MLC website (Render + MongoDB Atlas)

Plan: the app runs on **Render** (a web service with a persistent disk), data lives in **MongoDB Atlas**, DNS in **Cloudflare**, the domain at **Namecheap**. Every account is created and owned by the school, with you invited as a member (see `docs/domain-email-setup-runbook.md`).

Prices, plan names and menu labels change. Check each provider's current docs where this guide says "verify".

---

## Why a disk, and what it means

Admin uploads (teacher photos, announcement and achievement images, resumes, payment proofs) are written to the server's disk. A normal deploy wipes the disk, so Render needs a **persistent disk** mounted at `/var/data`, and the app is told about it with `UPLOAD_ROOT=/var/data`. Public images are then served by the app itself at `/uploads/<folder>/<file>` (a production Next.js server does not serve files added to `public/` after the build, so `src/app/uploads/[folder]/[filename]/route.ts` does it).

Consequences:
- Only **one instance** can mount the disk, and a deploy briefly stops the service while it swaps. That is fine for this site.
- The disk is a single copy. Keep backups (see below).

---

## 1. MongoDB Atlas

1. The school creates the Atlas account and an organization, then invites you.
2. Create a free cluster in a European region.
3. **Database Access:** create a user for the app only, with read and write on the `mlc` database (not an admin user), with a long random password.
4. **Network Access:** allow Render's outbound IP addresses (listed in Render's docs under outbound IPs; verify), or, if that is awkward, allow all addresses and rely on the long password.
5. Copy the connection string and add the database name, for example `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/mlc?retryWrites=true&w=majority`.

The free tier has no automatic backups. See "Backups".

---

## 2. Render

1. The school creates the Render account (with its card), then invites you to the team.
2. Connect the GitHub repository. Decide whose GitHub account owns it. Render must be able to read it, and the school should be able to keep it if you step away.
3. Create the service from `render.yaml` (New, then Blueprint), or by hand with the same settings:
   - Runtime Node, region Frankfurt, a paid plan (disks need one).
   - Build command `npm ci --include=dev && npm run build`, start command `npm start`.
   - Health check path `/api/health`.
   - A disk named `mlc-uploads`, mount path `/var/data`, size 5 GB to start.
4. Fill in the environment variables:

| Variable | Value |
|---|---|
| `MONGODB_URI` | Atlas connection string from step 1 |
| `JWT_SECRET` | 48+ random characters. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin login. Use a strong password and keep it in the school's password manager. |
| `UPLOAD_ROOT` | `/var/data` |
| `SITE_URL` | `https://modernisticlearning.com`. Needed at build time too. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | From the email sending service |
| `EMAIL_FROM` | `"Modernistic Learning Community" <info@modernisticlearning.com>` |
| `ADMIN_NOTIFY_EMAIL` | Inbox that receives new-request alerts |
| `TRUSTED_PROXY_HOPS` | Set after step 4 below |

5. Deploy. When it is live, open the Render Shell and create the admin user: `npm run seed:prod`.
6. Check `https://<service>.onrender.com/api/health` returns `{"status":"ok"}`, then log in at `/admin/login`.

---

## 3. Custom domain

1. In Render, add `modernisticlearning.com` and `www.modernisticlearning.com` as custom domains. Render shows the DNS records to create.
2. Add them in Cloudflare. While Render issues the HTTPS certificate, keep the records on "DNS only" (grey cloud).
3. Wait for Render to show the domains as verified, then check `https://modernisticlearning.com` loads with a padlock and `www` redirects.
4. Keep the mail records (MX, SPF, DKIM, DMARC) as "DNS only" too. See the runbook.

---

## 4. Find the right `TRUSTED_PROXY_HOPS`

Rate limiting (login and the public forms) needs the visitor's real IP. Behind Render, the header `X-Forwarded-For` has the visitor's IP added by the proxy, but a visitor can also send their own value, so the app must count entries **from the right**. The right number depends on how many proxies sit in front, so test it once on the live site.

1. With the variable **unset**, send six bad logins, each with a different fake first address. If none is blocked, spoofing works:

   ```
   for i in 1 2 3 4 5 6 7; do
     curl -s -o /dev/null -w "%{http_code} " -X POST https://<site>/api/auth/login \
       -H "content-type: application/json" -H "X-Forwarded-For: 1.1.1.$i" \
       -d '{"email":"nobody@example.com","password":"wrong"}'
   done
   ```

   Expect `401` seven times (no limit hit).
2. Set `TRUSTED_PROXY_HOPS=1` and redeploy. Run the same loop. Now the fake first address should be ignored and the sixth attempt should return `429`.
3. If you still get 401 every time, try `2`. If a **different person on a different network** is blocked by your attempts, the number is too high or too low (everyone shares one address), so adjust.
4. Wait 15 minutes for the login limit to reset before testing again.

---

## 5. Backups

**Database (Atlas free tier):** nothing is automatic. Once a week, from a computer with the MongoDB Database Tools installed:

```
mongodump --uri="<MONGODB_URI>" --out=backup-YYYY-MM-DD
```

Keep the last few copies in a place the school controls. To restore, use `mongorestore`. Upgrading the Atlas tier gives automatic backups, and is worth it if the site holds real records.

**Uploads (Render disk):** turn on Render's disk snapshots (verify what the plan includes), and about once a month copy the folder off the server (Render Shell, or `scp`) to a place the school controls. Resumes and payment proofs are the files that matter most.

**Test a restore once**, so you know it works before you need it.

---

## 6. Routine

- **Deploys:** pushing to the connected branch redeploys. The site is briefly down while the disk is swapped.
- **Rollbacks:** Render keeps previous deploys and can roll back.
- **Domain renewal:** the expiry date is in the handover sheet. Put a reminder in the school's calendar for one month before.
- **Secrets:** if a password or key is ever exposed, change it in the provider first, then in Render's environment settings.

---

## 7. Launch checklist

- [ ] `/api/health` returns ok
- [ ] Admin login works over HTTPS
- [ ] `TRUSTED_PROXY_HOPS` tested (section 4)
- [ ] Upload a teacher photo in the admin, see it on the public page, then redeploy and confirm it is still there (proves the disk works)
- [ ] Submit a meeting request, a job application and a session application. Each alert arrives in the admin inbox.
- [ ] Verify a session application. The confirmation email arrives, not in spam.
- [ ] Replace the placeholder text on the About page and the street address in `src/lib/siteContact.ts`
- [ ] `https://modernisticlearning.com/sitemap.xml` and `/robots.txt` show the real domain
- [ ] A first database backup taken and restored once
- [ ] Delete the test records
