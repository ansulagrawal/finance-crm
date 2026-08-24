# Third-Party Integrations Inventory (from `../old-php-files`)

Catalog of every third-party service the legacy PHP CRM calls, extracted from `application/` (controllers, models, helpers) and `components/includes/integration/*.php` (pulled in via `components/CommonComponent.php`, which is `require_once`'d by the cron controllers). Credentials resolve through `integration_config()` — two copies exist: `components/includes/integration/integration_config.php` and `application/helpers/integration/integration_config_helper.php` — env-gated by `ENVIRONMENT`. Config var names are listed, never actual secret values.

Many files exist in dated/`_old` duplicates; only the file(s) actually wired via a live call site are listed as "live" — others are flagged **dormant/dead** at the end of each entry where relevant. This inventory is meant to seed the `integrations-api` module list (one module per vendor per the architecture in `CLAUDE.md`) — vendors flagged dormant should be confirmed with the team before porting.

---

## Bureau / Credit Check

### Surepass (live — primary bureau path)
- **Purpose**: CRIF credit report fetch (bureau check on new/existing leads).
- **Endpoints**:
  - `POST https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report`
  - `POST https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf`
- **Auth**: `Authorization: Bearer <ApiToken>` (JWT)
- **Request payload**: `{ first_name, last_name, mobile, pan, consent: "Y", raw: true }`
- **Response fields**: `status_code`, `data.credit_report.SCORES.SCORE.SCORE-VALUE`, `data.credit_report_link`
- **Files**: `components/includes/integration/payday_surepass_crif_api.php`, wired via `CommonComponent::call_surepass_bureau_api()` → `application/controllers/CibilController.php:37` (`index()`).

### CRIF direct (dead)
- **Purpose**: Direct CRIF bureau call (bypassing Surepass), XML/JSON to a company relay.
- **Endpoints**: `crif.salaryontime.in` (or a placeholder `example.com` URL in some config paths).
- **Files**: `payday_crif_api.php` (`crif_bureau_api_call()` / `crif_bureau_json_api_call()`).
- **Status**: `CommonComponent::call_bureau_api()` has zero callers under `application/` — fully dead.

### CIBIL/TransUnion direct SOAP (dead/legacy)
- **Purpose**: Legacy direct CIBIL bureau call via SOAP.
- **Endpoint**: `www.dc.transuniondecisioncentre.co.in/.../ExternalSolutionExecution.svc`, SOAP action `SolutionExecution` / `ExecuteXMLString`.
- **Auth**: Hardcoded credentials (not env-driven).
- **File**: `application/controllers/CibilController.php::old_index()`.
- **Status**: not called from the live `index()` path — dead.

### CIBIL REST (config-only, unconfirmed live)
- **Purpose**: REST alternative to the SOAP CIBIL path.
- **Endpoint**: `POST https://api.transunioncibil.com/acquire/credit-assessment/v1/consumer-cir-cv`
- **Env vars**: `CIBIL_CALL_UserName`, `CIBIL_CALL_UserPassword`, `CIBIL_CALL_ApiKey`, `CIBIL_CALL_ClientSecret`, `CIBIL_CALL_ApiMemberId`
- **File**: `payday_crif_api.php::cibil_api_call()` (config type `CIBIL_CALL`).
- **Status**: needs team confirmation — no confirmed live call site found.

### Signzy-bridged CRIF (alt path, dead)
- **Purpose**: CRIF bureau fetch proxied through Signzy's encrypt/consent/decrypt flow.
- **Endpoints**: `api.signzy.app` — `v3/test-encrypt-data`, `v3/create-bureau-consent`, `v3/test-decrypt-data`
- **File**: `payday_signzy_crif_api.php`, `CommonComponent::call_signzy_bureau_api()`.
- **Status**: only call site (`CibilController.php:34`) is commented out — dead today.

### Credeau (secondary BRE on top of bureau)
- **Purpose**: Runs a secondary business-rule-engine decision on top of the CRIF bureau report (loan amount / accept-reject) for new-to-book leads.
- **Endpoint**: `POST https://credforge.credeau.com/api/execute/finance-crm/bureau_mobile_bre`
- **Auth headers**: `x-client-id` (`CREDEAU_CLIENT_ID`), `x-auth-token` (`CREDEAU_TOKEN`)
- **Request payload**: the CRIF bureau JSON report (passthrough)
- **Response fields**: `output_data.rules_output.final_decision.{Decision, LoanAmount, DecisionReason}`
- **File**: `payday_credeau_api.php`, called from `CibilController::index()` when `user_type == 'NEW'`.

---

## eKYC / OCR / Digilocker / eSign

### Signzy (dominant vendor for this category, live)
- **Purpose**: PAN/Aadhaar fetch & OCR, Digilocker, bank account penny-drop, email/domain verification, UAN/employment verification, video KYC, eSign, face match, utility bill OCR, reverse geocoding.
- **Base**: `https://api.signzy.app/api/`
- **Auth**: `Authorization: <SIGNZY_TOKEN>` (config block `SIGNZY_API`)
- **Endpoints**:
  | Endpoint | Purpose | File |
  |---|---|---|
  | `v3/pan/fetchV2` | PAN details fetch | `payday_poi_verification_api.php` |
  | `v3/pan/extractions` | PAN OCR | `payday_poi_ocr_api.php` |
  | `v3/aadhaar/extraction` | Aadhaar OCR | `payday_poi_ocr_api.php` |
  | `v3/aadhaar/extraction-masking` | Aadhaar masking | `payday_poi_ocr_api.php` |
  | `v3/digilocker-v2/createUrl` | Digilocker consent URL | `payday_aadhaar_digilocker_api.php` |
  | `v3/digilocker-v2/getDetails` | Digilocker profile details | `payday_aadhaar_digilocker_api.php` |
  | `v3/digilocker-v2/geteAadhaar` | eAadhaar fetch | `payday_aadhaar_digilocker_api.php` |
  | `v3/digilocker-v2/getFiles` | Digilocker document files | `payday_aadhaar_digilocker_api.php` |
  | `v3/bankaccountverification/bankaccountverifications` | Penny-drop bank account verification | `payday_bank_verification_api_helper.php` |
  | `v3/email/verificationV2` | Office/personal email verification | `payday_email_verification_api.php` |
  | `v3/domainVerificationLite` | Domain verification | `payday_domain_verification_api.php` |
  | `v3/api/advance-employment-verification` | UAN/employment verification | `payday_uan_verification_api.php` |
  | `v3/consenzAI/createUrl` | Video KYC session URL | `payday_video_kyc_api.php` |
  | `v3/contract/initiate` | eSign (eMudhra) upload/initiate | `payday_aadhaar_esign_api.php` |
  | `v3/contract/pullData` | eSign download/pull signed doc | `payday_aadhaar_esign_api.php` |
  | `v3/face/match` | Face match (selfie vs ID photo) | `payday_face_match_verification_api.php` (non-dated file is live) |
  | `v3/utility/single-kyc` | Utility bill OCR | `payday_utility_bill_verification_api.php` |
  | `v3/electricitybills/fetch` | Electricity bill fetch | `payday_utility_bill_verification_api.php` |
  | `v3/pan-extensive/premium` | PAN extensive verification (called directly, not via CommonComponent) | `VerificationController.php:213` |
- **Note**: `payday_reverse_geo_code.php` also implements reverse-geocode/address-distance, partly Signzy-adjacent (see Google Maps below).

### Digitap (secondary/parallel provider, live)
- **Purpose**: Alternated with Signzy on odd/even days (`date('d') % 2` in `CommonComponent::call_pan_ocr_api` / `call_aadhaar_ocr_api`) for PAN details, eKYC OTP, OCR, bank penny-drop, eSign, Digilocker.
- **Auth**: base64 `client_id:client_secret` token.
- **Endpoints**:
  | Endpoint | Purpose |
  |---|---|
  | `svc.digitap.ai/validation/kyc/v1/pan_details` | PAN details |
  | `ent/v3/kyc/intiate-kyc-auto` | eKYC OTP init |
  | `ent/v3/kyc/submit-otp` | eKYC OTP submit |
  | `api.digitap.ai/ocr/v1/pan` | PAN OCR |
  | `api.digitap.ai/ocr/v1/aadhaar` | Aadhaar OCR |
  | `penny-drop/v2/check-valid` | Bank account penny-drop |
  | `ent/v1/generate-esign` | eSign generate |
  | `ent/v1/get-esign-doc` | eSign fetch |
  | `ent/v1/kyc/generate-url` | Digilocker create URL |
  | `ent/v1/kyc/get-digilocker-details` | Digilocker details |
- **Known bug**: the dispatcher in `payday_bank_verification_api_helper.php` hardcodes method_id to always pick Signzy for penny-drop, so the Digitap penny-drop path is dead in practice despite being coded.

### Google Maps
- **Purpose**: Distance Matrix (address-distance calculation, e.g. residence-to-branch distance checks).
- **Endpoint**: `GET maps.googleapis.com/.../distancematrix/json`
- **Env vars**: `GOOGLE_MAPS_URL`, `GOOGLE_MAPS_APIKEY`
- **File**: `payday_reverse_geo_code.php::address_distance_api_google()`

---

## Payments / Disbursement / eNACH

### Razorpay (live, two independent code paths)
- **Purpose 1 — Payment Links**: collection/repayment links sent to customers.
  - `POST api.razorpay.com/v1/payment_links/`
  - Config: `Key`, `Secret`
  - File: `payday_razorpay_api.php`
- **Purpose 2 — Orders/Payments** (separately implemented, own hardcoded live key):
  - `POST api.razorpay.com/v1/orders`
  - `GET api.razorpay.com/v1/payments/{id}`
  - HMAC signature verification on webhook/callback
  - File: `PayCustomerDetails.php`

### ICICI Bank (multiple distinct API families, all RSA-encrypted payloads)
- **EazyPay** — hosted collection page: `eazypay.icicibank.com/EazyPG`
- **UPI QR / CollectPay / Status**: `apibankingone(.bank.in|.com)/api/MerchantAPI/UPI/v0/{QR3,CollectPay3,TransactionStatus3}/<merchantId>`. File: `call_upi_api.php`. Also calls **QuickChart** (`quickchart.io/qr`) to render the UPI deeplink as a scannable QR image.
- **Composite disbursement (IMPS)**: `apibankingone.icici.bank.in/api/v1/composite-payment` + `/composite-status`. File: `application/helpers/integration/payday_disbursement_icici_helper.php` — production-critical, user-ID gated.
- **eNACH mandate scheduling/verification**: env-var-driven URLs (`ENACH_ICICI_SCHEDULING_URL`, `MANDATE_VERIFICATION_URL`). File: `payday_enach_api.php`. **Note**: the initiate path currently has `$hardcoded = true` — stubbed, not live.
- **In-house Java middleware** for ICICI encrypt/decrypt: `http://loanwallefintech.in:8096/middleware/service/` — not itself third-party, but part of the request-signing flow for all ICICI calls above.

### NuPay (bank account verification, dormant)
- **Endpoints**: `nupaybiz.com/Auth/token`, `/api/Validate/getAccountVerificationWithIFSC`
- **Status**: blank API key in config — dormant, needs confirmation.

---

## SMS / WhatsApp / Voice / Call-Center

### RouteMobile (live, primary SMS gateway)
- **Endpoint**: `GET/POST http://sms6.rmlconnect.net/bulksms/bulksms`
- **Request fields**: `username, password, type, dlr, destination, source, message, entityid, tempid`
- **Response**: code `1701` = success
- **Files**: `CronSMS_Model.php`, `Sms_Model.php`, `Users/SMS_Model.php`, `LoginController.php`, `commonfun_helper.php`

### Vapio (SMS, live)
- **Endpoint**: `https://vapio.in/api.php?`
- **Env vars**: `VAPIO_USER`, `VAPIO_SENDERID`, `VAPIO_PEID`, `VAPIO_KEY`

### Whistle / Sms24hours (SMS, dormant)
- Configured (`sms.whistle.mobi`) but no confirmed live caller — needs confirmation.

### DesignHost / "staticking.org" (SMS, legacy/unclear)
- Seen in `PromotionalSmsDndController.php`, `UserController.php`, `Welcome.php` — appears to be leftover unrelated admin-tool boilerplate, not core loan flows.

### Whistle via Pinbot.ai (WhatsApp, live default)
- **Endpoint**: `POST partnersv1.pinbot.ai/v3/491310100730713/messages`
- **Payload**: WhatsApp Business template message shape.

### Aisensy (WhatsApp, dormant)
- **Endpoint**: `backend.api-wa.co/campaign/smartping/api` — configured, not the active sub-type.

### Yellow.ai (WhatsApp, dormant)
- **Endpoint**: `app.yellowmessenger.com` — configured, no caller found.

### MSG91 (WhatsApp, test-only)
- Only referenced in `CronJobs/Test.php` — a test/spike controller, not production.

### RUNO (call-center lead allocation, live)
- **Endpoint**: `POST api.runo.in/v1/crm/allocation`
- **Auth header**: `Auth-Key`
- **Files**: duplicate implementations in `components/includes/integration/` and `application/helpers/integration/payday_runo_call_api_helper.php` — the latter is what `application/` controllers actually `load->helper()`.

### Smartping (click-to-call + bulk contact upload, live)
- **Endpoints**: `smartdevmuni.vispl.in/cc/api/v1/click-to-call`, `/contacts`

### Cube Software / "Quick Dialer" (dev-only, dormant)
- **Endpoint**: `raphsody.in/QuickCallRaphsody/Click2Call58.php` — prod URL blank, dormant.

### Facebook Graph API (Lead Ads ingestion, dormant)
- **Endpoints**: `graph.facebook.com/v16.0/{page}/leadgen_forms`, `/leads`
- **Config**: `PageID`, `PageAccessToken` — both blank, dormant (needs page token setup).

### Exotel (voice-blast IVR campaigns, live)
- **Endpoint**: `POST api.exotel.com/v2/accounts/<sid>/campaigns`
- **Auth**: Basic auth
- **Purpose**: cron-triggered defaulter reminder calls.

---

## Email

### SendGrid (live/production)
- **Endpoint**: `POST api.sendgrid.com/v3/mail/send`
- **Auth**: Bearer key — **hardcoded in-file, not env-driven** (flag for rotation/secret-hygiene when porting).
- **File**: `application/helpers/commonfun_helper.php::lw_send_email()`

### ZeptoMail (live/production, second code path)
- **Endpoint**: `POST api.zeptomail.in/v1.1/email`
- **Auth**: `Authorization: Zoho-enczapikey`
- **File**: `components/includes/functions.inc.php::common_send_email()`

### Mailgun (dead fallback)
- SMTP (`smtp.mailgun.org`) and HTTP API (`api.mailgun.net/v3/.../messages`) fallback branches exist in both email functions above but are dead — hardcoded `active_id` always selects SendGrid/ZeptoMail instead.

### SendGrid/Mailgun email validation (dormant)
- `api.sendgrid.com/v3/validations/email`, `api.mailgun.net/v4/address/validate` — configured, no confirmed live caller.

---

## Attribution / Marketing

### AppsFlyer
- **Purpose**: pull attribution reports + push in-app events.
- **Endpoints**:
  - `GET hq1.appsflyer.com/api/raw-data/export/...` (pull reports)
  - `POST api3.appsflyer.com/inappevent/<app_id>` (push events)
- **File**: `payday_appsflyer_call_api.php`

### Adjust
- **Purpose**: device/install inspection for attribution.
- **Endpoint**: `GET api.adjust.com/device_service/api/v1/inspect_device`
- **File**: `payday_adjust_api.php`

---

## Misc / Utility

### TinyURL
- **Purpose**: link shortening for SMS/WhatsApp messages.
- **Endpoint**: `POST api.tinyurl.com/create`

### Novel Pattern / CartBI
- **Purpose**: bank statement analysis + account-aggregator net-banking flow.
- **Endpoints**:
  - `cartbi.com/api/upload`, `/downloadFile`, `/cart_callback` (bank statement analysis) — files: `payday_bank_analysis_api_call.php`, `CartController.php`
  - `NP_URL/api/generateNetBankingRequest` (account aggregator) — env vars `NP_URL`, `NP_TOKEN` — file: `aa_api_curl_helper.php`

### AWS S3
- **Purpose**: document storage.
- **Config vars**: `S3_BUCKET_ACCESS_KEY`, `S3_BUCKET_SECRET_KEY`, `S3_BUCKET_NAME`
- **Files**: two parallel implementations — `application/libraries/S3.php` (pure-PHP) and `components/includes/file_handling_with_s3.php` (real AWS SDK, this is what `CommonComponent` actually uses).

### SOT CRM
- **Purpose**: blacklist sync to a partner/sister CRM.
- **Endpoint**: `api.sotcrm.com/Api/Connector/.../blacklistCustomer`

### India Post Pincode API
- **Purpose**: free public pincode lookup, no key required.
- **Endpoint**: `GET api.postalpincode.in`
- **File**: `TaskController::apiPincode()`

### "SMS Analyser" — broken/orphaned
- `ThirdPartyAPIController::setSMSAnalyzer()` calls `CommonComponent::call_payday_sms_analyser()`, a method that does not exist anywhere in the codebase — would fatal-error if hit. Do not port as-is.

### Finbox — broken/orphaned
- Alt-data credit predictor. Config case `FINBOX_API` referenced in code does not exist in `integration_config.php` at all, so the call always throws immediately. Do not port as-is.

---

## Needs team confirmation before porting

The following have config and/or code present but no confirmed live call path — likely superseded-but-left-in-place code or half-finished spikes:

- Whistle / Sms24hours (SMS)
- Aisensy / Yellow.ai (WhatsApp)
- MSG91 (WhatsApp — test-only)
- NuPay (bank verification)
- SendGrid/Mailgun email validation
- Cube Software dialer
- Direct-CRIF / direct-CIBIL SOAP bureau paths
- Signzy-bridged CRIF
- Finbox
- "SMS Analyser"

Confirm with whoever runs the crons/ops before treating these as active integrations to migrate.
