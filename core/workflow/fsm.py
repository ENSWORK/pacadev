"""
Finite State Machine pour le workflow PACADEV.
Définit les états, transitions autorisées et les règles de passage d'état.
"""

from enum import Enum
from typing import Dict, Set, Optional, Any
from datetime import datetime
import json
from pathlib import Path


class WorkflowState(Enum):
    """États possibles du workflow PACADEV"""
    INIT = "init"
    DEV = "dev"
    SELF_REVIEW = "self_review"
    TEST_MANUAL = "test_manual"
    CI_RUNNING = "ci_running"
    CI_PASSED = "ci_passed"
    MERGED = "merged"
    STAGING_DEPLOYED = "staging_deployed"
    STAGING_VALIDATED = "staging_validated"
    PROD_APPROVED = "prod_approved"
    PROD_DEPLOYED = "prod_deployed"
    CLOSED = "closed"
    ERROR = "error"


class TransitionEvent(Enum):
    """Événements déclenchant une transition"""
    WORK_START_VALID = "work_start_valid"
    SELF_REVIEW_STARTED = "self_review_started"
    SELF_REVIEW_PASSED = "self_review_passed"
    SELF_REVIEW_FAILED = "self_review_failed"
    TEST_MANUAL_PASSED = "test_manual_passed"
    TEST_MANUAL_FAILED = "test_manual_failed"
    PUSH_DETECTED = "push_detected"
    ALL_CHECKS_PASS = "all_checks_pass"
    CHECK_FAILED = "check_failed"
    MERGE_APPROVED = "merge_approved"
    TAG_CREATED = "tag_created"
    SMOKE_OK = "smoke_ok"
    SMOKE_FAILED = "smoke_failed"
    HUMAN_APPROVE_PROD = "human_approve_prod"
    BACKUP_OK = "backup_ok"
    HEALTHCHECKS_OK = "healthchecks_ok"
    HEALTHCHECKS_FAILED = "healthchecks_failed"
    ROLLBACK_TRIGGERED = "rollback_triggered"
    WORK_DONE = "work_done"
    ERROR_OCCURRED = "error_occurred"


class WorkflowError(Exception):
    """Exception levée pour transitions invalides ou erreurs workflow"""
    def __init__(self, message: str, current_state: Optional["WorkflowState"] = None,
                 attempted_transition: Optional[str] = None, level: str = "error"):
        self.message = message
        self.current_state = current_state
        self.attempted_transition = attempted_transition
        self.level = level
        super().__init__(message)


class WorkflowFSM:
    """Machine à états finie stricte pour PACADEV."""

    TRANSITIONS: Dict[WorkflowState, Set[tuple[TransitionEvent, WorkflowState]]] = {
        WorkflowState.INIT: {
            (TransitionEvent.WORK_START_VALID, WorkflowState.DEV),
        },
        WorkflowState.DEV: {
            (TransitionEvent.SELF_REVIEW_STARTED, WorkflowState.SELF_REVIEW),
            (TransitionEvent.PUSH_DETECTED, WorkflowState.CI_RUNNING),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.SELF_REVIEW: {
            (TransitionEvent.SELF_REVIEW_PASSED, WorkflowState.TEST_MANUAL),
            (TransitionEvent.SELF_REVIEW_FAILED, WorkflowState.DEV),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.TEST_MANUAL: {
            (TransitionEvent.TEST_MANUAL_PASSED, WorkflowState.DEV),
            (TransitionEvent.TEST_MANUAL_FAILED, WorkflowState.DEV),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.CI_RUNNING: {
            (TransitionEvent.ALL_CHECKS_PASS, WorkflowState.CI_PASSED),
            (TransitionEvent.CHECK_FAILED, WorkflowState.DEV),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.CI_PASSED: {
            (TransitionEvent.MERGE_APPROVED, WorkflowState.MERGED),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.MERGED: {
            (TransitionEvent.TAG_CREATED, WorkflowState.STAGING_DEPLOYED),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.STAGING_DEPLOYED: {
            (TransitionEvent.SMOKE_OK, WorkflowState.STAGING_VALIDATED),
            (TransitionEvent.SMOKE_FAILED, WorkflowState.ERROR),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.STAGING_VALIDATED: {
            (TransitionEvent.HUMAN_APPROVE_PROD, WorkflowState.PROD_APPROVED),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.PROD_APPROVED: {
            (TransitionEvent.BACKUP_OK, WorkflowState.PROD_DEPLOYED),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.PROD_DEPLOYED: {
            (TransitionEvent.HEALTHCHECKS_OK, WorkflowState.CLOSED),
            (TransitionEvent.HEALTHCHECKS_FAILED, WorkflowState.ERROR),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.ERROR: {
            (TransitionEvent.ROLLBACK_TRIGGERED, WorkflowState.DEV),
            (TransitionEvent.ERROR_OCCURRED, WorkflowState.ERROR),
        },
        WorkflowState.CLOSED: {
            (TransitionEvent.WORK_DONE, WorkflowState.CLOSED),
        },
    }

    def __init__(self, client: str, state_file: Optional[Path] = None):
        self.client = client
        if state_file is None:
            state_file = Path.home() / ".pacadev" / "clients" / client / "state.json"
        self.state_file = state_file
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load_state()
        self.transition_history = []

    def _load_state(self) -> WorkflowState:
        """Charge l'état depuis le fichier ou retourne INIT"""
        if self.state_file.exists():
            try:
                with open(self.state_file) as f:
                    data = json.load(f)
                    return WorkflowState(data.get("state", "init"))
            except (json.JSONDecodeError, ValueError):
                return WorkflowState.INIT
        return WorkflowState.INIT

    def _save_state(self) -> None:
        """Persiste l'état courant"""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, "w") as f:
            json.dump({
                "state": self._state.value,
                "client": self.client,
                "timestamp": datetime.utcnow().isoformat(),
                "history_count": len(self.transition_history),
            }, f, indent=2)

    @property
    def state(self) -> WorkflowState:
        """Retourne l'état courant"""
        return self._state

    def can_transition(self, event: TransitionEvent) -> bool:
        """Vérifie si une transition est autorisée"""
        if self._state not in self.TRANSITIONS:
            return False
        allowed = self.TRANSITIONS[self._state]
        return any(evt == event for evt, _ in allowed)

    def get_allowed_transitions(self) -> list[tuple[TransitionEvent, WorkflowState]]:
        """Retourne les transitions autorisées depuis l'état courant"""
        return list(self.TRANSITIONS.get(self._state, set()))

    def transition(self, event: TransitionEvent, metadata: Optional[Dict[str, Any]] = None) -> WorkflowState:
        """Effectue une transition si elle est valide"""
        allowed = self.TRANSITIONS.get(self._state, set())

        for evt, next_state in allowed:
            if evt == event:
                old_state = self._state
                self._state = next_state

                self.transition_history.append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "from": old_state.value,
                    "to": next_state.value,
                    "event": event.value,
                    "metadata": metadata or {}
                })

                self._save_state()
                return next_state

        allowed_events = [evt.value for evt, _ in allowed]
        raise WorkflowError(
            f"Transition invalide: {self._state.value} --[{event.value}]--> ??? "
            f"(autorisées: {allowed_events})",
            current_state=self._state,
            attempted_transition=event.value,
            level="error"
        )

    def reset_to_state(self, target_state: WorkflowState, reason: str = "") -> WorkflowState:
        """Réinitialise à un état spécifique (rollback)"""
        old_state = self._state
        self._state = target_state

        self.transition_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "from": old_state.value,
            "to": target_state.value,
            "event": "manual_reset",
            "metadata": {"reason": reason}
        })

        self._save_state()
        return target_state

    def get_history(self) -> list[dict]:
        """Retourne l'historique des transitions"""
        return self.transition_history
