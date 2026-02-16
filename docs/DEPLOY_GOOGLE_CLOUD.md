# Deploy Swiri to Google Cloud Run

> Complete step-by-step guide to deploy the Swiri backend on Google Cloud Run.
> Cloud Run supports WebSockets (Socket.IO), scales to zero, and has a free tier.

---

## Prerequisites

| Tool | Install |
|------|---------|
| **Google Cloud account** | [console.cloud.google.com](https://console.cloud.google.com) |
| **gcloud CLI** | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| **Docker Desktop** | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) (optional — Cloud Build can build for you) |

---

## Step 1 — Install & Login to gcloud CLI

### Windows (PowerShell):
```powershell
# Download installer from https://cloud.google.com/sdk/docs/install
# Or use winget:
winget install Google.CloudSDK
```

### After install:
```bash
gcloud init
gcloud auth login
```

This opens a browser — sign in with your Google account.

---

## Step 2 — Create a Google Cloud Project

```bash
# Create project (pick a unique ID)
gcloud projects create swiri-backend --name="Swiri Backend"

# Set it as active
gcloud config set project swiri-backend
```

> If you already have a project, just run `gcloud config set project YOUR_PROJECT_ID`

### Enable billing
Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing) and link a billing account to your project. Cloud Run has a generous free tier (2 million requests/month free).

---

## Step 3 — Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Step 4 — Set Environment Variables (Secrets)

Store your secrets securely:

```bash
# Set your region (pick closest to your users)
REGION=me-west1    # Middle East (Tel Aviv) — closest to Egypt
# Other options: europe-west1 (Belgium), us-central1 (Iowa)

# Create the .env equivalent for Cloud Run
# These will be passed as --set-env-vars during deploy
```

Your required env vars are:
| Variable | Value |
|----------|-------|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A strong random string |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGINS` | Your Flutter app domain or `*` |
| `AI_RISK_MODEL_URL` | `simulate` (uses local AI simulator) |
| `NODE_ENV` | `production` |

---

## Step 5 — Deploy (One Command)

### Option A: Let Google Cloud Build your image (easiest — no Docker needed locally)

```bash
gcloud run deploy swiri-backend \
  --source . \
  --region me-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60 \
  --session-affinity \
  --set-env-vars "MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/swiri,JWT_SECRET=your-super-secret-key-here,JWT_EXPIRES_IN=7d,CORS_ORIGINS=*,AI_RISK_MODEL_URL=simulate,NODE_ENV=production"
```

> **IMPORTANT:** Replace the `MONGO_URI` and `JWT_SECRET` values with your actual values.

> **`--session-affinity`** is critical — it ensures Socket.IO WebSocket connections stick to the same instance.

This will:
1. Upload your code to Cloud Build
2. Build the Docker image using your `Dockerfile`
3. Push the image to Artifact Registry
4. Deploy it to Cloud Run
5. Give you a URL like `https://swiri-backend-xxxxx-xx.a.run.app`

### Option B: Build locally with Docker first

```bash
# Build the image
docker build -t swiri-backend .

# Test locally
docker run -p 8080:8080 --env-file .env swiri-backend

# Tag for Google Artifact Registry
docker tag swiri-backend $REGION-docker.pkg.dev/swiri-backend/cloud-run-source-deploy/swiri-backend

# Push
docker push $REGION-docker.pkg.dev/swiri-backend/cloud-run-source-deploy/swiri-backend

# Deploy
gcloud run deploy swiri-backend \
  --image $REGION-docker.pkg.dev/swiri-backend/cloud-run-source-deploy/swiri-backend \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --session-affinity \
  --set-env-vars "..."
```

---

## Step 6 — Verify Deployment

After deploy, you get a URL. Test it:

```bash
# Health check
curl https://swiri-backend-xxxxx-xx.a.run.app/health

# Signup
curl -X POST https://swiri-backend-xxxxx-xx.a.run.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phone":"+201234567890","password":"123456","confirmPassword":"123456","agreedToTerms":true}'
```

---

## Step 7 — Custom Domain (Optional)

```bash
# Map your own domain
gcloud run domain-mappings create \
  --service swiri-backend \
  --domain api.swiri.com \
  --region me-west1
```

Then add the DNS records shown in the output to your domain registrar.

---

## Step 8 — Update Your Flutter App

Change the base URL:

```dart
// Before (Vercel)
static const String baseUrl = 'https://swiri.vercel.app';

// After (Cloud Run)
static const String baseUrl = 'https://swiri-backend-xxxxx-xx.a.run.app';
```

Update Socket.IO connection too:
```dart
final socket = IO.io('https://swiri-backend-xxxxx-xx.a.run.app', <String, dynamic>{
  'transports': ['websocket'],
  'auth': {'token': jwtToken},
});
```

---

## Updating After Code Changes

After making changes to the code, redeploy with one command:

```bash
gcloud run deploy swiri-backend --source . --region me-west1
```

That's it — Cloud Build rebuilds the image and deploys automatically.

---

## Monitoring & Logs

```bash
# View live logs
gcloud run services logs read swiri-backend --region me-west1 --limit 50

# Stream logs in real-time
gcloud beta run services logs tail swiri-backend --region me-west1

# View in browser
gcloud run services describe swiri-backend --region me-west1 --format="value(status.url)"
```

Or go to [console.cloud.google.com/run](https://console.cloud.google.com/run) → click your service → "Logs" tab.

---

## Cost Estimate

Cloud Run free tier (per month):
- **2 million requests** free
- **360,000 GB-seconds** of memory free
- **180,000 vCPU-seconds** free
- Outbound data: 1 GB/month free

For a typical child-safety app with < 1000 users, you'll likely **stay within the free tier**.

---

## Architecture Summary

```
Flutter App
    │
    ├── HTTPS requests ──→  Cloud Run (swiri-backend)
    │                            │
    ├── WebSocket (Socket.IO) ──→│    ← session affinity keeps
    │                            │      WS on same instance
    │                            ▼
    │                     MongoDB Atlas
    │                     (your existing cluster)
    │
    └── Push Notifications (future: Firebase Cloud Messaging)
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `MONGO_URI` connection fails | Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access (Cloud Run IPs are dynamic) |
| Socket.IO falls back to polling | Make sure `--session-affinity` is set. Also ensure `--timeout 60` or higher |
| Cold start takes 3-5s | Set `--min-instances 1` to keep one instance warm (costs ~$5/month) |
| Build fails | Check `gcloud builds log` for errors. Usually missing `package-lock.json` |
| 503 Service Unavailable | Check logs: `gcloud run services logs read swiri-backend --region me-west1` |

---

## Quick Reference

```bash
# Deploy / redeploy
gcloud run deploy swiri-backend --source . --region me-west1

# View URL
gcloud run services describe swiri-backend --region me-west1 --format="value(status.url)"

# View logs
gcloud run services logs read swiri-backend --region me-west1

# Update env vars
gcloud run services update swiri-backend --region me-west1 --set-env-vars "KEY=value"

# Delete service
gcloud run services delete swiri-backend --region me-west1
```
