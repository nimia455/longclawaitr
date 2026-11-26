# Longclaw

A calm AI workspace for writing, coding with live preview, image generation, and Google Workspace commands.

## Deploy to GitHub Pages (Free, No Billing Required)

This repository includes an automatic GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) pre-configured for both default `*.github.io` URLs and custom domains.

### 1. Push to GitHub
Push this project to your GitHub repository on the `main` (or `master`) branch.

### 2. Enable GitHub Pages
1. Open your GitHub repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. The **Deploy Longclaw to GitHub Pages** workflow runs automatically (or trigger it from the **Actions** tab).

### 3. Using a Custom Domain on GitHub Pages
The workflow automatically detects a `CNAME` file (at repo root or `public/CNAME`) or a GitHub Actions Repository Variable named `CUSTOM_DOMAIN`, forces the build base path to `/`, sanitizes the domain, and preserves `dist/CNAME` on every deploy.

1. **Configure DNS at your domain registrar**:
   - **Apex domain (`yourdomain.com`)** — add four `A` records pointing to:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
     *(Optional IPv6 `AAAA` records: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)*
   - **Subdomain (`www.yourdomain.com` or `app.yourdomain.com`)** — add one `CNAME` record pointing to `<your-username>.github.io`.
2. **Save your custom domain in GitHub**:
   - In GitHub → **Settings → Pages → Custom domain**, enter only the hostname (e.g. `yourdomain.com` or `app.yourdomain.com`, with **no** `https://` and **no** trailing `/`) and click **Save**.
   - Also set the same hostname as a GitHub Actions variable (`Settings → Secrets and variables → Actions → Variables → CUSTOM_DOMAIN`) or commit a single-line `CNAME` file in the repo root so every workflow deploy keeps your custom domain active.
   - Once DNS passes, check **Enforce HTTPS**.
3. **Authorize your custom domain in Firebase**:
   - Open **Firebase Console → Authentication → Settings → Authorized domains** and add your custom domain (e.g. `yourdomain.com`) so sign-in works without `auth/unauthorized-domain`.

### 4. (Optional) Connect Live AI Replies on GitHub Pages
GitHub Pages hosts static frontend files only. To enable live AI chat and image generation on your GitHub Pages or custom domain site:
1. Host `server.ts` on any Node.js host (e.g., Render or Koyeb) with `GEMINI_API_KEY` set (`npm run build` and `npm start`).
2. If you use a custom domain, set `ALLOWED_ORIGINS="https://yourdomain.com"` on your backend host so CORS permits requests from your custom domain (`*.github.io` is allowed automatically).
3. In GitHub → **Settings → Secrets and variables → Actions → Variables**, add `VITE_API_BASE_URL` with your backend URL and re-run the workflow.

## Local Development

```bash
npm install
npm run dev
```
