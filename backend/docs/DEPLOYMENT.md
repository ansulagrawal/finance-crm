# DEPLOYMENT.md — AWS production runbook

Manual, hand-executable AWS deployment runbook for the Finance CRM backend.
No Terraform/CloudFormation — per the locked-in architecture decision
(`CLAUDE.md`'s "IaC scope" decision), there are no cloud credentials available in
this environment to write/apply IaC against, so this is a step-by-step guide
for a human to execute in the AWS Console or via the `aws` CLI.

This is a **runbook**, not a CI/CD pipeline design. Every judgment call
(instance sizes, Multi-AZ, etc.) is called out explicitly with its reasoning
so the client can override it with different budget/compliance constraints.

## 0. What's being deployed

Five deployable units (bun workspace apps), read straight from
`docker-compose.yml` / `*/Dockerfile` / `*/src/main.ts`:

| Service | Container port | Global route prefix | Health check path | Public via ALB? |
|---|---|---|---|---|
| `core-api` | 3000 | `/api/v1` (+ unversioned `/api/signin`, `/api/forgot-password*`) | none dedicated — see §3.4 caveat | yes (catch-all) |
| `integrations-api` | 3001 | `/api/v1/integrations` | `GET /api/v1/integrations/health` | yes (`/api/v1/integrations/*`) |
| `reporting-api` | 3002 | `/api/v1/reporting` | `GET /api/v1/reporting/health` | yes (`/api/v1/reporting/*`) |
| `automation-worker` | 3003 | `/api/v1/automation` | `GET /api/v1/automation/health` | **no** — no public routes, no ALB target group |
| `gateway` | 80 (nginx) | n/a (reverse proxy) | `/` (whatever it proxies to) | yes — this is the internet-facing edge |

Routing logic that must be mirrored (source: `gateway/nginx.conf`):
1. `location /api/v1/integrations/` → `integrations-api`
2. `location /api/v1/reporting/` → `reporting-api`
3. `location /` (everything else, including core-api's unversioned auth
   routes) → `core-api`

All inter-service URLs (`CORE_API_URL`, `INTEGRATIONS_API_URL`) are env-var
driven (`CLAUDE.md` architecture decision) — nothing below requires code
changes, only environment values pointed at AWS resources instead of
docker-compose service names.

## 1. VPC and networking

### 1.1 VPC

```
aws ec2 create-vpc --cidr-block 10.20.0.0/16 --tag-specifications \
  'ResourceType=vpc,Tags=[{Key=Name,Value=finance-crm-prod-vpc}]'
```
Enable DNS support/hostnames (needed for RDS/ALB DNS names):
```
aws ec2 modify-vpc-attribute --vpc-id <vpc-id> --enable-dns-support
aws ec2 modify-vpc-attribute --vpc-id <vpc-id> --enable-dns-hostnames
```

### 1.2 Subnets — 2 AZs minimum

| Subnet | AZ | CIDR | Purpose |
|---|---|---|---|
| `finance-crm-public-a` | ap-south-1a | 10.20.0.0/24 | gateway EC2, NAT gateway, internet-facing ENIs |
| `finance-crm-public-b` | ap-south-1b | 10.20.1.0/24 | spare AZ for public tier (no second gateway instance yet, see §2.4) |
| `finance-crm-private-app-a` | ap-south-1a | 10.20.10.0/24 | core-api / integrations-api / reporting-api / automation-worker |
| `finance-crm-private-app-b` | ap-south-1b | 10.20.11.0/24 | second AZ for the app tier + the internal ALB's second subnet |
| `finance-crm-private-db-a` | ap-south-1a | 10.20.20.0/24 | RDS subnet group |
| `finance-crm-private-db-b` | ap-south-1b | 10.20.21.0/24 | RDS subnet group (RDS requires ≥2 AZs in its subnet group even for single-AZ deployments) |

(Region shown as `ap-south-1` (Mumbai) since `AWS_REGION=ap-south-1` is
already the default in `.env.example` — confirm this matches the client's
actual target region before provisioning.)

```
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.0.0/24 --availability-zone ap-south-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-public-a}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.1.0/24 --availability-zone ap-south-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-public-b}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.10.0/24 --availability-zone ap-south-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-private-app-a}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.11.0/24 --availability-zone ap-south-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-private-app-b}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.20.0/24 --availability-zone ap-south-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-private-db-a}]'
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.20.21.0/24 --availability-zone ap-south-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=finance-crm-private-db-b}]'
```

### 1.3 Internet gateway + NAT gateway

```
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=finance-crm-igw}]'
aws ec2 attach-internet-gateway --internet-gateway-id <igw-id> --vpc-id <vpc-id>

# Elastic IP + NAT gateway in the public subnet, for private-subnet outbound
# internet (integrations-api calls Finbox/Razorpay/Signzy/Surepass/
# ICICI/Adjust/AppsFlyer/Vapio/SMTP/WhatsApp — all outbound HTTPS to public
# vendor endpoints from a private-subnet instance).
aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id <finance-crm-public-a-id> --allocation-id <eip-alloc-id> \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=finance-crm-nat}]'
```
Wait for the NAT gateway to become `available` before wiring routes (`aws ec2
describe-nat-gateways --nat-gateway-ids <id>`).

One NAT gateway (single AZ) is enough for this initial load — it is not a
per-service resource, just an egress path shared by all private subnets.
**Judgment call**: not making it redundant across both AZs initially (that
would need a second NAT gateway + EIP, roughly double the ~$0.045/hr + data
processing cost) since a NAT outage only affects outbound vendor calls, not
inbound traffic to the app — acceptable initial risk, revisit if vendor-call
availability becomes critical.

### 1.4 Route tables

**Public route table** (associate with `finance-crm-public-a`, `finance-crm-public-b`):
```
aws ec2 create-route-table --vpc-id <vpc-id> --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=finance-crm-public-rt}]'
aws ec2 create-route --route-table-id <public-rt-id> --destination-cidr-block 0.0.0.0/0 --gateway-id <igw-id>
aws ec2 associate-route-table --route-table-id <public-rt-id> --subnet-id <finance-crm-public-a-id>
aws ec2 associate-route-table --route-table-id <public-rt-id> --subnet-id <finance-crm-public-b-id>
```

**Private route table** (associate with all 4 private subnets — app tier and
DB tier both route outbound through the same NAT; RDS itself makes no
outbound calls but sharing one table is simpler and equally secure since the
security groups are what actually gate DB access, not the route table):
```
aws ec2 create-route-table --vpc-id <vpc-id> --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=finance-crm-private-rt}]'
aws ec2 create-route --route-table-id <private-rt-id> --destination-cidr-block 0.0.0.0/0 --nat-gateway-id <nat-gw-id>
aws ec2 associate-route-table --route-table-id <private-rt-id> --subnet-id <finance-crm-private-app-a-id>
aws ec2 associate-route-table --route-table-id <private-rt-id> --subnet-id <finance-crm-private-app-b-id>
aws ec2 associate-route-table --route-table-id <private-rt-id> --subnet-id <finance-crm-private-db-a-id>
aws ec2 associate-route-table --route-table-id <private-rt-id> --subnet-id <finance-crm-private-db-b-id>
```

### 1.5 Topology decision: where does `gateway` sit?

Read `gateway/nginx.conf` and `docker-compose.yml` first: today, nginx
(`gateway`) is the **single entry point** — it terminates all inbound
traffic and path-routes to `core-api`/`reporting-api`/`integrations-api` by
proxying to their compose service names. `automation-worker` has no route in
nginx.conf at all (it has no public HTTP surface).

The already-confirmed architecture decision (`CLAUDE.md`'s "Service split" entry) says: *"one
**internal** ALB in front of per-service EC2 instances, path/host-based
routing rules per service."* The word "internal" is load-bearing — in AWS
terms an **internal ALB** has no public IP and is not reachable from the
internet at all, only from inside the VPC (or a peered/VPN'd network). That
means the ALB itself cannot be the internet-facing edge; something else has
to be.

**Decision**: `gateway` stays the internet-facing edge, exactly as it is
today, in the **public subnet** with a public IP — it keeps doing exactly
what `nginx.conf` already does (TLS termination, CORS, cookie-path
rewriting) — except its `proxy_pass` targets change from compose service
names to **the internal ALB's DNS name**, with nginx still owning the
path-based `location` blocks. The internal ALB sits in the private app
subnets, in front of per-service target groups, and is only reachable from
`gateway`'s security group. This means:

```
Internet → gateway (EC2, public subnet, public IP, nginx) → internal ALB (private subnets)
         → target group (core-api | reporting-api | integrations-api) → EC2 instance (private subnet)
```

Justification: this is the smallest change from the current, already-tested
topology (`nginx.conf`'s routing logic is reused verbatim, only the upstream
hostnames change from `core-api:3000` to the ALB's DNS name + path), it
satisfies "internal ALB" literally (never internet-facing), and it avoids
duplicating nginx's routing rules a second time as ALB listener rules
*and* keeping nginx around doing nothing — instead each does one job:
nginx owns TLS/CORS/cookies at the edge, the ALB owns per-service target
group health/failover behind it.

**Alternative considered and rejected**: making the ALB internet-facing and
retiring `gateway` entirely. Rejected because the architecture decision
explicitly says "internal ALB," and retiring `gateway` would mean CORS/
cookie-path handling (currently nginx's job) would need to move into each
Nest app or into ALB listener rules, which is a bigger, un-asked-for change
just to save one EC2 instance (a `t3.micro`, negligible cost either way).

If the client wants to eliminate the extra hop later, that is a valid
follow-up — flagged here, not decided unilaterally.

## 2. Security groups (one per tier, least-privilege ingress)

| SG | Attached to | Ingress | Egress |
|---|---|---|---|
| `sg-gateway` | `gateway` EC2 (public subnet) | 443 from `0.0.0.0/0`; 80 from `0.0.0.0/0` (redirect-to-443 only, or drop this rule once TLS is confirmed working) | 80 (or 443, matching the ALB listener) to `sg-internal-alb`; 443 to `0.0.0.0/0` only if nginx itself needs outbound (it doesn't today — keep this closed unless a future need appears) |
| `sg-internal-alb` | internal ALB | app-listener port(s) from `sg-gateway` only | 3000 to `sg-app-core`, 3001 to `sg-app-integrations`, 3002 to `sg-app-reporting` |
| `sg-app-core` | `core-api` EC2 | 3000 from `sg-internal-alb` only | 3306 to `sg-rds`; 443 to `0.0.0.0/0` via NAT only if/when it calls out directly (currently it doesn't call third parties directly — see `CLAUDE.md`) |
| `sg-app-integrations` | `integrations-api` EC2 | 3001 from `sg-internal-alb` only | 3306 to `sg-rds`; 443 to `0.0.0.0/0` via NAT (every vendor adapter — Finbox, Razorpay, Signzy, Surepass, ICICI, Adjust, AppsFlyer, Vapio, SMTP:587, WhatsApp — is an outbound HTTPS/SMTP call to a public endpoint) |
| `sg-app-reporting` | `reporting-api` EC2 | 3002 from `sg-internal-alb` only | 3306 to `sg-rds` |
| `sg-app-automation` | `automation-worker` EC2 | **none** — nothing calls this instance over the network, it has no ALB target group | 3306 to `sg-rds`; egress to `sg-internal-alb` on the ALB's app-listener port (it calls `integrations-api` over HTTP for SMS/email/WhatsApp/attribution via `INTEGRATIONS_API_URL`, which in production points at the internal ALB's `/api/v1/integrations/*` path — see §7) |
| `sg-rds` | RDS instance | 3306 from `sg-app-core`, `sg-app-integrations`, `sg-app-reporting`, `sg-app-automation` only | none needed (RDS doesn't initiate outbound connections) |

```
aws ec2 create-security-group --group-name sg-gateway --description "gateway (internet-facing edge)" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-internal-alb --description "internal ALB" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-app-core --description "core-api" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-app-integrations --description "integrations-api" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-app-reporting --description "reporting-api" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-app-automation --description "automation-worker" --vpc-id <vpc-id>
aws ec2 create-security-group --group-name sg-rds --description "RDS MySQL" --vpc-id <vpc-id>

# gateway: public ingress
aws ec2 authorize-security-group-ingress --group-id <sg-gateway> --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <sg-gateway> --protocol tcp --port 80 --cidr 0.0.0.0/0

# internal ALB: only from gateway
aws ec2 authorize-security-group-ingress --group-id <sg-internal-alb> --protocol tcp --port 80 --source-group <sg-gateway>

# app tier: only from the internal ALB, one rule per service port
aws ec2 authorize-security-group-ingress --group-id <sg-app-core> --protocol tcp --port 3000 --source-group <sg-internal-alb>
aws ec2 authorize-security-group-ingress --group-id <sg-app-integrations> --protocol tcp --port 3001 --source-group <sg-internal-alb>
aws ec2 authorize-security-group-ingress --group-id <sg-app-reporting> --protocol tcp --port 3002 --source-group <sg-internal-alb>
# sg-app-automation gets NO ingress rule at all.

# RDS: only from the 4 app SGs
aws ec2 authorize-security-group-ingress --group-id <sg-rds> --protocol tcp --port 3306 --source-group <sg-app-core>
aws ec2 authorize-security-group-ingress --group-id <sg-rds> --protocol tcp --port 3306 --source-group <sg-app-integrations>
aws ec2 authorize-security-group-ingress --group-id <sg-rds> --protocol tcp --port 3306 --source-group <sg-app-reporting>
aws ec2 authorize-security-group-ingress --group-id <sg-rds> --protocol tcp --port 3306 --source-group <sg-app-automation>
```
(Default egress on a new SG is "allow all" — for `sg-app-*` and `sg-rds`,
explicitly revoke the default all-egress rule and add only the narrow rules
in the table above if the client wants egress locked down too; leaving
default egress open is a common, lower-effort compromise since AWS SGs are
stateful and egress-only traffic can't be spoofed inbound — call this out to
the client as a choice, not a silent decision.)

## 3. Compute (EC2)

### 3.1 AMI choice

**Amazon Linux 2023**, justification: first-party AWS AMI (fastest security
patch cadence, SSM Agent preinstalled which simplifies bastion-less shell
access via Session Manager instead of opening SSH/22 to anything), free,
and Docker installs cleanly via `dnf`. Ubuntu would work equally well; AL2023
is picked because it needs zero extra IAM/agent setup for Session Manager
access, which matters since there is deliberately **no bastion host** in
this design (see §4.4).

### 3.2 Instance sizing (judgment call — modest initial load, not over-provisioned)

| Instance | Type | vCPU / RAM | Reasoning |
|---|---|---|---|
| `gateway` | `t3.micro` | 2 / 1 GiB | Pure nginx reverse proxy, negligible CPU/memory. |
| `core-api` | `t3.small` | 2 / 2 GiB | Highest request volume (all CRUD + auth + audit + menu/permissions + search). `t3` burstable covers spiky staff-CRM traffic patterns (business hours) without paying for sustained `m`-class capacity. **Note**: `common`'s `PuppeteerPdfRenderer` (sanction letters etc.) is built but not yet wired into any core-api controller — headless Chromium is memory-hungry (~300-500MB per render). If/when that gets wired in, revisit and likely bump this to `t3.medium` (4 GiB) — not sized for it yet since nothing calls it today. |
| `integrations-api` | `t3.small` | 2 / 2 GiB | Mostly I/O-bound outbound HTTP to vendors, not CPU-heavy — but keeps a second vCPU for concurrent vendor calls (BRE decisioning, eKYC, payments can happen simultaneously across leads). |
| `reporting-api` | `t3.small` | 2 / 2 GiB | CSV/MIS report generation over potentially large result sets (e.g. the 7,922-row pincode table joined against leads) benefits from the extra vCPU/RAM over `t3.micro`. |
| `automation-worker` | `t3.micro` | 2 / 1 GiB | Cron jobs are periodic, not concurrent-user-facing; `InProcessJobRunner` (default, no `REDIS_URL`) runs one job at a time per its cron schedule — light steady-state load. |

**Judgment call, flag to client**: these are starting points sized for "a
handful of concurrent staff users, no public consumer traffic" (this is the
internal CRM, not the customer-facing app — explicitly out of scope per
`CLAUDE.md`). Watch CloudWatch CPU/memory in the first weeks and resize
(`t3.small` → `t3.medium`, etc.) rather than guessing further ahead — EC2
instance type changes are a stop/change-type/start operation, cheap to do
later, expensive to over-provision now speculatively.

### 3.3 Launch the instances

Repeat per instance (5 total), varying subnet/SG/tags:
```
aws ec2 run-instances \
  --image-id <al2023-ami-id> \
  --instance-type t3.small \
  --key-name <your-keypair> \
  --subnet-id <finance-crm-private-app-a-id> \
  --security-group-ids <sg-app-core> \
  --iam-instance-profile Name=finance-crm-core-api-instance-profile \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=finance-crm-core-api}]' \
  --associate-public-ip-address false
```
`gateway` is the one exception: launch it in `finance-crm-public-a`, with
`sg-gateway`, and `--associate-public-ip-address true` (or attach an Elastic
IP afterward so its address survives a stop/start).

Spread the 4 private app instances across both `finance-crm-private-app-a`/`-b` for
basic AZ diversity even though each service is a single instance today (no
ASG yet — see §3.2's "judgment call" — a single-AZ outage on one AZ then
only takes down whichever 2 of the 4 services happen to land there, not
all 4).

### 3.4 Docker install (Amazon Linux 2023)

SSH in (or use `aws ssm start-session --target <instance-id>`, preferred
since it needs no open port 22):
```
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user   # re-login for group to take effect
docker --version
```

### 3.5 Getting the code/image onto the instance

No CI/CD pipeline exists yet (deliberately out of scope — CLAUDE.md's "Monorepo tooling" decision,
"no Nx/Turborepo... doesn't justify the overhead" reflects the same
keep-it-simple stance). Simplest path for a hand-run deploy:

```
sudo dnf install -y git
git clone <repo-url> /home/ec2-user/finance-crm-backend
cd /home/ec2-user/finance-crm-backend
git checkout feature/microservices-migration   # or main, once merged
```
Build context is the **repo root** for all 4 Nest apps (confirmed in
`docker-compose.yml`: `build: {context: ., dockerfile: <name>/Dockerfile}`)
— each `Dockerfile` only `COPY`s `database/`+`common/` + its own `<name>/`, so
building from repo root on each instance (rather than trying to ship a
slimmed-down tree) is correct and matches what compose already does.

Build the image for whichever service this instance runs, e.g. on the
`core-api` instance:
```
docker build -f core-api/Dockerfile -t finance-crm/core-api:$(git rev-parse --short HEAD) .
```
Tag with the git short SHA (not `latest`) — this is what makes rollback
possible later (§8).

### 3.6 Environment file

Create `/home/ec2-user/finance-crm-backend/.env.production` on each instance (never
commit this — same rule as the local `.env`) containing that service's
required vars from §7, with AWS values filled in (RDS endpoint, S3 bucket,
etc.). Lock down permissions: `chmod 600 .env.production`.

### 3.7 `docker run` per service

Translated directly from each `docker-compose.yml` service definition —
same image, same port, same `env_file` pattern, minus compose's internal
DNS (service name → now the RDS endpoint / ALB DNS via env vars) and minus
`depends_on` (there's no local orchestrator now — see §3.8 for the systemd
wrapper that gives an equivalent "start me after the DB is reachable"
behavior).

**core-api** (on the `core-api` instance):
```
docker run -d --name core-api --restart unless-stopped \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -p 3000:3000 \
  finance-crm/core-api:<git-sha>
```

**integrations-api**:
```
docker run -d --name integrations-api --restart unless-stopped \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -p 3001:3001 \
  finance-crm/integrations-api:<git-sha>
```

**reporting-api**:
```
docker run -d --name reporting-api --restart unless-stopped \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -p 3002:3002 \
  finance-crm/reporting-api:<git-sha>
```

**automation-worker**:
```
docker run -d --name automation-worker --restart unless-stopped \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -p 3003:3003 \
  finance-crm/automation-worker:<git-sha>
```

**gateway** (nginx — its `Dockerfile` builds `FROM nginx:alpine`, context is
`gateway/`, no `.env` needed since nginx.conf has no env-var
substitution today):
```
docker build -t finance-crm/gateway:<git-sha> gateway
docker run -d --name gateway --restart unless-stopped \
  -p 443:443 -p 80:80 \
  finance-crm/gateway:<git-sha>
```
`nginx.conf`'s `proxy_pass` targets must be edited before this build to
point at the internal ALB's DNS name instead of `core-api`/`integrations-api`/
`reporting-api` (compose service names only resolve inside a compose
network) — e.g. `proxy_pass http://<internal-alb-dns-name>;` per location
block, keeping the same path-prefix structure. TLS termination (443) also
needs a real cert added to this config (ACM can't attach directly to an EC2
instance the way it can to an ALB — either terminate TLS here with a
cert-manager-issued/purchased cert mounted into the container, or put a
second, internet-facing ALB in front of `gateway` purely for ACM+443
termination if the client would rather not manage certs by hand on the
instance; this second-ALB option is a legitimate alternative to the
gateway-terminates-TLS approach above — flagged as a choice, not decided
here since it changes the topology in §1.5 slightly).

### 3.8 systemd unit wrapper (recommended over a bare `docker run`)

Wrapping each container in a systemd unit gets automatic restart-on-boot and
a normal `systemctl status`/`journalctl` workflow. Example for `core-api`
(`/etc/systemd/system/core-api.service`):
```ini
[Unit]
Description=core-api container
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop core-api
ExecStartPre=-/usr/bin/docker rm core-api
ExecStart=/usr/bin/docker run --name core-api \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -p 3000:3000 \
  finance-crm/core-api:<git-sha>
ExecStop=/usr/bin/docker stop core-api

[Install]
WantedBy=multi-user.target
```
```
sudo systemctl daemon-reload
sudo systemctl enable --now core-api
```
Repeat per service, substituting name/image/port. Note the image tag is
baked into the unit file — bumping it (§8) means editing this file, not
just re-running a command, which is intentional: it makes "what's currently
deployed" grep-able (`systemctl cat core-api | grep docker run`).

## 4. Database (RDS MySQL)

### 4.1 Engine + version

`docker-compose.yml` uses `mysql:8` — match with RDS engine `mysql`,
version `8.0.x` (pick the latest 8.0 minor RDS currently supports at
provisioning time).

### 4.2 Sizing

**Judgment call**: `db.t3.small` (2 vCPU, 2 GiB) to start — this is a
staff-CRM database (49 tables, largest reference table ~8k rows per
`docs/COMPLETED.md`'s Task #41b pincode seed note), not a high-QPS consumer workload. Storage:
20 GiB `gp3` with storage autoscaling enabled up to e.g. 100 GiB (the legacy
UAT dump restored to compare against was ~16 MB compressed SQL; production
data will grow with real lead/loan volume but 20 GiB is a safe starting
allocation with room to autoscale rather than a hard ceiling).

```
aws rds create-db-subnet-group --db-subnet-group-name finance-crm-db-subnet-group \
  --subnet-ids <finance-crm-private-db-a-id> <finance-crm-private-db-b-id> \
  --db-subnet-group-description "FINANCE CRM RDS subnet group"

aws rds create-db-instance \
  --db-instance-identifier finance-crm-prod \
  --db-instance-class db.t3.small \
  --engine mysql \
  --engine-version 8.0 \
  --master-username <admin-username> \
  --master-user-password <use-secrets-manager-or-a-password-manager> \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type gp3 \
  --db-subnet-group-name finance-crm-db-subnet-group \
  --vpc-security-group-ids <sg-rds> \
  --backup-retention-period 7 \
  --db-name finance_crm_backend \
  --character-set-name utf8mb4 \
  --no-publicly-accessible \
  --multi-az
```

### 4.3 Multi-AZ — confirmed on

**Enabled in the command above (`--multi-az`)**. This roughly **doubles**
RDS cost (a synchronous standby in a second AZ) in exchange for automatic
failover on AZ outage/instance failure (typically 60-120s, vs. a manual
restore-from-backup otherwise).

No actual RBI/NBFC regulatory requirement for Multi-AZ is confirmed
anywhere in the codebase or planning docs — the client made this a
deliberate availability decision for a production loan-lifecycle CRM
(leads, disbursal, collections), not a compliance mandate. If cost
pressure ever calls this back into question, it can be turned off as a
modification to the existing instance with no data migration needed:
`aws rds modify-db-instance --db-instance-identifier finance-crm-prod
--no-multi-az`.

### 4.4 Backups

`--backup-retention-period 7` (7 days) above — AWS's own default and a
reasonable starting point for automated point-in-time-recovery backups.
Take a manual snapshot before any risky operation (major migration, engine
version upgrade): `aws rds create-db-snapshot --db-instance-identifier
finance-crm-prod --db-snapshot-identifier <name>-pre-migration`.

### 4.5 Parameter group / character set

`database/src/data-source.ts` doesn't set an explicit `charset`
option on the TypeORM connection — it relies on the `mysql2` driver default.
**Flagging, not silently fixing** (out of scope for a docs-only task and
outside the files this task is scoped to touch): the seed step (see
`docs/TODO.md`'s "Open items", MySQL charset entry) explicitly creates the
local dev database with `CHARACTER SET utf8mb4`
(needed for full-range Unicode — emoji, some regional-language names), but
nothing in the app code enforces the connection itself negotiates
`utf8mb4` rather than falling back to `utf8`/`latin1`. Two independent
things should both be true in production, and only the first is covered by
this runbook:
1. **RDS side (this runbook covers this)**: create a custom DB parameter
   group with `character_set_server=utf8mb4` and
   `collation_server=utf8mb4_general_ci` (or `utf8mb4_0900_ai_ci` if the
   client prefers MySQL 8's newer default collation), and associate it with
   the instance:
   ```
   aws rds create-db-parameter-group --db-parameter-group-name finance-crm-utf8mb4 \
     --db-parameter-group-family mysql8.0 --description "utf8mb4 defaults"
   aws rds modify-db-parameter-group --db-parameter-group-name finance-crm-utf8mb4 \
     --parameters "ParameterName=character_set_server,ParameterValue=utf8mb4,ApplyMethod=pending-reboot" \
                  "ParameterName=collation_server,ParameterValue=utf8mb4_general_ci,ApplyMethod=pending-reboot"
   aws rds modify-db-instance --db-instance-identifier finance-crm-prod \
     --db-parameter-group-name finance-crm-utf8mb4 --apply-immediately
   ```
2. **App side (NOT covered here, flagged for whoever next touches
   `database`)**: `buildDataSourceOptions()` should probably pass
   `charset: 'utf8mb4'` explicitly to TypeORM/`mysql2` so the connection
   itself requests it regardless of server defaults — this is a one-line
   code change outside this task's scope (docs-only, and `database`
   isn't one of the files this task was asked to touch), noted here and in
   `docs/TODO.md`'s "Open items" as a follow-up.

### 4.6 Running migrations against RDS

Schema is plain `.sql` files in `database/sql-migrations/` (`init.sql` +
`m1.sql`, plus any later `mN.sql`), not TypeORM — every file there is also valid to
paste directly into any MySQL client (phpMyAdmin included), not just run
through the CLI below. See `database/src/run-sql-migrations.ts`'s doc
comment for the full `--init`/`--mN`/`--mA-mB` flag reference and how
failure-recovery works (best-effort revert via each `mN.sql`'s paired
`mN.down.sql` — MySQL auto-commits DDL, so there is no real transactional
rollback for schema changes, see that file's header for the full
explanation).

**Decision: run `bun run migrate` as a one-off `docker run` using the
already-built `core-api` image**, from any one of the app EC2 instances
(doesn't matter which — all four services connect to the same shared
database, and `core-api`'s image already bundles `database`
verbatim per its `Dockerfile`'s `COPY packages packages` step). No separate
bastion host, no CI/CD step:

```
docker run --rm \
  --env-file /home/ec2-user/finance-crm-backend/.env.production \
  -w /app/database \
  finance-crm/core-api:<git-sha> \
  bun run migrate
```
(`-w` overrides the image's baked-in `WORKDIR /app/core-api` to
`/app/database`, where `migrate` is actually defined per
`database/package.json`.) `.env.production` must have `DB_HOST`
pointed at the RDS endpoint for this to reach the right database — same env
file the actual `core-api` container uses is fine, no separate migration-only
env file needed. RDS already has real data (it's not a brand-new empty
database), so this is `bun run migrate` alone — no `--init`, that's only
for bootstrapping a schema-less database from scratch.

Justification for "simplest safe option, no bastion, no CI/CD": there's no
CI/CD pipeline in this project by design (CLAUDE.md's "Monorepo tooling" decision), so adding one
solely to run migrations would be new infrastructure just for this step. A
dedicated bastion host is unnecessary extra attack surface/cost when the app
instances already have network access to RDS and already have the exact
Docker image that contains the migration files — reusing that image as a
one-off command is the smallest addition. Run this **once during initial
setup** (before starting any app container) and again **before any deploy
that adds a new `mN.sql`** (check `database/sql-migrations/` diff before
deploying). Every item in an `mN.sql` is idempotent — it checks
`information_schema` and no-ops if already applied — so accidentally
including an already-run range is harmless, just a few redundant checks;
there is still no tracking table, so pass the right `--mN`/`--mA-mB` range
to actually run the new one, rather than relying on re-running everything
every time.

## 5. S3

### 5.1 What the storage adapter needs

Confirmed by reading `common/src/storage/s3-storage.adapter.ts` and
`storage.module.ts`, cross-checked against `.env.example`:
- `STORAGE_DRIVER=s3` (switches `StorageModule`'s factory from
  `LocalDiskStorageAdapter` to `S3StorageAdapter`)
- `AWS_S3_BUCKET` — required (`config.getOrThrow`)
- `AWS_REGION` — required (`config.getOrThrow`), e.g. `ap-south-1`
- `AWS_S3_KEY_PREFIX` — optional, defaults to `upload` (mirrors legacy's
  `folder_name` default)
- **No `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars are read by the
  app at all** — `S3StorageAdapter` constructs `new S3Client({ region })`
  with no explicit credentials, so it relies on the AWS SDK's default
  credential provider chain. In this topology that chain resolves to the
  **EC2 instance profile** (§6) — this is intentional and is why the IAM
  role in §6 matters; there is no credential env var to set here.

### 5.2 Public access — confirmed blocked

Reading `S3StorageAdapter.upload()`: every object is written with
`ACL: 'private'`, and `getUrl()` always returns a **time-limited signed URL**
(`getSignedUrl`, default 900s) rather than a public object URL — there is no
code path that serves a file directly from a public S3 URL. Bucket public
access should be fully blocked:
```
aws s3api create-bucket --bucket <bucket-name> --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-public-access-block --bucket <bucket-name> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket <bucket-name> --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

### 5.3 Bucket policy

No public bucket policy needed at all (access is entirely via the IAM
instance role in §6 + signed URLs) — the "Block all public access" settings
above are sufficient; don't add a bucket policy granting any principal
beyond what §6's IAM role already grants.

## 6. IAM

### 6.1 Scope check — is S3 the only AWS-native integration?

No — `common` also depends on `@aws-sdk/client-secrets-manager` and
`@aws-sdk/client-ssm` (alongside `@aws-sdk/client-s3`/
`@aws-sdk/s3-request-presigner`, used exclusively by `S3StorageAdapter`).
Every one of the 4 NestJS services (`core-api`, `integrations-api`,
`reporting-api`, `automation-worker`) bootstraps `ConfigModule.forRoot({
load: [awsSsmLoader, awsSecretsLoader] })` — see CLAUDE.md's config-chain
architecture-decisions entry — so all 4 need Secrets Manager/SSM read
access, not just the 2 that touch S3. Both loaders use the SDK's default
credential provider chain (no explicit access keys, resolved via the
instance profile below) and both no-op safely (fall through to `.env`) if
the relevant env var naming the secret/path is unset or the call fails —
so attaching the policy is only needed in environments that actually use
this stage of the chain. Email still goes through vendor SMTP/Mailgun
(`SMTP_*` vars), not SES; nothing else in the codebase calls an AWS API
directly.

### 6.2 Judgment call: one shared role vs. per-service roles

**Decision: give all 4 NestJS-service roles the same Secrets Manager/SSM
statement (scoped to this deployment's specific secret/path, not `*`), but
keep the S3 statement on `core-api` and `integrations-api` only.**
`StorageModule`/`S3StorageAdapter` (`common`) started as a `core-api`-only
consumer (sanction-letter endpoint, `docs/COMPLETED.md`'s Task #63), and
`integrations-api`'s `CrifBureauModule` (`docs/COMPLETED.md`'s Task #77)
downloads Surepass's rendered bureau-report PDF and re-uploads it via
`StorageAdapter.upload()`/`.download()` — so per this section's own "extend
this decision when a future task wires storage into a different service"
rule, `integrations-api` needs the same S3 statement `core-api` does.
Least-privilege still means not handing S3 access to
`reporting-api`/`automation-worker`/`gateway` instances, which have no code
path that touches it. `gateway` is pure nginx (no NestJS process, no AWS
SDK), so it gets neither statement.

```
aws iam create-role --role-name finance-crm-core-api-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}]
  }'

aws iam put-role-policy --role-name finance-crm-core-api-role --policy-name finance-crm-s3-access --policy-document '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::<bucket-name>/*"
  }]
}'

# Config chain (§6.1) — scope to this deployment's specific secret and
# parameter path, never "*". Attach to core-api/integrations-api/
# reporting-api/automation-worker's roles (not gateway).
aws iam put-role-policy --role-name finance-crm-core-api-role --policy-name finance-crm-config-chain-access --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:<secret-name>-*"
    },
    {
      "Effect": "Allow",
      "Action": "ssm:GetParametersByPath",
      "Resource": "arn:aws:ssm:<region>:<account-id>:parameter<parameter-path>*"
    }
  ]
}'
# If any SSM parameters under that path are SecureString (KMS-backed),
# also attach a kms:Decrypt statement scoped to that key's ARN — omit
# entirely if every parameter is a plain String.

# SSM Agent access, so Session Manager works without opening SSH (§3.4) —
# attach to every instance's role, not just core-api's.
aws iam attach-role-policy --role-name finance-crm-core-api-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

aws iam create-instance-profile --instance-profile-name finance-crm-core-api-instance-profile
aws iam add-role-to-instance-profile --instance-profile-name finance-crm-core-api-instance-profile --role-name finance-crm-core-api-role
```

Repeat the same commands for `integrations-api`, substituting
`finance-crm-integrations-api-role`/`finance-crm-integrations-api-instance-profile` for the
`core-api` names (same S3 policy document + same config-chain policy
document, same bucket/secret/parameter path).

For `reporting-api` and `automation-worker`, create a role with the SSM
managed policy **and** the config-chain statement, but **no** S3 statement
— e.g. `finance-crm-reporting-api-role`, `finance-crm-automation-worker-role`. `gateway`
gets a role with only the SSM managed policy attached (no S3, no
config-chain statement) — e.g. `finance-crm-gateway-role` — so every instance still
gets Session Manager access without any of them getting permissions they
don't use.

## 7. Environment variables — per service checklist

Built from each service's actual `ConfigService.get()`/`getOrThrow()` calls,
cross-checked against `.env.example`'s inline comments (which already
annotate which service owns which var).

### 7.1 `core-api`
```
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_USERNAME=<app-db-user>          # not the RDS master user — create a
DB_PASSWORD=<app-db-password>      # scoped app-level MySQL user, see note below
DB_DATABASE=finance_crm_backend
JWT_ACCESS_SECRET=<real-secret>
JWT_ACCESS_EXPIRES_IN_SECONDS=900
JWT_REFRESH_EXPIRES_IN_SECONDS=86400
INTERNAL_SERVICE_SECRET=<same value as integrations-api and automation-worker>   # core-api calls integrations-api (LeadsService.selfAllocate -> RUNO)
BCRYPT_SALT_ROUNDS=10
PASSWORD_EXPIRY_DAYS=14             # rolling password-expiry window; matches legacy's LoginController::dashboard()
COOKIE_SECURE=true                 # true in prod — this is served over HTTPS
CORS_ORIGIN=<frontend-prod-origin>
PORT=3000
# Only relevant once file storage/PDF are wired into a core-api controller:
STORAGE_DRIVER=s3
AWS_S3_BUCKET=<bucket-name>
AWS_REGION=ap-south-1
AWS_S3_KEY_PREFIX=upload
PUPPETEER_EXECUTABLE_PATH=<path-to-os-installed-chromium-in-the-image>  # see .env.example's comment: avoids bundling a redundant Chromium download
# Config chain (§6.1/CLAUDE.md) — both optional, leave unset to skip straight
# to .env. AWS_REGION above is reused for both clients.
AWS_SECRETS_MANAGER_SECRET_NAME=<secret name/ARN, e.g. finance-crm/prod>
AWS_SSM_PARAMETER_PATH=<parameter path, e.g. /finance-crm/prod/>
```
(App-level DB user: don't point services at the RDS master user in
production — create a dedicated MySQL user scoped to `finance_crm_backend` only,
`CREATE USER 'finance-crm_app'@'%' IDENTIFIED BY '...'; GRANT ALL PRIVILEGES ON
finance_crm_backend.* TO 'finance-crm_app'@'%';`, connected to as the master user once via
one of the app instances after the security group allows it. Same user/
password go into every service's `DB_*` vars below.)

### 7.2 `integrations-api`
```
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_USERNAME=<app-db-user>
DB_PASSWORD=<app-db-password>
DB_DATABASE=finance_crm_backend
PORT=3001
CORS_ORIGIN=<frontend-prod-origin>   # SharedAuthModule's guard is shared across services
JWT_ACCESS_SECRET=<same value as core-api>   # verification-only, must match the issuer's secret
INTERNAL_SERVICE_SECRET=<same value as core-api and automation-worker>   # verifies HMAC-signed internal calls (JwtAuthGuard's internal-request path) - integrations-api is the only real receiver today
LMS_URL=<frontend-prod-origin>       # used as a callback/redirect base by ekyc.service.ts and esign.service.ts
BRAND_NAME=Finance CRM
FINBOX_DEVICE_CONNECT_URL=<real>
FINBOX_DEVICE_CONNECT_API_KEY=<real>
FINBOX_DEVICE_CONNECT_HASH_KEY=<real>
FINBOX_DEVICE_CONNECT_PREDICTORS_VERSION=1
FINBOX_BUREAU_CONNECT_URL=<real>
FINBOX_BUREAU_CONNECT_API_KEY=<real>
FINBOX_BUREAU_CONNECT_SOURCE_TYPE=<real>
FINBOX_BANK_CONNECT_URL_TEMPLATE=<real, must contain literal "<entity_id>">
FINBOX_BANK_CONNECT_API_KEY=<real>
FINBOX_BANK_CONNECT_HASH_KEY=<real>
RAZORPAY_KEY_ID=<real>
RAZORPAY_KEY_SECRET=<real>
RAZORPAY_API_URL=https://api.razorpay.com/v1/payment_links/
RAZORPAY_CALLBACK_URL=<real prod callback URL>
RAZORPAY_WEBHOOK_SECRET=<real, from the Razorpay dashboard>
ICICI_UPI_MERCHANT_ID=<real>
ICICI_UPI_TERMINAL_ID=<real>
ICICI_UPI_API_KEY=<real>
ICICI_UPI_QR_API_URL=<real>
ICICI_UPI_PUBLIC_KEY=<the PEM itself, NOT a path — see .env.example's PEM note.
#   Key material must not sit on an EC2/ECS filesystem; it lives in Secrets Manager
#   with everything else, so there is nothing to mount and rotation is not a deploy.>
ICICI_UPI_PRIVATE_KEY=<the PEM itself, NOT a path>
SIGNZY_BASE_URL=<real — preproduction URL in .env.example, needs the real production Signzy URL>
SIGNZY_TOKEN=<real>
SUREPASS_CRIF_URL=https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf
SUREPASS_API_TOKEN=<real>
BANK_ANALYSIS_UPLOAD_URL=https://cartbi.com/api/upload
BANK_ANALYSIS_DOWNLOAD_URL=https://cartbi.com/api/downloadFile
BANK_ANALYSIS_API_TOKEN=<real, freshly rotated — do not reuse the plaintext token hardcoded in legacy's integration_config.php>
ENACH_ICICI_MERCHANTID=<real>
ENACH_ICICI_SCHEDULING_URL=<real>
ADJUST_APP_TOKEN=<real>
ADJUST_API_ACCESS_TOKEN=<real>
ADJUST_INSPECT_DEVICE_URL=https://api.adjust.com/device_service/api/v1/inspect_device
APPSFLYER_ANDROID_APP_ID=<real>
APPSFLYER_IOS_APP_ID=<real>
APPSFLYER_EVENT_PUSH_API_KEY=<real>
APPSFLYER_EVENT_PUSH_URL=https://api3.appsflyer.com/inappevent
VAPIO_SMS_API_URL=https://vapio.in/api.php?
VAPIO_USERNAME=<real>
VAPIO_API_KEY=<real>
VAPIO_SENDER_ID=<real>
VAPIO_PE_ID=<real>
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<real>
SMTP_PASS=<real>
EMAIL_FROM=no-reply@financecrm.co.in
WHATSAPP_API_URL=<real, includes account-specific path segment>
WHATSAPP_API_KEY=<real>
TINYURL_API_URL=https://api.tinyurl.com/create
TINYURL_API_TOKEN=<real, freshly rotated — do not reuse the plaintext token hardcoded in legacy's integration_config.php>
# CrifBureauModule downloads and re-stores Surepass's rendered report PDF:
STORAGE_DRIVER=s3
AWS_S3_BUCKET=<bucket-name>
AWS_REGION=ap-south-1
AWS_S3_KEY_PREFIX=upload
# Config chain (§6.1/CLAUDE.md) — both optional, leave unset to skip straight
# to .env.
AWS_SECRETS_MANAGER_SECRET_NAME=<secret name/ARN, e.g. finance-crm/prod>
AWS_SSM_PARAMETER_PATH=<parameter path, e.g. /finance-crm/prod/>
```
**Rotation reminder** (carried over from `docs/COMPLETED.md`'s Phase 4 notes, worth
repeating here since this is the deployment doc): the legacy PHP codebase
had *live* Razorpay, ICICI RSA private key, Signzy, Adjust, AppsFlyer, and
Vapio/Whistle/Sms24hours/Aisensy credentials hardcoded in plaintext. Every
one of those should be a **freshly rotated** credential when filled in here,
not the legacy value copied over.

### 7.3 `reporting-api`
```
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_USERNAME=<app-db-user>
DB_PASSWORD=<app-db-password>
DB_DATABASE=finance_crm_backend
PORT=3002
JWT_ACCESS_SECRET=<same value as core-api>
# Config chain (§6.1/CLAUDE.md) — both optional, leave unset to skip straight
# to .env.
AWS_SECRETS_MANAGER_SECRET_NAME=<secret name/ARN, e.g. finance-crm/prod>
AWS_SSM_PARAMETER_PATH=<parameter path, e.g. /finance-crm/prod/>
```
(Read-only reporting service — no vendor credentials, matches its module
list: MIS reports + CSV exports, permission-gated per report/export type via
`user_export_permission`/`user_mis_permission`, no outbound HTTP calls.)

### 7.4 `automation-worker`
```
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_USERNAME=<app-db-user>
DB_PASSWORD=<app-db-password>
DB_DATABASE=finance_crm_backend
PORT=3003
CORE_API_URL=<internal ALB DNS name, e.g. http://<alb-dns-name>>          # not used directly today (automation-worker reads/writes DB directly per CLAUDE.md) but set for consistency/future use
INTEGRATIONS_API_URL=<internal ALB DNS name>/api/v1/integrations         # IntegrationsApiClient's base — see §1.5/§2, this now resolves through gateway+ALB instead of a compose hostname
INTERNAL_SERVICE_SECRET=<same value as core-api and integrations-api>    # signs every IntegrationsApiClient call - required, the client throws at construction if unset
REDIS_URL=                          # leave blank initially — see §9
# Config chain (§6.1/CLAUDE.md) — both optional, leave unset to skip straight
# to .env.
AWS_SECRETS_MANAGER_SECRET_NAME=<secret name/ARN, e.g. finance-crm/prod>
AWS_SSM_PARAMETER_PATH=<parameter path, e.g. /finance-crm/prod/>
```

### 7.5 `gateway`
No app-level env vars (nginx.conf has no env-var substitution) — only the
AWS-specific pieces from §3.7: a TLS certificate for 443, and `nginx.conf`'s
`proxy_pass` targets edited to point at the internal ALB's DNS name.

### 7.6 New AWS-specific variables this runbook introduces

| Var | Used by | Value |
|---|---|---|
| `DB_HOST` | all 4 DB-connected services | RDS endpoint, from `aws rds describe-db-instances` |
| `AWS_S3_BUCKET` / `AWS_REGION` | `core-api` (once storage is wired in) | the bucket from §5, the region from §1 |
| Internal ALB DNS name | `gateway`'s nginx.conf, `automation-worker`'s `INTEGRATIONS_API_URL`/`CORE_API_URL` | `aws elbv2 describe-load-balancers --names finance-crm-internal-alb --query 'LoadBalancers[0].DNSName'` |
| `AWS_SECRETS_MANAGER_SECRET_NAME` | all 4 NestJS services (§6.1) | the secret name/ARN created for this environment, e.g. `aws secretsmanager create-secret --name finance-crm/prod --secret-string '{"KEY":"value"}'` |
| `AWS_SSM_PARAMETER_PATH` | all 4 NestJS services (§6.1) | the SSM path this environment's parameters were written under, e.g. `aws ssm put-parameter --name /finance-crm/prod/KEY --value <value> --type String` |

`LMS_URL` (integrations-api) should point at the **frontend's** production
origin (it's used as an eKYC/eSign redirect/callback base, not an
inter-backend-service URL) — confirm the actual deployed frontend domain
with whoever owns that deployment; it is not one of this backend's own EC2
instances or the ALB.

## 8. Internal ALB — target groups + listener rules

### 8.1 Target groups (one per routable service — not `automation-worker`)

```
aws elbv2 create-target-group --name tg-core-api --protocol HTTP --port 3000 \
  --vpc-id <vpc-id> --target-type instance \
  --health-check-path /api/v1/health --health-check-interval-seconds 15 \
  --healthy-threshold-count 2 --unhealthy-threshold-count 3

aws elbv2 create-target-group --name tg-integrations-api --protocol HTTP --port 3001 \
  --vpc-id <vpc-id> --target-type instance \
  --health-check-path /api/v1/integrations/health --health-check-interval-seconds 15 \
  --healthy-threshold-count 2 --unhealthy-threshold-count 3

aws elbv2 create-target-group --name tg-reporting-api --protocol HTTP --port 3002 \
  --vpc-id <vpc-id> --target-type instance \
  --health-check-path /api/v1/reporting/health --health-check-interval-seconds 15 \
  --healthy-threshold-count 2 --unhealthy-threshold-count 3
```
Register each instance:
```
aws elbv2 register-targets --target-group-arn <tg-core-api-arn> --targets Id=<core-api-instance-id>
aws elbv2 register-targets --target-group-arn <tg-integrations-api-arn> --targets Id=<integrations-api-instance-id>
aws elbv2 register-targets --target-group-arn <tg-reporting-api-arn> --targets Id=<reporting-api-instance-id>
```

**`core-api` health check — resolved**: `core-api` originally had no
dedicated, unauthenticated `GET /health` route at all — unlike
`reporting-api`/`integrations-api`/`automation-worker`, which each got one
in their scaffolding tasks. This was fixed during Task #61's merge review
(`AppController` now exposes `@Public() GET /api/v1/health`, matching the
other three services' pattern), so the target group above points at that
real endpoint with a plain `200` matcher — no workaround needed.

### 8.2 Internal ALB

```
aws elbv2 create-load-balancer --name finance-crm-internal-alb --scheme internal \
  --subnets <finance-crm-private-app-a-id> <finance-crm-private-app-b-id> \
  --security-groups <sg-internal-alb> --type application
```

### 8.3 Listener + path-based rules (mirrors `nginx.conf` exactly)

Default action = `core-api` (matches nginx's `location /` catch-all):
```
aws elbv2 create-listener --load-balancer-arn <alb-arn> --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=<tg-core-api-arn>
```
Then two path-based rules, higher priority (lower number) evaluated first —
order doesn't matter here since the two prefixes don't overlap, but pick
1/2 anyway:
```
aws elbv2 create-rule --listener-arn <listener-arn> --priority 1 \
  --conditions Field=path-pattern,Values='/api/v1/integrations/*' \
  --actions Type=forward,TargetGroupArn=<tg-integrations-api-arn>

aws elbv2 create-rule --listener-arn <listener-arn> --priority 2 \
  --conditions Field=path-pattern,Values='/api/v1/reporting/*' \
  --actions Type=forward,TargetGroupArn=<tg-reporting-api-arn>
```
This exactly reproduces `nginx.conf`'s 3 `location` blocks: integrations
prefix → its target group, reporting prefix → its target group, everything
else (including core-api's unversioned `/api/signin` etc.) → the default
action.

## 9. Deployment / update process

Hand-rollout to an existing instance (no CI/CD, matches this runbook's
"executed by hand" stance throughout):

1. `git pull` (or `git fetch && git checkout <new-sha>`) on the instance.
2. Rebuild the image with the new SHA as its tag:
   `docker build -f core-api/Dockerfile -t finance-crm/core-api:<new-sha> .`
   (repeat the equivalent for whichever service this instance runs).
3. If `database/src/migrations/` has a new file since the last
   deploy, run it first (§4.6), **before** starting the new container —
   TypeORM migrations here are additive schema changes; running them ahead
   of the new code (which expects the new schema) is safe, running the new
   code before the migration is not.
4. Update the systemd unit's `ExecStart` line (§3.8) to reference the new
   image tag, then:
   ```
   sudo systemctl daemon-reload
   sudo systemctl restart core-api
   ```
   (or, without systemd: `docker stop core-api && docker rm core-api &&
   docker run -d --name core-api ... finance-crm/core-api:<new-sha>`)
5. **Confirm health before considering the deploy complete**: check the
   target group's health state in the ALB console/`aws elbv2
   describe-target-health --target-group-arn <tg-arn>` shows `healthy`, and
   `curl` the service's own health path directly against the instance's
   private IP (bypassing the ALB) as a second confirmation.

### Rollback

Keep at least the previous image tag on the instance (`docker images
finance-crm/core-api` — don't `docker image prune` tags you might need). If the new
deploy fails its health check, revert the systemd unit's `ExecStart` back to
the previous tag and `systemctl restart` — this is why §3.5/§8's tagging
scheme uses git SHAs rather than `latest`: `latest` gives you nothing to
roll back *to* once overwritten.

### 9.1 One-time cutover: migrating `api_whatsapp_logs` into `whatsapp_logs`

`WhatsappLog` (`database/src/entities/integrations/whatsapp-log.entity.ts`)
was originally mapped onto legacy `api_whatsapp_logs` under an assumed
`whatsapp_*` column shape; a real prod schema export later showed that
table's actual columns are `msg_*`, unrelated to what the entity expected.
Rather than remap onto legacy's `msg_*` names, the entity now points at a
clean new table (`whatsapp_logs`, `wa_*` columns, created by the standard
migration like any other NEW table). The old `api_whatsapp_logs` table
still holds real historical log rows in production, though, and this repo
has no live connection to production to script that copy automatically —
so it's a **manual, one-time step to run once, by hand, against the real
production database**, after the migration that creates `whatsapp_logs`
has run there but before (or immediately after) cutting the new backend
over:

```sql
INSERT INTO whatsapp_logs
  (wa_log_id, wa_lead_id, wa_user_id, wa_provider, wa_created_on)
SELECT
  msg_log_id, msg_lead_id, msg_user_id, msg_provider, msg_api_request_datetime
FROM api_whatsapp_logs;

-- Only after confirming the row count matches and spot-checking a few rows:
DROP TABLE api_whatsapp_logs;
```

Only `wa_log_id`/`wa_lead_id`/`wa_user_id`/`wa_provider`/`wa_created_on`
have a direct counterpart in the old table's real columns (confirmed
against the prod schema export — see `docs/SCHEMA-MAP.md`'s `whatsapp_logs`
row); `wa_type_id`/`wa_mobile`/`wa_template_id`/`wa_request`/`wa_response`/
`wa_api_status_id`/`wa_errors` have no old-table equivalent and stay
`NULL` for migrated rows. `wa_log_id` is an `AUTO_INCREMENT` PK — inserting
explicit values for it works in MySQL as long as `whatsapp_logs` is empty
beforehand (run this before the new backend writes any real rows there).
Do this once per environment (dev, then prod) as part of that
environment's first deploy of the backend version containing this table;
skip it entirely for a brand-new environment that never had legacy's PHP
app running against it (nothing to migrate from).

## 10. Redis (optional — not required for initial launch)

`common/src/jobs/job-runner.module.ts` defaults to
`InProcessJobRunner` (`@nestjs/schedule`, in-memory, single-instance-safe)
and only switches to `BullMqJobRunner` (Redis-backed, retries, concurrency
control, safe across multiple `automation-worker` replicas) when
`REDIS_URL` is set — this toggle already exists in the code and needs no
new deployment work to *use*, only to *enable*.

**This is genuinely optional infrastructure for initial launch** — a single
`automation-worker` instance (as deployed in §3) has no concurrency problem
for the job runner to solve; BullMQ's value shows up once there's more than
one `automation-worker` instance (needing distributed locking so two
replicas don't both run the same cron job) or a need for job retries/backoff
that `InProcessJobRunner` doesn't provide.

**When to add it**: if/when the client decides to scale `automation-worker`
beyond one instance, or wants retry/observability on failed jobs (e.g. a
failed SMS reminder push silently not retrying today).

**How to add it then**:
```
aws elasticache create-cache-cluster --cache-cluster-id finance-crm-redis \
  --engine redis --cache-node-type cache.t3.micro --num-cache-nodes 1 \
  --cache-subnet-group-name <a subnet group over the private app subnets> \
  --security-group-ids <a new sg-redis, ingress 6379 from sg-app-automation only>
```
Then set `REDIS_URL=redis://<elasticache-endpoint>:6379` in
`automation-worker`'s `.env.production` and restart it — no code change,
no other service needs to know about Redis (only `automation-worker` injects
`JOB_RUNNER`/imports `JobRunnerModule`). `cache.t3.micro`, single node, no
replication/Multi-AZ — this is a job queue backing store, not
customer-facing data; if that changes (e.g. Redis starts holding anything
more valuable than transient job state), revisit sizing then.
