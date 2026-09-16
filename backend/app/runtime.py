"""Event-loop helpers shared by the ASGI launcher (run.py) and the CLI scripts.

psycopg's async driver cannot run on Windows' default ProactorEventLoop, so on
Windows every entrypoint uses a SelectorEventLoop:
- uvicorn: `--loop app.runtime:selector_event_loop` (see UVICORN_LOOP / run.py);
- scripts: `run(coroutine)` instead of `asyncio.run(coroutine)`.
Both are no-ops in behaviour on Linux/macOS (production).
"""

import asyncio
import sys
from collections.abc import Callable, Coroutine
from typing import Any, TypeVar

T = TypeVar("T")


def selector_event_loop() -> asyncio.AbstractEventLoop:
    """Loop factory usable by uvicorn (`--loop app.runtime:selector_event_loop`) and asyncio.run."""
    return asyncio.SelectorEventLoop()


def loop_factory() -> Callable[[], asyncio.AbstractEventLoop] | None:
    return selector_event_loop if sys.platform == "win32" else None


# Value passed to uvicorn's `loop` option ("auto" keeps uvloop on Linux when available).
UVICORN_LOOP = "app.runtime:selector_event_loop" if sys.platform == "win32" else "auto"


def run(coroutine: Coroutine[Any, Any, T]) -> T:
    """Drop-in replacement for asyncio.run that picks a psycopg-compatible loop on Windows."""
    return asyncio.run(coroutine, loop_factory=loop_factory())
