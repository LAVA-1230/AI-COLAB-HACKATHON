import os
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph import run_planner, plan_single_subtopic
from agents import register_agents, get_agent_info
from agent_chat import get_or_create_thread, get_user_threads, get_thread_history, chat_with_memory, agent_app, conn, chat_supervisor_memory
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from vector import process_pdf_to_qdrant, embed_paper_for_clustering, get_all_paper_vectors

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Research Multi-Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ─────────────────────── Models ───────────────────────

class PlanRequest(BaseModel):
    topic: str
    members: List[dict]   # [{"id": str, "name": str}]

class PlanSingleRequest(BaseModel):
    topic: str
    member: dict
    existing_subtopics: List[dict]

class ChatRequest(BaseModel):
    project_id: str
    user_id: str
    thread_id: Optional[str] = None
    message: str

class ThreadRequest(BaseModel):
    project_id: str
    user_id: str
    is_supervisor: Optional[bool] = False


class RegisterRequest(BaseModel):
    project_id: str
    agent_prompts: dict   # user_id → {system_prompt, subtopic_title, ...}


# ─────────────────────── Helpers ──────────────────────


class InsightItem(BaseModel):
    heading: str
    content: str

class EvaluateInsightsRequest(BaseModel):
    project_id: str
    user_id: str
    paper_title: str
    subtopic_description: str
    insights: List[InsightItem]

class ClusterRequest(BaseModel):
    project_id: str


# ─────────────────────── Routes ───────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest_stub():
    """Stub endpoint. PDF/URL ingestion is disabled in the simplified flow."""
    return {"source_summaries": []}


@app.post("/plan")
def plan(req: PlanRequest):
    """
    Run the LangGraph planner.
    Takes topic and member list, returns subtopics + agent_prompts.
    """
    try:
        result = run_planner(
            topic=req.topic,
            members=req.members,
        )
        return result
    except Exception as e:
        print(f"[plan] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/plan-single")
def plan_single(req: PlanSingleRequest):
    """
    Generate a single, non-overlapping subtopic for a late-joining team member.
    """
    try:
        result = plan_single_subtopic(
            topic=req.topic,
            member=req.member,
            existing_subtopics=req.existing_subtopics
        )
        return result
    except Exception as e:
        print(f"[plan-single] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/register-agents")
def register(req: RegisterRequest):
    """
    Register sub-agent system prompts for a project.
    Called by the Node backend after planning is complete.
    """
    register_agents(req.project_id, req.agent_prompts)
    return {"status": "registered", "count": len(req.agent_prompts)}


@app.post("/threads")
def list_threads(req: ThreadRequest):
    """Get all historical threads for a user."""
    uid = f"sup_{req.user_id}" if req.is_supervisor else req.user_id
    threads = get_user_threads(req.project_id, uid)
    return {"threads": threads}


@app.post("/chat/new")
def new_chat_thread(req: ThreadRequest):
    """Create a new empty thread for a user."""
    uid = f"sup_{req.user_id}" if req.is_supervisor else req.user_id
    thread_id = get_or_create_thread(req.project_id, uid, new_thread=True)
    return {"thread_id": thread_id}


@app.get("/chat/history/{thread_id}")
def get_history(thread_id: str):
    """Get past messages for a specific thread."""
    history = get_thread_history(thread_id)
    return {"history": history}


@app.post("/chat")
def chat(req: ChatRequest):
    """
    Route a chat message to an agent. 
    Uses LangGraph's SqliteSaver to automatically manage history by thread_id.
    """
    try:
        info = get_agent_info(req.project_id, req.user_id)
        system_prompt = info.get("system_prompt", "You are a helpful research assistant.")
        return_title = info.get("subtopic_title", "Research")

        # 1. Resolve thread ID
        if req.thread_id:
            thread_id = req.thread_id
        else:
            thread_id = get_or_create_thread(req.project_id, req.user_id)

        # 2. Let LangGraph handle memory natively
        response_text = chat_with_memory(
            thread_id=thread_id,
            message=req.message,
            system_prompt=system_prompt,
            project_id=req.project_id,
            user_id=req.user_id
        )

        return {
            "response": response_text,
            "subtopic_title": return_title,
            "thread_id": thread_id
        }
    except Exception as e:
        print(f"[chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/supervisor")
def chat_supervisor(req: ChatRequest):
    """
    Chat endpoint for the Supervisor Agent.
    """
    try:
        thread_id = req.thread_id
        uid = f"sup_{req.user_id}"
        if not thread_id:
            # Create or get the latest thread for this supervisor instance
            thread_id = get_or_create_thread(req.project_id, uid)

        response = chat_supervisor_memory(
            thread_id=thread_id,
            message=req.message,
            project_id=req.project_id,
            user_id=req.user_id
        )

        return {
            "response": response,
            "subtopic_title": "Project Supervisor",
            "thread_id": thread_id
        }
    except Exception as e:
        print(f"[chat/supervisor] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/pdf")
async def upload_pdf(
    project_id: str = Form(...),
    user_id: str = Form(...),
    thread_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Handle PDF upload from chat UI.
    Parses with LlamaParse, splits into sections, stores in ChromaDB.
    Then injects a memory node into LangGraph so the agent acts like it read it.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    # 1. Save file locally
    uploads_dir = "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    file_path = os.path.join(uploads_dir, file.filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    try:
        # 2. Extract and embed with LlamaParse -> Qdrant
        print(f"[{thread_id}] Processing PDF {file.filename} into Qdrant Cloud...")
        sections_found = process_pdf_to_qdrant(
            file_path=file_path,
            project_id=project_id,
            thread_id=thread_id
        )
        
        # 3. Force-inject a memory into LangGraph so the AI knows we did this
        # We don't trigger the LLM to respond yet, just inject into the DB
        config = {"configurable": {"thread_id": thread_id}}
        
        system_acknowledgment = f"System Notification: The user has uploaded a PDF named '{file.filename}'. It has been successfully parsed into {len(sections_found)} structural sections and stored in the Qdrant Cloud vector database for RAG retrieval. The sections found are: {', '.join(sections_found)}."
        
        # Update the LangGraph state
        agent_app.update_state(
            config,
            {"messages": [AIMessage(content=system_acknowledgment)]}
        )
        
        return {
            "status": "success",
            "message": f"Successfully parsed and embedded PDF: {len(sections_found)} sections found.",
            "sections": sections_found
        }
        
    except Exception as e:
        print(f"[upload_pdf] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate_insights")
def evaluate_insights(req: EvaluateInsightsRequest):
    """
    Evaluates paper insights submitted by a student using Gemini.
    Awards 1-10 points based on depth, relevance, and clarity.
    """
    try:
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
        
        insights_text = "\n\n".join([f"**{i.heading}**\n{i.content}" for i in req.insights])
        
        prompt = f"""You are a STRICT academic evaluator. You must critically assess the following student insights on a research paper.

**Paper Title:** {req.paper_title}
**Student's Assigned Subtopic:** {req.subtopic_description}

**Student's Submitted Insights:**
{insights_text}

SCORING CRITERIA (be harsh and honest):
- 1-2 points: Empty, gibberish, copy-pasted, or completely irrelevant text
- 3-4 points: Very superficial, just restating the title, no actual analysis
- 5-6 points: Some relevant observations but lacking depth or critical thinking
- 7-8 points: Good analysis with connections to the subtopic, shows understanding
- 9-10 points: Exceptional insights with novel connections, deep understanding, and critical evaluation

IMPORTANT RULES:
- If the student wrote very little (under 20 words total), give 1-3 points MAX
- If the insights are generic and could apply to any paper, give 3-5 points MAX
- If the insights don't relate to their assigned subtopic, deduct 2 points
- Do NOT give 5 by default. Actually read and evaluate the content critically.

You MUST respond with ONLY a JSON object, nothing else. No markdown, no explanation, just the JSON:
{{"points": <integer 1-10>, "feedback": "<1-2 sentence justification>"}}"""
        
        response = llm.invoke([HumanMessage(content=prompt)]).content
        print(f"[evaluate_insights] Raw LLM response: {response}")
        
        import json, re
        
        # Try direct JSON parse first
        cleaned = response.strip()
        
        # Remove markdown code blocks if present
        cleaned = re.sub(r'```(?:json)?\s*', '', cleaned)
        cleaned = cleaned.strip()
        
        # Try to extract JSON object
        json_match = re.search(r'\{[^{}]*"points"\s*:\s*\d+[^{}]*\}', cleaned)
        if json_match:
            cleaned = json_match.group(0)
        
        data = json.loads(cleaned)
        
        points = int(data.get("points", 3))
        # Clamp to 1-10 range
        points = max(1, min(10, points))
        feedback = str(data.get("feedback", "Evaluated."))
        
        print(f"[evaluate_insights] Parsed -> points={points}, feedback={feedback}")
        
        result = {
            "points": points,
            "feedback": feedback
        }

        # Embed the paper for clustering after successful evaluation
        try:
            embedding_text = f"{req.paper_title} {req.subtopic_description} {insights_text}"
            embed_paper_for_clustering(
                project_id=req.project_id,
                paper_title=req.paper_title,
                user_id=req.user_id,
                text=embedding_text,
                feedback=feedback
            )
        except Exception as embed_err:
            print(f"[evaluate_insights] Embedding for clustering failed: {embed_err}")

        return result
        
    except Exception as e:
        print(f"[evaluate_insights] Error: {e}")
        import traceback
        traceback.print_exc()
        # Default fallback — give LOW score, not 5
        return {
            "points": 1,
            "feedback": "Could not evaluate insights properly. Please try again."
        }


@app.post("/cluster-papers")
def cluster_papers(req: ClusterRequest):
    """
    Runs K-Means clustering on all completed papers for a project.
    Requires at least 5 papers to produce meaningful clusters.
    """
    try:
        papers = get_all_paper_vectors(req.project_id)
        count = len(papers)

        if count < 2:
            return {
                "ready": False,
                "message": f"Need at least 2 completed papers to cluster. Currently have {count}.",
                "count": count
            }

        import numpy as np
        from sklearn.cluster import KMeans

        vectors = np.array([p["vector"] for p in papers])
        n_clusters = min(3, count // 2)
        if n_clusters < 2:
            n_clusters = 2

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(vectors)

        clusters = {}
        for i, label in enumerate(labels):
            label_int = int(label)
            if label_int not in clusters:
                clusters[label_int] = []
            clusters[label_int].append({
                "title": papers[i]["paper_title"],
                "user_id": papers[i]["user_id"],
                "feedback": papers[i].get("feedback", "")
            })

        result_clusters = [
            {"cluster_id": cid, "papers": cpapers}
            for cid, cpapers in sorted(clusters.items())
        ]

        return {
            "ready": True,
            "clusters": result_clusters,
            "count": count
        }

    except Exception as e:
        print(f"[cluster-papers] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
