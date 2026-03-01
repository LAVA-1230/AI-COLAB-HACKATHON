import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List
import operator

load_dotenv()

# Define state
class AgentState(TypedDict):
    messages: Annotated[List[str], operator.add]

# Initialize LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7
)

# Define node function
def call_model(state: AgentState):
    messages = state['messages']
    # Simple interaction: just send the last message or full history to LLM
    # For simplicity, we just send the last user message
    last_message = messages[-1]
    response = llm.invoke(last_message)
    return {"messages": [response.content]}

# Build graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", call_model)

# Set entry point
workflow.set_entry_point("agent")

# Add edges
workflow.add_edge("agent", END)

# Compile
app = workflow.compile()

def process_message(user_input: str):
    # Depending on how langgraph is set up, we might need to invoke with a list
    inputs = {"messages": [user_input]}
    result = app.invoke(inputs)
    # The result 'messages' will contain the full history or updates depending on reducer.
    # Our node returns a list with the response, and operator.add appends it.
    # So the last message in result['messages'] should be the AI response.
    return result['messages'][-1]
