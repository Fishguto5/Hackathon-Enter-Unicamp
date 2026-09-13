from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum
import re
from typing import Iterable
import unicodedata


class SanitizationDecision(str, Enum):
    ALLOW = "allow"
    REVIEW = "review"
    REJECT = "reject"


@dataclass(frozen=True)
class SanitizerPolicy:
    policy_version: str = "enteros-prompt-sanitizer/v1"
    max_chars: int = 120000
    reject_score_threshold: int = 6
    max_excerpt_chars: int = 180

    def __post_init__(self) -> None:
        if self.max_chars <= 0:
            raise ValueError("max_chars must be greater than zero.")
        if self.reject_score_threshold <= 0:
            raise ValueError("reject_score_threshold must be greater than zero.")
        if self.max_excerpt_chars <= 0:
            raise ValueError("max_excerpt_chars must be greater than zero.")


@dataclass(frozen=True)
class SanitizerFinding:
    rule_id: str
    category: str
    severity: str
    message: str
    line_numbers: tuple[int, ...] = ()
    excerpt: str | None = None


@dataclass(frozen=True)
class SanitizerChange:
    change_id: str
    category: str
    message: str
    line_numbers: tuple[int, ...] = ()
    count: int = 0


@dataclass(frozen=True)
class SanitizerResult:
    text: str
    decision: SanitizationDecision
    findings: tuple[SanitizerFinding, ...]
    changes: tuple[SanitizerChange, ...]
    source_reference: str
    policy_version: str
    location_basis: str = "1-based line numbers in treated text"


DISALLOWED_CONTROL_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
INVISIBLE_FORMATTING_PATTERN = re.compile(r"[\u200b\u200c\u200d\u2060\ufeff]")
BIDI_CONTROL_PATTERN = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")

DIRECTIVE_PATTERNS: tuple[tuple[str, str, str, re.Pattern[str]], ...] = (
    (
        "direct_instruction_override",
        "instruction_override",
        "high",
        re.compile(
            r"\b(?:ignore|ignorar|desconsidere|desconsiderar|abandone)\b.{0,50}"
            r"\b(?:instrucoes|instructions|prompt|sistema|system|developer|desenvolvedor|tarefa|task)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "assistant_targeted_override",
        "instruction_override",
        "high",
        re.compile(
            r"\b(?:assistente|assistant|modelo|model|llm|ia|ai|chatgpt)\b.{0,80}"
            r"\b(?:ignore|ignorar|desconsidere|desconsiderar|abandone|substitua|troque|altere|mude|"
            r"replace|fill|marque|responda|retorne|return|reply|respond)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "privileged_role_spoofing",
        "authority_spoofing",
        "high",
        re.compile(
            r"(?:^|\n)\s*(?:system|developer|assistant|admin|root)\s*(?::|>|-)",
            re.IGNORECASE,
        ),
    ),
    (
        "output_format_override",
        "schema_override",
        "high",
        re.compile(
            r"\b(?:responda|retorne|return|respond|reply|output)\b.{0,60}"
            r"\b(?:apenas|somente|only)\b.{0,60}"
            r"\b(?:json|xml|yaml|schema|esquema|formato|markdown|teste_pi_[a-z_]+)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "field_tampering_instruction",
        "field_tampering",
        "high",
        re.compile(
            r"\b(?:substitua|troque|altere|preencha|fill|replace|marque)\b.{0,90}"
            r"\b(?:autor|autora|reu|valor(?: da causa)?|resultado_macro|resultado_micro|"
            r"todos os documentos|todos os subsidios|todos os subsídios)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "policy_or_tool_override",
        "policy_override",
        "high",
        re.compile(
            r"\b(?:ignore|desconsidere|desative|altere|mude|bypass)\b.{0,90}"
            r"\b(?:politica|policy|sanitizer|filtro|validacao|schema|ferramenta|tool)\b",
            re.IGNORECASE,
        ),
    ),
)

# A confirmed injection can be split over several PDF extraction lines.  Treat it as
# conclusive only when a single short block combines target, precedence and mutation.
CONTEXTUAL_TARGET_PATTERN = re.compile(
    r"\b(?:instrucao|orientacao|nota|comando)\b.{0,60}"
    r"\b(?:para|ao|a)\b.{0,30}"
    r"\b(?:o\s+)?(?:assistente|assistant|modelo|model|llm|ia|ai)\b",
    re.IGNORECASE,
)
CONTEXTUAL_PRECEDENCE_PATTERN = re.compile(
    r"\b(?:prioridade|precedencia)\b.{0,100}"
    r"\b(?:instrucoes?|orientacoes?|prompt|sistema|system)\b"
    r"|\b(?:ignore|ignorar|desconsidere|desconsiderar|abandone)\b.{0,100}"
    r"\b(?:instrucoes?|orientacoes?|prompt|sistema|system|anteriores?)\b",
    re.IGNORECASE,
)
CONTEXTUAL_FIELD_MUTATION_PATTERN = re.compile(
    r"\b(?:preencha|substitua|troque|altere|mude|replace|fill)\b.{0,120}"
    r"\b(?:campo|field|nome[_\s]?autor|autor|autora|reu|valor|resultado_macro|"
    r"resultado_micro|documentos|subsidios)\b",
    re.IGNORECASE,
)
CONTEXTUAL_WINDOW_LINE_COUNT = 8

SEVERITY_SCORES = {
    "low": 1,
    "medium": 2,
    "high": 4,
}


class PromptInjectionSanitizer:
    def __init__(self, policy: SanitizerPolicy | None = None) -> None:
        self._policy = policy or SanitizerPolicy()

    @property
    def policy(self) -> SanitizerPolicy:
        return self._policy

    def sanitize_text(
        self,
        text: str,
        *,
        source_reference: str,
        policy: SanitizerPolicy | None = None,
    ) -> SanitizerResult:
        if not isinstance(text, str):
            raise TypeError("text must be a string.")
        if not isinstance(source_reference, str) or not source_reference.strip():
            raise ValueError("source_reference must be a non-empty string.")

        active_policy = policy or self._policy
        if len(text) > active_policy.max_chars:
            finding = SanitizerFinding(
                rule_id="input_limit_exceeded",
                category="limits",
                severity="high",
                message=(
                    "The text exceeded the configured inspection limit and cannot be forwarded "
                    "to the model without manual review."
                ),
            )
            return SanitizerResult(
                text=text,
                decision=SanitizationDecision.REVIEW,
                findings=(finding,),
                changes=(),
                source_reference=source_reference,
                policy_version=active_policy.policy_version,
            )

        treated_text, changes, transformation_findings = self._apply_transformations(text)
        findings = list(transformation_findings)
        findings.extend(self._detect_prompt_injection_signals(treated_text, active_policy))
        decision = self._decide(findings, active_policy)

        return SanitizerResult(
            text=treated_text,
            decision=decision,
            findings=tuple(findings),
            changes=tuple(changes),
            source_reference=source_reference,
            policy_version=active_policy.policy_version,
        )

    def with_max_chars(self, max_chars: int) -> SanitizerPolicy:
        return replace(self._policy, max_chars=max_chars)

    def _apply_transformations(
        self,
        text: str,
    ) -> tuple[str, list[SanitizerChange], list[SanitizerFinding]]:
        working_text = text
        changes: list[SanitizerChange] = []
        findings: list[SanitizerFinding] = []

        if "\r" in working_text:
            line_numbers = self._line_numbers_for_matches(
                working_text,
                re.finditer(r"\r\n?|\r", working_text),
            )
            working_text = working_text.replace("\r\n", "\n").replace("\r", "\n")
            changes.append(
                SanitizerChange(
                    change_id="normalize_line_endings",
                    category="normalization",
                    message="Normalized line endings to LF for deterministic inspection.",
                    line_numbers=line_numbers,
                    count=len(line_numbers),
                )
            )

        control_matches = list(DISALLOWED_CONTROL_PATTERN.finditer(working_text))
        if control_matches:
            line_numbers = self._line_numbers_for_matches(working_text, control_matches)
            working_text = DISALLOWED_CONTROL_PATTERN.sub(" ", working_text)
            changes.append(
                SanitizerChange(
                    change_id="replace_disallowed_controls",
                    category="normalization",
                    message="Replaced disallowed ASCII control characters with spaces.",
                    line_numbers=line_numbers,
                    count=len(control_matches),
                )
            )
            findings.append(
                SanitizerFinding(
                    rule_id="disallowed_control_characters",
                    category="obfuscation",
                    severity="medium",
                    message="Disallowed control characters were found and replaced before inspection.",
                    line_numbers=line_numbers,
                )
            )

        invisible_matches = list(INVISIBLE_FORMATTING_PATTERN.finditer(working_text))
        bidi_matches = list(BIDI_CONTROL_PATTERN.finditer(working_text))
        if invisible_matches or bidi_matches:
            matches = invisible_matches + bidi_matches
            line_numbers = self._line_numbers_for_matches(working_text, matches)
            working_text = INVISIBLE_FORMATTING_PATTERN.sub("", working_text)
            working_text = BIDI_CONTROL_PATTERN.sub("", working_text)
            changes.append(
                SanitizerChange(
                    change_id="remove_invisible_formatting",
                    category="normalization",
                    message="Removed zero-width and bidirectional formatting characters.",
                    line_numbers=line_numbers,
                    count=len(matches),
                )
            )
            findings.append(
                SanitizerFinding(
                    rule_id="invisible_or_bidi_controls",
                    category="obfuscation",
                    severity="medium",
                    message="Invisible or bidirectional formatting characters were found in the text.",
                    line_numbers=line_numbers,
                )
            )

        return working_text, changes, findings

    def _detect_prompt_injection_signals(
        self,
        treated_text: str,
        policy: SanitizerPolicy,
    ) -> list[SanitizerFinding]:
        findings: list[SanitizerFinding] = []
        seen: set[tuple[str, tuple[int, ...], str | None]] = set()
        lines = treated_text.split("\n")

        findings.extend(self._detect_contextual_instruction_hijacks(lines, policy))

        for line_number, line in enumerate(lines, start=1):
            normalized_line = self._normalize_for_detection(line)
            if not normalized_line:
                continue

            for rule_id, category, severity, pattern in DIRECTIVE_PATTERNS:
                if pattern.search(normalized_line):
                    excerpt = self._build_excerpt(line, policy.max_excerpt_chars)
                    key = (rule_id, (line_number,), excerpt)
                    if key in seen:
                        continue
                    seen.add(key)
                    findings.append(
                        SanitizerFinding(
                            rule_id=rule_id,
                            category=category,
                            severity=severity,
                            message=self._build_rule_message(rule_id),
                            line_numbers=(line_number,),
                            excerpt=excerpt,
                        )
                    )

        normalized_full_text = self._normalize_for_detection(treated_text)
        for rule_id, category, severity, pattern in DIRECTIVE_PATTERNS:
            if pattern.search(normalized_full_text) and not any(
                finding.rule_id == rule_id for finding in findings
            ):
                findings.append(
                    SanitizerFinding(
                        rule_id=rule_id,
                        category=category,
                        severity=severity,
                        message=(
                            f"{self._build_rule_message(rule_id)} The pattern spans multiple lines or "
                            "document fragments in the treated text."
                        ),
                    )
                )

        return findings

    def _detect_contextual_instruction_hijacks(
        self,
        lines: list[str],
        policy: SanitizerPolicy,
    ) -> list[SanitizerFinding]:
        """Detect a complete instruction hijack when PDF text wraps it across lines."""
        for start in range(len(lines)):
            window_lines = lines[start : start + CONTEXTUAL_WINDOW_LINE_COUNT]
            normalized_window = self._normalize_for_detection("\n".join(window_lines))
            if not normalized_window:
                continue
            if not CONTEXTUAL_TARGET_PATTERN.search(normalized_window):
                continue
            if not CONTEXTUAL_PRECEDENCE_PATTERN.search(normalized_window):
                continue
            if not CONTEXTUAL_FIELD_MUTATION_PATTERN.search(normalized_window):
                continue

            end = start + len(window_lines)
            return [
                SanitizerFinding(
                    rule_id="contextual_instruction_hijack",
                    category="instruction_override",
                    severity="high",
                    message=self._build_rule_message("contextual_instruction_hijack"),
                    line_numbers=tuple(range(start + 1, end + 1)),
                    excerpt=self._build_excerpt("\n".join(window_lines), policy.max_excerpt_chars),
                )
            ]
        return []

    def _decide(
        self,
        findings: list[SanitizerFinding],
        policy: SanitizerPolicy,
    ) -> SanitizationDecision:
        if not findings:
            return SanitizationDecision.ALLOW

        total_score = sum(SEVERITY_SCORES.get(finding.severity, 0) for finding in findings)
        high_severity_count = sum(finding.severity == "high" for finding in findings)

        if high_severity_count >= 2 or total_score >= policy.reject_score_threshold:
            return SanitizationDecision.REJECT

        return SanitizationDecision.REVIEW

    def _line_numbers_for_matches(
        self,
        text: str,
        matches: re.Match[str] | Iterable[re.Match[str]],
    ) -> tuple[int, ...]:
        if isinstance(matches, re.Match):
            iterable = [matches]
        else:
            iterable = list(matches)
        line_numbers = {
            text.count("\n", 0, match.start()) + 1
            for match in iterable
        }
        return tuple(sorted(line_numbers))

    def _normalize_for_detection(self, text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text)
        normalized = "".join(
            character for character in normalized if not unicodedata.combining(character)
        )
        normalized = normalized.lower()
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized.strip()

    def _build_excerpt(self, text: str, limit: int) -> str:
        compact = re.sub(r"\s+", " ", text).strip()
        if len(compact) <= limit:
            return compact
        return compact[: limit - 3] + "..."

    def _build_rule_message(self, rule_id: str) -> str:
        messages = {
            "direct_instruction_override": (
                "The document appears to instruct the model to ignore or replace higher-priority guidance."
            ),
            "assistant_targeted_override": (
                "The document appears to address the assistant or model directly with an instruction."
            ),
            "privileged_role_spoofing": (
                "The document appears to simulate privileged roles such as system or developer messages."
            ),
            "output_format_override": (
                "The document appears to demand a different output format or schema than the application expects."
            ),
            "field_tampering_instruction": (
                "The document appears to ask the model to fabricate, replace or force extracted fields."
            ),
            "policy_or_tool_override": (
                "The document appears to ask the model to alter policies, validations or tool behavior."
            ),
            "contextual_instruction_hijack": (
                "The document combines an instruction to the model, precedence over existing guidance "
                "and a request to alter structured case data."
            ),
        }
        return messages.get(rule_id, "Potential prompt injection signal detected.")
