import os
from typing import List, Dict, Any
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)

# ─────────────────────────────────────────────────────────────
# In-memory agent registry
# Key:   "{project_id}:{user_id}"
# Value: {"system_prompt": str, "subtopic_title": str}
# ─────────────────────────────────────────────────────────────
agent_registry: Dict[str, Dict[str, str]] = {}


def register_agents(project_id: str, agent_prompts: Dict[str, Dict]) -> None:
    """
    Store all sub-agent system prompts for a project.
    Called after the planner graph runs.

    agent_prompts format:
        { user_id: {"system_prompt": str, "subtopic_title": str, ...} }
    """
    for user_id, info in agent_prompts.items():
        key = f"{project_id}:{user_id}"
        agent_registry[key] = info
    print(f"[agent_registry] Registered {len(agent_prompts)} agents for project {project_id}")


def get_agent_info(project_id: str, user_id: str) -> Dict[str, str]:
    """Return agent info dict for a user, or a generic fallback."""
    key = f"{project_id}:{user_id}"
    return agent_registry.get(key, {
        "system_prompt": "You are a helpful research assistant.",
        "subtopic_title": "General Research",
    })


def chat_with_agent(
    project_id: str,
    user_id: str,
    message: str,
    history: List[Dict[str, str]],
    override_system_prompt: str | None = None,
) -> str:
    """
    Chat with the user's assigned sub-agent.

    Args:
        project_id: The project ID
        user_id:    The user's MongoDB _id
        message:    The user's latest message
        history:    List of {"role": "user"|"assistant", "content": str}

    Returns:
        The AI response as a string.
    """
    # allow external caller to bypass registry
    if override_system_prompt:
        system_prompt = override_system_prompt
    else:
        info = get_agent_info(project_id, user_id)
        system_prompt = info["system_prompt"]

    # Build message list
    messages = [SystemMessage(content=system_prompt)]

    for turn in history:
        if turn["role"] == "user":
            messages.append(HumanMessage(content=turn["content"]))
        elif turn["role"] == "assistant":
            messages.append(AIMessage(content=turn["content"]))

    messages.append(HumanMessage(content=message))

    response = llm.invoke(messages)
    return response.content
