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
    def test_explicit_negative_hazards_do_not_stop_but_failures_do(self) -> None:
        for text in ["The engine is not overheating.", "I don't smell fuel.", "I don’t smell fuel.", "The battery is not leaking."]:
            with self.subTest(text=text):
                self.assertFalse(check_stop_condition("ai2_aktc_0036", text)["triggered"])
        for text in ["My brakes are not working.", "The steering is not working.", "Fuel is leaking.", "The temperature gauge is in the red."]:
            with self.subTest(text=text):
                self.assertTrue(check_stop_condition("ai2_aktc_0036", text)["triggered"])

    def test_generic_category_words_do_not_choose_an_unrelated_guide(self) -> None:
        self.assertIsNone(get_guide_for_fault("engine_system_fault", "Engine problem. Not sure. No other signs."))
        self.assertIsNone(get_guide_for_fault("electrical_system_fault", "The interior display shows an unfamiliar message."))

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
        self.assertEqual(response["status"], "clarification_required")

    def test_current_step_and_escalation_service(self) -> None:
        step = get_current_step("ai2_aktc_0098", "step_1")
        self.assertEqual(step["step_id"], "step_1")
        self.assertEqual(get_escalation_service("ai2_aktc_0098"), "tire_mechanic")

    def test_normal_observation_asks_for_resolution_without_claiming_repair(self):
        result = process_step_result("ai2_aktc_0036", "step_1", "clean_terminals")
        self.assertEqual(result["status"], "awaiting_resolution_confirmation")
        self.assertIsNone(result["next_step"])
        self.assertIn("Do not start", result["message"])

    def test_unresolved_washer_check_has_a_distinct_next_approved_step(self):
        result = process_step_result("ai2_aktc_0091", "step_1", "sufficient_fluid_level")
        self.assertEqual(result["status"], "awaiting_resolution_confirmation")
        self.assertEqual(result["next_step"]["step_id"], "step_2")
        self.assertNotIn("source_instruction", result["next_step"])

    def test_symptoms_select_pressure_guide_but_not_for_bearing_noise(self):
        guide = get_guide_for_fault("wheel_tire_fault", "TPMS tyre pressure warning", "flat_tyre")
        self.assertEqual(guide["id"], "ai2_aktc_0098")
        bearing = get_guide_for_fault("wheel_tire_fault", "Grinding wheel bearing noise", "flat_tyre")
        self.assertEqual(bearing["risk_level"], "HIGH")
        battery = get_guide_for_fault("electrical_system_fault", "Car won't start with clicking and dim lights")
        self.assertEqual(battery["id"], "ai2_aktc_0036")

    def test_unknown_symptoms_do_not_select_an_arbitrary_guide(self):
        self.assertIsNone(get_guide_for_fault("electrical_system_fault", "unrelated unknown symptom"))

    def test_explicit_negation_and_substring_collisions_do_not_trigger_danger(self):
        for text in ["No smoke or fire", "No smoke or burning smell", "No smoke, sparks, or exposed damaged wiring", "There is no smoke, overheating, or fluid leak", "There is no warning light, smoke, burning smell, unusual noise, overheating, or fluid leak", "engine misfire", "battery is not leaking", ""]:
            self.assertFalse(check_stop_condition("ai2_aktc_0036", text)["triggered"], text)
        for text in ["No smoke but battery leaking", "No smoke and battery is leaking", "No smoke and brakes are not working", "No warning light, but smoke is coming from the bonnet", "Not sure if there is smoke", "brakes not working", "unsafe location"]:
            self.assertTrue(check_stop_condition("ai2_aktc_0036", text)["triggered"], text)


if __name__ == "__main__":
    unittest.main()
