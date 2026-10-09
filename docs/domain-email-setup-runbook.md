# MLC domain, email and go-live runbook

For an in-person session with the school, working from their laptop and yours. Goal: the school owns and controls its `.edu.lb` domain, staff have real mailboxes, and the website can send mail from that domain and be reached at it.

Allow 2–3 hours for the session, plus a short follow-up the next day (DNS changes can take hours to spread).

Facts about prices, limits and menu names change. Check each provider's current page rather than trusting this document on those points.

---

## Principles

1. **The school owns everything.** Every account (registrar, DNS, mailbox host, sending service) is created with a school-owned email address and billed to the school. You are added as a delegate or admin, never the owner.
2. **No passwords in chat, email or screenshots.** Use a password manager (Bitwarden is free) set up on the school's side, and share what you need through it.
3. **Turn on two-factor authentication** on every account, with the school's phone, and print the recovery codes for the school's records.
4. **Never break what already works.** Before changing any DNS setting, copy down every existing record. If the domain already serves a website or email, keep it working until the replacement is tested.

---

## Phase -1: buy the domain (decided 2026-10-09: modernisticlearning.com)

The school dropped the `.edu.lb` idea (it needed Ministry paperwork) and will use a `.com`. Checked on 2026-10-09: the `.com` registry returned "not found" for `modernisticlearning.com` and DNS showed nothing, so it looked unregistered. A `.com` needs no documents.

The school buys it at Namecheap, from **their own account**:

1. The school creates the Namecheap account with a **school-owned email address**, and turns on 2FA with a phone the school keeps.
2. Search `modernisticlearning.com` and buy it, 1 or 2 years, paid by the school.
3. At checkout: **decline the upsells** (hosting, email, SSL, premium DNS). Keep the free WHOIS privacy on, turn **auto-renew** on, and keep the **domain lock** on.
4. The registrant details must be the school's real name, address and phone.
5. **Click the verification link** Namecheap emails to the registrant within 15 days, or the domain gets suspended (an ICANN rule).
6. The first-year price is usually low and the renewal price higher. Check the renewal price and put the expiry date in the handover sheet.

Do **not** take over the school's Namecheap login. The 2FA codes would go to the school's phone, and handing over a password undoes the point of the school owning the account. Instead:

1. The school (or you together, in person or on a video call) logs into Namecheap once and changes the domain's nameservers to Cloudflare's (Phase 2).
2. The school creates the Cloudflare account (free), and **invites you as a member** with your own email and login. You then make every DNS change from your own login, and the school never has to share a password.

The old plan, `mlc.edu.lb` through IDM, was dropped. Nothing was signed or paid. If the school ever wants an `.edu.lb`, the rules are at lbdr.org.lb (LBDR-A form, a Ministry of Education attestation, an accredited registrar).

---

## Phase 0: before the meeting (you, alone, ~30 min)

Get the domain name from the school, then:

- [ ] **Look up the domain's registration.** Search it on the Lebanese Domain Registry's whois (as far as I know, the `.lb` registry is LBDR, so verify the current site). Note the registrant, the registrar or reseller, and the expiry date.
- [ ] **Look up the current DNS** (replace `DOMAIN`):

  ```
  nslookup -type=NS DOMAIN
  nslookup -type=MX DOMAIN
  nslookup -type=TXT DOMAIN
  nslookup DOMAIN
  nslookup www.DOMAIN
  ```

  Or paste the domain into mxtoolbox.com and dnschecker.org. This tells you:
  - **NS**: who currently hosts the DNS (the registrar, a hosting company, an ISP, or a web agency).
  - **MX**: whether the domain already handles email. If it does, find out who uses it before touching anything.
  - **TXT**: any existing SPF record (there may be only one).
  - **A / www**: whether a website already runs on it.
- [ ] **Ask the school, by phone or message:**
  - Who registered the domain, or who set up their website or email in the past? (A web agency or ISP often holds the login.)
  - Do they have the registrar account email and can they receive mail there?
  - Does anyone use an email address at this domain today?
  - Which addresses do they want (`info@`, `admissions@`, `careers@`) and for how many people?
  - What monthly budget do they have for email?
  - Who should receive the website's alert emails?
- [ ] **Decide the services** (suggestions, change if the school prefers something else):

  | Need | Suggested | Notes |
  |---|---|---|
  | DNS host | Cloudflare (free), only if the registrar allows changing nameservers | If not, edit DNS at the registrar |
  | Mailboxes | Google Workspace or Zoho Mail | Workspace is paid per user; Zoho has a limited free tier. Check what the free tier includes. |
  | Website sending | Resend, Brevo, Postmark or Amazon SES | Any of them gives SMTP details that fit the site's existing setup |
  | Website hosting | Not decided yet | Needed before the domain can point at the site (Phase 5) |

- [ ] **Bring:** your laptop, a charger, a phone for 2FA codes, a notebook, and any official school paper (letterhead, registration) in case the registry asks for proof of ownership.

---

## Phase 1: ownership and access (~30–45 min)

Goal: find out who controls the domain, and get the school in charge of it.

1. Sit at the school's laptop, signed into the school's email address (the one on the registrant record, if it exists).
2. Locate the domain's control panel from the Phase 0 findings (registrar login, hosting panel, or the agency's panel).
   - If the school has a login: sign in. If they forgot the password, reset it using the school's email, with them typing it.
   - If an agency or ISP holds it: call them with the school present and ask for either (a) the account transferred to the school's email, or (b) DNS access for the school and for you. Their staff must confirm this; you can't do it for them.
3. Install a password manager on the school's laptop and save the registrar login in it. Turn on 2FA for the registrar account, using the school's phone.
4. Record in the handover sheet (end of this file): the registrar name, the account email, the expiry date, and the renewal method (is a card on file, or do they pay by invoice?). **A domain that lapses takes the website and all email down**, so settle who renews it and when.
5. If the control panel supports adding another user, add yours with DNS-only rights. If not, plan to make DNS changes together on the school's laptop.

**Check:** the school can log in without you, and the account email is a school address.

---

## Phase 2: take control of DNS (~30 min)

Two ways, depending on what the registrar allows.

**A. Registrar's DNS panel works fine.** Do all DNS edits there. Skip to Phase 3.

**B. Move DNS to Cloudflare.** Use this only if the registrar allows changing nameservers.

1. Create a Cloudflare account using the school's email, with 2FA on.
2. Add the domain (Free plan). Cloudflare scans and imports the existing records.
3. **Compare the imported records against the list you wrote down in Phase 0.** Add anything missing. Do not continue until the two match.
4. At the registrar, replace the nameservers with the two Cloudflare gives you. For `.lb` domains, confirm the registry accepts third-party nameservers before you start.
5. Wait for Cloudflare to show the domain as Active (minutes to hours).
6. In Cloudflare, set records for mail (MX, DKIM, SPF) to **DNS only** (grey cloud), never proxied.

If the domain currently serves a website or email, do this step outside working hours and keep the old records identical.

**Check:** `nslookup -type=NS DOMAIN` shows the new nameservers, and the old website and email (if any) still work.

---

## Phase 3: mailboxes, so staff can send and receive (~45 min)

Example for Google Workspace; Zoho is similar.

1. Sign up using the school's email as the admin account, with the school's billing details.
2. Verify the domain: the provider gives you a TXT record to add in DNS. Add it and click verify.
3. **Replace the MX records** with the provider's. If the domain had working email before, first create the matching mailboxes and move any old mail, or the old mail stops arriving.
4. **SPF: there can be only one SPF record per domain.** Edit the existing one to combine providers, for example:

   ```
   v=spf1 include:_spf.google.com include:SENDING-PROVIDER-INCLUDE ~all
   ```

   (the second include comes from Phase 4). Two separate SPF records break email.
5. Turn on DKIM in the provider's admin panel and add the record it gives you.
6. Add a DMARC record to start in monitoring mode:

   ```
   Name: _dmarc    Type: TXT
   Value: v=DMARC1; p=none; rua=mailto:info@DOMAIN
   ```

   Tighten it to `p=quarantine` later, once everything is passing.
7. Create the mailboxes the school asked for. Hand each person their login in person, and have them set their own password and 2FA.

**Check:**
- Send from a new mailbox to a personal Gmail account and to an Outlook or Hotmail account. Both arrive in the inbox, not spam.
- Reply from Gmail and from Outlook to the new mailbox. Both arrive.
- In Gmail, open the received message, choose "Show original", and confirm SPF, DKIM and DMARC all say PASS.

---

## Phase 4: the website's sending service (~30 min)

The site already sends mail through SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). This phase replaces the Mailtrap sandbox with a real sender.

1. Create an account at the chosen sending service, with the school's email.
2. Add the domain, then add every DNS record it lists (usually a DKIM TXT or CNAMEs, an SPF include, and a return-path CNAME). Keep these as **DNS only** if you use Cloudflare.
3. Click verify. It can take minutes to hours.
4. Create SMTP credentials (or an API key used as the SMTP password). Store them in the password manager. **Do not paste them into chat.**
5. Decide the sender address, such as `info@DOMAIN`. Use a real mailbox, not a dead `no-reply@`, so replies reach a person.

I then set these on the server (not in git):

```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   (from the sending service)
ADMIN_NOTIFY_EMAIL                            (the inbox that gets alerts)
```

and update `src/lib/mailer.ts`' sender address and `src/lib/siteContact.ts`' `SITE_EMAIL`.

**Check:** the sending service's dashboard shows the domain as verified, and a test email from the service arrives in Gmail with SPF, DKIM and DMARC all PASS.

---

## Phase 5: point the domain at the website (depends on hosting)

Not possible until a host is chosen. When it is:

1. Add the host's records for the bare domain and for `www` (usually an A record or CNAME) in DNS.
2. The host issues the HTTPS certificate once DNS points at it. Wait for it.
3. Redirect one form to the other (for example `www` to the bare domain).
4. If an old website runs on the domain today, keep it live until the new site is tested on a temporary address, then switch the records.
5. I update the base URL in `src/app/sitemap.ts` and `src/app/robots.ts`.

**Check:** `https://DOMAIN` loads the site with a valid padlock, and `http://` and `www` both redirect correctly.

---

## Phase 6: final end-to-end check (~30 min, ideally the next day)

Use the live site, with a Gmail and an Outlook address you control.

- [ ] Send a test message to mail-tester.com from a school mailbox and from the website. Aim for 9 or 10 out of 10.
- [ ] Check the domain on mxtoolbox.com: MX, SPF, DKIM, DMARC and blacklist all clean.
- [ ] Submit a **meeting request** on the public form. The alert arrives at `ADMIN_NOTIFY_EMAIL`, in the inbox, with a working link and a working Reply.
- [ ] Submit a **session application** and **verify** it from the admin dashboard. The confirmation arrives at the applicant's Gmail, inbox not spam, with the right location and map link.
- [ ] Reply to that confirmation. It reaches a real mailbox.
- [ ] Open the site on a phone over mobile data.
- [ ] Delete the test records from the admin dashboard.

---

## Handover sheet (fill in and leave with the school)

| Item | Value |
|---|---|
| Domain | |
| Registrar / where it's managed | |
| Account email (school-owned) | |
| Expiry / renewal date | |
| Who pays and how | |
| DNS host | |
| Mailbox provider and admin | |
| Sending service | |
| Website host | |
| 2FA phone, and where recovery codes are kept | |
| Who to call for help (you) | |

---

## Pitfalls

- Changing nameservers before copying the old records. Copy them first.
- Two SPF records. Merge them into one.
- Replacing MX records before the new mailboxes exist, so old mail bounces.
- Proxying mail records through Cloudflare (orange cloud). Keep them grey.
- Accounts created under your own email, or under a personal address of whoever happens to be in the room.
- Leaving without the renewal date and the 2FA recovery codes written down.
