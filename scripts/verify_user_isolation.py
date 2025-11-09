#!/usr/bin/env python3
"""
Quick smoke-check that user-specific storage paths are isolated.

Example:
    python scripts/verify_user_isolation.py --user-id alice@example.com --user-id bob@example.com
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, List, Optional

# Ensure project root on import path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from user_context import (  # noqa: E402
    get_activity_path,
    get_pending_transactions_path,
    get_transactions_path,
)


def summarise_json(path: Path) -> str:
    if not path.exists():
        return "absent"
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, list):
            return f"list ({len(data)} entries)"
        if isinstance(data, dict):
            return f"dict ({len(data)} keys)"
        return f"type={type(data).__name__}"
    except Exception as exc:
        return f"unreadable ({exc})"


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Verify per-user data isolation.")
    parser.add_argument(
        "--user-id",
        action="append",
        dest="user_ids",
        required=True,
        help="Add a user to the isolation check (repeat flag for multiple users).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    user_ids: List[str] = args.user_ids
    if len(user_ids) < 1:
        parser.error("At least one --user-id is required.")

    seen_paths = {}
    for user_id in user_ids:
        tx_path = get_transactions_path(user_id)
        pending_path = get_pending_transactions_path(user_id)
        activity_path = get_activity_path(user_id)

        for label, path in (
            ("transactions", tx_path),
            ("pending", pending_path),
            ("activity", activity_path),
        ):
            seen_paths.setdefault(path, []).append((user_id, label))

        print(f"\nUser: {user_id}")
        print(f"  transactions: {tx_path} [{summarise_json(tx_path)}]")
        print(f"  pending:      {pending_path} [{summarise_json(pending_path)}]")
        print(f"  activity:     {activity_path} [{'exists' if activity_path.exists() else 'absent'}]")

    overlaps = {path: owners for path, owners in seen_paths.items() if len(owners) > 1}
    if overlaps:
        print("\n[ERROR] Found overlapping storage paths:")
        for path, owners in overlaps.items():
            owner_str = ", ".join(f"{user_id}:{label}" for user_id, label in owners)
            print(f"  {path} shared by {owner_str}")
        return 1

    print("\nIsolation check passed: no shared storage paths detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

