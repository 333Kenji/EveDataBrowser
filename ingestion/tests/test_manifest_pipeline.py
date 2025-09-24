from __future__ import annotations

import bz2
import io
import json
import tarfile
from pathlib import Path
from typing import Iterator

import pytest

from ingestion.src.pipeline import ManifestPipeline, PipelineConfig


@pytest.fixture
def source_dir(tmp_path: Path) -> Path:
    sde_dir = tmp_path / "source"
    sde_dir.mkdir(parents=True)
    return sde_dir


def _create_bz2(path: Path, data: bytes) -> Path:
    compressed = bz2.compress(data)
    path.write_bytes(compressed)
    return path


def _create_tar(path: Path, members: dict[str, bytes]) -> Path:
    with tarfile.open(path, "w:gz") as tar:
        for name, data in members.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tar.addfile(info, fileobj=tarfile.io.BytesIO(data))
    return path


def _manifest(config: PipelineConfig, archive_name: str) -> ManifestPipeline:
    return ManifestPipeline(config=config, archive_path=config.downloads_dir / archive_name)


def test_pipeline_decompresses_and_writes_manifest(tmp_path: Path, source_dir: Path) -> None:
    downloads_dir = tmp_path / "data" / "SDE" / "_downloads"
    downloads_dir.mkdir(parents=True)
    staging_dir = tmp_path / "staging"
    staging_dir.mkdir()
    output_dir = tmp_path / "output"
    output_dir.mkdir()

    types_data = json.dumps({"item": 1}).encode()
    blueprint_data = json.dumps({"blueprint": 2}).encode()

    archive_path = downloads_dir / "sde-test.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        for name, data in {
            "typeIDs.json": types_data,
            "blueprints.json": blueprint_data,
        }.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))

    config = PipelineConfig(
        downloads_dir=downloads_dir,
        staging_dir=staging_dir,
        output_dir=output_dir,
        manifest_path=output_dir / "manifest.json",
    )

    pipeline = ManifestPipeline(config=config, archive_path=archive_path)
    manifest = pipeline.run()

    assert manifest.version == "sde-test"
    assert manifest.types_checksum is not None
    assert manifest.blueprints_checksum is not None
    assert manifest.staged_paths["typeIDs.json"].exists()
    assert manifest.manifest_file.exists()


def test_pipeline_handles_bz2_archives(tmp_path: Path) -> None:
    downloads_dir = tmp_path / "data" / "SDE" / "_downloads"
    downloads_dir.mkdir(parents=True)
    staging_dir = tmp_path / "staging"
    staging_dir.mkdir()
    output_dir = tmp_path / "output"
    output_dir.mkdir()

    types_data = json.dumps({"item": 1}).encode()
    archive_path = downloads_dir / "typeIDs.yaml.bz2"
    archive_path.write_bytes(bz2.compress(types_data))

    config = PipelineConfig(
        downloads_dir=downloads_dir,
        staging_dir=staging_dir,
        output_dir=output_dir,
        manifest_path=output_dir / "manifest.json",
    )

    pipeline = ManifestPipeline(config=config, archive_path=archive_path)
    manifest = pipeline.run()

    assert manifest.types_checksum is not None
    assert manifest.staged_paths["typeIDs.yaml"].exists()


def test_pipeline_raises_for_missing_required_files(tmp_path: Path) -> None:
    downloads_dir = tmp_path / "data" / "SDE" / "_downloads"
    downloads_dir.mkdir(parents=True)
    staging_dir = tmp_path / "staging"
    staging_dir.mkdir()
    output_dir = tmp_path / "output"
    output_dir.mkdir()

    archive_path = downloads_dir / "empty.tar.gz"
    with tarfile.open(archive_path, "w:gz"):
        pass

    config = PipelineConfig(
        downloads_dir=downloads_dir,
        staging_dir=staging_dir,
        output_dir=output_dir,
        manifest_path=output_dir / "manifest.json",
    )

    pipeline = ManifestPipeline(config=config, archive_path=archive_path)

    with pytest.raises(RuntimeError):
        pipeline.run()
