import logging
import json
import time
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Services
from .cache_manager import cache_manager
from .memory_manager import memory_manager
from .tool_manager import tool_manager

# Exception types for Retry
# We'll just generic catch for now or import specific provider errors if available
# Assuming generic Exception for broad coverage as requested ("Must catch generic exceptions")

logger = logging.getLogger(__name__)

class SmartExecutor:
    def __init__(self):
        pass

    def _clean_output(self, text: str) -> str:
        """Removes <think> tags and other artifacts."""
        if not text: return ""
        import re
        # Regex for <think>...</think> (dotall equivalent)
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()
        # Remove leading separators
        text = re.sub(r'^---\s*', '', text).strip()
        # Remove Markdown bold/italic markers (** or *)
        text = re.sub(r'\*\*+', '', text)
        # Remove content in parentheses (meta comments)
        text = re.sub(r'\([^)]*\)', '', text).strip()
        return text

    def execute(self, 
                db: Session,
                node_id: str,
                system_prompt: str,
                user_input: str, 
                llm_callable, 
                config: dict = None):
        """
        Orchestrates the AI Execution:
        1. Check Cache
        2. Fetch Memory
        3. Execute LLM (Retry)
        4. Save Memory/Cache
        """
        use_cache = config.get("use_smart_cache", True) if config else True
        use_memory = config.get("use_memory", False) if config else False
        use_web_search = config.get("use_web_search", False) if config else False
        include_images = config.get("include_images", True) if config else True
        
        # 1. Memory Fetch
        memory_context = []
        if use_memory:
            memory_context = memory_manager.get_context(db, node_id)

        # 2. Cache Check
        # Generate Key with Prefix Strategy
        model_name = config.get("model", "default") if config else "default"
        cache_key = cache_manager.generate_key_with_prefix(node_id, system_prompt, user_input, memory_context, model=model_name)
        
        if use_cache:
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                # CACHE HIT - SANITIZE HERE TOO
                cleaned_cache = self._clean_output(cached_result)
                return {
                    "content": cleaned_cache,
                    "meta": {
                        "source": "cache",
                        "duration_ms": 0,
                        "timestamp": time.time()
                    }
                }

        # 3. Execution (Cache Miss)
        start_time = time.time()
        
        try:
            # Prepare Prompt (Inject Memory)
            # Ideally llm_callable handles list of messages, OR we construct a big string
            # Assuming llm_callable accepts (system, user, history=[]) or we merge them
            # Let's assume we pass the raw components and llm_callable handles it, 
            # OR we merge memory into system/user prompt here.
            # Strategy: Prepend memory to User Input or System?
            # Better Strategy: If llm_callable supports messages list, use it.
            # If it's a simple (system, input) func, we inject memory into input text.
            
            final_input = user_input
            tool_data = None
            
            # --- 2.5 Tool Use (Web Search) ---
            if use_web_search:
                try:
                    # Step A: Query Refinement (Thought)
                    # We use the same LLM to convert the user intent into a search query
                    query_gen_prompt = (
                        f"You are a Search Engine Optimizer. \n"
                        f"Convert this user request into a single, optimal Google search query to find the most relevant and recent facts.\n"
                        f"Request: '{user_input}'\n"
                        f"Return ONLY the query string, no quotes."
                    )
                    # Simple non-retried call for query gen
                    search_query = llm_callable("You are a helpful query generator.", query_gen_prompt).strip().strip('"')
                    logger.info(f"SmartExecutor: Generated Search Query -> '{search_query}'")
                    
                    # Step B: Execute Tool
                    tool_data = tool_manager.search(search_query, include_images=include_images, db=db)
                    
                    # Step C: Synthesize Context
                    search_context_str = "### [Fresh Web Search Results]\n"
                    if tool_data.get('summary'):
                        search_context_str += f"AI Summary: {tool_data['summary']}\n"
                    
                    for idx, res in enumerate(tool_data.get('results', [])):
                        search_context_str += f"Source {idx+1}: [{res['title']}]({res['url']})\nSnippet: {res['content']}...\n\n"
                        
                    if tool_data.get('images'):
                        search_context_str += f"### [Found Visual References]\n" + "\n".join(tool_data['images']) + "\n"

                    # Inject into Input
                    final_input = f"{final_input}\n\n{search_context_str}\n\n[Instruction: Use the above Search Results to answer. Cite sources as [Source Name].]"
                    
                except Exception as e:
                    logger.error(f"Tool Use Failed: {e}")
                    # Continue without search context if failed
            
            # --- Memory Injection (Prepend) ---
            if use_memory and memory_context:
                history_str = "\n".join([f"{msg['role'].upper()}: {msg['content']}" for msg in memory_context])
                final_input = f"Previous Context:\n{history_str}\n\n{final_input}"

            # Retry Wrapper
            @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
            def _run_llm():
                return llm_callable(system_prompt, final_input)

            output_text = _run_llm()
            
            # --- CLEAN OUTPUT ---
            output_text = self._clean_output(output_text)
            
            duration = (time.time() - start_time) * 1000 # ms

            # 4. Save State (Cleaned)
            if use_cache:
                cache_manager.set(cache_key, output_text)
            
            if use_memory:
                memory_manager.add_turn(db, node_id, user_input, output_text)

            return {
                "content": output_text,
                "meta": {
                    "source": "api",
                    "duration_ms": int(duration),
                    "timestamp": time.time(),
                    "tool_data": tool_data # Pass back for Frontend Citations
                }
            }

        except Exception as e:
            logger.error(f"SmartExecution Failed: {e}")
            raise e

smart_executor = SmartExecutor()
