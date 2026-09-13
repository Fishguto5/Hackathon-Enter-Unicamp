from __future__ import annotations

from typing import Iterable

from .models import ProcessRecord


class InMemoryProcessRepository:
    def __init__(self) -> None:
        self._processes: dict[str, ProcessRecord] = {}

    def list(self) -> Iterable[ProcessRecord]:
        return sorted(
            self._processes.values(),
            key=lambda process: process.updated_at,
            reverse=True,
        )

    def get(self, process_id: str) -> ProcessRecord | None:
        return self._processes.get(process_id)

    def create(self, name: str) -> ProcessRecord:
        process = ProcessRecord.create(name)
        self._processes[process.id] = process
        return process

    def save(self, process: ProcessRecord) -> ProcessRecord:
        self._processes[process.id] = process
        return process

    def delete(self, process_id: str) -> ProcessRecord | None:
        return self._processes.pop(process_id, None)
