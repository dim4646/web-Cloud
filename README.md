# WebCloud Orders — Stripe Webhook → Airtable

Netlify serverless function that listens for Stripe `checkout.session.completed` events,
records the order in Airtable, and sends a notification email via Resend.

## Flow

```
Stripe Checkout → webhook → Netlify Function → Airtable record + Resend email
```

## Environment Variables

Set these in **Netlify → Site → Environment variables**:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe dashboard (`whsec_...`) |
| `AIRTABLE_API_KEY` | Airtable personal access token |
| `RESEND_API_KEY` | Resend API key (`re_...`) |
| `RESEND_FROM_EMAIL` | Verified sender address in Resend (e.g. `orders@yourdomain.com`) |
| `NOTIFICATION_EMAIL` | Email address to receive order notifications |

## Deploy to Netlify

### 1. Push to GitHub

```bash
cd webcloud-orders
git init
git add .
git commit -m "Initial commit"
gh repo create webcloud-orders --private --push --source=.
```

### 2. Connect to Netlify

1. Go to https://app.netlify.com → **Add new site → Import an existing project**
2. Connect your GitHub account and select the `webcloud-orders` repo
3. Build settings are already in `netlify.toml` — click **Deploy**

### 3. Set Environment Variables

Go to **Site → Environment variables** and add all variables from the table above.

Trigger a redeploy after adding them (**Deploys → Trigger deploy**).

### 4. Get your Webhook URL

Your function URL will be:
```
https://<your-site>.netlify.app/.netlify/functions/stripe-webhook
```

### 5. Register Webhook in Stripe

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Paste the URL above
4. Under **Events to listen to**, select: `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in Netlify

### 6. Test the Webhook

In the Stripe dashboard, open your endpoint and click **Send test event** →
select `checkout.session.completed` → Send. Check Netlify function logs under
**Functions → stripe-webhook → Logs**.

## Price ID → Package Mapping

| Stripe Price ID | Package |
|---|---|
| `price_1TouzzJM2u2WIzsFWkd2lfD6` | Basic |
| `price_1Tov04JM2u2WIzsF1q68qDHj` | Business |
| `price_1Tov06JM2u2WIzsFSQ8neydW` | Maintenance |

## Airtable Setup

- **Base ID:** `appv7AQg99c5GqdTU`
- **Table ID:** `tblYF1s42rbE88ZYJ`

The function creates records with these fields:
- Customer Name, Email, Package, Payment Status = Paid, Form Status = Waiting, Stripe Session ID, Date

## Local Testing

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward events locally:

```bash
npm install
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
```

Run the dev server in another terminal:
```bash
npx netlify dev
```
