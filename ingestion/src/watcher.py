from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

ARCHIVE_EXTENSIONS = (".tar.gz", ".zip", ".bz2", ".tar")
IGNORED_SUFFIXES = (".part", ".tmp")


@dataclass(frozen=True)
class ManifestEvent:
    path: Path
    checksum: str
    version: str
    discovered_at: float


class SDEWatcher:
    """Polls the SDE downloads directory for new or updated archives."""

    def __init__(self, downloads_dir: Path) -> None:
        self.downloads_dir = downloads_dir
        self._seen: Dict[Path, str] = {}

    def scan(self) -> List[ManifestEvent]:
        events: List[ManifestEvent] = []
        for path in sorted(self._iter_candidate_files()):
            checksum = self._sha256(path)
            previous = self._seen.get(path)
            if previous == checksum:
                continue
            self._seen[path] = checksum
            version = self._derive_version(path)
            events.append(
                ManifestEvent(
                    path=path,
                    checksum=checksum,
                    version=version,
                    discovered_at=time.time(),
                )
            )
        return events

    def _iter_candidate_files(self) -> Iterable[Path]:
        if not self.downloads_dir.exists():
            return []
        candidates = []
        for entry in self.downloads_dir.iterdir():
            if not entry.is_file():
                continue
            lower_name = entry.name.lower()
            if lower_name.endswith(IGNORED_SUFFIXES):
                continue
            if not lower_name.endswith(ARCHIVE_EXTENSIONS):
                continue
            candidates.append(entry)
        return candidates

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _derive_version(path: Path) -> str:
        name = path.name
        for ext in ARCHIVE_EXTENSIONS:
            if name.lower().endswith(ext):
                return name[: -len(ext)]
        return path.stem
