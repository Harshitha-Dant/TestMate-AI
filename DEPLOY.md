# Deploying TestMate AI online for free

This guide puts TestMate AI on a public HTTPS address such as `https://testmate-ai.onrender.com`, with a
database that survives restarts, at **₹0 per month and without a payment card**.

| Part | Service | What it does | Cost |
|---|---|---|---|
| App (UI + API + SQLite) | **Render** free web service | Runs the Docker image built from this repository | Free |
| Database backup | **Litestream** (inside the container) | Copies every database change to B2 within about 1 second and restores it at startup | Free, open source |
| Backup storage | **Backblaze B2** | Private bucket holding the database backup | Free up to 10 GB |

The app runs in **public mode** online (`TESTMATE_PUBLIC_MODE=1`): deleting and app-wide settings need an
admin key, visitors are rate limited, and request-safety settings are locked. Local use is unchanged.

---

## Rules that keep it at ₹0

1. **Never add a payment card** to Render or Backblaze. Without one, Render suspends the service instead of
   billing when a free limit is reached ("If you haven't added a payment method and you would incur charges,
   Render instead disables your services").
2. **Never put secrets in the repository.** Secrets are entered only in Render's dashboard. `render.yaml`
   lists their names with `sync: false`, so no values are stored in GitHub.
3. Keep the **lifecycle rule** and **caps and alerts** described below on the B2 bucket.

## Free limits and possible charges

| Limit | Free allowance | Expected use | If exceeded (no card on file) |
|---|---|---|---|
| Render instance hours | 750 per month | At most 744 (only while awake) | Service suspended until next month |
| Render outbound bandwidth | 5 GB per month | ~0.5–1 MB per first visit | Service suspended or spun down |
| Render build minutes | 500 per month | A few minutes per deploy | New builds paused; the site keeps running |
| B2 storage | 10 GB | Database (~0.3 MB) + 7 days of hourly snapshots: tens of MB | $0.005/GB-month, not reachable at this size |
| B2 uploads, reads, listing (Class A, B, C) | Free | Litestream's normal traffic | – |
| B2 downloads | 3× average storage per month | One restore (~0.3–0.5 MB) per wake-up, deploy or restart | $0.01/GB (behaviour without a card is not documented) |

Other behaviour to expect:
- Render puts the free service to sleep after **15 minutes** without visitors; the next visit takes about
  **1 minute** while it wakes and restores the database.
- Render "might restart a Free web service at any time". The database is restored from B2 each time.
- If the container is killed abruptly, up to about **1 second** of the latest changes could be lost.
- Free plans can change their terms. Check Render's and Backblaze's pages once in a while.

---

## Step 1: Backblaze B2 (backup storage)

1. Sign up at backblaze.com for **B2 Cloud Storage**. The sign-up page says "No credit card required".
   Skip any prompt to add a card.
2. **Create a bucket** (B2 Cloud Storage → Buckets → Create a Bucket):
   - Name: something unique, e.g. `testmate-ai-db-<random letters>`
   - Files in bucket: **Private**
   - Default encryption: **Enable**
   - Object Lock: **Disable**
3. **Lifecycle rule** (the bucket's *Lifecycle Settings*): choose **"Keep only the last version of the
   file"**. Litestream deletes snapshots older than 7 days; B2 then hides them and this rule deletes the
   hidden versions after a day, so old backups can't pile up. Without it, hidden versions are kept forever
   and count as storage.
4. **Application key** (Application Keys → Add a New Application Key):
   - Allow access to: **only this bucket**
   - Type of access: **Read and Write**
   - Leave "Allow List All Bucket Names" unticked
   - Copy the **keyID** and **applicationKey** straight into a password manager. The applicationKey is shown only once.
5. **Endpoint and region**: the bucket details show an endpoint like `s3.us-west-004.backblazeb2.com`.
   - `B2_ENDPOINT` = `https://s3.us-west-004.backblazeb2.com` (with `https://`)
   - `B2_REGION` = `us-west-004` (the part between `s3.` and `.backblazeb2.com`)
6. **Caps and alerts** (Account → Caps & Alerts):
   - Set a daily cap for **storage** and for **Class A, B and C transactions** at the lowest value the page
     accepts, and for **download bandwidth** if the page offers it.
   - Turn on the email alerts (sent at 75% and 100% of each cap).
   - Backblaze's documentation does not say exactly what happens when a cap is reached, and Class D calls
     cannot be capped (Litestream does not use them). Treat the alerts as your early warning: if one fires,
     suspend the Render service (Render → service → Settings → Suspend) and check what happened.

## Step 2: Admin key

Generate it on your own computer so nobody else ever sees it. In PowerShell, from the project folder:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Save the output in a password manager. It must be at least 24 characters (this gives 43). You will paste it
into Render once and type it into **Settings → Admin access** when you need to delete something.

## Step 3: Render (the app)

1. Sign up at render.com with your GitHub account. Skip any prompt to add a card. Allow Render to read the
   `TestMate-AI` repository.
2. **New → Blueprint**, select the repository. Render reads `render.yaml` and shows one free web service,
   `testmate-ai`, in the Singapore region.
   If you create the service with **New → Web Service** instead of a Blueprint, Render ignores
   `render.yaml`: add every variable below yourself (service → Environment). The image already sets
   `TESTMATE_PUBLIC_MODE=1`, `TESTMATE_API_PORT=10000` and `TESTMATE_DB_PATH`; don't override them
   (the start script refuses to run if public mode is turned off).
3. Fill in the six secret values when asked. Names are case-sensitive; paste values without spaces
   before or after. If the start fails with `[start] Missing environment variable NAME`, add that
   variable. The script stops at the first missing one, so check that all six exist:

   | Variable | Value |
   |---|---|
   | `TESTMATE_ADMIN_KEY` | The key from step 2 |
   | `LITESTREAM_ACCESS_KEY_ID` | B2 keyID |
   | `LITESTREAM_SECRET_ACCESS_KEY` | B2 applicationKey |
   | `B2_BUCKET` | The bucket name |
   | `B2_ENDPOINT` | e.g. `https://s3.us-west-004.backblazeb2.com` |
   | `B2_REGION` | e.g. `us-west-004` |

4. Apply. The first build takes several minutes. The log shows:
   - `[start] Restoring the database from Backblaze B2 (if a backup exists)`
   - `[start] No backup yet: creating a new database with the demo project` (first deploy only)
   - `[start] Starting TestMate AI with continuous backup`
5. `autoDeploy` is off: pushing to GitHub does not redeploy. Use **Manual Deploy** when you choose.

If a variable is missing, the log says which one and the service does not start. The start script also
stops if the restore command reports an error, so the app should not run on an empty database while a
backup exists. That Litestream reports a wrong or rejected B2 key as an error (rather than "no backup") is
expected but not yet confirmed: check it once during verification by entering a deliberately wrong
`LITESTREAM_SECRET_ACCESS_KEY`, deploying, and confirming the start fails, then restoring the right value.

## Step 4: Verify

- [ ] `https://<your-service>.onrender.com` opens over HTTPS and shows the "Public demo" notice.
- [ ] All pages load: Dashboard, Projects, Chatbot Lab, Memory Lab, Multilingual, API Studio, Regression,
      Bugs, Reports, Test History, Settings.
- [ ] Running a chatbot test works and is labelled **Simulated**.
- [ ] Deleting something without the admin key is refused; after **Settings → Admin access → Unlock** it works.
- [ ] A request to `http://169.254.169.254/` in API Studio is **blocked**.
- [ ] Rate limits: more than 20 runs in a minute from one browser returns "allows 20 runs per minute".
      If two different networks (for example phone data and Wi-Fi) share one limit, the proxy setting is
      wrong: tell the maintainer before raising `TESTMATE_TRUST_PROXY_HOPS`.
- [ ] Reports: Runs CSV, Regression CSV and PDF download.
- [ ] **Restore after restart**: create a project named `Restore check <date>`, wait 10 seconds, then
      Render → service → **Restart service**. After it is back, the project must still be there.
      Repeat after a **Manual Deploy**, and after the service has slept (no visits for 20 minutes).
- [ ] The B2 bucket shows files under `testmate/` and their total size (this is what each restore downloads).
- [ ] No secret in the site: the browser's page source and network responses contain none of the six values.

## Maintenance

- **Rotate the admin key**: generate a new one (step 2), update `TESTMATE_ADMIN_KEY` in Render → Environment, save (Render restarts the service).
- **Rotate the B2 key**: create a new bucket-only key, update the two `LITESTREAM_*` variables, then delete the old key in Backblaze.
- **Pause everything**: Render → service → Settings → **Suspend**. The backup stays in B2.
- **Start over with an empty database**: suspend the service, delete the files under `testmate/` in the bucket, resume. The demo project is created again.
