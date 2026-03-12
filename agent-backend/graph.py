import os
import json
import numpy as np
from typing import TypedDict, List
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.optimize import linear_sum_assignment

load_dotenv()

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

def compute_similarity(text1, text2):
    emb1 = embedding_model.encode([text1])
    emb2 = embedding_model.encode([text2])
    sim = cosine_similarity(emb1, emb2)[0][0]
    return float(sim)

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
    "description": "<2-3 sentence description of what this subtopic covers and what the researcher should focus on>",
    "required_domains": ["<skill1>", "<skill2>"],
    "preferred_methodology": ["<method1>"]
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
    Intelligently assign subtopics to members using Hungarian matching algorithm.
    Build a specialised system prompt for each member's sub-agent.
    """
    members = state["members"]
    subtopics = state["subtopics"]
    
    n = len(members)
    if n == 0 or len(subtopics) == 0:
        return {"subtopics": [], "agent_prompts": {}}
        
    score_matrix = np.zeros((n, len(subtopics)))
    
    for i, member in enumerate(members):
        # Flatten member profile into a single text representation
        member_profile_text = f"Domain: {member.get('domain', '')} Details: {member.get('details', '')} Research: {member.get('previousResearch', '')}"
        
        for j, subtopic in enumerate(subtopics):
            domain_score = 0
            required_domains = subtopic.get("required_domains", [])
            for required in required_domains:
                sim = compute_similarity(required, member_profile_text)
                domain_score += sim
                
            if len(required_domains) > 0:
                domain_score /= len(required_domains)
            else:
                domain_score = 0.5 # Default score if no domains generated
                
            # We want to MAXIMIZE score_matrix, so when we minimize cost, we use -score_matrix
            score_matrix[i, j] = domain_score
            
    cost_matrix = -score_matrix
    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    
    agent_prompts = {}
    enriched_subtopics = []
    
    for user_idx, subtopic_idx in zip(row_ind, col_ind):
        member = members[user_idx]
        subtopic = subtopics[subtopic_idx]
        
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
        
        enriched_subtopics.append({
            **subtopic,
            "assignedUserId": member["id"],
            "assignedUserName": member["name"],
            "agentSystemPrompt": system_prompt,
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


def plan_single_subtopic(topic: str, member: dict, existing_subtopics: list) -> dict:
    """
    Generate exactly 1 new subtopic for a late-joining member,
    ensuring it does not overlap with existing subtopics.
    """
    print(existing_subtopics)
    existing_titles = ", ".join([s.get("title", "") for s in existing_subtopics])
    existing_descriptions = "\n".join([f"- {s.get('title', '')}: {s.get('description', '')}" for s in existing_subtopics])
    
    prompt = f"""You are a research project manager.

Research Topic: {topic}

A new team member has joined: {member.get('name', 'Researcher')}

Existing subtopics already assigned to others (CRITICAL: DO NOT overlap with these, provide something entirely different):
{existing_descriptions}

Your task is to generate EXACTLY 1 new, distinct subtopic for this team member that covers a completely novel angle of the main topic not covered by the existing subtopics. Evaluate the existing subtopics carefully and choose a direction that complements them but does not duplicate their focus.

Return your response as a JSON object ONLY (no markdown, no explanation):
{{
  "title": "<short subtopic title>",
  "description": "<2-3 sentence description of what this subtopic covers>",
  "required_domains": ["<skill1>"],
  "preferred_methodology": ["<method1>"]
}}
"""
    response = llm.invoke(prompt)
    print("RAW Response from LLM:", response)
    
    # Handle the LangChain AIMessage response structure
    raw = ""
    if hasattr(response, 'content'):
        if isinstance(response.content, list) and len(response.content) > 0 and 'text' in response.content[0]:
            # This handles the specific format shown in the user's error message
            raw = response.content[0]['text']
        else:
            raw = str(response.content)
    else:
        raw = str(response)

    raw = raw.strip()
    
    import re
    import json
    
    # Try to find a JSON block in the markdown
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(1)
    else:
        # If no markdown block, try to extract just the {...} part
        start_idx = raw.find('{')
        end_idx = raw.rfind('}')
        if start_idx != -1 and end_idx != -1:
            raw = raw[start_idx:end_idx+1]
            
    try:
        subtopic_data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON: {raw}")
        print(f"Error: {e}")
        # Provide a safe fallback so the app doesn't crash completely
        subtopic_data = {
            "title": "Unplanned Research Subtopic",
            "description": "The AI planner could not generate a strictly formatted subtopic. Please try again.",
            "required_domains": ["General"],
            "preferred_methodology": ["General"]
        }
    print(subtopic_data)
    
    # Build their system prompt
    system_prompt = (
        f"You are a specialized AI research assistant focused on the subtopic: "
        f"'{subtopic_data['title']}'.\n\n"
        f"Subtopic overview: {subtopic_data['description']}\n\n"
        f"Main research topic: {topic}\n\n"
        f"Your role:\n"
        f"- Help {member['name']} deeply research this specific subtopic\n"
        f"- Suggest key concepts, methodologies, and open questions\n"
        f"- Provide insights based on the context provided\n"
        f"- Stay focused on your subtopic; refer cross-subtopic questions back to the team\n\n"
    )
    
    enriched_subtopic = {
        **subtopic_data,
        "assignedUserId": member["id"],
        "assignedUserName": member["name"],
        "agentSystemPrompt": system_prompt,
    }
    
    return {
        "subtopic": enriched_subtopic,
        "agent_prompt": {
            "system_prompt": system_prompt,
            "subtopic_title": subtopic_data["title"],
            "subtopic_description": subtopic_data["description"]
        }
    }
