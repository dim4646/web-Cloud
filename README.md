# WebCloud Orders — Stripe → Airtable → Questionnaire → AI Draft

Netlify serverless functions that, after a customer pays via one of the site's
Stripe payment links, record the order in Airtable, send them to an on-site
project questionnaire, and generate a first-draft website with Claude.

## Flow

```
Stripe Payment Link (redirect after payment)
  → start.html?session_id=...   (questionnaire form)
      → POST submit-questionnaire  → Airtable updated, generate-draft-background triggered
          → generate-draft-background: Claude generates a draft site → stored in Netlify Blobs
      → start.html polls order.js until the draft is ready, then links to preview-draft.js

Stripe checkout.session.completed webhook → stripe-webhook.js → creates the Airtable order record
```

## Environment Variables

Set these in **Netlify → Site → Environment variables**:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe dashboard (`whsec_...`) |
| `AIRTABLE_API_KEY` | Airtable personal access token |
| `ANTHROPIC_API_KEY` | Anthropic API key, used to generate the draft site |
| `RESEND_API_KEY` | (optional) Resend API key (`re_...`) for the owner notification email |
| `RESEND_FROM_EMAIL` | (optional) Verified sender address in Resend |
| `NOTIFICATION_EMAIL` | (optional) Email address to receive order notifications |

## Deploy to Netlify

This repo is already connected to the Netlify site `melodious-nasturtium-49677d`,
building from the `main` branch. Pushing to `main` triggers a redeploy automatically.

### Set Environment Variables

Go to **Site → Environment variables**, add all variables from the table above,
then trigger a redeploy.

### Register the Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**, URL: `https://melodious-nasturtium-49677d.netlify.app/.netlify/functions/stripe-webhook`
3. Events to listen to: `checkout.session.completed`
4. Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`

## Price ID → Package Mapping

| Stripe Price ID | Package |
|---|---|
| `price_1TphB7JM2u2WIzsFKS2pdpUT` | Basic |
| `price_1TphBFJM2u2WIzsFg5BByaJO` | Business |
| `price_1TphDPJM2u2WIzsF3ixJVTz4` | Portfolio |
| `price_1TphBMJM2u2WIzsFK9zUxSLp` | Maintenance |

## Airtable Setup

- **Base ID:** `appv7AQg99c5GqdTU`
- **Table ID:** `tblYF1s42rbE88ZYJ` (Orders)

Fields: Customer Name, Email, Package, Payment Status, Form Status (Waiting/Received),
Draft Status (Queued/Generating/Ready/Failed), Draft URL, Answers (JSON), Stripe Session ID, Date.

## Local Testing

```bash
npm install
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
npx netlify dev
```
