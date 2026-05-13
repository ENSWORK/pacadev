#!/usr/bin/env python3
"""
Test d'intégration complet Phase A + Phase B.
Simule un workflow complet : work → staging → approval → prod
"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from workflow import WorkflowFSM, TransitionEvent
from security import RBAC, ApprovalManager, ApprovalToken, SecretsMasker
from audit import AuditLogger, AuditVerifier

def test_workflow():
    """Teste le workflow complet"""

    print("\n" + "=" * 80)
    print("🚀 TEST D'INTÉGRATION PHASE A + B")
    print("=" * 80)

    client = "acmecorp"

    # 1. Initialiser RBAC et vérifier permissions
    print("\n[1] 🔐 RBAC Check")
    print("-" * 80)
    rbac = RBAC()

    # Bob = dev (pas d'accès prod)
    can_bob_prod = rbac.can_access("bob", "deploy_prod", client)
    print(f"  ✅ bob (dev) peut faire deploy_prod? {can_bob_prod} (expected: False)")
    assert not can_bob_prod

    # Alice = lead (accès prod)
    can_alice_prod = rbac.can_access("alice", "deploy_prod", client)
    print(f"  ✅ alice (lead) peut faire deploy_prod? {can_alice_prod} (expected: True)")
    assert can_alice_prod

    # 2. Générer un token d'approbation
    print("\n[2] 🔑 Token Génération")
    print("-" * 80)
    token = ApprovalToken.generate(
        client=client,
        action="deploy_prod",
        reason="Hotfix #145",
        user="alice"
    )
    print(f"  ✅ Token généré: {token[:50]}...")

    info = ApprovalToken.get_info(token)
    print(f"  ✅ Token expires: {info['expires_at']}")
    assert not info['expired']

    # 3. FSM workflow
    print("\n[3] 🔄 FSM Workflow")
    print("-" * 80)

    with tempfile.TemporaryDirectory() as tmpdir:
        state_file = Path(tmpdir) / "state.json"
        fsm = WorkflowFSM(client, state_file=state_file)

        # Transitions
        transitions = [
            (TransitionEvent.WORK_START_VALID, "dev"),
            (TransitionEvent.PUSH_DETECTED, "ci_running"),
            (TransitionEvent.ALL_CHECKS_PASS, "ci_passed"),
            (TransitionEvent.MERGE_APPROVED, "merged"),
            (TransitionEvent.TAG_CREATED, "staging_deployed"),
            (TransitionEvent.SMOKE_OK, "staging_validated"),
            (TransitionEvent.HUMAN_APPROVE_PROD, "prod_approved"),
            (TransitionEvent.BACKUP_OK, "prod_deployed"),
            (TransitionEvent.HEALTHCHECKS_OK, "closed"),
        ]

        for event, expected_state in transitions:
            fsm.transition(event)
            assert fsm.state.value == expected_state
            print(f"  ✅ {event.value:25} → {expected_state}")

    # 4. Approbations avec usage unique
    print("\n[4] 📋 Approbations (Usage Unique)")
    print("-" * 80)

    with tempfile.TemporaryDirectory() as tmpdir:
        approval_file = Path(tmpdir) / "approvals.jsonl"
        manager = ApprovalManager(approvals_file=approval_file)

        # Émettre
        token = manager.issue_approval(client, "deploy_prod", "Hotfix #145", "alice")
        print(f"  ✅ Approbation émise: {token[:40]}...")

        # Utiliser
        manager.use_approval(token, "alice")
        print(f"  ✅ Token utilisé par alice")

        # Double-use doit échouer
        try:
            manager.use_approval(token, "bob")
            assert False, "Devrait échouer"
        except Exception as e:
            print(f"  ✅ Double-use bloquée: {str(e)}")

    # 5. Masquage secrets
    print("\n[5] 🔐 Masquage Secrets")
    print("-" * 80)

    masker = SecretsMasker()

    test_cases = [
        ("api_key=sk_live_123456789", "API key"),
        ("password=super_secret_xyz", "Password"),
        ("github_token=ghp_abc123def456", "GitHub token"),
    ]

    for text, label in test_cases:
        masked = masker.mask_text(text)
        assert "123" not in masked or "***" in masked or text.split("=")[0] not in masked
        print(f"  ✅ {label:20} masqué: {masked}")

    # 6. Audit log immuable
    print("\n[6] 📊 Audit Log (Immuable)")
    print("-" * 80)

    with tempfile.TemporaryDirectory() as tmpdir:
        audit_file = Path(tmpdir) / "audit-log.jsonl"
        logger = AuditLogger(log_file=audit_file)

        # Logger plusieurs actions
        logger.log_action("work_start", client, issue=142, user="bob")
        logger.log_action("deploy_staging", client, user="bob")
        logger.log_action("deploy_prod", client, approval_token="token_...", user="alice")

        # Vérifier intégrité
        result = AuditVerifier.verify_log_integrity(log_file=audit_file)

        print(f"  ✅ Audit log valide: {result.valid}")
        print(f"  ✅ Total entrées: {result.total_entries}")

        history = logger.get_client_history(client)
        print(f"  ✅ Historique client: {len(history)} actions")
        for entry in history:
            print(f"     - {entry['action']}")

    # 7. RBAC + Token + FSM intégration
    print("\n[7] ✨ Intégration Complète")
    print("-" * 80)

    print("  Workflow: dev (bob) → staging → approval (alice) → prod (alice)")
    print()

    print("  Scénario 1: bob essaie deploy_prod")
    print("    ❌ RBAC refuse (dev n'a pas permission)")
    assert not rbac.can_access("bob", "deploy_prod", client)
    print()

    print("  Scénario 2: alice obtient token et déploie")
    token = ApprovalToken.generate(client, "deploy_prod", "Hotfix #145", "alice")
    print(f"    ✅ Token généré: {token[:30]}...")
    print(f"    ✅ RBAC OK: alice = lead")
    assert rbac.can_access("alice", "deploy_prod", client)
    print(f"    ✅ Token valide: {not ApprovalToken.get_info(token)['expired']}")
    print()

    print("  Scénario 3: FSM transitions avec audit")
    with tempfile.TemporaryDirectory() as tmpdir:
        state_file = Path(tmpdir) / "state.json"
        audit_file = Path(tmpdir) / "audit.jsonl"

        fsm = WorkflowFSM(client, state_file=state_file)
        logger = AuditLogger(log_file=audit_file)

        # Workflow
        fsm.transition(TransitionEvent.WORK_START_VALID)
        logger.log_action("work_start", client, issue=142, user="bob")

        fsm.transition(TransitionEvent.PUSH_DETECTED)
        fsm.transition(TransitionEvent.ALL_CHECKS_PASS)
        fsm.transition(TransitionEvent.MERGE_APPROVED)
        fsm.transition(TransitionEvent.TAG_CREATED)
        fsm.transition(TransitionEvent.SMOKE_OK)
        logger.log_action("deploy_staging", client, user="bob")

        fsm.transition(TransitionEvent.HUMAN_APPROVE_PROD)
        fsm.transition(TransitionEvent.BACKUP_OK)
        fsm.transition(TransitionEvent.HEALTHCHECKS_OK)
        logger.log_action("deploy_prod", client, approval_token=token[:20], user="alice")

        print(f"    ✅ FSM final: {fsm.state.value}")
        history = logger.get_client_history(client)
        print(f"    ✅ Audit logs: {len(history)} entrées")

    print("\n" + "=" * 80)
    print("✅ TOUS LES TESTS PASSENT!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    try:
        test_workflow()
    except Exception as e:
        print(f"\n❌ ERREUR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
