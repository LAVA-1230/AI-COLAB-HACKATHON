import os
import sqlite3
import uuid
import json
import xml.etree.ElementTree as ET
from typing import TypedDict, Annotated, List, Dict
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import re

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
import requests
from vector import query_qdrant

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)

# ─────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────
def extract_text(response) -> str:
    content = response.content
    if isinstance(content, list):
        return "".join(c.get("text", "") for c in content if isinstance(c, dict) and "text" in c)
    return content

# ─────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    project_id: str
    user_id: str
    thread_id: str


# ─────────────────────────────────────────────────────────────
# Search Implementation
# ─────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────
# Graph Nodes & Routing
# ─────────────────────────────────────────────────────────────
def chatbot_node(state: AgentState):
    last_msg = state["messages"][-1].content
    thread_id = state.get("thread_id", "")
    
    # 1. Identify uploaded PDFs from history
    available_pdfs = []
    for m in state["messages"]:
        if isinstance(m, AIMessage) and "successfully parsed into" in m.content and "uploaded a PDF named" in m.content:
            try:
                # Extract filename from "uploaded a PDF named 'filename.pdf'"
                fname = m.content.split("uploaded a PDF named '")[1].split("'")[0]
                if fname not in available_pdfs:
                    available_pdfs.append(fname)
            except Exception:
                pass
                
    # 2. Extract target filename using LLM
    target_filename = "all"
    if available_pdfs:
        target_prompt = f"The user asks: '{last_msg}'. Which ONE of these uploaded research papers are they referring to? Options: {available_pdfs}. Respond strictly with the exact filename, or 'all' if they are asking a general question across all papers or neither. Return NOTHING ELSE."
        target_response = extract_text(llm.invoke([HumanMessage(content=target_prompt)])).strip()
        if target_response in available_pdfs:
            target_filename = target_response
            
    # 3. Perform RAG
    rag_context = ""
    if thread_id:
        retrieved_sections = query_qdrant(thread_id, last_msg, n_results=3, target_filename=target_filename)
        if retrieved_sections:
            rag_context = "\n\n".join(retrieved_sections)
            
    # 4. Invoke LLM with injected RAG context
    if rag_context:
        injected_prompt = f"Use the following retrieved context from the research paper(s) to answer the user's question. If the context doesn't contain the answer, say so.\n\nContext:\n{rag_context}\n\nUser Question: {last_msg}"
        # We replace the last user message with the augmented one
        messages = state["messages"][:-1] + [HumanMessage(content=injected_prompt)]
    else:
        messages = state["messages"]
        
    response = llm.invoke(messages)
    return {"messages": [response]}

def search_node(state: AgentState):
    last_msg = state["messages"][-1].content
    project_id = state.get("project_id", "")
    user_id = state.get("user_id", "")
    
    # 1. Subject extraction
    extraction_prompt = f"Extract ONLY the specific research paper name, topic, or keyword the user is trying to find from this message. Respond strictly with the search phrase and absolutely nothing else. Message: '{last_msg}'"
    extraction_response = llm.invoke([HumanMessage(content=extraction_prompt)]).content
    if isinstance(extraction_response, list):
        extraction_response = "".join(c.get("text", "") for c in extraction_response if isinstance(c, dict) and "text" in c)
    print(extraction_response)
    extracted_topic = extraction_response.strip()

    # 2. Get old papers purely to verify similarity
    c = conn.cursor()
    c.execute("SELECT abstract FROM papers WHERE project_id=? AND user_id=?", (project_id, user_id))
    old_abstracts = [row[0] for row in c.fetchall() if row[0]]

    response_text = f"I couldn't find any genuinely novel research papers for **{extracted_topic}** after extensive searching."
    
    # ArXiv loop
    max_iterations = 5
    for iteration in range(max_iterations):
        try:
            url = "http://export.arxiv.org/api/query"
            params = {
                "search_query": f"all:{extracted_topic.replace(' ', '+')}",
                "start": iteration * 4,
                "max_results": 4
            }
            res = requests.get(url, params=params)
            root = ET.fromstring(res.text)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            
            entries = root.findall("atom:entry", ns)
            if not entries:
                if iteration == 0:
                    response_text = f"I couldn't find any results for **{extracted_topic}**."
                break
                
            new_papers = []
            new_abstracts = []
            for entry in entries:
                
                title = entry.find("atom:title", ns).text.strip().replace("\n", " ")
                abstract = entry.find("atom:summary", ns).text.strip()
                author_elements = entry.findall("atom:author", ns)
                authors = ", ".join([a.find("atom:name", ns).text.strip() for a in author_elements])
                print(type(title))
                print(type(abstract))
                print(type(authors))
                # print(type(pdf_url))
                pdf_url = ""
                for link in entry.findall("atom:link", ns):
                    if link.get("title") == "pdf":
                        pdf_url = link.get("href")
                        break
                if not pdf_url: # Fallback to standard id link
                    pdf_url = entry.find("atom:id", ns).text
                
                # Extract Headings from ArXiv HTML
                headings = []
                try:
                    # atom:id is usually http://arxiv.org/abs/xxxx.xxxxv1 or similar
                    entry_id_url = entry.find("atom:id", ns).text
                    paper_id_match = re.search(r'/abs/(.+?)(?:v\d+)?$', entry_id_url)
                    if paper_id_match:
                        paper_id_only = paper_id_match.group(1)
                        # We try to get the v1 HTML by default or the exact version
                        html_url = f"https://arxiv.org/html/{paper_id_only}v1"
                        html_res = requests.get(html_url, timeout=5)
                        if html_res.status_code == 200:
                            soup = BeautifulSoup(html_res.text, "html.parser")
                            items = soup.find_all("span", class_="ltx_text ltx_ref_title")
                            data = [item.get_text(strip=True) for item in items]
                            for item in data:
                                if re.match(r'^\d+[A-Za-z]', item):
                                    cleaned = re.sub(r'^\d+', '', item)
                                    headings.append(cleaned)
                except Exception as e:
                    print(f"Failed to extract headings for {title}: {e}")

                new_papers.append({
                    "title": title,
                    "authors": authors,
                    "abstract": abstract,
                    "pdf_url": pdf_url,
                    "headings": headings
                })
                new_abstracts.append(abstract)

            # Novelty Check
            novel_indices = []
            if not old_abstracts:
                novel_indices = list(range(len(new_papers)))
            else:
                old_text = "\\n\\n".join([f"OLD {i}: {a}" for i, a in enumerate(old_abstracts)])
                new_text = "\\n\\n".join([f"NEW {i}: {a}" for i, a in enumerate(new_abstracts)])
                
                prompt = f"""
You are an AI filtering redundant research papers.
Here are previously recommended abstracts:
{old_text}

Here are newly fetched abstracts:
{new_text}

Determine which of the NEW abstracts are genuinely novel and are NOT highly similar to any of the OLD abstracts.
Return your answer strictly as a JSON list of integer indices (e.g., [0, 2]) for the novel NEW abstracts. Do not include markdown formatting or explanation. If none are novel, return [].
"""
                dedup_response = extract_text(llm.invoke([HumanMessage(content=prompt)]))
                print(dedup_response)
                cleaned = dedup_response.replace("```json", "").replace("```", "").strip()
                try:
                    indices = json.loads(cleaned)
                    novel_indices = [int(i) for i in indices if isinstance(i, (int, float))]
                except Exception as e:
                    print(f"[search_node] JSON parse fail for deduplication: {dedup_response}")
                    novel_indices = list(range(len(new_papers)))

            if novel_indices:
                formatted_results = []
                for idx in novel_indices:
                    if idx >= len(new_papers): continue
                    
                    p = new_papers[idx]
                    
                    # Generate a concise UI summary
                    sum_prompt = f"Provide a concise, 2-sentence summary of this abstract for a UI dashboard: {p['abstract']}"
                    
                    ui_summary = extract_text(llm.invoke([HumanMessage(content=sum_prompt)])).strip()
                    print(ui_summary)
                    # Store in SQLite
                    c.execute(
                        "INSERT INTO papers (project_id, user_id, title, authors, abstract, summary, pdf_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (project_id, user_id, p["title"], p["authors"], p["abstract"], ui_summary, p["pdf_url"])
                    )
                    conn.commit()
                    
                    # Post to UI
                    if project_id:
                        try:
                            paper_data = {
                                "userId": user_id,
                                "title": p["title"],
                                "link": p["pdf_url"],
                                "authors": p["authors"],
                                "snippet": ui_summary,
                                "summary": ui_summary,
                                "citedBy": 0, # ArXiv doesn't supply this cleanly
                                "headings": p["headings"]
                            }
                            requests.post(f"http://localhost:5000/api/projects/{project_id}/papers", json=paper_data)
                        except Exception as db_err:
                            print(f"[search_node] Failed to push to UI DB: {db_err}")
                            
                    formatted_results.append(
                        f"### 📄 [{p['title']}]({p['pdf_url']})\n"
                        f"**Authors:** {p['authors']}\n\n"
                        f"> {ui_summary}\n"
                    )
                    
                response_text = f"Here are the latest genuinely novel research papers I found on ArXiv for **{extracted_topic}**:\n\n" + "\n---\n\n".join(formatted_results)
                break # We found valid papers, exit loop
                
        except Exception as e:
            response_text = f"I encountered an error while searching for papers: {e}"
            break
            
    return {"messages": [AIMessage(content=response_text)]}

def load_node(state: AgentState):
    response_text = "The 'load paper' feature is coming soon! For now, please summarize or paste the snippets you want me to read."
    return {"messages": [AIMessage(content=response_text)]}

def detect_intent(state: AgentState) -> str:
    """Evaluates the last user message and decides the route."""
    last_msg = state["messages"][-1]
    if not isinstance(last_msg, HumanMessage):
        return "ask_question"
        
    message_lower = last_msg.content.lower()
    
    # Keyword matching
    find_keywords = ["find", "search", "show me papers", "look for", "get papers", "more papers"]
    load_keywords = ["load", "read", "open", "analyze this", "tell me about this paper"]
    flowchart_keywords = ["flowchart", "diagram", "visualize", "draw", "architecture"]
    
    if any(kw in message_lower for kw in find_keywords):
        return "find_papers"
    
    if any(kw in message_lower for kw in flowchart_keywords):
        return "flowchart"
        
    if any(kw in message_lower for kw in load_keywords):
        return "load_paper"
    
    # Default: treat as a question -> standard LLM
    return "ask_question"

def flowchart_node(state: AgentState):
    """Generates a Mermaid JS flowchart based on Qdrant context."""
    last_msg = state["messages"][-1].content
    thread_id = state.get("thread_id", "")
    
    # Extract concept
    extraction_prompt = f"What specific concept or process does the user want a flowchart of? Respond only with the concise topic. User said: '{last_msg}'"
    topic = extract_text(llm.invoke([HumanMessage(content=extraction_prompt)])).strip()
    
    # Identify uploaded PDFs from history
    available_pdfs = []
    for m in state["messages"]:
        if isinstance(m, AIMessage) and "successfully parsed into" in m.content and "uploaded a PDF named" in m.content:
            try:
                fname = m.content.split("uploaded a PDF named '")[1].split("'")[0]
                if fname not in available_pdfs:
                    available_pdfs.append(fname)
            except Exception:
                pass
                
    # Extract target filename using LLM
    target_filename = "all"
    if available_pdfs:
        target_prompt = f"The user asks to map: '{topic}'. Which ONE of these uploaded research papers are they referring to? Options: {available_pdfs}. Respond strictly with the exact filename, or 'all'. Return NOTHING ELSE."
        target_response = extract_text(llm.invoke([HumanMessage(content=target_prompt)])).strip()
        print(target_response) 
        if target_response in available_pdfs:
            target_filename = target_response
            
    # Perform RAG
    rag_context = ""
    if thread_id:
        retrieved_sections = query_qdrant(thread_id, topic, n_results=5, target_filename=target_filename)
        if retrieved_sections:
            rag_context = "\n\n".join(retrieved_sections)
    
    system_prompt = f"""
You are an expert at creating visual diagrams using Mermaid JS.
The user wants a flowchart mapping out: {topic}.

Based on ALL the context and facts you have in this chat history, synthesize a logical, step-by-step process flow or architectural diagram. 
If there is factual context provided below, prioritize it over your general knowledge.

Context from documents:
{rag_context}

RULES:
1. ONLY output valid Mermaid JS syntax starting with `graph TD` or `flowchart LR`.
2. Do NOT use markdown inside the Mermaid node labels (no asterisks, backticks, or HTML).
3. Keep the labels incredibly short (max 4-5 words per bubble).
4. Put the Mermaid syntax inside standard Markdown code blocks: ```mermaid [your code] ```
5. You may write a 1 sentance summary above the code block.
"""
    
    response = llm.invoke(state["messages"] + [SystemMessage(content=system_prompt)])
    return {"messages": [response]}

# ─────────────────────────────────────────────────────────────
# Graph Construction
# ─────────────────────────────────────────────────────────────
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("chatbot", chatbot_node)
workflow.add_node("search_papers", search_node)
workflow.add_node("load_paper", load_node)
workflow.add_node("flowchart", flowchart_node)

# Add Conditional Edge from START based on intent
workflow.add_conditional_edges(
    START,
    detect_intent,
    {
        "find_papers": "search_papers",
        "load_paper": "load_paper",
        "flowchart": "flowchart",
        "ask_question": "chatbot"
    }
)

# All routes lead to END
workflow.add_edge("chatbot", END)
workflow.add_edge("search_papers", END)
workflow.add_edge("load_paper", END)
workflow.add_edge("flowchart", END)

# Configure the SQLite memory saver
DB_PATH = "agent_memory.db"
conn = sqlite3.connect(DB_PATH, check_same_thread=False)

with conn:
    conn.execute('''CREATE TABLE IF NOT EXISTS papers 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id text, user_id text, title text, authors text, abstract text, summary text, pdf_url text, created_at timestamp DEFAULT CURRENT_TIMESTAMP)''')

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
        
        content = m.content
        if isinstance(content, list):
            content = "".join(c.get("text", "") for c in content if isinstance(c, dict) and "text" in c)
            
        history.append({"role": role, "content": content})
    return history


def chat_with_memory(
    thread_id: str,
    message: str,
    system_prompt: str,
    project_id: str = "",
    user_id: str = ""
) -> str:
    """
    Chat with the agent using LangGraph's Sqlite checkpointer.
    The system prompt is injected if this is the start of a thread.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    # Check if thread is empty by trying to get state
    state = agent_app.get_state(config)
    
    inputs = {"messages": [], "project_id": project_id, "user_id": user_id, "thread_id": thread_id}
    
    if not state.values.get("messages", []):
        # First interaction! Embed the system prompt
        inputs["messages"].append(SystemMessage(content=system_prompt))
        
    inputs["messages"].append(HumanMessage(content=message))
    
    # Stream or invoke through LangGraph
    response = agent_app.invoke(inputs, config=config)
    
    # The last message is the AI's response
    last_msg = response["messages"][-1]
    content = last_msg.content
    
    if isinstance(content, list):
        content = "".join(c.get("text", "") for c in content if isinstance(c, dict) and "text" in c)
        
    return content


# ─────────────────────────────────────────────────────────────
# Supervisor Agent Graph & Logic
# ─────────────────────────────────────────────────────────────

def supervisor_node(state: AgentState):
    """
    Supervisor Node fetches the real-time project context string from the Node backend,
    injects it as a SystemMessage, and calls Gemini with the thread history.
    """
    project_id = state.get("project_id", "")
    context_str = "No workspace context available."
    
    if project_id:
        try:
            import requests
            resp = requests.get(f"http://localhost:5000/api/projects/{project_id}/context")
            if resp.status_code == 200:
                context_str = resp.json().get("context", context_str)
        except Exception as e:
            print(f"[supervisor_node] Error fetching context: {e}")
            
    system_prompt = f"""You are the Lead Project Supervisor for a collaborative research team.

{context_str}

Use this real-time knowledge to answer the student's questions, guide their research, and oversee the distribution of subtopics and research papers. Base your answers solely on the provided Workspace Overview and the conversational history.
"""
    
    # We pass the SystemMessage *only* to the LLM invocation so it isn't permanently 
    # saved into the SQLite checkpointer history on every single turn.
    response = llm.invoke([SystemMessage(content=system_prompt)] + state["messages"])
    return {"messages": [response]}

supervisor_workflow = StateGraph(AgentState)
supervisor_workflow.add_node("supervisor", supervisor_node)
supervisor_workflow.add_edge(START, "supervisor")
supervisor_workflow.add_edge("supervisor", END)
supervisor_app = supervisor_workflow.compile(checkpointer=memory)

def chat_supervisor_memory(
    thread_id: str,
    message: str,
    project_id: str,
    user_id: str
) -> str:
    """
    Chat with the Supervisor agent using LangGraph's Sqlite checkpointer.
    """
    config = {"configurable": {"thread_id": thread_id}}
    inputs = {"messages": [HumanMessage(content=message)], "project_id": project_id, "user_id": user_id, "thread_id": thread_id}
    
    # Invoke the supervisor graph
    response = supervisor_app.invoke(inputs, config=config)
    
    # The last message is the AI's response
    last_msg = response["messages"][-1]
    content = last_msg.content
    
    if isinstance(content, list):
        content = "".join(c.get("text", "") for c in content if isinstance(c, dict) and "text" in c)
        
    return content

