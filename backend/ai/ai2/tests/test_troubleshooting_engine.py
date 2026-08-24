"""Safety-focused tests for the deterministic AI 2 engine."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


AI_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AI_ROOT))

from ai2.services.troubleshooting_engine import (  # noqa: E402
    check_stop_condition,
    get_current_step,
    get_escalation_service,
    get_guide_by_id,
    get_guide_for_fault,
    process_step_result,
    start_troubleshooting,
)


class TroubleshootingEngineTests(unittest.TestCase):
    def test_public_lookup_does_not_expose_internal_source_procedures(self) -> None:
        guide = get_guide_by_id("ai2_aktc_0001")
        self.assertIsNotNone(guide)
        self.assertNotIn("source_diagnosis_steps", guide)
        self.assertTrue(all("source_instruction" not in step for step in guide["steps"]))

    def test_basic_battery_guide_requires_caution_confirmation(self) -> None:
        guide = get_guide_for_fault("electrical_system_fault")
        self.assertIsNotNone(guide)
        self.assertIn(guide["risk_level"], {"LOW", "CAUTION"})
        self.assertEqual(guide["source_record_id"], "aktc_0036")
        start = start_troubleshooting(guide["id"])
        self.assertEqual(start["status"], "safety_confirmation_required")
        confirmed = start_troubleshooting(guide["id"], safety_confirmed=True)
        self.assertEqual(confirmed["status"], "in_progress")
        self.assertNotIn("source_instruction", confirmed["current_step"])
        self.assertTrue(confirmed["current_step"]["requires_action_confirmation"])
        self.assertEqual(
            confirmed["current_step"]["result_question"],
            confirmed["current_step"]["question"],
        )
        self.assertNotIn("source", confirmed["current_step"]["result_question"].lower())

    def test_engine_overheating_is_gated_by_safety_confirmation(self) -> None:
        guide = get_guide_by_id("ai2_aktc_0020")
        self.assertIn(guide["risk_level"], {"CAUTION", "HIGH"})
        start = start_troubleshooting(guide["id"])
        self.assertIn(
            start["status"],
            {"safety_confirmation_required", "professional_help_required"},
        )

    def test_brake_issue_is_high_risk(self) -> None:
        response = start_troubleshooting("ai2_aktc_0001")
        self.assertEqual(response["status"], "professional_help_required")
        self.assertEqual(response["risk_level"], "HIGH")
        self.assertEqual(response["recommended_service"], "brake_mechanic")

    def test_fuel_leak_requires_professional_help(self) -> None:
        response = start_troubleshooting("ai2_aktc_0085")
        self.assertEqual(response["status"], "professional_help_required")
        self.assertEqual(response["recommended_service"], "fuel_system_mechanic")

    def test_tpms_has_a_safe_low_risk_path(self) -> None:
        response = start_troubleshooting("ai2_aktc_0098")
        self.assertEqual(response["status"], "in_progress")
        self.assertEqual(response["guide"]["risk_level"], "LOW")
        self.assertIn("tyre pressure", response["current_step"]["instruction"].lower())

    def test_unsupported_fault_and_guide_fail_safely(self) -> None:
        self.assertIsNone(get_guide_for_fault("unsupported_fault"))
        response = start_troubleshooting("missing_guide")
        self.assertEqual(response["status"], "guide_unavailable")
        self.assertTrue(response["professional_help_required"])

    def test_smoke_stops_troubleshooting_immediately(self) -> None:
        response = check_stop_condition("ai2_aktc_0098", "Smoke is coming from the car")
        self.assertTrue(response["triggered"])
        self.assertEqual(response["status"], "professional_help_required")

    def test_not_sure_never_forces_continuation(self) -> None:
        response = process_step_result("ai2_aktc_0098", "step_1", "not sure")
        self.assertEqual(response["status"], "professional_help_required")

    def test_current_step_and_escalation_service(self) -> None:
        step = get_current_step("ai2_aktc_0098", "step_1")
        self.assertEqual(step["step_id"], "step_1")
        self.assertEqual(get_escalation_service("ai2_aktc_0098"), "tire_mechanic")


if __name__ == "__main__":
    unittest.main()
