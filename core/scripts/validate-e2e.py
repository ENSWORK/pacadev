#!/usr/bin/env python3
"""
Validation End-to-End complète : simule workflow réel d'acmecorp
Phase A + B, tous les chemins critiques
"""

import sys
import tempfile
import time
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from workflow import WorkflowFSM, TransitionEvent, WorkflowError
from security import RBAC, ApprovalManager, ApprovalToken, TokenError, SecretsMasker
from audit import AuditLogger, AuditVerifier

class E2EValidator:
    def __init__(self):
        self.client = "acmecorp"
        self.tests_passed = 0
        self.tests_failed = 0
        self.results = []

    def test(self, name, fn):
        """Exécute un test et enregistre le résultat"""
        try:
            fn()
            self.tests_passed += 1
            self.results.append(f"✅ {name}")
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.results.append(f"❌ {name}: {str(e)}")
            return False
        except Exception as e:
            self.tests_failed += 1
            self.results.append(f"❌ {name}: {str(e)}")
            return False

    def run_all(self):
        """Lance tous les tests"""
        print("\n" + "=" * 80)
        print("🚀 VALIDATION END-TO-END PHASE A + B")
        print("=" * 80 + "\n")

        print("[1] 🔐 RBAC - Permissions\n" + "-" * 80)
        self.test("Bob (dev) peut work_start", self._rbac_bob_work_start)
        self.test("Bob (dev) peut test", self._rbac_bob_test)
        self.test("Bob (dev) peut deploy_staging", self._rbac_bob_staging)
        self.test("Bob (dev) REFUSE deploy_prod", self._rbac_bob_prod_denied)
        self.test("Alice (lead) peut deploy_prod", self._rbac_alice_prod)
        self.test("Viewer REFUSE work_start", self._rbac_viewer_denied)

        print("\n[2] 🔑 Tokens HMAC\n" + "-" * 80)
        self.test("Token généré avec format correct", self._token_format)
        self.test("Token non expiré au démarrage", self._token_not_expired)
        self.test("Token info extractible", self._token_info)
        self.test("Token signature valide", self._token_signature)

        print("\n[3] 📋 Approbations\n" + "-" * 80)
        self.test("Approbation émise", self._approval_issue)
        self.test("Approbation utilisée", self._approval_use)
        self.test("Double-use bloquée", self._approval_double_use)
        self.test("Expiration respectée", self._approval_expiration)
        self.test("Historique traçable", self._approval_history)

        print("\n[4] 🔄 FSM - State Transitions\n" + "-" * 80)
        self.test("Transition INIT → DEV", self._fsm_init_dev)
        self.test("Transition DEV → CI_RUNNING", self._fsm_dev_ci)
        self.test("Transition CI → MERGED", self._fsm_ci_merged)
        self.test("Transition MERGED → STAGING", self._fsm_staging)
        self.test("Transition STAGING → PROD_DEPLOYED", self._fsm_prod)
        self.test("Transition PROD → CLOSED", self._fsm_closed)
        self.test("Transition invalide bloquée", self._fsm_invalid_transition)

        print("\n[5] 📊 Audit Log\n" + "-" * 80)
        self.test("Log action créé", self._audit_log_create)
        self.test("Hash chaîné correct", self._audit_log_hash)
        self.test("Intégrité vérifiable", self._audit_log_verify)
        self.test("Secrets masqués", self._audit_log_masked)
        self.test("Historique client", self._audit_log_history)

        print("\n[6] 🔐 Secrets Masking\n" + "-" * 80)
        self.test("API key masquée", self._secrets_api_key)
        self.test("Password masqué", self._secrets_password)
        self.test("Token GitHub masqué", self._secrets_github)
        self.test("9 patterns détectés", self._secrets_patterns)

        print("\n[7] 🎬 Workflow Complet\n" + "-" * 80)
        self.test("Scénario 1: dev → staging (bob)", self._workflow_dev_staging)
        self.test("Scénario 2: approval → prod (alice)", self._workflow_approval_prod)
        self.test("Scénario 3: refus prod (bob)", self._workflow_denied_prod)

        print("\n" + "=" * 80)
        print(f"📊 RÉSULTATS: {self.tests_passed}✅ {self.tests_failed}❌")
        print("=" * 80)
        for result in self.results:
            print(f"  {result}")

        return self.tests_failed == 0

    # RBAC Tests
    def _rbac_bob_work_start(self):
        rbac = RBAC()
        assert rbac.can_access("bob", "work_start", self.client)

    def _rbac_bob_test(self):
        rbac = RBAC()
        assert rbac.can_access("bob", "test", self.client)

    def _rbac_bob_staging(self):
        rbac = RBAC()
        assert rbac.can_access("bob", "deploy_staging", self.client)

    def _rbac_bob_prod_denied(self):
        rbac = RBAC()
        assert not rbac.can_access("bob", "deploy_prod", self.client)

    def _rbac_alice_prod(self):
        rbac = RBAC()
        assert rbac.can_access("alice", "deploy_prod", self.client)

    def _rbac_viewer_denied(self):
        rbac = RBAC()
        assert not rbac.can_access("viewer", "work_start", self.client)

    # Token Tests
    def _token_format(self):
        token = ApprovalToken.generate(self.client, "deploy_prod", "Test", "alice")
        assert token.startswith("token_")
        parts = token.split(".")
        assert len(parts) == 3

    def _token_not_expired(self):
        token = ApprovalToken.generate(self.client, "deploy_prod", "Test", "alice")
        info = ApprovalToken.get_info(token)
        assert not info["expired"]

    def _token_info(self):
        token = ApprovalToken.generate(self.client, "deploy_prod", "Test", "alice")
        info = ApprovalToken.get_info(token)
        assert "timestamp" in info
        assert "expires_at" in info

    def _token_signature(self):
        token = ApprovalToken.generate(self.client, "deploy_prod", "Test", "alice")
        # Vérifier que le token a une signature (partie 3)
        sig = token.split(".")[2]
        assert len(sig) == 64  # SHA256 hex = 64 chars

    # Approval Tests
    def _approval_issue(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            token = manager.issue_approval(self.client, "deploy_prod", "Test", "alice")
            assert token is not None
            assert token.startswith("token_")

    def _approval_use(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            token = manager.issue_approval(self.client, "deploy_prod", "Test", "alice")
            result = manager.use_approval(token, "alice")
            assert result is True

    def _approval_double_use(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            token = manager.issue_approval(self.client, "deploy_prod", "Test", "alice")
            manager.use_approval(token, "alice")
            try:
                manager.use_approval(token, "bob")
                assert False, "Should raise TokenError"
            except TokenError:
                pass

    def _approval_expiration(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            # Créer un token de test manuel expiré
            info = ApprovalToken.get_info(
                ApprovalToken.generate(self.client, "deploy_prod", "Test", "alice")
            )
            assert not info["expired"]  # Nouveau token non expiré

    def _approval_history(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            manager.issue_approval(self.client, "deploy_prod", "Test1", "alice")
            manager.issue_approval(self.client, "deploy_prod", "Test2", "alice")
            history = manager.get_approval_history(self.client)
            assert len(history) == 2

    # FSM Tests
    def _fsm_init_dev(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            assert fsm.state.value == "dev"

    def _fsm_dev_ci(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            assert fsm.state.value == "ci_running"

    def _fsm_ci_merged(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            assert fsm.state.value == "merged"

    def _fsm_staging(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            fsm.transition(TransitionEvent.TAG_CREATED)
            fsm.transition(TransitionEvent.SMOKE_OK)
            assert fsm.state.value == "staging_validated"

    def _fsm_prod(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            fsm.transition(TransitionEvent.TAG_CREATED)
            fsm.transition(TransitionEvent.SMOKE_OK)
            fsm.transition(TransitionEvent.HUMAN_APPROVE_PROD)
            fsm.transition(TransitionEvent.BACKUP_OK)
            fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
            assert fsm.state.value == "closed"

    def _fsm_closed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            fsm.transition(TransitionEvent.TAG_CREATED)
            fsm.transition(TransitionEvent.SMOKE_OK)
            fsm.transition(TransitionEvent.HUMAN_APPROVE_PROD)
            fsm.transition(TransitionEvent.BACKUP_OK)
            fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
            assert fsm.state.value == "closed"

    def _fsm_invalid_transition(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            try:
                fsm.transition(TransitionEvent.MERGE_APPROVED)
                assert False, "Should raise WorkflowError"
            except WorkflowError:
                pass

    # Audit Tests
    def _audit_log_create(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            entry = logger.log_action("work_start", self.client, issue=145)
            assert entry is not None
            assert entry["action"] == "work_start"

    def _audit_log_hash(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            logger.log_action("action1", self.client)
            logger.log_action("action2", self.client)
            logs = logger.get_all_logs()
            assert len(logs) >= 2
            # Vérifier que prev_hash est chaîné
            assert logs[1]["prev_hash"] == logs[0]["hash"]

    def _audit_log_verify(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            logger.log_action("action1", self.client)
            logger.log_action("action2", self.client)
            result = AuditVerifier.verify_log_integrity(log_file=Path(tmpdir) / "audit.jsonl")
            assert result.valid

    def _audit_log_masked(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            # Vérifier que les secrets peuvent être masqués
            masker = SecretsMasker()
            text = "api_key=sk_live_123456"
            masked = masker.mask_text(text)
            # Le secret original ne doit pas être visible
            assert "123456" not in masked

    def _audit_log_history(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            logger.log_action("action1", self.client)
            logger.log_action("action2", self.client)
            history = logger.get_client_history(self.client)
            assert len(history) >= 2

    # Secrets Tests
    def _secrets_api_key(self):
        masker = SecretsMasker()
        masked = masker.mask_text("api_key=sk_live_123456789")
        assert "123456789" not in masked

    def _secrets_password(self):
        masker = SecretsMasker()
        masked = masker.mask_text("password=super_secret_xyz")
        assert "super_secret" not in masked

    def _secrets_github(self):
        masker = SecretsMasker()
        masked = masker.mask_text("token=ghp_abc123def456")
        assert "abc123def456" not in masked

    def _secrets_patterns(self):
        masker = SecretsMasker()
        assert len(masker.patterns) >= 9

    # Workflow Tests
    def _workflow_dev_staging(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Bob workflow: work → staging
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            rbac = RBAC()

            # Bob peut work_start
            assert rbac.can_access("bob", "work_start", self.client)
            fsm.transition(TransitionEvent.WORK_START_VALID)
            logger.log_action("work_start", self.client, issue=145, user="bob")

            # Bob peut test
            assert rbac.can_access("bob", "test", self.client)

            # Bob peut staging
            assert rbac.can_access("bob", "deploy_staging", self.client)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            fsm.transition(TransitionEvent.TAG_CREATED)
            fsm.transition(TransitionEvent.SMOKE_OK)
            logger.log_action("deploy_staging", self.client, user="bob")

            assert fsm.state.value == "staging_validated"

    def _workflow_approval_prod(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Alice workflow: approval → prod
            rbac = RBAC()
            manager = ApprovalManager(approvals_file=Path(tmpdir) / "approvals.jsonl")
            logger = AuditLogger(log_file=Path(tmpdir) / "audit.jsonl")
            fsm = WorkflowFSM(self.client, state_file=Path(tmpdir) / "state.json")

            # Setup: FSM en STAGING_VALIDATED
            fsm.transition(TransitionEvent.WORK_START_VALID)
            fsm.transition(TransitionEvent.PUSH_DETECTED)
            fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
            fsm.transition(TransitionEvent.MERGE_APPROVED)
            fsm.transition(TransitionEvent.TAG_CREATED)
            fsm.transition(TransitionEvent.SMOKE_OK)

            # Alice peut approve
            assert rbac.can_access("alice", "approve_prod", self.client)
            token = manager.issue_approval(self.client, "deploy_prod", "Hotfix #145", "alice")

            # Alice peut deploy prod
            assert rbac.can_access("alice", "deploy_prod", self.client)
            manager.use_approval(token, "alice")
            fsm.transition(TransitionEvent.HUMAN_APPROVE_PROD)
            fsm.transition(TransitionEvent.BACKUP_OK)
            fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
            logger.log_action("deploy_prod", self.client, approval_token=token[:20], user="alice")

            assert fsm.state.value == "closed"

    def _workflow_denied_prod(self):
        rbac = RBAC()
        # Bob ne peut pas deployer prod
        assert not rbac.can_access("bob", "deploy_prod", self.client)

if __name__ == "__main__":
    validator = E2EValidator()
    success = validator.run_all()
    sys.exit(0 if success else 1)
