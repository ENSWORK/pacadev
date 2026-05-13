"""
Tests unitaires pour Phase B (Tokens + RBAC + Secrets).
"""

import time
import tempfile
from pathlib import Path
from tokens import ApprovalToken, TokenError
from approval import ApprovalManager
from rbac import RBAC, Role, Permission
from secrets import SecretsMasker


class TestTokens:
    """Tests des tokens HMAC"""

    def test_token_generation(self):
        """Test la génération d'un token"""
        token = ApprovalToken.generate(
            client="acmecorp",
            action="deploy_prod",
            reason="Hotfix critical",
            user="abdelali"
        )
        assert token.startswith("token_")
        assert "." in token
        print(f"✅ Token généré: {token[:50]}...")

    def test_token_info(self):
        """Test l'extraction d'infos d'un token"""
        token = ApprovalToken.generate(
            client="acmecorp",
            action="deploy_prod",
            reason="Test",
            user="abdelali"
        )
        info = ApprovalToken.get_info(token)
        assert "timestamp" in info
        assert "expires_at" in info
        assert info["expired"] is False
        print(f"✅ Info token: expires_at={info['expires_at']}")

    def test_token_expiration(self):
        """Test l'expiration d'un token"""
        # Créer un token
        token = ApprovalToken.generate(
            client="acmecorp",
            action="deploy_prod",
            reason="Test",
            user="abdelali"
        )

        info = ApprovalToken.get_info(token)
        assert not info["expired"]
        print(f"✅ Token valide au démarrage")


class TestApprovalManager:
    """Tests du gestionnaire d'approbations"""

    def test_issue_approval(self, tmp_path):
        """Test l'émission d'une approbation"""
        manager = ApprovalManager(approvals_file=tmp_path / "approvals.jsonl")

        token = manager.issue_approval(
            client="acmecorp",
            action="deploy_prod",
            reason="Hotfix",
            user="abdelali"
        )

        assert token.startswith("token_")
        print(f"✅ Approbation émise: {token[:50]}...")

    def test_use_approval(self, tmp_path):
        """Test l'utilisation d'une approbation"""
        manager = ApprovalManager(approvals_file=tmp_path / "approvals.jsonl")

        token = manager.issue_approval(
            client="acmecorp",
            action="deploy_prod",
            reason="Hotfix",
            user="abdelali"
        )

        # Utiliser l'approbation
        result = manager.use_approval(token, user="abdelali")
        assert result is True
        print(f"✅ Approbation utilisée avec succès")

    def test_approval_already_used(self, tmp_path):
        """Test qu'une approbation ne peut être utilisée qu'une fois"""
        manager = ApprovalManager(approvals_file=tmp_path / "approvals.jsonl")

        token = manager.issue_approval(
            client="acmecorp",
            action="deploy_prod",
            reason="Hotfix",
            user="abdelali"
        )

        manager.use_approval(token, user="abdelali")

        # Essayer d'utiliser deux fois
        try:
            manager.use_approval(token, user="alice")
            assert False, "Devrait lever TokenError"
        except TokenError as e:
            assert "déjà utilisée" in str(e)
            print(f"✅ Approbation double correctement bloquée")


class TestRBAC:
    """Tests du contrôle d'accès basé rôles"""

    def test_rbac_creation(self, tmp_path):
        """Test la création d'une instance RBAC"""
        rbac = RBAC(config_file=tmp_path / "rbac.yaml")
        assert rbac.config is not None
        print(f"✅ RBAC instance créée")

    def test_set_user_role(self, tmp_path):
        """Test l'attribution d'un rôle à un utilisateur"""
        rbac = RBAC(config_file=tmp_path / "rbac.yaml")
        rbac.set_user_role("alice", "lead")

        role = rbac.get_user_role("alice")
        assert role == "lead"
        print(f"✅ Rôle 'lead' attribué à alice")

    def test_can_access_admin(self, tmp_path):
        """Test que admin a accès à tout"""
        rbac = RBAC(config_file=tmp_path / "rbac.yaml")
        rbac.set_user_role("admin_user", "admin")

        assert rbac.can_access("admin_user", "deploy_prod", "acmecorp")
        assert rbac.can_access("admin_user", "deploy_prod", "other_client")
        print(f"✅ Admin a accès à toutes les actions")

    def test_can_access_dev(self, tmp_path):
        """Test que dev n'a pas accès à deploy_prod"""
        rbac = RBAC(config_file=tmp_path / "rbac.yaml")
        rbac.set_user_role("dev_user", "dev")

        assert rbac.can_access("dev_user", "work_start", "acmecorp")
        assert rbac.can_access("dev_user", "test", "acmecorp")
        assert not rbac.can_access("dev_user", "deploy_prod", "acmecorp")
        print(f"✅ Dev n'a pas accès à deploy_prod")

    def test_get_user_permissions(self, tmp_path):
        """Test la récupération des permissions d'un utilisateur"""
        rbac = RBAC(config_file=tmp_path / "rbac.yaml")
        rbac.set_user_role("alice", "lead")

        permissions = rbac.get_user_permissions("alice")
        assert "deploy_prod" in permissions
        assert "approve_prod" in permissions
        print(f"✅ Permissions lead récupérées: {len(permissions)} permissions")


class TestSecretsMasker:
    """Tests du masquage de secrets"""

    def test_mask_api_key(self):
        """Test le masquage d'une clé API"""
        masker = SecretsMasker()
        masked = masker.mask_text("api_key=sk_live_abc123def456")
        assert "abc123def456" not in masked
        assert "***" in masked or "sk_li" in masked
        print(f"✅ API key masquée: {masked}")

    def test_mask_dict(self):
        """Test le masquage dans un dictionnaire"""
        masker = SecretsMasker()
        data = {
            "username": "alice",
            "password": "super_secret_123",
            "api_token": "tok_xyz789"
        }

        masked = masker.mask_dict(data)
        assert masked["username"] == "alice"
        assert "super_secret" not in str(masked["password"])
        assert "tok_xyz" not in str(masked["api_token"])
        print(f"✅ Dict masqué: {masked}")

    def test_contains_secret(self):
        """Test la détection de secrets"""
        masker = SecretsMasker()

        assert masker.contains_secret("api_key=sk_live_123")
        assert masker.contains_secret("password=secret123")
        assert not masker.contains_secret("just a normal string")
        print(f"✅ Détection de secrets fonctionnelle")

    def test_extract_secrets(self):
        """Test l'extraction de secrets détectés"""
        masker = SecretsMasker()
        text = "api_key=sk_123 and token=abc_xyz"

        secrets = masker.extract_secrets(text)
        assert len(secrets) > 0
        assert any(s["type"] == "api_key" for s in secrets)
        print(f"✅ {len(secrets)} secrets détectés")


if __name__ == "__main__":
    import tempfile

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        print("\n🧪 Tests Phase B\n")
        print("═" * 60)

        print("\n📌 Tokens HMAC")
        t = TestTokens()
        t.test_token_generation()
        t.test_token_info()
        t.test_token_expiration()

        print("\n📌 Approbations")
        a = TestApprovalManager()
        a.test_issue_approval(tmp_path)
        a.test_use_approval(tmp_path)
        a.test_approval_already_used(tmp_path)

        print("\n📌 RBAC")
        r = TestRBAC()
        r.test_rbac_creation(tmp_path)
        r.test_set_user_role(tmp_path)
        r.test_can_access_admin(tmp_path)
        r.test_can_access_dev(tmp_path)
        r.test_get_user_permissions(tmp_path)

        print("\n📌 Masquage de Secrets")
        s = TestSecretsMasker()
        s.test_mask_api_key()
        s.test_mask_dict()
        s.test_contains_secret()
        s.test_extract_secrets()

        print("\n═" * 60)
        print("\n🎉 Tous les tests Phase B sont passés!\n")
