import os
from typing import TypedDict, List
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.4,
)


# ─────────────────────────── State ───────────────────────────

class PlannerState(TypedDict):
    topic: str
    members: List[dict]           # [{"id": "...", "name": "..."}]
    subtopics: List[dict]         # final output
    agent_prompts: dict           # user_id → system_prompt


# ─────────────────────────── Nodes ───────────────────────────

def plan_subtopics_node(state: PlannerState) -> dict:
    """Ask the LLM to divide the topic into N subtopics (one per member)."""
    n = len(state["members"])
    member_names = ", ".join(m["name"] for m in state["members"])

    prompt = f"""You are a research project manager.

Research Topic: {state['topic']}

Team members: {member_names} ({n} people)

Your task:
Divide the research topic into exactly {n} focused subtopics — one per team member.
Each subtopic must be distinct and cover a different angle of the main topic.

Return your response as a JSON array ONLY (no markdown, no explanation):
[
  {{
    "title": "<short subtopic title>",
    "description": "<2-3 sentence description of what this subtopic covers and what the researcher should focus on>"
  }},
  ...
]
"""
    response = llm.invoke(prompt)

    # normalize content to a string; the SDK may return list/dict
    content = response.content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            else:
                parts.append(str(item))
        raw = "\n".join(parts)
    elif isinstance(content, dict) and "text" in content:
        raw = content["text"]
    else:
        raw = str(content)
    raw = raw.strip()

    # Strip markdown code fence if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    import json
    subtopics = json.loads(raw)
    return {"subtopics": subtopics}


def assign_and_build_agents_node(state: PlannerState) -> dict:
    """
    Round-robin assign subtopics to members.
    Build a specialised system prompt for each member's sub-agent.
    """
    members = state["members"]
    subtopics = state["subtopics"]
    agent_prompts = {}

    for i, member in enumerate(members):
        subtopic = subtopics[i % len(subtopics)]
        system_prompt = (
            f"You are a specialized AI research assistant focused on the subtopic: "
            f"'{subtopic['title']}'.\n\n"
            f"Subtopic overview: {subtopic['description']}\n\n"
            f"Main research topic: {state['topic']}\n\n"
            f"Your role:\n"
            f"- Help {member['name']} deeply research this specific subtopic\n"
            f"- Suggest key concepts, methodologies, and open questions\n"
            f"- Provide insights based on the context provided\n"
            f"- Stay focused on your subtopic; refer cross-subtopic questions back to the team\n\n"
        )
        agent_prompts[member["id"]] = {
            "system_prompt": system_prompt,
            "subtopic_title": subtopic["title"],
            "subtopic_description": subtopic["description"],
        }

    # Attach assigned member info to each subtopic entry
    enriched_subtopics = []
    for i, subtopic in enumerate(subtopics):
        member = members[i % len(members)]
        enriched_subtopics.append({
            **subtopic,
            "assignedUserId": member["id"],
            "assignedUserName": member["name"],
            "agentSystemPrompt": agent_prompts[member["id"]]["system_prompt"],
        })

    return {"subtopics": enriched_subtopics, "agent_prompts": agent_prompts}


# ─────────────────────────── Graph ───────────────────────────

def build_planner_graph():
    workflow = StateGraph(PlannerState)

    workflow.add_node("plan_subtopics", plan_subtopics_node)
    workflow.add_node("assign_agents", assign_and_build_agents_node)

    workflow.set_entry_point("plan_subtopics")
    workflow.add_edge("plan_subtopics", "assign_agents")
    workflow.add_edge("assign_agents", END)

    return workflow.compile()


# Singleton graph
planner_graph = build_planner_graph()


def run_planner(topic: str, members: list) -> dict:
    """
    Run the full planning pipeline.

    Args:
        topic:    Research topic string
        members:  List of {"id": str, "name": str}

    Returns:
        {"subtopics": [...], "agent_prompts": {user_id: {...}}}
    """
    result = planner_graph.invoke({
        "topic": topic,
        "members": members,
        "subtopics": [],
        "agent_prompts": {},
    })
    return {
        "subtopics": result["subtopics"],
        "agent_prompts": result["agent_prompts"],
    }
