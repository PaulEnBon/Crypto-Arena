"""Development launcher: `python run.py` (equivalent to `uvicorn app.main:app --reload`).

On Windows it selects a psycopg-compatible event loop (see app/runtime.py); the same
result is obtained with: uvicorn app.main:app --reload --loop app.runtime:selector_event_loop
"""

import os

import uvicorn

from app.runtime import UVICORN_LOOP

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "true").lower() == "true",
        loop=UVICORN_LOOP,
    )
