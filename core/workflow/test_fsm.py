"""
Tests unitaires pour la FSM PACADEV.
"""

import pytest
from pathlib import Path
import tempfile
import json
from fsm import WorkflowFSM, WorkflowState, TransitionEvent, WorkflowError


@pytest.fixture
def temp_state_file():
    """Crée un fichier d'état temporaire"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        yield Path(f.name)
    Path(f.name).unlink(missing_ok=True)


class TestWorkflowFSM:
    """Tests de la FSM"""

    def test_initial_state(self, temp_state_file):
        """Test que l'état initial est INIT"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        assert fsm.state == WorkflowState.INIT

    def test_valid_transition(self, temp_state_file):
        """Test une transition valide"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        new_state = fsm.transition(TransitionEvent.WORK_START_VALID)
        assert new_state == WorkflowState.DEV
        assert fsm.state == WorkflowState.DEV

    def test_invalid_transition(self, temp_state_file):
        """Test qu'une transition invalide lève une exception"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        with pytest.raises(WorkflowError) as exc_info:
            fsm.transition(TransitionEvent.MERGE_APPROVED)
        assert "invalide" in str(exc_info.value).lower()

    def test_can_transition(self, temp_state_file):
        """Test la vérification des transitions autorisées"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        assert fsm.can_transition(TransitionEvent.WORK_START_VALID)
        assert not fsm.can_transition(TransitionEvent.MERGE_APPROVED)

    def test_full_workflow_path(self, temp_state_file):
        """Test un chemin complet du workflow"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)

        # INIT -> DEV
        fsm.transition(TransitionEvent.WORK_START_VALID)
        assert fsm.state == WorkflowState.DEV

        # DEV -> CI_RUNNING
        fsm.transition(TransitionEvent.PUSH_DETECTED)
        assert fsm.state == WorkflowState.CI_RUNNING

        # CI_RUNNING -> CI_PASSED
        fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
        assert fsm.state == WorkflowState.CI_PASSED

        # CI_PASSED -> MERGED
        fsm.transition(TransitionEvent.MERGE_APPROVED)
        assert fsm.state == WorkflowState.MERGED

    def test_ci_failure_recovery(self, temp_state_file):
        """Test le recovery depuis une failure CI"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)

        fsm.transition(TransitionEvent.WORK_START_VALID)
        fsm.transition(TransitionEvent.PUSH_DETECTED)
        # CI fail -> revient à DEV
        fsm.transition(TransitionEvent.CHECK_FAILED)
        assert fsm.state == WorkflowState.DEV

        # Peut continuer
        fsm.transition(TransitionEvent.PUSH_DETECTED)
        assert fsm.state == WorkflowState.CI_RUNNING

    def test_error_state_rollback(self, temp_state_file):
        """Test le rollback depuis ERROR"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)

        fsm.transition(TransitionEvent.WORK_START_VALID)
        fsm.transition(TransitionEvent.PUSH_DETECTED)
        fsm.transition(TransitionEvent.ERROR_OCCURRED)
        assert fsm.state == WorkflowState.ERROR

        # Rollback à DEV
        fsm.transition(TransitionEvent.ROLLBACK_TRIGGERED)
        assert fsm.state == WorkflowState.DEV

    def test_state_persistence(self, temp_state_file):
        """Test que l'état persiste entre instances"""
        fsm1 = WorkflowFSM("test-client", state_file=temp_state_file)
        fsm1.transition(TransitionEvent.WORK_START_VALID)

        # Créer une nouvelle instance — doit charger l'état
        fsm2 = WorkflowFSM("test-client", state_file=temp_state_file)
        assert fsm2.state == WorkflowState.DEV

    def test_transition_history(self, temp_state_file):
        """Test que l'historique est enregistré"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        fsm.transition(TransitionEvent.WORK_START_VALID)
        fsm.transition(TransitionEvent.PUSH_DETECTED)

        history = fsm.get_history()
        assert len(history) == 2
        assert history[0]["from"] == "init"
        assert history[0]["to"] == "dev"
        assert history[1]["from"] == "dev"
        assert history[1]["to"] == "ci_running"

    def test_metadata_in_history(self, temp_state_file):
        """Test que les métadonnées sont enregistrées"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        fsm.transition(
            TransitionEvent.WORK_START_VALID,
            metadata={"issue": 42, "module": "sale"}
        )

        history = fsm.get_history()
        assert history[0]["metadata"]["issue"] == 42
        assert history[0]["metadata"]["module"] == "sale"

    def test_reset_to_state(self, temp_state_file):
        """Test le reset manuel à un état spécifique"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)
        fsm.transition(TransitionEvent.WORK_START_VALID)
        fsm.transition(TransitionEvent.PUSH_DETECTED)

        # Reset à DEV
        fsm.reset_to_state(WorkflowState.DEV, reason="Manual recovery")
        assert fsm.state == WorkflowState.DEV

        history = fsm.get_history()
        last_entry = history[-1]
        assert last_entry["event"] == "manual_reset"
        assert last_entry["metadata"]["reason"] == "Manual recovery"

    def test_staging_to_prod_path(self, temp_state_file):
        """Test le chemin complet jusqu'à prod"""
        fsm = WorkflowFSM("test-client", state_file=temp_state_file)

        # Chemin rapide: INIT -> DEV -> CI_RUNNING -> CI_PASSED -> MERGED -> STAGING
        transitions = [
            (TransitionEvent.WORK_START_VALID, WorkflowState.DEV),
            (TransitionEvent.PUSH_DETECTED, WorkflowState.CI_RUNNING),
            (TransitionEvent.ALL_CHECKS_PASS, WorkflowState.CI_PASSED),
            (TransitionEvent.MERGE_APPROVED, WorkflowState.MERGED),
            (TransitionEvent.TAG_CREATED, WorkflowState.STAGING_DEPLOYED),
            (TransitionEvent.SMOKE_OK, WorkflowState.STAGING_VALIDATED),
            (TransitionEvent.HUMAN_APPROVE_PROD, WorkflowState.PROD_APPROVED),
            (TransitionEvent.BACKUP_OK, WorkflowState.PROD_DEPLOYED),
            (TransitionEvent.HEALTHCHECKS_OK, WorkflowState.CLOSED),
        ]

        for event, expected_state in transitions:
            fsm.transition(event)
            assert fsm.state == expected_state


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
