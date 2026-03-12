import os
import re
from typing import Dict, List
from dotenv import load_dotenv

from llama_parse import LlamaParse
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

load_dotenv()

# Setup Local HuggingFace Embeddings model (free, unlimited, stable)
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize Qdrant Cloud client
qdrant_url = os.getenv("QDRANT_URL")
qdrant_api_key = os.getenv("QDRANT_API_KEY")

if qdrant_url and qdrant_api_key:
    qdrant_client = QdrantClient(
        url=qdrant_url, 
        api_key=qdrant_api_key,
    )
else:
    # Error will be thrown later if we try to use it without keys defined
    qdrant_client = None

def get_embedding(text: str) -> List[float]:
    """Generates an embedding for the given text using local HuggingFace model."""
    embedding = embedding_model.encode(text)
    return embedding.tolist()

def split_into_sections(markdown: str) -> Dict[str, str]:
    """Splits markdown into logical sections based on h2 headers."""
    sections = {}
    current_section = "header"
    current_content = []
    
    lines = markdown.split("\n")
    
    for line in lines:
        if line.startswith("## "):
            if current_content:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = line.replace("## ", "").strip().lower()
            current_content = []
        else:
            current_content.append(line)
            
    if current_content:
        sections[current_section] = "\n".join(current_content).strip()
        
    return sections

def process_pdf_to_qdrant(file_path: str, project_id: str, thread_id: str):
    """Parses a PDF using LlamaParse, splits it into sections, and stores in Qdrant."""
    
    if not qdrant_client:
        raise ValueError("Missing QDRANT_URL or QDRANT_API_KEY in environment variables")
    
    llama_api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    print(llama_api_key)
    if not llama_api_key:
        raise ValueError("Missing LLAMA_CLOUD_API_KEY in environment variables")
        
    parser = LlamaParse(
        api_key=llama_api_key,
        result_type="markdown",
        parsing_instruction="""
        You are parsing an academic research paper for a research 
        collaboration platform. The output will be used for:
        1. RAG (retrieval augmented generation) - so sections must 
           be clearly separated
        2. Structured extraction - so key content must be preserved exactly
        3. Citation and reference tracking - so references must be clean

        Follow these rules strictly:

        SECTION STRUCTURE:
        - Start every major section with ## (h2 heading)
        - Use the exact section name from the paper
        - Common sections: Abstract, Introduction, Related Work, Methodology, Experiments, Results, Discussion, Conclusion, References
        - If a section has subsections use ### (h3)
        - Never skip section headings even if content is short

        ABSTRACT:
        - Always extract as its own section ## Abstract
        - Keep it complete, word for word
        - This is critical - never summarize or truncate

        EQUATIONS:
        - Wrap every equation in $$ on its own line
        - Example: $$L(w) = \\frac{1}{n}\\sum_{i=1}^{n} l(w, x_i)$$
        - Give each equation a label if the paper has one
        - If equation is inline keep it as $equation$
        - Never convert equations to plain text descriptions

        TABLES:
        - Preserve every table in markdown table format
        - Keep all column headers exactly as in paper
        - Keep all numerical values exactly as in paper
        - Add a caption above the table if paper has one: **Table N: caption text**
        - Never summarize or skip tables

        FIGURES:
        - Cannot render images but extract figure captions fully
        - Format as: **Figure N: [exact caption text]**
        - Place caption where figure appears in paper
        - If figure has subfigures label them: Figure 1a, Figure 1b

        ALGORITHMS:
        - Preserve pseudocode in code blocks
        - Use ```algorithm  ``` fencing
        - Keep line numbers if present
        - Keep all variable names exactly as written

        REFERENCES:
        - Extract as ## References section at end
        - Each reference on its own line starting with [N]
        - Format: [N] Authors. "Title". Venue, Year.
        - Preserve DOI or arXiv links if present

        WHAT TO IGNORE:
        - Page numbers
        - Headers and footers repeated on each page
        - "Submitted to..." or review watermarks
        - Column layout artifacts (paper may be 2-column, output should be single column flowing text)

        AUTHOR AND METADATA:
        - Extract at very top before Abstract as:
          **Authors:** names here
          **Institution:** affiliations
          **Published:** venue and year if present
          **arXiv:** link if present
        """,
        verbose=True,
        language="en",
        skip_diagonal_text=True,
        invalidate_cache=False,
    )
    
    # Extract markdown
    parsed_docs = parser.load_data(file_path)
    if not parsed_docs:
        raise ValueError("Failed to extract text from PDF")
        
    full_markdown = parsed_docs[0].text
    
    # Split into sections
    sections = split_into_sections(full_markdown)
    
    # Define collection name (must conform to Qdrant naming rules)
    # Appended _v2 to force fresh collections since we changed embedding dimensions
    collection_name = f"thread_{thread_id.replace('-', '_')}_v2" 
    
    # Check if collection exists, if not create it
    try:
        qdrant_client.get_collection(collection_name)
    except Exception:
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=384, # all-MiniLM-L6-v2 embedding size
                distance=models.Distance.COSINE
            )
        )
    
    points = []
    
    # Prepare data for Qdrant
    # Qdrant requires UUIDs or integers for point IDs
    import uuid
    for section_title, content in sections.items():
        if not content.strip():
            continue
            
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{file_path}_{section_title}"))
        
        # Generate embedding manually
        vector = get_embedding(content)
        
        points.append(
            models.PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "text": content,
                    "source": file_path,
                    "filename": os.path.basename(file_path),
                    "section": section_title,
                    "project_id": project_id,
                    "thread_id": thread_id
                }
            )
        )
        
    # Add to Qdrant Cloud
    if points:
        qdrant_client.upsert(
            collection_name=collection_name,
            points=points
        )
        
    return list(sections.keys())

def query_qdrant(thread_id: str, query: str, n_results: int = 3, target_filename: str = None) -> List[str]:
    """Queries the Qdrant vector database for relevant sections, optionally filtered by filename."""
    
    if not qdrant_client:
        print("Warning: Qdrant client not configured.")
        return []
        
    collection_name = f"thread_{thread_id.replace('-', '_')}_v2" 
    try:
        # Check if collection exists
        qdrant_client.get_collection(collection_name)
        
        # Manually embed the query string
        query_vector = get_embedding(query)
        
        # Build filter if filename target is provided
        query_filter = None
        if target_filename and target_filename.strip().lower() != "all":
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="filename",
                        match=models.MatchValue(value=target_filename.strip())
                    )
                ]
            )
        
        results = qdrant_client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=n_results
        )
        
        if not results:
            return []
            
        # Extract the source text from the payloads
        return [hit.payload.get("text", "") for hit in results]
    except Exception as e:
        print(f"Error querying Qdrant: {e}")
        return []


# ─────────────────────────────────────────────────────────────
# Paper Clustering Helpers
# ─────────────────────────────────────────────────────────────

def embed_paper_for_clustering(project_id: str, paper_title: str, user_id: str, text: str, feedback: str = ""):
    """
    Embeds a completed paper into a project-level Qdrant collection for clustering.
    Called after insight evaluation succeeds.
    """
    if not qdrant_client:
        print("Warning: Qdrant client not configured. Skipping paper embedding.")
        return

    import uuid as _uuid

    collection_name = f"paper_clusters_{project_id.replace('-', '_')}"

    # Create collection if it doesn't exist (384-dim for all-MiniLM-L6-v2)
    try:
        qdrant_client.get_collection(collection_name)
    except Exception:
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=384,
                distance=models.Distance.COSINE
            )
        )

    vector = get_embedding(text)
    point_id = str(_uuid.uuid4())

    qdrant_client.upsert(
        collection_name=collection_name,
        points=[
            models.PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "paper_title": paper_title,
                    "user_id": user_id,
                    "project_id": project_id,
                    "feedback": feedback
                }
            )
        ]
    )
    print(f"[clustering] Embedded paper '{paper_title}' into collection '{collection_name}'")


def get_all_paper_vectors(project_id: str) -> List[dict]:
    """
    Retrieves all paper vectors from a project's clustering collection.
    Returns a list of dicts: {id, vector, paper_title, user_id}
    """
    if not qdrant_client:
        print("Warning: Qdrant client not configured.")
        return []

    collection_name = f"paper_clusters_{project_id.replace('-', '_')}"

    try:
        qdrant_client.get_collection(collection_name)
    except Exception:
        print(f"[clustering] Collection '{collection_name}' does not exist yet. Creating it now.")
        try:
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=384,
                    distance=models.Distance.COSINE
                )
            )
            print(f"[clustering] Created collection '{collection_name}'")
        except Exception as create_err:
            print(f"[clustering] Failed to create collection: {create_err}")
        return []

    all_points = []
    offset = None

    while True:
        results, next_offset = qdrant_client.scroll(
            collection_name=collection_name,
            limit=100,
            offset=offset,
            with_vectors=True
        )

        for point in results:
            all_points.append({
                "id": point.id,
                "vector": point.vector,
                "paper_title": point.payload.get("paper_title", "Unknown"),
                "user_id": point.payload.get("user_id", "Unknown"),
                "feedback": point.payload.get("feedback", "")
            })

        if next_offset is None:
            break
        offset = next_offset

    return all_points
