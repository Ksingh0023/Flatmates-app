# Deployment Guide

This document outlines the step-by-step process to deploy the **FlatMates Shared Expense Tracker** application to production. 

The application is split into two parts:
1. **Backend (API Server):** Node.js + Express with an SQLite database, deployed on **Render** with a persistent disk.
2. **Frontend (Web App):** React + Vite SPA, deployed on **Vercel**.

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Vercel (React Frontend)     │
│   https://flatmates.vercel.app  │
└────────────────┬────────────────┘
                 │
                 │ HTTP Requests (CORS enabled)
                 ▼
┌─────────────────────────────────┐
│      Render (Express API)       │
│  https://flatmates.onrender.com │
└────────────────┬────────────────┘
                 │
                 ▼
       [ SQLite Database ]
  (Stored on Render Persistent Disk)
```

---

## Step 1: Push Code to GitHub

Before deploying, you must host the code on your GitHub account.

1. Go to [GitHub](https://github.com) and create a new repository (e.g., `flatmates-app`).
2. Do **not** initialize it with a README, `.gitignore`, or license (since the codebase already has them).
3. Open your terminal in the project root directory and run the following commands to link and push your code:

```bash
# Rename the default branch to main (standard)
git branch -M main

# Link your local repository to your remote GitHub repository
git remote add origin https://github.com/Ksingh0023/Flatmates-app.git

# Push the code to GitHub
git push -u origin main
```

---

## Step 2: Deploy Backend on Render

Render is used to host the Express backend. Because we are using SQLite, we will attach a **persistent disk** to the service so that the database file (`expenses.db`) survives service restarts and deployments.

### Option A: Automatic Deployment (using `render.yaml`)
We have pre-configured a `render.yaml` file in the root directory. If you have a Render account:
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **Blueprints** in the top navigation.
3. Click **New Blueprint Instance**.
4. Connect your GitHub repository.
5. Render will automatically read the `render.yaml` file, set up the Web Service, request a 1 GB persistent disk, and configure the variables.
6. Once deployed, note down your backend URL (e.g., `https://flatmates-backend.onrender.com`).

### Option B: Manual Setup via Render UI
If you prefer to configure it step-by-step through the Render dashboard:

1. Click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your repo.
3. Configure the following settings:
   - **Name:** `flatmates-backend`
   - **Region:** Select the region closest to you (e.g., Singapore or Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or any tier)

4. Scroll down and click **Advanced**.
5. Add the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `[Make up a long random secure string]`
   - `DB_PATH`: `./data/expenses.db`
   - `CORS_ORIGIN`: `https://your-frontend-url.vercel.app` *(Note: You will update this URL once the Vercel frontend is deployed)*

6. Scroll down to **Disks** and click **Add Disk**:
   - **Name:** `sqlite-data`
   - **Mount Path:** `/opt/render/project/src/backend/data`
   - **Size:** `1 GiB`

7. Click **Create Web Service**.

---

## Step 3: Deploy Frontend on Vercel

Vercel is the recommended hosting platform for Vite/React applications.

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your `flatmates-app` GitHub repository.
4. In the configuration page:
   - **Framework Preset:** Select **Vite** (Vercel usually auto-detects this).
   - **Root Directory:** Click Edit and select `frontend`.
   - **Build and Output Settings:** Keep defaults (`npm run build` and `dist` directory).
5. Open the **Environment Variables** section and add:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-render-backend-url.onrender.com/api` *(Replace with your actual Render URL)*
6. Click **Deploy**.
7. Once the build completes, copy your live frontend URL (e.g., `https://flatmates-app-xyz.vercel.app`).

---

## Step 4: Sync CORS Settings (Critical Step)

For security, the backend blocks requests from unknown origins. Now that your frontend has a live URL, you must update the backend CORS configuration:

1. Open your **Render Dashboard** and click on your `flatmates-backend` service.
2. Go to **Environment** in the sidebar.
3. Find `CORS_ORIGIN` and edit its value to match your live Vercel URL (e.g., `https://flatmates-app-xyz.vercel.app`).
4. Click **Save Changes**. Render will automatically redeploy the backend with the new setting.

Now, your application is fully live, secure, and ready for evaluation!
