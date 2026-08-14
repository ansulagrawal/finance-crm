# Dev deployment — local → EC2 over SSH

> This is the generic procedure. For the box that was actually built
> (`203.0.113.10`, `/opt/crm`, Secrets Manager `finance-crm/dev`, host-nginx TLS) and
> the problems hit on the way, see **`EC2-DEV-DEPLOYMENT.md`** — that one is
> the as-built record and supersedes this file wherever the two disagree.

Single-instance dev deployment: one fresh EC2 box running the 5 app services
via the existing `docker-compose.yml`, code pushed from your local machine
over SSH/rsync, built and run on the box. MySQL is NOT part of this stack —
it's an existing external server this deployment points at via `DB_HOST`
(steps 7/10). No CI/CD, no migrations step (run those yourself separately
when you actually need schema), no RDS/ALB/multi-instance topology — that's
`DEPLOYMENT.md`, the production runbook. This is the fast dev loop: rsync
code up, `docker compose up --build`, done.

## 0. What this deploys

Everything `docker-compose.yml` already brings up, on one box:

| Service | Container port | Reachable via |
|---|---|---|
| `gateway` (nginx) | 80 → published `8080` | `http://<instance-ip>:8080/` |
| `core-api` | 3000 | through gateway, or `docker compose exec`/SSH tunnel |
| `integrations-api` | 3001 | through gateway at `/api/v1/integrations/*` |
| `reporting-api` | 3002 | through gateway at `/api/v1/reporting/*` |
| `automation-worker` | 3003 | no public routes |

`mysql` is NOT part of this stack — this deployment points at an existing
external MySQL server via `DB_HOST` (step 8/10), not the `mysql` service in
`docker-compose.yml`. The security group's default outbound-all-allowed rule
covers the EC2 -> DB direction; the external server's own firewall/security
group must separately allow inbound from this instance's IP on its DB port.

## 1. Prerequisites (local machine)

- AWS CLI configured (`aws sts get-caller-identity` works) with permissions
  to create EC2/IAM/Secrets Manager/SSM resources.
- `rsync` installed locally.
- A target AWS region/VPC — this doc uses your account's **default VPC**
  (simplest for a single dev box; skip building custom subnets, that's only
  needed for the multi-AZ production topology in `DEPLOYMENT.md`).
- The box already has an `ansul` user with password SSH login working
  (existing setup, not covered by this doc). All SSH/rsync/scp commands
  below authenticate as that user — step 5a authorizes your local SSH key
  for it once so the rest of the commands need no password prompt and no
  extra tooling (`ssh-copy-id` ships with OpenSSH).

## 2. SSH key pair

EC2 still requires a key pair to launch the instance (fallback/console
access) even though day-to-day SSH below uses `ansul`/password:
```bash
aws ec2 create-key-pair --key-name finance-crm-dev-key \
  --query 'KeyMaterial' --output text > ~/.ssh/finance-crm-dev-key.pem
chmod 400 ~/.ssh/finance-crm-dev-key.pem
```

## 3. Security group

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
MY_IP=$(curl -s https://checkip.amazonaws.com)/32

SG_ID=$(aws ec2 create-security-group --group-name finance-crm-dev-sg \
  --description "Finance CRM dev box" --vpc-id "$VPC_ID" --query GroupId --output text)

aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MY_IP"
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 8080 --cidr "$MY_IP"
```
(22 for SSH, 8080 for hitting `gateway` — the only port `docker-compose.yml`
publishes to the host. Add 3000-3003 too if you want to hit a service
directly without going through nginx while debugging.)

## 4. IAM role — SSM access + the config chain (both stages, as requested)

One role, attached to the instance, covering:
- `AmazonSSMManagedInstanceCore` — lets you `aws ssm start-session` into the
  box without needing port 22 open at all (SSH above still works too; this
  is just the AWS-native alternative).
- `secretsmanager:GetSecretValue` + `ssm:GetParametersByPath` scoped to this
  dev environment's secret/path — so the app's own config chain
  (`awsSsmLoader`/`awsSecretsLoader`, see `CLAUDE.md`) can resolve values
  from both, exactly as it does in production.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1

aws iam create-role --role-name finance-crm-dev-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [{"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}]
}'

aws iam attach-role-policy --role-name finance-crm-dev-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

aws iam put-role-policy --role-name finance-crm-dev-role --policy-name finance-crm-config-chain-access --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {\"Effect\": \"Allow\", \"Action\": \"secretsmanager:GetSecretValue\", \"Resource\": \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:finance-crm/dev-*\"},
    {\"Effect\": \"Allow\", \"Action\": \"ssm:GetParametersByPath\", \"Resource\": \"arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/finance-crm/dev/*\"}
  ]
}"

aws iam create-instance-profile --instance-profile-name finance-crm-dev-instance-profile
aws iam add-role-to-instance-profile --instance-profile-name finance-crm-dev-instance-profile --role-name finance-crm-dev-role
```

## 5. Launch the EC2 instance (t3a.xlarge)

```bash
AMI_ID=$(aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text)
SUBNET_ID=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
  --query 'Subnets[0].SubnetId' --output text)

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type t3a.xlarge \
  --key-name finance-crm-dev-key \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SG_ID" \
  --iam-instance-profile Name=finance-crm-dev-instance-profile \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":40,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=finance-crm-dev}]' \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "$IP"
```
(40 GiB gp3 root volume — default 8 GiB is tight once you've got 5 built
Docker images on the same disk, even without a local MySQL volume. `t3a.xlarge`
= 4 vCPU / 16 GiB, plenty of headroom to build and run all 5 services on one
box for dev.)

## 5a. Authorize your SSH key for `ansul` (one-time)

```bash
ssh-copy-id ubuntu@"$IP"     # prompts for ansul's password once
```
Every SSH/rsync/scp command from here on connects key-based, no password
prompt and no `sshpass`. If `ansul` doesn't have a `~/.ssh` directory yet on
a truly fresh box, `ssh-copy-id` creates it.

## 6. Install Docker on the instance

```bash
ssh ubuntu@"$IP" '
  sudo dnf update -y &&
  sudo dnf install -y docker git rsync &&
  sudo systemctl enable --now docker &&
  sudo usermod -aG docker ansul &&
  DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d"\"" -f4) &&
  sudo curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/libexec/docker/cli-plugins/docker-compose &&
  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose &&
  docker compose version
'
```
Re-SSH after this (the `ansul` group change needs a fresh session).

## 6a. Create the deploy directory

`/opt` requires root to create; `ansul` owns it from here on:
```bash
ssh ubuntu@"$IP" 'sudo mkdir -p /opt/crm-backend && sudo chown ansul:ansul /opt/crm-backend'
```

## 7. AWS Secrets Manager — dev secret

One secret holding config as flat JSON. `awsSecretsLoader`/`awsSsmLoader`
merge whatever keys you give them with no allowlist — any key from
`.env.example` can go here, not just credentials. The only things that
CANNOT live here are `AWS_SECRETS_MANAGER_SECRET_NAME`/
`AWS_SSM_PARAMETER_PATH`/`AWS_REGION` themselves (read from real `.env`
before the loaders can even run) — everything else, including `DB_HOST` now
that MySQL is external rather than compose-managed, is fair game:
```bash
aws secretsmanager create-secret --name finance-crm/dev --secret-string '{
  "DB_HOST": "<external-db-host>",
  "DB_PORT": "3306",
  "DB_USERNAME": "<dev-db-username>",
  "DB_PASSWORD": "<dev-db-password>",
  "DB_DATABASE": "finance_crm_backend",
  "JWT_ACCESS_SECRET": "<dev-jwt-secret>",
  "INTERNAL_SERVICE_SECRET": "<dev-internal-secret>"
}'
```
Prefer a JSON file over inline `--secret-string` once you're adding more than
a couple of keys (e.g. every vendor credential, which lives in
`FINANCE-CRM/secret.dev.json` / `FINANCE-CRM/secret.prod.json` — never in this repo)
— keeps the values out of shell history: `--secret-string file:///path/to/secret.json`.

## 8. AWS SSM Parameter Store — dev parameters

Same values, alternate path (SSM entries here win over the same key in
Secrets Manager and both win over `.env` — see `CLAUDE.md`'s config-chain
decision: `load: [awsSsmLoader, awsSecretsLoader]`, later entries win on a
clash, so put here whatever should override the secret above):
```bash
aws ssm put-parameter --name /finance-crm/dev/COOKIE_SECURE --value "false" --type String
aws ssm put-parameter --name /finance-crm/dev/CORS_ORIGIN --value "http://localhost:5173" --type String
```
Both stages are optional per-key — anything not present in SSM or Secrets
Manager falls straight through to `.env` (step 10). For a first dev
deployment it's fine to lean on `.env` for everything and only put a couple
of values in SSM/Secrets Manager to prove the chain resolves — that's the
point of wiring both up here.

## 9. Push code to the instance (rsync over SSH)

From the repo root, locally. Excludes cover everything the Docker builds and
running containers never touch — dev tooling and docs, not just build
artifacts:
```bash
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.git' --exclude 'old' --exclude '/storage' \
  --exclude 'docs' --exclude 'README.md' --exclude '.claude' --exclude '.husky' \
  ./ ubuntu@"$IP":/opt/crm-backend/
```

## 10. Push `.env` to the instance

Copy your local `.env` (or a dev-specific variant) up, then point it at the
secret/path from steps 7-8:
```bash
scp .env ubuntu@"$IP":/opt/crm-backend/.env
ssh ubuntu@"$IP" '
  cd /opt/crm-backend &&
  sed -i "s|^AWS_SECRETS_MANAGER_SECRET_NAME=.*|AWS_SECRETS_MANAGER_SECRET_NAME=finance-crm/dev|" .env &&
  sed -i "s|^AWS_SSM_PARAMETER_PATH=.*|AWS_SSM_PARAMETER_PATH=/finance-crm/dev/|" .env &&
  sed -i "s|^AWS_REGION=.*|AWS_REGION=ap-south-1|" .env &&
  sed -i "/^DB_HOST=/d; /^DB_PORT=/d; /^DB_USERNAME=/d; /^DB_PASSWORD=/d; /^DB_DATABASE=/d" .env &&
  chmod 600 .env
'
```
No DB values in `.env` at all, and `docker-compose.yml` doesn't set `DB_HOST`
either — every `DB_*` key only ever comes from the secret. `ConfigService`'s
`load` factories win over `.env`/`process.env` unconditionally
(`core-api/src/app.module.ts:29-33`), so normal operation is unaffected; if
Secrets Manager is ever unreachable, each service falls back to its own
hardcoded default (`config.get('DB_HOST', 'localhost')`) — an obvious
connection error rather than a silently wrong host.

## 11. Build and run everything

```bash
ssh ubuntu@"$IP" '
  cd /opt/crm-backend &&
  docker compose up -d --build --no-deps core-api integrations-api reporting-api automation-worker gateway
'
```
Builds all 5 Nest/nginx images from source on the box and starts just those
5 — `--no-deps` skips `docker-compose.yml`'s local `mysql` service entirely
(each app service's `depends_on: mysql` would otherwise force it to start),
since this deployment connects to the external DB from step 7/10 instead.
No migration step here either way — run one yourself when you actually need
schema.

## 12. Verify

```bash
ssh ubuntu@"$IP" 'cd /opt/crm-backend && docker compose ps'
curl http://"$IP":8080/api/v1/health
```
Tail logs for any service that isn't healthy:
```bash
ssh ubuntu@"$IP" 'cd /opt/crm-backend && docker compose logs -f core-api'
```

## 13. Redeploying after a code change

Repeat steps 9 and 11 — `rsync --delete` only transfers changed files,
`docker compose up -d --build` only rebuilds images whose build context
changed and only restarts the containers that changed:
```bash
rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'old' --exclude '/storage' \
  --exclude 'docs' --exclude 'README.md' --exclude '.claude' --exclude '.husky' \
  ./ ubuntu@"$IP":/opt/crm-backend/
ssh ubuntu@"$IP" 'cd /opt/crm-backend && docker compose up -d --build --no-deps core-api integrations-api reporting-api automation-worker gateway'
```

## 14. Stop/terminate when done (dev box, avoid leaving it running)

```bash
aws ec2 stop-instances --instance-ids "$INSTANCE_ID"      # keep the disk, pay only for EBS
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"  # tear down entirely
```
