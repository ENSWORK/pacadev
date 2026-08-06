"""
Mem0 local — LiteLLM/OpenRouter LLM + ChromaDB vector store.

Persistence: ~/.pacadev/memory/
Collection: pacadev_memory
"""
from __future__ import annotations

import os
from pathlib import Path

MEMORY_DIR = Path.home() / ".pacadev" / "memory"
CHROMA_DIR = MEMORY_DIR / "chroma_db"
HISTORY_DB = MEMORY_DIR / "history.db"

MEMORY_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("MEM0_DIR", str(MEMORY_DIR))

MEMORY_AVAILABLE = False
_memory_instance = None

CONFIG = {
    "llm": {
        "provider": "litellm",
        "config": {
            "model": os.getenv("LITELLM_MODEL", "openrouter/deepseek/deepseek-chat"),
            "temperature": 0.1,
            "max_tokens": 1000,
        },
    },
    "embedder": {
        "provider": "fastembed",
        "config": {
            "model": "BAAI/bge-small-en-v1.5",
        },
    },
    "vector_store": {
        "provider": "chroma",
        "config": {
            "path": str(CHROMA_DIR),
            "collection_name": "pacadev_memory",
        },
    },
    "history_db_path": str(HISTORY_DB),
}


def get_memory():
    """Return the Mem0 Memory instance, initializing lazily. Returns None if unavailable."""
    global _memory_instance, MEMORY_AVAILABLE
    if _memory_instance is not None:
        return _memory_instance
    try:
        from mem0 import Memory
        _memory_instance = Memory.from_config(CONFIG)
        MEMORY_AVAILABLE = True
    except ImportError:
        pass
    except Exception:
        pass
    return _memory_instance


if __name__ == "__main__":
    m = get_memory()
    if m:
        print("OK: Mem0 pacadev configured")
        print(f"Store: {CHROMA_DIR}")
        r = m.search("odoo v17 computed fields", user_id="odoo17_official")
        print(f"Test search: {str(r)[:120]}...")
    else:
        print("WARN: mem0 not available (pip install mem0ai chromadb)")
