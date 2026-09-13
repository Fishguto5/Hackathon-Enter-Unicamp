from __future__ import annotations

from dataclasses import dataclass

from ..security.prompt_injection_sanitizer import (
    PromptInjectionSanitizer,
    SanitizationDecision,
    SanitizerChange,
    SanitizerFinding,
)


@dataclass(frozen=True)
class GuardedModelInput:
    text: str | None
    local_safe_text: str | None
    decision: SanitizationDecision
    findings: tuple[SanitizerFinding, ...]
    changes: tuple[SanitizerChange, ...]
    source_reference: str
    policy_version: str
    notes: tuple[str, ...]


class EnterOSPromptInjectionAdapter:
    def __init__(
        self,
        sanitizer: PromptInjectionSanitizer | None = None,
        *,
        extraction_max_chars: int = 120000,
        classification_document_max_chars: int = 30000,
        classification_batch_max_chars: int = 120000,
    ) -> None:
        self._sanitizer = sanitizer or PromptInjectionSanitizer()
        self._extraction_max_chars = extraction_max_chars
        self._classification_document_max_chars = classification_document_max_chars
        self._classification_batch_max_chars = classification_batch_max_chars

    def guard_extraction_text(
        self,
        *,
        case_name: str,
        combined_text: str,
    ) -> GuardedModelInput:
        source_reference = f"process:{case_name}:combined_text"
        return self._guard_single_text(
            source_reference=source_reference,
            text=combined_text,
            max_chars=self._extraction_max_chars,
        )

    def guard_document_classification_batch(
        self,
        documents: list[tuple[str, str]],
    ) -> GuardedModelInput:
        findings: list[SanitizerFinding] = []
        changes: list[SanitizerChange] = []
        notes: list[str] = []
        sanitized_chunks: list[str] = []
        overall_decision = SanitizationDecision.ALLOW

        try:
            for index, (filename, text) in enumerate(documents):
                source_reference = f"document:{index}:{filename or 'documento'}"
                chunk = f"DOCUMENTO {index}: {filename}\n{text}"
                result = self._sanitizer.sanitize_text(
                    chunk,
                    source_reference=source_reference,
                    policy=self._sanitizer.with_max_chars(self._classification_document_max_chars),
                )
                findings.extend(result.findings)
                changes.extend(result.changes)
                notes.extend(self._build_notes(result))
                sanitized_chunks.append(result.text)
                overall_decision = self._merge_decisions(overall_decision, result.decision)

            batch_source_reference = "document_batch:model_input"
            batch_text = "\n\n".join(sanitized_chunks)
            batch_result = self._sanitizer.sanitize_text(
                batch_text,
                source_reference=batch_source_reference,
                policy=self._sanitizer.with_max_chars(self._classification_batch_max_chars),
            )
            findings.extend(batch_result.findings)
            changes.extend(batch_result.changes)
            notes.extend(self._build_notes(batch_result))
            overall_decision = self._merge_decisions(overall_decision, batch_result.decision)

            return GuardedModelInput(
                text=batch_result.text if overall_decision == SanitizationDecision.ALLOW else None,
                local_safe_text=self._build_local_safe_text(
                    batch_result.text,
                    findings,
                ),
                decision=overall_decision,
                findings=tuple(findings),
                changes=tuple(changes),
                source_reference=batch_source_reference,
                policy_version=batch_result.policy_version,
                notes=tuple(notes),
            )
        except Exception as exc:
            return self._build_error_result(
                source_reference="document_batch:model_input",
                error=exc,
            )

    def _guard_single_text(
        self,
        *,
        source_reference: str,
        text: str,
        max_chars: int,
    ) -> GuardedModelInput:
        try:
            result = self._sanitizer.sanitize_text(
                text,
                source_reference=source_reference,
                policy=self._sanitizer.with_max_chars(max_chars),
            )
            return GuardedModelInput(
                text=result.text if result.decision == SanitizationDecision.ALLOW else None,
                local_safe_text=self._build_local_safe_text(
                    result.text,
                    result.findings,
                ),
                decision=result.decision,
                findings=result.findings,
                changes=result.changes,
                source_reference=result.source_reference,
                policy_version=result.policy_version,
                notes=tuple(self._build_notes(result)),
            )
        except Exception as exc:
            return self._build_error_result(source_reference=source_reference, error=exc)

    def _build_notes(self, result: object) -> list[str]:
        findings = getattr(result, "findings")
        changes = getattr(result, "changes")
        decision = getattr(result, "decision")
        notes: list[str] = []
        if decision != SanitizationDecision.ALLOW:
            notes.append(
                "Possivel prompt injection detectado nos documentos enviados. "
                "A entrada externa foi sinalizada para revisao e nao deve orientar automaticamente a decisao."
            )

        notes.extend([
            (
                f"Sanitizer {getattr(result, 'policy_version')} avaliou {getattr(result, 'source_reference')} "
                f"com decisao {decision.value}; achados={len(findings)}; "
                f"transformacoes={len(changes)}."
            )
        ])
        for finding in findings[:5]:
            location = (
                f" linhas {', '.join(str(line) for line in finding.line_numbers)}"
                if finding.line_numbers
                else ""
            )
            notes.append(
                f"Sanitizer regra={finding.rule_id} severidade={finding.severity}{location}: {finding.message}"
            )
        for change in changes[:5]:
            location = (
                f" linhas {', '.join(str(line) for line in change.line_numbers)}"
                if change.line_numbers
                else ""
            )
            notes.append(
                f"Sanitizer transformacao={change.change_id}{location}: {change.message}"
            )
        return notes

    def _build_error_result(
        self,
        *,
        source_reference: str,
        error: Exception,
    ) -> GuardedModelInput:
        finding = SanitizerFinding(
            rule_id="sanitizer_runtime_error",
            category="operational",
            severity="high",
            message=(
                "The sanitizer raised an exception. The adapter blocked automatic forwarding "
                "of the external text to the model."
            ),
        )
        policy_version = self._sanitizer.policy.policy_version
        notes = (
            f"Sanitizer {policy_version} falhou em {source_reference}: {error}. "
            "A entrada externa nao foi enviada ao modelo.",
        )
        return GuardedModelInput(
            text=None,
            local_safe_text=None,
            decision=SanitizationDecision.REVIEW,
            findings=(finding,),
            changes=(),
            source_reference=source_reference,
            policy_version=policy_version,
            notes=notes,
        )

    def _build_local_safe_text(
        self,
        treated_text: str,
        findings: tuple[SanitizerFinding, ...] | list[SanitizerFinding],
    ) -> str:
        flagged_lines = {
            line_number
            for finding in findings
            if finding.category
            in {
                "instruction_override",
                "authority_spoofing",
                "schema_override",
                "field_tampering",
                "policy_override",
            }
            for line_number in finding.line_numbers
        }
        if not flagged_lines:
            return treated_text

        safe_lines = [
            line
            for index, line in enumerate(treated_text.splitlines(), start=1)
            if index not in flagged_lines
        ]
        return "\n".join(safe_lines).strip()

    def _merge_decisions(
        self,
        left: SanitizationDecision,
        right: SanitizationDecision,
    ) -> SanitizationDecision:
        ranking = {
            SanitizationDecision.ALLOW: 0,
            SanitizationDecision.REVIEW: 1,
            SanitizationDecision.REJECT: 2,
        }
        return right if ranking[right] > ranking[left] else left
