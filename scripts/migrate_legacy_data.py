#!/usr/bin/env python3
"""
Utility to move legacy single-tenant data files into the new per-user layout.

Example:
    python scripts/migrate_legacy_data.py --user-id alice@example.com
"""

import argparse
import shutil
import sys
from pathlib import Path
from typing import Dict, Iterable, Optional

# Ensure project root is importable
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from user_context import (  # noqa: E402
    get_activity_path,
    get_pending_transactions_path,
    get_transactions_path,
    get_user_dir,
)


LEGACY_FILE_RESOLVERS = {
    "new_transactions.json": get_transactions_path,
    "pending_transactions.json": get_pending_transactions_path,
    "My Activity.html": get_activity_path,
}


def iter_takeout_archives(source_dir: Path) -> Iterable[Path]:
    yield from source_dir.glob("takeout-*.zip")


def migrate_file(user_id: str, source: Path, destination: Path, dry_run: bool) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        print(f"[dry-run] Would move {source} -> {destination}")
        return

    print(f"Moving {source} -> {destination}")
    shutil.move(str(source), destination)


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy data files into per-user storage.")
    parser.add_argument("--user-id", required=True, help="Email/identifier used during Google OAuth login.")
    parser.add_argument(
        "--source-dir",
        default=".",
        help="Directory containing legacy files (defaults to project root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned moves without modifying the filesystem.",
    )

    args = parser.parse_args(list(argv) if argv is not None else None)
    source_dir = Path(args.source_dir).resolve()
    if not source_dir.exists():
        print(f"Source directory does not exist: {source_dir}", file=sys.stderr)
        return 1

    get_user_dir(args.user_id)  # Ensure directory exists

    planned_moves: Dict[Path, Path] = {}
    for filename, resolver in LEGACY_FILE_RESOLVERS.items():
        legacy_path = source_dir / filename
        if legacy_path.exists():
            planned_moves[legacy_path] = resolver(args.user_id)

    for archive in iter_takeout_archives(source_dir):
        planned_moves[archive] = get_user_dir(args.user_id) / archive.name

    if not planned_moves:
        print("No legacy files found. Nothing to migrate.")
        return 0

    for source, destination in planned_moves.items():
        migrate_file(args.user_id, source, destination, args.dry_run)

    print("Migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

