from __future__ import annotations

import bz2
import hashlib
import io
import json
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable


@dataclass
class ManifestRecord:
    version: str
    types_checksum: str | None
    blueprints_checksum: str | None
    staged_paths: Dict[str, Path]
    manifest_file: Path


@dataclass
class PipelineConfig:
    downloads_dir: Path
    staging_dir: Path
    output_dir: Path
    manifest_path: Path


class ManifestPipeline:
    REQUIRED_KEYS = ("typeIDs", "blueprints")

    def __init__(self, config: PipelineConfig, archive_path: Path) -> None:
        self.config = config
        self.archive_path = archive_path

    def run(self) -> ManifestRecord:
        self.config.staging_dir.mkdir(parents=True, exist_ok=True)
        self.config.output_dir.mkdir(parents=True, exist_ok=True)

        staged_files = self._extract_archive()
        if not staged_files:
            raise RuntimeError("Archive did not produce any files")
        if len(staged_files) > 1:
            self._assert_required(staged_files)

        types_path = self._find_key(staged_files, "typeIDs")
        blueprints_path = self._find_key(staged_files, "blueprints")

        types_checksum = self._checksum(types_path)
        blueprints_checksum = self._checksum(blueprints_path)

        manifest = {
            "version": self._derive_version(),
            "typeIDs": {
                "path": str(types_path) if types_path else None,
                "checksum": types_checksum,
            },
            "blueprints": {
                "path": str(blueprints_path) if blueprints_path else None,
                "checksum": blueprints_checksum,
            },
        }
        self.config.manifest_path.write_text(json.dumps(manifest, indent=2))

        return ManifestRecord(
            version=manifest["version"],
            types_checksum=types_checksum,
            blueprints_checksum=blueprints_checksum,
            staged_paths=staged_files,
            manifest_file=self.config.manifest_path,
        )

    # Extraction helpers -------------------------------------------------
    def _extract_archive(self) -> Dict[str, Path]:
        name = self.archive_path.name.lower()
        if name.endswith(".tar.gz") or name.endswith(".tgz"):
            return self._extract_tar()
        if name.endswith(".zip"):
            return self._extract_zip()
        if name.endswith(".bz2"):
            return self._extract_bz2()
        raise RuntimeError(f"Unsupported archive format: {self.archive_path}")

    def _extract_tar(self) -> Dict[str, Path]:
        staged: Dict[str, Path] = {}
        with tarfile.open(self.archive_path, "r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile():
                    continue
                filename = Path(member.name).name
                extracted = self.config.staging_dir / filename
                with tar.extractfile(member) as src, extracted.open("wb") as dst:
                    if src is None:
                        continue
                    dst.write(src.read())
                staged[filename] = extracted
        return staged

    def _extract_zip(self) -> Dict[str, Path]:
        staged: Dict[str, Path] = {}
        with zipfile.ZipFile(self.archive_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                filename = Path(info.filename).name
                extracted = self.config.staging_dir / filename
                with zf.open(info) as src, extracted.open("wb") as dst:
                    dst.write(src.read())
                staged[filename] = extracted
        return staged

    def _extract_bz2(self) -> Dict[str, Path]:
        raw_name = Path(self.archive_path.name).with_suffix("")
        destination = self.config.staging_dir / raw_name.name
        data = bz2.decompress(self.archive_path.read_bytes())
        destination.write_bytes(data)
        return {destination.name: destination}

    # Utility helpers ----------------------------------------------------
    def _derive_version(self) -> str:
        name = self.archive_path.name
        for suffix in (".tar.gz", ".tgz", ".zip", ".bz2"):
            if name.endswith(suffix):
                return name[: -len(suffix)]
        return Path(name).stem

    @staticmethod
    def _checksum(path: Path | None) -> str | None:
        if path is None or not path.exists():
            return None
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _assert_required(self, staged: Dict[str, Path]) -> None:
        missing = [key for key in self.REQUIRED_KEYS if not self._find_key(staged, key)]
        if missing:
            raise RuntimeError(f"Missing required SDE artifacts: {', '.join(missing)}")

    @staticmethod
    def _find_key(staged: Dict[str, Path], key: str) -> Path | None:
        for filename, path in staged.items():
            if Path(filename).stem == key:
                return path
        return None
