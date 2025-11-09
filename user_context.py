import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Optional

try:
    import fcntl  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None  # type: ignore[assignment]


DATA_ROOT = Path(os.environ.get("USER_DATA_ROOT", "user_data")).resolve()
TRANSACTIONS_FILENAME = "new_transactions.json"
PENDING_FILENAME = "pending_transactions.json"
ACTIVITY_FILENAME = "My Activity.html"


def sanitize_user_id(raw_user_id: str) -> str:
    """Sanitize a user identifier (e.g., email) for filesystem safety."""
    safe = "".join(c if c.isalnum() else "_" for c in raw_user_id.strip())
    return safe.lower()


def get_user_dir(user_id: str) -> Path:
    safe_id = sanitize_user_id(user_id)
    user_dir = DATA_ROOT / safe_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def get_transactions_path(user_id: str) -> Path:
    return get_user_dir(user_id) / TRANSACTIONS_FILENAME


def get_pending_transactions_path(user_id: str) -> Path:
    return get_user_dir(user_id) / PENDING_FILENAME


def get_activity_path(user_id: str) -> Path:
    return get_user_dir(user_id) / ACTIVITY_FILENAME


@contextmanager
def _locked_file(path: Path):
    """
    File lock context manager (POSIX only). Falls back to no-op lock on systems
    without fcntl support (e.g. Windows), which still benefits from atomic writes.
    """
    if fcntl is None:
        with path.open("a+"):
            yield
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+") as fh:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


def atomic_write_json(path: Path, data: Any) -> None:
    """Write JSON atomically to avoid readers seeing partial content."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8") as tmp:
        json.dump(data, tmp, indent=2, ensure_ascii=False)
        tmp.flush()
        os.fsync(tmp.fileno())
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    """Atomically write binary payloads."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("wb", delete=False, dir=path.parent) as tmp:
        tmp.write(payload)
        tmp.flush()
        os.fsync(tmp.fileno())
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def load_json(path: Path, default_factory: Optional[Callable[[], Any]] = None) -> Any:
    if not path.exists():
        return default_factory() if default_factory else None

    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return default_factory() if default_factory else None


def update_json(path: Path, mutator: Callable[[Any], Any], default_factory: Optional[Callable[[], Any]] = None) -> Any:
    """Safely load, mutate, and store JSON with an exclusive lock."""
    with _locked_file(path.with_suffix(path.suffix + ".lock")):
        current = load_json(path, default_factory)
        updated = mutator(current)
        atomic_write_json(path, updated)
        return updated

