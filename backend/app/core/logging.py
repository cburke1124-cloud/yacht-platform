import logging
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict

# ---------------------------------------------------------------------------
# In-memory ring buffer — keeps the last MAX_ENTRIES log records so the
# admin dashboard can read live logs without touching the filesystem.
# ---------------------------------------------------------------------------
MAX_LOG_ENTRIES = 2000

class _MemoryLogHandler(logging.Handler):
    """Thread-safe circular buffer that stores the last N log records as dicts."""

    def __init__(self, capacity: int = MAX_LOG_ENTRIES):
        super().__init__()
        self._buf: deque = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord):
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
            "message": self.format(record),
        }
        if record.exc_info:
            import traceback
            entry["exc_info"] = "".join(traceback.format_exception(*record.exc_info))
        with self._lock:
            self._buf.append(entry)

    def get_records(
        self,
        level: str | None = None,
        search: str | None = None,
        limit: int = 500,
    ) -> List[Dict]:
        with self._lock:
            records = list(self._buf)

        if level and level.upper() != "ALL":
            lvl_num = getattr(logging, level.upper(), None)
            if lvl_num is not None:
                records = [r for r in records if getattr(logging, r["level"], 0) >= lvl_num]

        if search:
            s = search.lower()
            records = [r for r in records if s in r["message"].lower() or s in r.get("logger", "").lower()]

        return records[-limit:]

    def clear(self):
        with self._lock:
            self._buf.clear()

    @property
    def entry_count(self) -> int:
        with self._lock:
            return len(self._buf)


# Singleton — imported by routes_admin and anywhere else that needs it
memory_log_handler = _MemoryLogHandler(capacity=MAX_LOG_ENTRIES)


def setup_logging(
    log_level: str = "INFO",
    log_file: str = "logs/yachtversal.log",
    json_logs: bool = False,
):
    Path("logs").mkdir(exist_ok=True)

    # Use the root logger so ALL loggers (uvicorn, sqlalchemy, etc.) are captured
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    app_logger = logging.getLogger("yachtversal")
    app_logger.setLevel(getattr(logging, log_level.upper()))

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    try:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
    except Exception:
        file_handler = None

    if json_logs:
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
            '"module": "%(module)s", "message": "%(message)s"}'
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    console_handler.setFormatter(formatter)
    memory_log_handler.setFormatter(formatter)
    if file_handler:
        file_handler.setFormatter(formatter)

    app_logger.addHandler(console_handler)
    app_logger.addHandler(memory_log_handler)
    if file_handler:
        app_logger.addHandler(file_handler)

    # Also attach the memory handler to the root logger so uvicorn / sqlalchemy
    # errors surface in the admin log viewer
    if memory_log_handler not in root_logger.handlers:
        root_logger.addHandler(memory_log_handler)

    return app_logger