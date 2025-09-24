from __future__ import annotations

import datetime as dt
from typing import Iterable, List, Protocol

import sqlalchemy as sa

from ingestion.src.market.base import MarketSnapshot


class MarketFetcher(Protocol):
    provider: str

    def fetch(self, type_id: int, window_days: int = 7) -> List[MarketSnapshot]:
        ...


class Limiter(Protocol):
    def acquire(self, key: str) -> bool:
        ...


class MarketScheduler:
    def __init__(
        self,
        engine: sa.Engine,
        fetchers: Iterable[MarketFetcher],
        limiter: Limiter,
        retention_days: int = 90,
    ) -> None:
        self.engine = engine
        self.fetchers = list(fetchers)
        self.limiter = limiter
        self.retention_days = retention_days
        metadata = sa.MetaData()
        self.market_snapshots = sa.Table("market_snapshots", metadata, autoload_with=engine)

    def run_once(self, type_ids: Iterable[int], window_days: int = 7) -> int:
        inserted = 0
        with self.engine.begin() as conn:
            for fetcher in self.fetchers:
                if not self.limiter.acquire(fetcher.provider):
                    continue
                for type_id in type_ids:
                    series = fetcher.fetch(type_id=type_id, window_days=window_days)
                    for snapshot in series:
                        conn.execute(
                            sa.dialects.postgresql.insert(self.market_snapshots)
                            .values(
                                provider=snapshot.provider,
                                type_id=snapshot.type_id,
                                region_id=snapshot.region_id,
                                ts=snapshot.ts,
                                price=snapshot.price,
                                volume=snapshot.volume,
                                spread=snapshot.spread,
                                payload_json=snapshot.payload,
                                ingested_from_sde=False,
                            )
                            .on_conflict_do_nothing(
                                index_elements=[
                                    self.market_snapshots.c.provider,
                                    self.market_snapshots.c.type_id,
                                    self.market_snapshots.c.region_id,
                                    self.market_snapshots.c.ts,
                                ]
                            )
                        )
                        inserted += 1
            cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=self.retention_days)
            conn.execute(
                sa.delete(self.market_snapshots).where(self.market_snapshots.c.ts < cutoff)
            )
        return inserted


import asyncio
import json
import logging
import os
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Optional

log = logging.getLogger("ingestion.scheduler")
logging.basicConfig(level=os.environ.get("LOGLEVEL", "INFO"))

# Configuration via env (defaults)
INTERVAL_MINUTES = int(os.environ.get("SCHED_INTERVAL_MINUTES", "30"))
JITTER_PCT = float(os.environ.get("SCHED_JITTER_PCT", "0.1"))  # 10% jitter by default
RETENTION_DAYS = int(os.environ.get("SCHED_RETENTION_DAYS", "90"))
SNAPSHOT_DIR = Path(os.environ.get("SCHED_SNAPSHOT_DIR", "data/market_snapshots"))


async def fetch_and_persist(adapter, type_ids: Iterable[int], region_id: int = 10000002, snapshot_dir: Optional[Path] = None):
	"""
	Call adapter.fetch_history for each type_id and persist JSON snapshot files.
	Adapter must provide async fetch_history(type_id, region_id, window_days).
	"""
	if snapshot_dir is None:
		snapshot_dir = SNAPSHOT_DIR
	snapshot_dir.mkdir(parents=True, exist_ok=True)

	timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
	for type_id in type_ids:
		try:
			log.info("Fetching history for type_id=%s region=%s", type_id, region_id)
			points = await adapter.fetch_history(type_id=type_id, region_id=region_id)
			out = {
				"fetched_at": datetime.utcnow().isoformat() + "Z",
				"type_id": type_id,
				"region_id": region_id,
				"points": points,
			}
			path = snapshot_dir / f"snapshot_{type_id}_{timestamp}.json"
			with open(path, "w", encoding="utf-8") as fh:
				json.dump(out, fh, ensure_ascii=False)
			log.info("Wrote snapshot %s (%d points)", path, len(points))
		except Exception as exc:
			log.exception("Failed to fetch/persist for type_id=%s: %s", type_id, exc)


def prune_snapshots(retention_days: int = RETENTION_DAYS, snapshot_dir: Optional[Path] = None) -> List[Path]:
	"""
	Delete snapshot files older than retention_days. Returns list of removed files.
	"""
	if snapshot_dir is None:
		snapshot_dir = SNAPSHOT_DIR
	removed = []
	cutoff = datetime.utcnow() - timedelta(days=retention_days)
	if not snapshot_dir.exists():
		return removed
	for p in snapshot_dir.glob("snapshot_*.json"):
		try:
			mtime = datetime.utcfromtimestamp(p.stat().st_mtime)
			if mtime < cutoff:
				p.unlink()
				removed.append(p)
				log.info("Pruned old snapshot %s", p)
		except Exception:
			log.exception("Error pruning %s", p)
	return removed


async def scheduler_loop(adapter, type_ids: Iterable[int], region_id: int = 10000002, interval_minutes: int = INTERVAL_MINUTES, jitter_pct: float = JITTER_PCT, stop_event: Optional[asyncio.Event] = None):
	"""
	Run an endless scheduler loop until stop_event is set (or KeyboardInterrupt).
	Between runs wait interval +/- jitter.
	"""
	if stop_event is None:
		stop_event = asyncio.Event()

	# Run initial prune
	prune_snapshots()

	while not stop_event.is_set():
		start = datetime.utcnow()
		await fetch_and_persist(adapter, type_ids=type_ids, region_id=region_id)
		# prune after fetch
		prune_snapshots()

		# compute jittered sleep
		interval = interval_minutes * 60
		jitter = interval * jitter_pct
		sleep_for = interval + random.uniform(-jitter, jitter)
		elapsed = (datetime.utcnow() - start).total_seconds()
		sleep_for = max(0, sleep_for - elapsed)
		log.info("Scheduler sleeping for %.1f seconds", sleep_for)
		try:
			await asyncio.wait_for(stop_event.wait(), timeout=sleep_for)
		except asyncio.TimeoutError:
			# timeout expired -> continue loop
			continue


def _load_type_ids_from_env() -> List[int]:
	"""
	Utility: parse comma separated SCHED_TYPE_IDS env var, e.g. "123,456,789"
	If not provided returns empty list.
	"""
	raw = os.environ.get("SCHED_TYPE_IDS", "")
	if not raw:
		return []
	out = []
	for part in raw.split(","):
		part = part.strip()
		if not part:
			continue
		try:
			out.append(int(part))
		except Exception:
			log.warning("Invalid type id in SCHED_TYPE_IDS: %r", part)
	return out


def main():
	"""
	Entrypoint for running scheduler as a script. Expects an 'adapter' module path to be set via env ADAPTER_MODULE,
	or uses a noop adapter when none provided (useful for container stubs).
	Also accepts SCHED_TYPE_IDS env var or falls back to empty list (no-op).
	"""
	# dynamic import of adapter if provided
	adapter = None
	adapter_module = os.environ.get("ADAM4EVE_ADAPTER_MODULE", "")
	if adapter_module:
		# expected to expose Adam4EVEAdapter class
		try:
			parts = adapter_module.split(":")
			mod_path = parts[0]
			attr = parts[1] if len(parts) > 1 else "Adam4EVEAdapter"
			import importlib

			mod = importlib.import_module(mod_path)
			AdapterCls = getattr(mod, attr)
			adapter = AdapterCls()
		except Exception:
			log.exception("Failed to import adapter %s, using noop adapter", adapter_module)

	# fallback noop adapter
	class _NoopAdapter:
		async def fetch_history(self, type_id, region_id):
			return []

	if adapter is None:
		adapter = _NoopAdapter()

	type_ids = _load_type_ids_from_env()
	if not type_ids:
		log.warning("No SCHED_TYPE_IDS configured; scheduler will run but perform no fetches")

	stop_event = asyncio.Event()
	try:
		asyncio.run(scheduler_loop(adapter, type_ids=type_ids, region_id=int(os.environ.get("SCHED_REGION_ID", "10000002"))))
	except KeyboardInterrupt:
		log.info("Scheduler interrupted, shutting down")
