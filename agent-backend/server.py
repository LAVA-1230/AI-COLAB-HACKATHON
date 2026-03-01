import os
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from graph import run_planner
from agents import register_agents, get_agent_info
from agent_chat import get_or_create_thread, get_user_threads, get_thread_history, chat_with_memory

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


class ChatRequest(BaseModel):
    project_id: str
    user_id: str
    thread_id: Optional[str] = None
    message: str

class ThreadRequest(BaseModel):
    project_id: str
    user_id: str


class RegisterRequest(BaseModel):
    project_id: str
    agent_prompts: dict   # user_id → {system_prompt, subtopic_title, ...}


# ─────────────────────── Helpers ──────────────────────



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
    threads = get_user_threads(req.project_id, req.user_id)
    return {"threads": threads}


@app.post("/chat/new")
def new_chat_thread(req: ThreadRequest):
    """Create a new empty thread for a user."""
    thread_id = get_or_create_thread(req.project_id, req.user_id, new_thread=True)
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
            system_prompt=system_prompt
        )

        return {
            "response": response_text,
            "subtopic_title": return_title,
            "thread_id": thread_id
        }
    except Exception as e:
        print(f"[chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
