# Odyssey — AI-Powered Collaborative Research Platform

## Project Description

Odyssey AI is a full-stack, AI-powered collaborative research platform built for academic teams. It enables research groups to work together on a shared topic — each member is intelligently assigned a unique subtopic based on their profile using the **Hungarian Algorithm** and **SentenceTransformer** similarity matching.

### Key Features

- **Team Management** — Create or join research teams using a unique 6-digit room code. Teachers and students have role-based access.
- **Intelligent Subtopic Assignment** — When a project is launched, the system generates distinct subtopics using **Google Gemini** and assigns them to members using the **Hungarian Algorithm** (`scipy.optimize.linear_sum_assignment`) based on their domain expertise and methodology preferences.
- **Per-User AI Research Agent** — Each team member gets a dedicated AI chat agent (powered by **LangGraph + Gemini**) focused on their specific subtopic, with persistent memory via **SQLite checkpointing**.
- **Shared Supervisor Agent** — A project-wide supervisor agent is available to all team members. Messages are attributed to each sender, enabling collaborative discussions with the AI about cross-topic coordination.
- **ArXiv Paper Discovery** — The AI agent can search ArXiv for relevant papers, filter duplicates using LLM-based abstract similarity, and save papers with section headings for structured reading.
- **PDF Upload & RAG** — Upload research PDFs which are parsed via **LlamaParse**, chunked, embedded with **SentenceTransformer (all-MiniLM-L6-v2)**, and stored in **Qdrant Cloud** for retrieval-augmented generation.
- **Paper Insights & Gamification** — When a student completes a paper, they submit insights per section heading. **Gemini** evaluates the quality and awards 1–10 points, powering a live leaderboard.
- **K-Means Paper Clustering** — After ≥5 papers are completed across the team, the platform runs **K-Means clustering** on the paper embeddings to discover thematic groupings across all completed research.
- **Mermaid Flowchart Generation** — Ask the AI agent to draw flowcharts from uploaded PDFs; it generates **Mermaid.js** diagrams rendered directly in the chat.
- **Late Joiner Support** — Members who join after project launch are dynamically assigned fresh subtopics that don't overlap with existing ones.
- **Teacher Dashboard** — Teachers can view all subtopics and papers, and provide feedback at both the subtopic and individual paper level.
- **Research Profile** — On creating/joining a team, users fill out their Domain Expertise, Methodology Preferences, and Experience, which directly influences subtopic assignment quality.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TailwindCSS, Lucide Icons, Mermaid.js |
| Node Backend | Express.js, MongoDB (Mongoose), JWT Auth |
| AI Backend | FastAPI, LangGraph, LangChain, Google Gemini |
| Vector DB | Qdrant Cloud |
| Embeddings | SentenceTransformer (all-MiniLM-L6-v2) |
| PDF Parsing | LlamaParse |
| Optimization | SciPy (Hungarian Algorithm), scikit-learn (K-Means) |

---

## Team Members

| Lavanya Singla |
| Aaditya Mehar |

---

## Setup Instructions

### Prerequisites

- **Node.js** (v18+)
- **Python** (3.10+)
- **MongoDB** (Atlas or local instance)
- **Qdrant Cloud** account (free tier works)
- **Google Gemini API Key**
- **LlamaCloud API Key** (for LlamaParse PDF parsing)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AI-HACKATHON-MICROSOFT
```

### 2. Backend Setup (Node.js)

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

Start the backend:

```bash
npm start
```

The Node.js server runs on **http://localhost:5000**.

### 3. Agent Backend Setup (Python/FastAPI)

```bash
cd agent-backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
pip install sentence-transformers beautifulsoup4
```

Create a `.env` file in `agent-backend/`:

```env
GOOGLE_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
LLAMA_CLOUD_API_KEY=your_llamaparse_api_key
```

Start the agent backend:

```bash
python server.py
```

The FastAPI server runs on **http://localhost:8000**.

### 4. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:5173**.

### 5. Access the Application

1. Open **http://localhost:5173** in your browser.
2. Sign up as a **Student** or **Teacher**.
3. Create a team or join one using a 6-digit room code.
4. Fill out your research profile (domain, methodology, experience).
5. Launch a research project by entering a topic.
6. Start chatting with your AI agent, upload PDFs, discover papers, and collaborate!
