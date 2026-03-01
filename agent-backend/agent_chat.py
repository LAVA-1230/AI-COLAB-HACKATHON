import os
import sqlite3
import uuid
from typing import TypedDict, Annotated, List, Dict
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)

# ─────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ─────────────────────────────────────────────────────────────
# Graph Nodes
# ─────────────────────────────────────────────────────────────
def chatbot_node(state: AgentState):
    # The last message is the human message, system message is already in state
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


# ─────────────────────────────────────────────────────────────
# Graph Construction
# ─────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)
workflow.add_node("chatbot", chatbot_node)
workflow.add_edge(START, "chatbot")
workflow.add_edge("chatbot", END)

# Configure the SQLite memory saver
DB_PATH = "agent_memory.db"
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
memory = SqliteSaver(conn)

# Compile graph with checkpointer
agent_app = workflow.compile(checkpointer=memory)

# ─────────────────────────────────────────────────────────────
# Exposed Functions
# ─────────────────────────────────────────────────────────────

def get_or_create_thread(project_id: str, user_id: str, new_thread: bool = False) -> str:
    """Gets the latest thread ID for a user or creates a new one."""
    
    # We maintain a simple table linking project_id:user_id to thread_ids
    # LangGraph's checkpointer handles message storage per thread_id, 
    # but we need to track *which* threads belong to *who*.
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS user_threads 
                 (project_id text, user_id text, thread_id text, title text, created_at timestamp DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()

    if new_thread:
        thread_id = str(uuid.uuid4())
        title = f"Chat Setup {len(get_user_threads(project_id, user_id)) + 1}"
        c.execute("INSERT INTO user_threads (project_id, user_id, thread_id, title) VALUES (?, ?, ?, ?)", 
                  (project_id, user_id, thread_id, title))
        conn.commit()
        return thread_id

    # Get the latest thread
    c.execute("SELECT thread_id FROM user_threads WHERE project_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1", (project_id, user_id))
    row = c.fetchone()
    
    if row:
        return row[0]
    else:
        # Create their very first thread
        thread_id = str(uuid.uuid4())
        c.execute("INSERT INTO user_threads (project_id, user_id, thread_id, title) VALUES (?, ?, ?, ?)", 
                  (project_id, user_id, thread_id, "Initial Chat"))
        conn.commit()
        return thread_id


def get_user_threads(project_id: str, user_id: str) -> List[Dict[str, str]]:
    """Get all threads for a specific user and project."""
    c = conn.cursor()
    # Ensure table exists if we query before creating
    c.execute('''CREATE TABLE IF NOT EXISTS user_threads 
                 (project_id text, user_id text, thread_id text, title text, created_at timestamp DEFAULT CURRENT_TIMESTAMP)''')
    c.execute("SELECT thread_id, title FROM user_threads WHERE project_id=? AND user_id=? ORDER BY created_at ASC", (project_id, user_id))
    rows = c.fetchall()
    return [{"thread_id": row[0], "title": row[1]} for row in rows]


def get_thread_history(thread_id: str) -> List[Dict]:
    """Fetch history from LangGraph checkpointer DB"""
    config = {"configurable": {"thread_id": thread_id}}
    state = agent_app.get_state(config)
    messages = state.values.get("messages", [])
    
    history = []
    for m in messages:
        if isinstance(m, SystemMessage):
            continue # Don't send system messages to UI
        role = "user" if isinstance(m, HumanMessage) else "assistant"
        history.append({"role": role, "content": m.content})
    return history


def chat_with_memory(
    thread_id: str,
    message: str,
    system_prompt: str
) -> str:
    """
    Chat with the agent using LangGraph's Sqlite checkpointer.
    The system prompt is injected if this is the start of a thread.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    # Check if thread is empty by trying to get state
    state = agent_app.get_state(config)
    
    inputs = {"messages": []}
    
    if not state.values.get("messages", []):
        # First interaction! Embed the system prompt
        inputs["messages"].append(SystemMessage(content=system_prompt))
    
    inputs["messages"].append(HumanMessage(content=message))
    
    # Stream or invoke through LangGraph
    response = agent_app.invoke(inputs, config=config)
    
    # The last message is the AI's response
    last_msg = response["messages"][-1]
    return last_msg.content
