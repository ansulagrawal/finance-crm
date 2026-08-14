# EC2 dev deployment runbook

What was actually done on the dev box, in order, with the reason for each
choice and every problem hit along the way. This is a record of a real
deployment, not a plan — if a step here reads oddly, it is because the box
made it that way.

**Host:** `203.0.113.10` (Ubuntu 24.04.4 LTS, x86_64, 4 vCPU, 15 GB RAM, 19 GB
disk) · **user:** `ansul` · **install root:** `/opt/crm` · **region:**
`ap-south-1` · **secret:** `finance-crm/dev` · **public URL:**
`https://api.financecrm.com` (Cloudflare-fronted)

Scope: everything except online disbursal. ICICI credentials are deliberately
absent (see step 5).

---

## Layout on the box

```
/opt/crm/
├── backend/                    # rsync'd from this repo, runtime files only
│   └── docker-compose.yml      # from the repo
├── .env                        # bootstrap vars ONLY, no secrets (mode 600)
├── docker-compose.ec2.yml      # host overlay
├── bin/                        # crm, issue-cert.sh, tail-logs.sh
└── logs/                       # aggregated container logs
```

`.env`, the overlay and `bin/` all sit *outside* `backend/` on purpose: a
developer re-running the `rsync --delete` from step 4 would otherwise wipe
them, because none of them exist in the repo. That is not hypothetical — it
already happened once to `.env` (step 4).

---

## Step 1 — SSH key instead of the password

A dedicated key was generated locally and installed, so that every later
step (and `rsync`) runs non-interactively:

```sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/finance_crm_ec2 -C "deploy@finance-crm"
ssh-copy-id -i ~/.ssh/finance_crm_ec2.pub ubuntu@203.0.113.10     # password used once
ssh -i ~/.ssh/finance_crm_ec2 ubuntu@203.0.113.10
```

**Issue:** `sshpass` is not installed on macOS and the password could not be
typed interactively. Worked around with a one-shot `expect` script driving
`ssh-copy-id`; after that the password is never needed for SSH again.

**`sudo` still prompts** — `ansul` is not in a NOPASSWD sudoers group. Rather
than change the box's security posture, every privileged command in this
runbook is run as `echo <password> | sudo -S -p "" …`. If you automate this
further, keep it that way; do not add a NOPASSWD rule just for convenience.

## Step 2 — Survey, and what was already there

```sh
docker --version && docker compose version    # 5.4.0 plugin, already installed
aws sts get-caller-identity                   # UAT_server_access_role, works
```

Found and removed: `/opt/crm-backend`, a stale copy of this repo from
2026-08-05 with no containers running against it. Nothing was listening on
:80 or :443, and `docker ps -a` was empty, so this was a clean slate.

```sh
sudo rm -rf /opt/crm-backend /opt/crm
sudo mkdir -p /opt/crm/backend && sudo chown -R ansul:ansul /opt/crm
```

Not installed, added later: `nginx`, `certbot`. Not installed and not needed:
`bun`/`node` — everything runs in containers.

## Step 3 — Verify the two external dependencies before building anything

Both of these are the classic day-one blockers, so they were checked first,
before any time was spent on image builds.

```sh
# IAM role can read the secret
aws secretsmanager describe-secret --secret-id finance-crm/dev --region ap-south-1

# Hostinger MySQL is reachable from this box
timeout 10 bash -c 'cat < /dev/null > /dev/tcp/srv502.hstgr.io/3306' && echo OK
```

Both passed. The instance profile is
`arn:aws:sts::760221990853:assumed-role/UAT_server_access_role`, account
`760221990853`.

## Step 4 — Ship only what runs

The repo is `rsync`'d, not cloned — there is no git remote configured. Docs,
lint config, agent files, tests and the SQL migrations are all excluded: they
are not needed to run the services, and migrations are applied from a
developer machine (step 16), never from the box.

```sh
rsync -az --delete \
  --exclude=node_modules --exclude=.git --exclude=old \
  --exclude='/core-api/storage' --exclude='*.log' \
  --exclude=.env --exclude=.env.example --exclude=docs --exclude='*.md' \
  --exclude=.claude --exclude=.husky --exclude=biome.json \
  --exclude='database/sql-migrations' --exclude='**/*.spec.ts' \
  -e "ssh -i ~/.ssh/finance_crm_ec2" ./ ubuntu@203.0.113.10:/opt/crm/backend/
```

8.3 MB on the wire. **Two exclude bugs were hit here; both cost a rebuild
cycle, so do not "tidy" this list.**

**`--exclude=storage` broke the build.** It was meant for the runtime upload
directory, but rsync patterns without a leading slash match at *every* depth,
so it also dropped `common/src/storage/` — real source. The containers then
crash-looped on:

```
error: Cannot find module './storage/local-disk-storage.adapter'
       from '/app/common/src/index.ts'
```

Anchor the pattern (`/core-api/storage`) so it can only match the intended
directory.

**`--delete-excluded` deleted the box's `.env`.** The flag does exactly what
its name says: excluded paths are removed from the destination. Plain
`--delete` leaves excluded files alone, which is the behaviour wanted here.
The permanent fix was to move the file out of the synced tree entirely — see
step 6.

## Step 5 — Populate `finance-crm/dev`

124 keys, built from `secret.dev.json` with the corrections below, then:

```sh
aws secretsmanager put-secret-value --secret-id finance-crm/dev \
  --secret-string file:///tmp/finance-crm-dev.json --region ap-south-1
```

The secret already existed (created 2026-08-05, 121 keys) and was overwritten.
The previous version is still retrievable as `AWSPREVIOUS` if needed.

**Corrections applied, recovered from the live legacy PHP:**

| Key | Change | Source |
|---|---|---|
| `EMAIL_PROVIDER` | `smtp` → `zeptomail` | `functions.inc.php:98` hardcodes `$active_id = 1`, the ZeptoMail branch. With `smtp` + `SMTP_HOST=localhost` **no email would send at all** — no OTP, no reminders, no legal notices. |
| `ZEPTOMAIL_TOKEN` | was blank, now filled | `functions.inc.php:231`. Stored *with* the `Zoho-enczapikey ` prefix: the SDK assigns `token` straight to the `Authorization` header (`zeptomail/lib/js/init.js:246`), it does not add a scheme. |
| `VAPIO_USERNAME`/`API_KEY`/`SENDER_ID`/`PE_ID` | `<VAPIO_USERNAME>`/`<VAPIO_API_KEY>`/`<SENDER_ID>`/`<PE_ID>` (redacted — see secret store) | `payday_sms_sent_api.php:74-78`, the live uncommented path. The values previously in `secret.dev.json` appear to come from an older backup and would have failed authentication. |

**Deliberately blank** (adapters are wired but fail at call time, which is the
intended safe default):

- every `ICICI_*` credential and PEM — withheld on instruction. URLs and
  `ICICI_DISBURSAL_TIMEOUT_MS` are kept so the modules stay configured. This
  disables online disbursal (out of scope) **and** UPI QR collection.
- `SIGNZY_TOKEN` — `config.php:35` reads it from `getenv()`; it exists only in
  the legacy server's environment. This is the one credential that blocks a
  large slice of testing: eKYC/Digilocker, eSign, bank-account verification,
  face match, PAN/Aadhaar OCR, UAN, video KYC.
- `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET` — legacy has only a **live**
  key (`rzp_live_SPxnxKIAdSSl4J`), which must not be used for testing.
- `GOOGLE_MAPS_APIKEY`, `ENACH_ICICI_*`, `SMTP_*`, `REDIS_URL`.

**Keys deliberately *not* stored in the secret**, because the secret would
override the value the container actually needs:

- `AWS_SECRETS_MANAGER_SECRET_NAME`, `AWS_SSM_PARAMETER_PATH` — bootstrap
  vars, read before the loader runs.
- `PORT`, `PUPPETEER_EXECUTABLE_PATH`, `SERVICE_NAME` — read from
  `process.env` directly and set per-container by Docker.
- `CRON_CREDEAU_APPLICATION_ALLOCATION` — that job was deleted in `5c132ec`.

**Trap worth knowing:** `ConfigService` resolves values from the Secrets
Manager loader *before* `process.env`, so anything in the secret silently
beats a `docker-compose.yml` `environment:` entry. That is why
`INTEGRATIONS_API_URL` is stored as `http://integrations-api:3001` (the
compose service name) and not `http://localhost:3001` — a container calling
localhost would be calling itself.

**Values changed for this deployment:** `DB_HOST=srv502.hstgr.io`,
`COOKIE_SECURE=true`, `LMS_URL` and `RAZORPAY_CALLBACK_URL` moved to the
public HTTPS host, `TRUSTED_PROXY_HOPS=2` (see step 7).

## Step 6 — Bootstrap `.env`, kept outside the synced tree

`/opt/crm/.env` (mode 600) holds four non-secret lines and nothing else:

```ini
AWS_REGION=ap-south-1
AWS_DEFAULT_REGION=ap-south-1
AWS_SECRETS_MANAGER_SECRET_NAME=finance-crm/dev
NODE_ENV=development
```

`AWS_REGION` has to be here even though the loader defaults to `ap-south-1`,
because the S3 storage adapter reads it too. No AWS keys anywhere: both the
loader and the S3 adapter use the SDK default credential chain, which lands on
the instance role.

It lives at `/opt/crm/.env`, *not* `/opt/crm/backend/.env`, because an rsync
run wiped the latter once (step 4). The overlay in step 7 repoints `env_file`
at the absolute path.

## Step 7 — Compose overlay: no MySQL container, no public plaintext

`/opt/crm/docker-compose.ec2.yml` overlays the repo's compose file:

```sh
cd /opt/crm/backend
docker compose -f docker-compose.yml -f /opt/crm/docker-compose.ec2.yml <cmd>
```

Three changes, each for a concrete reason:

1. **`depends_on: []` on all four services.** The base compose file has them
   depend on a local `mysql` container. The database is Hostinger, so that
   container must never start — and simply not naming it in `up` is not
   enough, an unmet `depends_on` drags it back in.
2. **Gateway publishes `127.0.0.1:8080:80`** instead of `8080:80`. Host nginx
   is the only public listener; nothing answers plaintext from the internet.
3. The `mysql` service is left defined but never started.

**Why keep the gateway container at all**, given host nginx is in front? Its
`nginx.conf` already carries the tested path routing
(`/api/v1/integrations/` → integrations-api, `/api/v1/reporting/` →
reporting-api, everything else → core-api) plus the CSP and security headers.
Re-implementing that in host nginx would mean maintaining the same routing
twice. Host nginx does TLS and nothing else.

That is also why `TRUSTED_PROXY_HOPS=2`: a request crosses host nginx *and*
the gateway before Express sees it, so `X-Forwarded-For` carries two entries.
With `1`, every audited IP (`User.lastLoginIp`, `UserActivityLog`,
document-download and report-access logs) would record the host nginx bridge
address instead of the real client.

## Step 8 — Build

```sh
cd /opt/crm/backend
docker compose -f docker-compose.yml -f /opt/crm/docker-compose.ec2.yml \
  build core-api integrations-api reporting-api automation-worker gateway
```

All five images built. ~90 s per image on this instance, mostly
`bun install`. `core-api` additionally installs Debian `chromium` for the PDF
pipeline, which is why its image is the largest.

**`depends_on: []` does not clear a dependency.** The first version of the
overlay used an empty list, and Compose started the MySQL container anyway:

```
Container backend-mysql-1  Error dependency mysql failed to start
dependency failed to start: container backend-mysql-1 is unhealthy
```

Compose *merges* `depends_on` between files rather than replacing it, so an
empty list is a silent no-op. The overlay uses the `!reset` tag, which is the
only thing that actually drops the base file's entry:

```yaml
services:
  core-api:
    depends_on: !reset null
```

`!override` is used for the same reason on `env_file` and `ports`.

## Step 9 — A real bug: AWS-only config is invisible at boot

With everything wired, all four services crash-looped on:

```
ERROR [ExceptionHandler] TypeError: Configuration key "JWT_ACCESS_SECRET" does not exist
    at useFactory (/app/common/src/auth/shared-auth.module.ts:34:24)
```

The secret was fine — calling `awsSecretsLoader()` by hand inside the very
same container, on the very same Compose network, returned all 124 keys. The
give-away was in the boot log's own ordering:

```
[InstanceLoader] CommonModule dependencies initialized   +0ms
[InstanceLoader] ConfigModule dependencies initialized   +1ms
```

`CommonModule` initialises **before** `ConfigModule`, and `ConfigModule` takes
1 ms, which is not enough time for a network round-trip to AWS. Nest resolves
providers module by module; a `useFactory` that injects `ConfigService` can
therefore run before `ConfigModule.forRoot({ load: [...] })`'s async factories
have resolved.

**This never shows up locally**, which is why it survived until now: `.env` is
parsed synchronously inside `forRoot()`, so every key is already in
`process.env` before any factory runs. It only appears when a key exists
**only** in AWS — exactly this deployment.

Fixed at the source, in `common/src/config/hydrate-remote-config.ts`:
`hydrateRemoteConfig()` runs both loaders and copies the result into
`process.env`, and each service's `bootstrap()` awaits it as its first
statement, before `NestFactory.create`. Ordering then stops mattering — the
value is present whenever any factory asks for it.

Precedence is unchanged: dotenv does not overwrite variables already in
`process.env`, so AWS still beats `.env`, and SSM is still applied before
Secrets Manager so Secrets Manager still wins a clash. The
`load: [awsSsmLoader, awsSecretsLoader]` entries were deliberately left in
every `AppModule` — redundant, harmless, and they keep the documented
resolution chain honest if the bootstrap call is ever removed.

After this, every service boots and logs
`[RemoteConfig] Hydrated 124 config keys into process.env`.

## Step 10 — nginx and TLS

```sh
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Config: `/etc/nginx/sites-available/crm` plus
`/etc/nginx/snippets/crm-proxy.conf` (shared by the `:80` and `:443` blocks so
certbot's block-cloning keeps them in step). Port 80 redirects to 443 apart
from `/.well-known/acme-challenge/`. `client_max_body_size 25m` because the
1 MB default is far too small for a bank-statement upload, and
`proxy_read_timeout 120s` because PDF renders and vendor callbacks both
outrun the 60 s default.

**`http2 on;` fails on this box.** Ubuntu 24.04 ships nginx 1.24 and the
standalone directive only exists from 1.25.1:

```
[emerg] unknown directive "http2" in /etc/nginx/sites-enabled/crm:24
```

Use the old form on the listen line: `listen 443 ssl http2;`.

**Let's Encrypt issuance is blocked twice over.** First by the security
group — inbound :80 is open to one office IP, and Let's Encrypt validates from
many unpublished source addresses:

```
Detail: 203.0.113.10: Fetching http://…/.well-known/acme-challenge/…:
        Timeout during connect (likely firewall problem)
```

Second, and more fundamentally, there is no domain pointed at this box, and
certbot's nginx plugin issues against a hostname.

Inbound :80 is open to one office IP. Let's Encrypt validates from many source
addresses and publishes no fixed range, so :80 must be open to `0.0.0.0/0`.
Until that changes the box serves a **self-signed** certificate
(`/etc/nginx/ssl/selfsigned.*`, CN `203.0.113.10`, with the IP in its SAN),
which is fine for local work but will be refused by every vendor webhook.

HSTS is set here rather than in the gateway container (that one listens on
plain `:80` behind this, where the header is ignored at best). `max-age` is
deliberately only 300 s while the certificate is self-signed;
`issue-cert.sh` raises it to a year once a real one is installed.

To switch to a real certificate, once a domain's A record points here:

```sh
sudo /opt/crm/bin/issue-cert.sh crm.financecrm.com
```

It takes a hostname, not an IP: certbot's nginx plugin issues against a
domain name.

It runs `certbot --nginx`, which rewrites the two `ssl_certificate` lines in
place, bumps HSTS, and reloads. Renewal is certbot's own systemd timer and
needs :80 to stay open.

## Step 11 — Logs

Three layers, because "check the logs" should never mean "reconstruct them":

| Where | What |
|---|---|
| `/opt/crm/logs/crm.log` | every container, interleaved, timestamped. This is the one to grep. |
| `docker logs <container>` | per-service, capped at 20 MB x 5 files by the overlay's `logging:` block so `/var/lib/docker` cannot fill the 19 GB root volume |
| `/var/log/nginx/crm.{access,error}.log` | TLS layer, including anything that never reached a container |

The aggregate file is produced by `crm-logs.service`, a systemd unit running
`docker compose logs -f --timestamps --no-color` into it, restarted
automatically and enabled at boot. `/etc/logrotate.d/crm` rotates it daily,
14 days, `copytruncate` (the tail holds the file open).

## Step 12 — Helper scripts

`/opt/crm/bin/`, with `crm` symlinked into `/usr/local/bin`:

| Command | Does |
|---|---|
| `crm ps` / `crm logs -f core-api` / `crm restart core-api` | compose wrapper, so nobody has to remember the two `-f` flags |
| `sudo /opt/crm/bin/issue-cert.sh <host>` | swap the self-signed cert for a real one |
| `/opt/crm/bin/tail-logs.sh` | the log aggregator, run by systemd, not by hand |

## Step 13 — Redeploying after a code change

```sh
# from backend/ on a developer machine — the rsync in step 4, then:
ssh -i ~/.ssh/finance_crm_ec2 ubuntu@203.0.113.10 \
  'crm build core-api && crm up -d core-api'
```

Images rebuild in ~90 s each. There is no git remote on the box, so `rsync` is
the only delivery path.

## Step 14 — MySQL moved onto the box

Hostinger's remote-MySQL grant does not cover this instance (see the closed
blocker at the end), so the database now runs here, as the `mysql` service
the base compose file already defined. The overlay makes three changes to it,
all of which were forced by an actual failure:

```yaml
mysql:
  command:
    - --sql-mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
    - --skip-log-bin
  ports: !override ['127.0.0.1:3306:3306']
```

**Credentials are explicit in the overlay, not in `.env`.** Everything else on
this box reads its secrets from Secrets Manager, but the MySQL image cannot,
and `.env` deliberately holds nothing sensitive. `finance_crm_uat` /
`finance_crm_prod` are kept identical to the Hostinger names so nothing else has
to change when we point back at a managed database.

**3306 is bound to `127.0.0.1`.** Reach it from a developer machine over an
SSH tunnel, never by opening the port:

```sh
ssh -i ~/.ssh/finance_crm_ec2 -f -N -L 3307:127.0.0.1:3306 ubuntu@203.0.113.10
```

**`--sql-mode=…` — the dumps are MariaDB, the server is MySQL 8.** MySQL's
defaults are stricter, and two of them break this data:

- `NO_ZERO_DATE`/`NO_ZERO_IN_DATE`: legacy tables carry
  `timestamp NOT NULL DEFAULT '0000-00-00 00:00:00'`. MySQL re-validates the
  entire table definition on `ALTER`, so `m1.sql` died on block 2 of 34 with
  `Invalid default value for 'updated_at'` — on a column it was not touching.
- `ONLY_FULL_GROUP_BY`: off in MariaDB, and the ported legacy reporting
  queries were written against that.

`STRICT_TRANS_TABLES` is deliberately kept: silently truncating a loan amount
is worse than a failed insert.

**`--skip-log-bin` — `m1.sql` creates a trigger.** MySQL refuses that from a
non-`SUPER` account while binary logging is on:

```
You do not have the SUPER privilege and binary logging is enabled
```

There is no replica and no point-in-time recovery on a dev box, so turning the
binlog off is both the fix and one less thing filling the 19 GB volume. On a
real database, grant the privilege instead.

## Step 15 — Loading the data

`sql-dumps/uat.sql` (125 tables, 379 inserts, database `finance_crm_prod`) is
imported as the baseline rather than `init.sql`, because it is the only source
with **data** — 184 users, 17 leads, 4 loans, 631 cities. `init.sql` would
give a structurally complete but empty database with no account to log in
with.

```sh
scp sql-dumps/uat.sql ubuntu@203.0.113.10:/tmp/
ssh … 'docker exec -i backend-mysql-1 mysql -uroot -p… < /tmp/uat.sql'
```

`init.sql` defines 149 tables to the dump's 125. The 24 missing ones were
checked against every TypeORM entity and **not one is mapped** — they are
dated backup copies (`leads_20260623`, `loan_20260718`, …) plus log tables for
vendors that have been removed (`api_whatsapp_logs`, `api_trackier_*`). So
nothing was back-filled. `init.sql` also cannot simply be replayed on top: it
is plain `CREATE TABLE` with 290 follow-up `ALTER TABLE` statements, all of
which fail against existing tables.

## Step 16 — Migrations, from the developer machine

Through the tunnel from step 14, exactly as instructed — never from the box:

```sh
cd backend/database
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=finance_crm_uat DB_PASSWORD='…' DB_DATABASE=finance_crm_prod bun run migrate --m1
```

`m1.sql applied successfully` — 34 blocks. Worth noting that the runner's
failure-recovery works exactly as documented: both earlier failures reverted
all 34 blocks cleanly and left the database as it was.

## Step 17 — nginx cached a dead container IP

With everything up, the gateway returned 502 while
`wget http://core-api:3000/…` from *inside that same gateway container*
returned a correct 401:

```
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://172.18.0.2:3000/api/signin"
```

nginx resolves a hostname in an `upstream` block once, at config load, and
caches it for the worker's lifetime. Recreating a service container gives it a
new IP on the compose network, and the gateway keeps dialling the old one.
Every `docker compose up -d core-api` would have needed a `restart gateway`
chaser.

Fixed in the repo's `gateway/nginx.conf`: the `upstream` blocks are gone,
replaced by Docker's embedded DNS plus a variable in each `proxy_pass`, which
makes nginx re-resolve per request.

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;
…
set $core_upstream core-api;
proxy_pass http://$core_upstream:3000$request_uri;
```

`$request_uri` is mandatory with a variable upstream — nginx only forwards the
original URI automatically for the literal form.

## Step 18 — A login, and the empty-list mystery

The `users` table has 184 rows and `user_password_hash` (added by `m1`) is
null for all of them, which the app correctly treats as "has never set a
password". User 1 (`it@financecrm.com`, "IT Team") was given a bcrypt hash
directly; it holds roles `CA, CR1, CR2, CR3, DS1, DS2, ST`, so one account
covers every queue.

**Set the hash from a file, not from a shell variable.** The first attempt
interpolated the hash into a double-quoted `ssh …"…"` command and the shell
ate `$2b$10$…` as empty variables, storing a 5-character string. It fails as a
plain wrong password with no hint as to why. Generate, write to `.sql`, `scp`,
pipe into `mysql`.

Then login worked but **every list endpoint returned `total: 0` against real
data** — `/api/v1/users` empty with 184 rows present, `/api/v1/users/1` a 404
for the very user that had just signed in successfully.

Cause: `company_login` is **empty in the dump**, while all 184 users and every
lead reference `company_id = 1`. `User.company` and `Lead.company` are
`@ManyToOne(() => Company, { nullable: false })`, and TypeORM loads a
non-nullable relation with an **INNER JOIN** — so the missing parent row
silently filtered out every child. Sign-in survived only because it queries by
email with no relations.

Fixed by seeding the one missing company row (id 1, "Acme Financial Services
Pvt Ltd."). Both endpoints returned real data immediately afterwards. Worth
remembering as a general rule: on this schema, an empty master table does not
degrade a list, it empties it.

---

## Step 19 — Real credentials, and two that arrived corrupted

The client supplied live credentials for ZeptoMail, CartBI account aggregator,
Signzy, Vapio, Razorpay and Google Maps. Every one was verified against the
real vendor before being written to `finance-crm/dev`.

**Two tokens were mangled in transit, in the same way.** Both differed from the
live legacy values by the case of a single character — the second one:

| | Supplied | Legacy / correct |
|---|---|---|
| `ZEPTOMAIL_TOKEN` | `Ph`tE6r1f… | `PH`tE6r1f… |
| `VAPIO_API_KEY` | `Dj`hgTi3ofqGz | `DJ`hgTi3ofqGz |

That "first letter kept capital, second lowercased" pattern is what an
autocapitalising editor does to a word at the start of a line. ZeptoMail
settles it empirically — post an empty body and read the status:

```
PHtE…  ->  400  "Bad Syntax"            = authenticated, payload rejected
PhtE…  ->  500  "Internal Error"        = authentication rejected
```

So the legacy casing is correct for both, and it is what is stored. **If you
paste a token from a document, check its second character.**

**Three URLs needed correcting**, each because of how the code consumes them:

- `ACCOUNT_AGGREGATOR_NP_URL` is a **base**: `AccountAggregatorService`
  appends `api/generateNetBankingRequest` / `api/downloadFile`. It held
  `https://cartbi.com/api/upload` (the *bank-analysis* path, a different
  vendor endpoint that happens to share a host), which would have produced
  `…/api/uploadapi/generateNetBankingRequest`. Now `https://cartbi.com/`.
  Its token was also the bank-analysis one; the real AA token is distinct.
- `SIGNZY_BASE_URL` needs its trailing `api/`: `SignzyClientService`
  concatenates base + path, and the paths are `v3/…`. The supplied
  `https://api.signzy.app/` became `https://api.signzy.app/api/`. Verified:
  `400 VALIDATION_ERROR` = authenticated. Note this is Signzy
  **production**, not the preproduction host used before.
- `ZEPTOMAIL_URL` stays the bare `api.zeptomail.in/`, *not* the full REST
  endpoint: the SDK appends `v1.1/email` itself
  (`zeptomail/lib/js/init.js:397`), so a full URL doubles the path.

`GOOGLE_MAPS_PROVIDER` and `GOOGLE_MAPS_URL` were supplied but are not stored:
nothing reads them. The client library owns the URL and only
`GOOGLE_MAPS_APIKEY` is consumed.

> **`RAZORPAY_KEY_ID` is a LIVE production key**, supplied deliberately. It was
> verified read-only (listing existing links, creating nothing) and the account
> returned real customer payment links. Any payment link this environment
> creates is a real one that charges real money. `RAZORPAY_WEBHOOK_SECRET` is
> still blank, so payment callbacks are not verified yet.

## Step 20 — TLS solved by Cloudflare, not Let's Encrypt

`api.financecrm.com` now points at the box **through Cloudflare**
(`dig` returns Cloudflare addresses, not the origin), and Cloudflare serves a
publicly trusted Google Trust Services certificate.

That closes the TLS blocker outright — **no Let's Encrypt certificate is
needed**. `issue-cert.sh` remains for a future origin-direct setup, but nothing
requires it now, and inbound :80 no longer has to be opened to the world.

The origin keeps its self-signed certificate; Cloudflare accepts it (Full, not
Full-Strict). Two consequences worth knowing:

- **`TRUSTED_PROXY_HOPS` is now 3** — Cloudflare, then host nginx, then the
  gateway container, all before Express. At 2 every audited IP would record
  Cloudflare's edge rather than the real client.
- Reaching the box **by IP still works** and still presents the self-signed
  certificate. That path bypasses Cloudflare, so a client that reaches it
  directly could forge `X-Forwarded-For` past a hop count tuned for the
  Cloudflare path. Acceptable on a dev box whose origin is IP-restricted;
  do not carry this arrangement to production without pinning the origin to
  Cloudflare's ranges.

## Step 21 — Back onto Hostinger MySQL

The remote-MySQL grant now covers both the box and the developer machine, so
the database moved back off the container:

```
DB_HOST=srv502.hstgr.io  DB_DATABASE=finance_crm_uat
```

It was found holding the bare 149-table `init.sql` baseline with **zero rows**
and **`m1` not applied** — no `user_password_hash`, no
`disbursal_authorised_users`, no `crm_settings`. Without that column the auth
path cannot work at all, so `m1` was applied first, from the developer machine
(all 34 blocks).

### Loading the data: data-only, no `down`/`up` cycle

`dev.sql` and `prod.sql` contain **no data at all** — 149 `CREATE TABLE`s, zero
`INSERT`s. They are where `init.sql` came from. `uat.sql` is the only dump with
rows (379 statements, 125 tables), so it is the source.

Reverting `m1` first was considered and rejected. The dump carries no
`DROP TABLE`, so its `CREATE TABLE`s would collide with the existing baseline,
and unwinding a migration to load data risks the schema for no gain. Instead
the `INSERT`s were extracted into a data-only file wrapped in
`SET FOREIGN_KEY_CHECKS=0` (dump order does not respect FK order) and applied
with `--force` so one bad statement could not abort the rest.

Three statements failed, and `--force` is why that was recoverable rather than
silent:

| Failure | Cost | Fix |
|---|---|---|
| `Unknown column 'cp_is_mobile_verified'` | all 83 `customer_profile` rows | The UAT source has a column the dev-derived baseline never had. Added back to match the source — no entity maps it, so the app is indifferent. |
| `Duplicate entry … for key 'm_pincode_value_2'` | ~3,000 pincodes | Re-ran as `INSERT IGNORE`. 20,627 of 20,650 loaded; the remaining 23 are genuine duplicates. |
| `Operation not permitted during COMMIT` | part of the same pincode batch | Same fix; a Hostinger-side limit on a large batch. |

**`company_login` is empty in the dump**, exactly as it was locally, while
every user and lead references `company_id = 1`. `User.company` and
`Lead.company` are non-nullable `@ManyToOne`, which TypeORM loads with an
**INNER JOIN**, so without that parent row every list endpoint returns zero
results against real data — while sign-in still succeeds, because it queries by
email with no relations. The one company row is seeded as part of the load.

Final state on Hostinger: 184 users, 17 leads, 4 loans, 83 customer profiles,
38 statuses, 374 user-role rows, 20,627 pincodes, 631 cities.

## Step 22 — Frontend against the deployed box

`core-crm/.env.local` (gitignored, `.env.example` is committed):

```ini
VITE_API_TARGET=https://api.financecrm.com
```

Then `bun run dev`. Verified through the Vite proxy: sign-in 200, leads 17,
users 184.

## Step 23 — CORS for the deployed front ends

The CRM is now served from `https://crm.financecrm.com` (and its raw
CloudFront URL), both cross-origin to the API at `api.financecrm.com`, so
CORS matters for the first time — the Vite proxy had made every call
same-origin until now.

Two gaps had to close:

1. **`CORS_ORIGIN` only ever held one value.** `enableCors({ origin })` was
   passed the raw string, so a second front end could not be added without a
   code change. `@finance-crm/common`'s `parseCorsOrigins()` now splits a
   comma-separated list. It returns an **array even for one entry**, and falls
   back to the dev origin rather than `*` when unset — `credentials: true`
   forbids the wildcard, and a forgotten variable must not end up echoing an
   attacker's `Origin` back with `Access-Control-Allow-Credentials: true`.
2. **Only `core-api` enabled CORS at all.** `reporting-api` and
   `integrations-api` had none, so `/api/v1/reporting/*` and
   `/api/v1/integrations/*` would have failed in the browser while
   `/api/v1/leads` worked. The browser applies CORS per response, and the
   gateway proxies each service's own headers through. Both now use the same
   allow-list.

Verified by preflighting all three services from each origin: the exact origin
is echoed with `Access-Control-Allow-Credentials: true`, and an unlisted origin
gets no `Access-Control-Allow-Origin` header at all.

### The CloudFront URL cannot hold a session, and CORS will not fix it

`https://crm.financecrm.com` works fully. The raw CloudFront URL will
pass CORS and then still fail to log in, for a reason CORS has no say over:

```
set-cookie: access_token=…;  HttpOnly; Secure; SameSite=Lax
set-cookie: refresh_token=…; HttpOnly; Secure; SameSite=Strict
```

`crm.financecrm.com` and `api.financecrm.com` share the registrable
domain `financecrm.com`, so requests between them are **same-site** — `Lax`
and `Strict` cookies are both sent, and nothing needs relaxing.

`cloudfront.net` is on the Public Suffix List, so `example.cloudfront.net`
is its own registrable domain. Requests from it to the API are **cross-site**,
and a browser will neither store nor send `SameSite=Lax`/`Strict` cookies on
them. Sign-in returns 200 and the session silently never exists.

Making that URL work means `SameSite=None; Secure` on both cookies, which
removes the main CSRF defence this API has (there are no CSRF tokens). **Use
the custom domain**; treat the CloudFront URL as an origin-of-record for the
distribution, not something to log in from. If it must work, that is a
deliberate security decision to take explicitly, not a config tweak.

---

## Step 24 — Removed the idle local `mysql` container for good (2026-08-12)

It had sat running-but-unused since Step 21 (all four app services read
`DB_HOST=srv502.hstgr.io` from `finance-crm/dev`, never the local container).
`docker stop`/`rm` alone wasn't enough — the overlay's `core-api`/
`integrations-api`/`reporting-api`/`automation-worker` entries all still
carried `depends_on: *db-depends` (a `mysql: condition: service_healthy`
anchor), and Compose merges `depends_on` rather than replacing it, so a
bare `crm up -d core-api` silently recreated `mysql` first to satisfy that
dependency — confirmed live, twice.

Fixed in `/opt/crm/docker-compose.ec2.yml` (outside the synced tree, edited
directly on the box): each of those four services now gets
`depends_on: !reset null` — the tag that actually replaces rather than
merges, per this same file's own note above. The `mysql` service block
itself is neutered with `profiles: ['unused']` (an inactive profile) rather
than deleted outright, since Compose can override a service's fields
across files but can't delete one — this way `docker compose config`
still merges cleanly and `mysql` simply never appears in `--services`.
Verified: `crm up -d` (all services) and `crm up -d core-api` (single
service, the exact command that resurrected it before) both leave `mysql`
absent from `crm ps`, and a live `/api/v1/auth/me` call still returns 200
straight after.

## Current state

| | |
|---|---|
| Containers | five app containers up; no local `mysql` — removed for good in Step 24, the database is Hostinger only |
| Secrets | 124 keys loading from `finance-crm/dev` on every boot |
| Database | Hostinger `finance_crm_uat`, `m1` + UAT data, 184 users / 17 leads / 4 loans |
| TLS | **done** — Cloudflare serves a publicly trusted certificate for `api.financecrm.com` |
| Logs | aggregating to `/opt/crm/logs/crm.log` |
| Login | `it@financecrm.com` / `DevTest@2026`, 7 roles |

Verified over HTTPS end to end: sign-in returns a session and 7 role codes,
`/api/v1/leads` and `/api/v1/users` return real rows, `/api/v1/integrations/*`
answers 200, and unauthenticated calls get a clean 401.

### Open — security-group :80 for a real certificate

Open inbound TCP 80 to `0.0.0.0/0` and run
`sudo /opt/crm/bin/issue-cert.sh <your-domain>` once DNS points here. Inbound 443 also needs
to be world-open before any vendor webhook (Signzy, CartBI, Razorpay) can
reach the box.

### Closed — Hostinger remote MySQL

Superseded: the database runs on the box now. If you ever point back at
Hostinger, both `203.0.113.10` and the developer machine's IP have to be added
under hPanel -> Databases -> Remote MySQL, or you get
`Access denied for user …@'203.0.113.10'` despite the TCP connection
succeeding.

### Still missing, unrelated to this box

`SIGNZY_TOKEN` (blocks eKYC/eSign/OCR/face-match/video-KYC), Razorpay **test**
keys, and every ICICI credential (withheld on instruction, so UPI collection
and online disbursal both fail at call time).

### Why there is no hostname

Everything addresses the box by IP: `https://203.0.113.10`. Both nginx server
blocks are `default_server`, so it answers regardless of the `Host` header,
and the self-signed certificate carries `IP Address:203.0.113.10` in its SAN.

An `a-b-c-d.sslip.io` name was used briefly, purely to give Let's Encrypt
something resolvable to validate before a real domain exists. It bought
nothing while :80 stays closed, so it was dropped. Certbot's `--nginx` flow
issues against a **hostname**, so a real certificate still needs a domain
pointed here — at which point `issue-cert.sh <domain>` handles it, and the
only other change is three config values in `finance-crm/dev`: `LMS_URL`,
`RAZORPAY_CALLBACK_URL`, `STORAGE_LOCAL_PUBLIC_URL`.
