from __future__ import annotations

import math
from typing import Any


class SchemaValidationError(ValueError):
    """Raised when a payload does not comply with the expected schema."""


def validate_payload_against_schema(payload: Any, schema: dict[str, Any]) -> None:
    errors = _collect_schema_errors(payload, schema, path="$")
    if errors:
        raise SchemaValidationError("; ".join(errors))


def _collect_schema_errors(
    payload: Any,
    schema: dict[str, Any],
    *,
    path: str,
) -> list[str]:
    errors: list[str] = []
    expected_type = schema.get("type")
    enum_values = schema.get("enum")

    if enum_values is not None and payload not in enum_values:
        errors.append(f"{path}: unexpected enum value {payload!r}")
        return errors

    if expected_type == "object":
        if not isinstance(payload, dict):
            return [f"{path}: expected object"]

        required_fields = schema.get("required", [])
        properties = schema.get("properties", {})
        for field_name in required_fields:
            if field_name not in payload:
                errors.append(f"{path}: missing required field {field_name!r}")

        if schema.get("additionalProperties") is False:
            unexpected_keys = sorted(set(payload) - set(properties))
            for key in unexpected_keys:
                errors.append(f"{path}: unexpected field {key!r}")

        for key, value in payload.items():
            property_schema = properties.get(key)
            if property_schema is None:
                continue
            errors.extend(
                _collect_schema_errors(
                    value,
                    property_schema,
                    path=f"{path}.{key}",
                )
            )
        return errors

    if expected_type == "array":
        if not isinstance(payload, list):
            return [f"{path}: expected array"]
        item_schema = schema.get("items", {})
        for index, item in enumerate(payload):
            errors.extend(
                _collect_schema_errors(item, item_schema, path=f"{path}[{index}]")
            )
        return errors

    if expected_type == "string":
        if not isinstance(payload, str):
            errors.append(f"{path}: expected string")
        return errors

    if expected_type == "number":
        if not _is_number(payload):
            errors.append(f"{path}: expected number")
        return errors

    if expected_type == "integer":
        if not isinstance(payload, int) or isinstance(payload, bool):
            errors.append(f"{path}: expected integer")
        return errors

    if expected_type == "boolean":
        if not isinstance(payload, bool):
            errors.append(f"{path}: expected boolean")
        return errors

    return errors


def _is_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return False
    return True
