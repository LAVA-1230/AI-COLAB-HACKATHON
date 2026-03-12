# OdysseyAI Deployment Guide

This guide outlines the steps to deploy the complete OdysseyAI platform to production. The platform consists of three main components that need to be deployed and connected:

1.  **AI Backend** (Python/FastAPI)
2.  **API Backend** (Node.js/Express)
3.  **Frontend** (React/Vite)

---

## 🏗️ Infrastructure Overview

- **Frontend**: [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/)
- **Node.js Backend**: [Render](https://render.com/) or [Railway](https://railway.app/)
- **Python AI Backend**: [Render](https://render.com/) or [Railway](https://railway.app/)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) (Cloud)
- **Vector DB**: [Qdrant Cloud](https://qdrant.tech/cloud/) (Cloud)

---

## 📡 Deployment Steps

### Step 1: Python AI Backend (FastAPI)
Deploy this service first as the Node.js backend depends on it.

1. Create a new "Web Service" on **Render**.
2. Connect your repository.
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
   - `GOOGLE_API_KEY`: Your Gemini API Key.
   - `QDRANT_URL`: Your Qdrant Cluster URL.
   - `QDRANT_API_KEY`: Your Qdrant API Key.
   - `LLAMA_CLOUD_API_KEY`: Your LlamaCloud Key.

> [!NOTE]  
> Once deployed, copy the **Service URL** (e.g., `https://odyssey-ai-agent.onrender.com`).

---

### Step 2: Node.js API Backend (Express)
1. Create a new "Web Service" on **Render**.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: A secure random string for tokens.
   - `AGENT_BACKEND`: The URL of your deployed Python AI Backend (from Step 1).

> [!NOTE]  
> Once deployed, copy the **Service URL** (e.g., `https://odyssey-api.onrender.com`).

---

### Step 3: React Frontend (Vite)
1. Create a new "Project" on **Vercel**.
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite
4. **Environment Variables**:
   - `VITE_API_ENDPOINT`: The URL of your deployed Node.js Backend (from Step 2).

---

## 📝 Environment Variable Checklist

| Service | Variable | Value |
|---------|----------|-------|
| **AI Backend** | `GOOGLE_API_KEY` | Gemini API Key |
| | `QDRANT_URL` | Qdrant Cloud URL |
| | `QDRANT_API_KEY` | Qdrant Cloud API Key |
| **API Backend** | `MONGO_URI` | MongoDB Connection URL |
| | `JWT_SECRET` | Secure Random String |
| | `AGENT_BACKEND` | Python Service URL |
| **Frontend** | `VITE_API_ENDPOINT` | Node.js Service URL |

---

## 🛠️ Post-Deployment Verification
1. Ensure all services show a "Healthy" status in their respective dashboards.
2. Check the browser console on the frontend for any CORS errors.
3. Test a "Team Creation" flow to verify MongoDB connectivity.
4. Test a "PDF Chat" flow to verify Qdrant and LLM connectivity.
