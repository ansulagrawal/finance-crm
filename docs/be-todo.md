# Backend Migration TODO

Everything already built/decided is in `docs/COMPLETED.md`. Legacy
functionality reviewed and deliberately excluded is in `docs/EXCLUDED.md`.
This file only tracks what's still actually open.

## Open items

- **Live QA pass in progress against `https://crm.financecrm.com/`
  (2026-08-11/12, `docs/COMPLETED.md` Task #168).** Sixteen real bugs
  found and fixed so far: vendor-call status always showing "failed", a
  null-date display bug, wrong rejected-leads count/pagination, reject
  not actually changing a lead's status, the unreachable "Claim leads"
  UI (plus the `CR2`/`DS1` queue-scope gap it depends on), a 500 in
  the Audit queue for every non-`AH` auditor, `CO2` seeing every lead
  in the system instead of a real collections queue, the Users/Leads
  search boxes not matching email/mobile despite their own placeholder
  text (plus a same-day production regression in the fix, caught and
  reverted within minutes), the "Override CAM detail" support modal's
  Save button getting silently stuck disabled, a 500 on the
  sanction-letter PDF caused by Chrome's sandbox failing to start on
  this host (`docs/COMPLETED.md` Task #170), four role-access gaps
  found while mapping the remaining untested roles — `ST` losing legacy
  access to the eKYC/eSign reset toolkit, the KYC-docs zip download
  having no role gate at all (legacy restricted it to `LD1`), `SA`'s
  sidebar not showing two nav items it can actually use, and search
  results never masking email/mobile for `OL` the way legacy did — and
  a 500 whenever re-granting any role a user previously held (found by
  accident while restoring the test account's role after testing the
  four above; `docs/COMPLETED.md` Task #173). Backend fixes
  are deployed to the EC2 dev box. Frontend fixes were committed and
  confirmed via a local dev server pointed at the EC2 API
  (`core-crm/.env.local` → `https://api.financecrm.com`) before the
  client redeployed the actual Cloudflare-fronted frontend
  (2026-08-12) — all frontend fixes from this pass are now live there
  too. Multi-role testing is underway using `it@financecrm.com`
  (`DevTest@2026`, all 23 roles) to grant one role at a time to
  `user@example.com` and re-test — done: `AF`, `CR1`, `CR2`,
  `CR3`, `CO1`, `CO3`, `DS1`, `AU`, `AM`, `AH`, `DS2`, `CA`, `CO2`,
  `CFE1`, `LD1`, `SA`, `ST`, `AC1`, `CO4`. `AC1`/`CO4` were verified at
  the API level (not a full browser click-through): `CO4` creating a
  payment without `remarks` correctly 400s ("SCM Remarks is
  required."), with `remarks` it succeeds; `CO4` trying to verify a
  payment correctly 403s (wrong role); `AC1` verifying without
  `closureRemarks` correctly 400s ("OPs Remarks is required."), with
  it supplied the verify succeeds, and the existing
  cannot-verify-your-own-payment segregation-of-duties check was
  confirmed still intact throughout. Still to test: `AC2`, `MR`, `OL`,
  `CC` — all four are confirmed via code/legacy research to have no
  distinct behavior of their own (generic nav only) except `OL`'s
  search-masking, which is already live-verified via `curl`. Live
  browser sessions for these four would only confirm "loads without
  crashing," not exercise any real feature.
  The full lead lifecycle (new lead →
  screener → credit/BRE/CAM → sanction → disbursal → disbursed loan)
  was also walked end-to-end live (2026-08-12) — collection-stage
  behavior (DPD tracking, followups) still untested since it needs a
  loan with a real elapsed repayment schedule, which synthetic same-day
  test data can't produce.
  The search-placeholder audit the client asked for (sweep every search
  input's placeholder against what its backend query actually filters
  on) is done — see Task #168's write-up for the full list checked.

- **Vendor webhooks are not registered anywhere yet (2026-08-10).** The dev
  box now has a publicly trusted URL (`https://api.financecrm.com`, fronted
  by Cloudflare), so the four unsigned callbacks can finally be pointed at it.
  `VENDOR_CALLBACK_TOKEN` already holds a real value but must also be
  configured on each vendor as the `x-callback-token` header (or `?token=`):
  Signzy video-KYC and eSign, CartBI bank-analysis and account-aggregator.
  Until then `VendorCallbackTokenGuard` rejects them all and eKYC/eSign
  completion never lands. Razorpay additionally needs
  `RAZORPAY_WEBHOOK_SECRET`, still blank, so payment callbacks are unverified.

- **The dev box carries a LIVE Razorpay key (2026-08-10).** `rzp_live_…` was
  supplied deliberately and is in `finance-crm/dev`; any payment link created from
  this environment is real and charges real money. Swap for `rzp_test_…` keys
  as soon as they exist.

- **CRITICAL — ICICI's production private key is committed in the legacy
  repo (2026-08-07, found while scoping the disbursal port).**
  `old-php-files/application/prod_private.key` is a real 3272-byte PKCS#8
  RSA **production private key**, alongside `prod_public_icici.txt` and
  `prod_public_key_collection_icici.pem` (both genuine ICICI certificates).
  That private key decrypts ICICI bank-payment responses, and anyone with
  repo access has it. **Rotate it with ICICI**, and keep the replacement out
  of source control — `backend/.gitignore` already excludes `/keys/`,
  `*.pem` and `*.key` for exactly this reason, and the new backend reads its
  ICICI UPI key from `ICICI_UPI_PRIVATE_KEY` — the PEM value out of
  Secrets Manager/`.env`, never a file on disk (Task #152).
  Independent of whether the disbursal API is ever ported; do this
  regardless. **Note (2026-08-07):** this same key is now also the value of
  `ICICI_UPI_PRIVATE_KEY` *and* `ICICI_DISBURSAL_PRIVATE_KEY` in
  `secret.dev.json`/`secret.prod.json` — one key decrypts both the UPI and the
  disbursal responses. That was done so the system can actually run, and it
  does not reduce the exposure: rotating it is still the fix, and the
  replacement goes into those files (and Secrets Manager), not onto disk.

- **Verify the ICICI disbursal port against a real sandbox before enabling it
  (2026-08-07, `docs/COMPLETED.md` Task #150).** The port is written and unit-
  tested, but **no part of it has ever spoken to ICICI** — there was no sandbox
  or credential available. It is inert until `ICICI_DISBURSAL_*` is configured,
  and offline/manual disbursal is unaffected. Before switching a real
  environment to `paymentMode: ONLINE`:
  - Confirm the response envelope's IV handling. `decryptResponse` accepts both
    a populated `iv` field and an IV prepended to the ciphertext, because
    legacy's encrypt and decrypt sides disagreed about which it was and the
    sample response in the legacy source shows `"iv": ""`. One of those two
    branches is dead in reality — find out which.
  - Confirm the success shape. IMPS success is read as `ActCode == 0 &&
    success == true && BankRRN` present, taken from legacy plus its sample
    response.
  - Confirm `tranRefNo` really is ICICI's idempotency key. The whole
    no-double-payment design assumes re-sending the same `tranRefNo` cannot
    produce a second transfer. If it can, the retry story needs rethinking.
  - Do a sandbox run of the UNKNOWN path (kill the connection mid-call) and
    check `/icici-disbursement/status` resolves it, since that is the only
    sanctioned way out of a pending transaction.

- **Name the people allowed to disburse on PROD (dev already seeded,
  2026-08-12).** Legacy's five hardcoded user-ids
  (`37, 31, 69, 83, 115`, `payday_disbursement_icici_helper.php:159`) were
  checked against the dev DB — all five still resolve to real, active,
  non-deleted staff (Vinay/Vikrant/Shobhna/Soni/Yogesh) — and granted via the
  real `POST /disbursal-authorised-users/:userId` endpoint (not by
  hand-editing the table), at the client's explicit instruction to do dev
  now and decide prod separately. **Still outstanding: prod.** Whenever a
  prod environment exists, this needs the client's own answer for prod
  staff — the dev grant is not evidence for what prod should have, since
  prod may have different/additional staff. Not urgent while online
  disbursal stays inert (`docs/TODO.md`'s ICICI-sandbox item below).

- **Deployment actions outstanding from the security review** (not code —
  things an operator must do, `docs/COMPLETED.md` Tasks #142-#146):
  - ~~Run `bun run migrate` (i.e. `--m1`) against dev/UAT.~~ **Confirmed
    done (2026-08-12):** queried the live Hostinger DB directly —
    `disbursal_authorised_users` and `password_reset_requests
    .otpAttemptCount` both already exist. Not yet run against a real
    `prod` environment, since none exists yet (only `finance-crm/dev` is
    registered in Secrets Manager; `secret.prod.json` is a local
    reference file for whenever prod actually gets stood up).
  - ~~Generate real `JWT_ACCESS_SECRET` and `INTERNAL_SERVICE_SECRET`~~ —
    **done 2026-08-07**: both, plus `VENDOR_CALLBACK_TOKEN`, are now real
    32-byte random values in `secret.dev.json`/`secret.prod.json`. Services
    **refuse to boot** on the `changeme` placeholder or anything under 32 chars
    outside `NODE_ENV=development`, so this had to be settled rather than left
    for the client. Still deploy them via Secrets Manager, not a checked-in file.
  - ~~Set `TRUSTED_PROXY_HOPS` to the real number of proxies~~ — **confirmed
    already correct (2026-08-12):** `finance-crm/dev`'s live secret has `"3"`
    (Cloudflare + ALB + gateway); `secret.prod.json` has `"2"`.
  - ~~Confirm `COOKIE_SECURE` is not set to `false`~~ — **confirmed
    (2026-08-12):** both `finance-crm/dev`'s live secret and `secret.prod.json`
    have `"true"`.
  - Configure `VENDOR_CALLBACK_TOKEN`'s value **on the vendor side** — Signzy
    (video-KYC, eSign) and CartBI (bank-analysis, account-aggregator). The
    value now exists, but those four callbacks **reject every request** until
    each vendor sends it back. By design, and it means they stay down until
    this is done. Needs someone with access to those vendor dashboards —
    not something this session can do.
  - Rotate the live third-party credentials still sitting hardcoded in
    `old-php-files/` — see `docs/EXCLUDED.md`'s note. Removing a vendor
    from this codebase does not revoke its key. Needs vendor-side
    coordination — not something this session can do.

- **Collection followup SMS/email template content still isn't seeded
  anywhere, and the client needs to supply it directly.**
  `CollectionController::get_followup_template_lists()` is ported
  (`CollectionService.listFollowupTemplates()`/
  `renderFollowupTemplateContent()`, `core-api`), backed by real
  `master_sms_template`/`master_email_template` entities (`SmsTemplate`/
  `EmailTemplate`). The client's 2026-08-03 ask — check whether real
  content already exists in prod before asking them to write copy — is
  now fully answered (`docs/COMPLETED.md` Task #169): no usable content
  exists. `master_sms_template` has only 2 generic OTP-send rows;
  `master_email_template` doesn't exist as a table at all; a decoy
  `master_templates` table with real-looking rows turned out to be
  dead/vestigial (never referenced in legacy PHP). Nothing left to
  discover by querying — blocked purely on the client supplying real
  template copy.
