from __future__ import annotations

import hashlib
import time
from pathlib import Path

import pytest

from ingestion.src.watcher import ManifestEvent, SDEWatcher


@pytest.fixture
def sde_dir(tmp_path: Path) -> Path:
    sde_path = tmp_path / "data" / "SDE" / "_downloads"
    sde_path.mkdir(parents=True)
    return sde_path


def _write_archive(path: Path, content: bytes, name: str) -> Path:
    archive = path / name
    archive.write_bytes(content)
    return archive


def test_watcher_emits_event_for_new_archive(sde_dir: Path) -> None:
    watcher = SDEWatcher(sde_dir)

    archive = _write_archive(sde_dir, b"example-data", "sde-2025-09-23.zip")

    events = watcher.scan()

    expected_checksum = hashlib.sha256(b"example-data").hexdigest()
    assert len(events) == 1
    event = events[0]
    assert event.path == archive
    assert event.checksum == expected_checksum
    assert event.version == "sde-2025-09-23"
    assert event.discovered_at <= time.time()


def test_watcher_skips_previously_seen_archives(sde_dir: Path) -> None:
    watcher = SDEWatcher(sde_dir)
    _write_archive(sde_dir, b"first", "sde-2025-09-23.zip")

    first_scan = watcher.scan()
    assert len(first_scan) == 1

    # No new archives
    assert watcher.scan() == []

    # Adding a new archive triggers another event
    _write_archive(sde_dir, b"second", "sde-2025-09-24.zip")
    second_scan = watcher.scan()
    assert len(second_scan) == 1
    assert second_scan[0].version == "sde-2025-09-24"


def test_watcher_ignores_temp_files(sde_dir: Path) -> None:
    watcher = SDEWatcher(sde_dir)
    _write_archive(sde_dir, b"partial", "incomplete.part")

    assert watcher.scan() == []


def test_watcher_handles_checksum_changes(sde_dir: Path) -> None:
    watcher = SDEWatcher(sde_dir)
    archive_name = "sde-2025-09-23.zip"
    archive_path = _write_archive(sde_dir, b"content-one", archive_name)
    first_checksum = hashlib.sha256(b"content-one").hexdigest()

    events = watcher.scan()
    assert events[0].checksum == first_checksum

    time.sleep(0.01)  # ensure mtime diff
    archive_path.write_bytes(b"content-two")
    second_checksum = hashlib.sha256(b"content-two").hexdigest()

    events = watcher.scan()
    assert len(events) == 1
    assert events[0].checksum == second_checksum
