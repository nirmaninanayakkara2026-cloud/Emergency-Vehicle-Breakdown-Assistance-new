"""Boundary tests for AI 2 FastAPI response contracts."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


AI_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AI_ROOT))

from app import (  # noqa: E402
    FindGuideRequest,
    StartGuideRequest,
    StepResultRequest,
    StopConditionRequest,
    find_guide_endpoint,
    health,
    process_step_endpoint,
    start_guide_endpoint,
    stop_condition_endpoint,
)


class AI2ApiTests(unittest.TestCase):
    def test_health_preserves_ai1_and_reports_ai2(self) -> None:
        response = health()
        self.assertIn("modelLoaded", response)
        self.assertTrue(response["ai2KnowledgeLoaded"])
        self.assertTrue(response["ai2SafetyRulesLoaded"])

    def test_find_guide_returns_metadata_without_steps(self) -> None:
        response = find_guide_endpoint(
            FindGuideRequest(fault_category="electrical_system_fault")
        )
        self.assertTrue(response["guide_available"])
        self.assertEqual(response["guide"]["risk_level"], "CAUTION")
        self.assertNotIn("steps", response["guide"])

    def test_caution_cannot_start_without_confirmation(self) -> None:
        response = start_guide_endpoint(StartGuideRequest(guide_id="ai2_aktc_0036"))
        self.assertEqual(response["status"], "safety_confirmation_required")
        self.assertIsNone(response["current_step"])

    def test_high_risk_guide_never_returns_a_step(self) -> None:
        response = start_guide_endpoint(
            StartGuideRequest(guide_id="ai2_aktc_0001", safety_confirmed=True)
        )
        self.assertEqual(response["status"], "professional_help_required")
        self.assertNotIn("current_step", response)

    def test_step_uses_next_step_contract(self) -> None:
        response = process_step_endpoint(
            StepResultRequest(
                guide_id="ai2_aktc_0098",
                step_id="step_1",
                selected_result="not_sure",
            )
        )
        self.assertEqual(response["status"], "professional_help_required")

    def test_public_step_requires_action_confirmation_before_result(self) -> None:
        response = start_guide_endpoint(
            StartGuideRequest(guide_id="ai2_aktc_0098", safety_confirmed=False)
        )
        step = response["current_step"]
        self.assertTrue(step["requires_action_confirmation"])
        self.assertIn("result_question", step)
        self.assertNotIn("source_instruction", step)

    def test_smoke_sets_stop_flag(self) -> None:
        response = stop_condition_endpoint(
            StopConditionRequest(guide_id="ai2_aktc_0036", condition="smoke")
        )
        self.assertTrue(response["stop"])
        self.assertEqual(response["status"], "professional_help_required")


if __name__ == "__main__":
    unittest.main()
