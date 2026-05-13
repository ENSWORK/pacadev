"""
Validations pré-vol (pré-flight checks) pour chaque action PACADEV.
"""

import subprocess
import json
from dataclasses import dataclass
from typing import Optional, List
from pathlib import Path


@dataclass
class ValidationCheck:
    """Résultat d'une vérification"""
    passed: bool
    message: str
    severity: str = "error"  # "error", "warning"


@dataclass
class ValidationResult:
    """Résultat complet d'une validation"""
    passed: bool
    checks: List[ValidationCheck]

    def failed_checks(self) -> List[ValidationCheck]:
        return [c for c in self.checks if not c.passed]

    def __str__(self) -> str:
        lines = []
        for check in self.checks:
            symbol = "✅" if check.passed else ("⚠️" if check.severity == "warning" else "❌")
            lines.append(f"{symbol} {check.message}")
        return "\n".join(lines)


class PreFlightChecker:
    """Validations pré-vol pour actions critiques"""

    @staticmethod
    def check_github_issue(repo: str, issue_num: int) -> ValidationCheck:
        """Vérifie qu'une issue GitHub existe et est ouverte"""
        try:
            result = subprocess.run(
                ["gh", "issue", "view", str(issue_num), "--repo", repo,
                 "--json", "state,title"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return ValidationCheck(
                    False,
                    f"Issue #{issue_num} n'existe pas ou accès refusé",
                    "error"
                )

            data = json.loads(result.stdout)
            if data.get("state") != "OPEN":
                return ValidationCheck(
                    False,
                    f"Issue #{issue_num} n'est pas ouverte (état: {data.get('state')})",
                    "error"
                )

            return ValidationCheck(
                True,
                f"Issue #{issue_num}: {data.get('title', 'No title')}"
            )
        except Exception as e:
            return ValidationCheck(False, f"Erreur vérification issue: {str(e)}", "error")

    @staticmethod
    def check_branch_name(branch: str) -> ValidationCheck:
        """Vérifie que le nom de branche suit le pattern"""
        import re
        pattern = r"^dev/[a-z0-9-]+/[0-9]+-[a-z0-9_-]+$"
        if re.match(pattern, branch):
            return ValidationCheck(True, f"Nom de branche valide: {branch}")
        return ValidationCheck(
            False,
            f"Nom de branche invalide: {branch}\n"
            f"Format requis: dev/client/123-feature-name",
            "error"
        )

    @staticmethod
    def check_git_repo(path: Path) -> ValidationCheck:
        """Vérifie qu'on est dans un dépôt Git"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                cwd=path, capture_output=True, timeout=2
            )
            if result.returncode == 0:
                return ValidationCheck(True, "Dépôt Git valide")
            return ValidationCheck(False, "Pas de dépôt Git", "error")
        except Exception as e:
            return ValidationCheck(False, f"Erreur Git: {str(e)}", "error")

    @staticmethod
    def check_local_tests(module: str) -> ValidationCheck:
        """Vérifie que les tests locaux passent"""
        try:
            result = subprocess.run(
                ["pacadev", "test", "--module", module, "--dry-run"],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                return ValidationCheck(True, f"Tests locaux OK pour {module}")
            return ValidationCheck(
                False,
                f"Tests échoués pour {module}. Corriger avant push.",
                "error"
            )
        except Exception as e:
            return ValidationCheck(False, f"Erreur tests: {str(e)}", "warning")

    @staticmethod
    def check_backup_exists(client: str) -> ValidationCheck:
        """Vérifie qu'un backup récent existe (< 24h)"""
        backup_dir = Path.home() / ".pacadev" / "backups" / client
        if not backup_dir.exists():
            return ValidationCheck(False, f"Aucun backup pour {client}", "error")

        import os
        import time
        recent_backups = sorted(
            backup_dir.iterdir(),
            key=lambda p: os.path.getmtime(p),
            reverse=True
        )

        if not recent_backups:
            return ValidationCheck(False, f"Aucun backup valide pour {client}", "error")

        latest = recent_backups[0]
        age_hours = (time.time() - os.path.getmtime(latest)) / 3600

        if age_hours > 24:
            return ValidationCheck(
                False,
                f"Backup trop ancien ({age_hours:.1f}h). Faire un nouveau backup.",
                "error"
            )

        return ValidationCheck(True, f"Backup récent: {latest.name} ({age_hours:.1f}h)")

    @staticmethod
    def check_ci_passing(repo: str, pr_num: int) -> ValidationCheck:
        """Vérifie que tous les checks CI passent"""
        try:
            result = subprocess.run(
                ["gh", "pr", "view", str(pr_num), "--repo", repo,
                 "--json", "checksResourceNodes,statusCheckRollup"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return ValidationCheck(False, "Impossible de vérifier CI", "error")

            data = json.loads(result.stdout)
            status = data.get("statusCheckRollup", "PENDING")

            if status == "SUCCESS":
                return ValidationCheck(True, "Tous les checks CI passent ✅")
            elif status == "PENDING":
                return ValidationCheck(False, "Checks CI en cours...", "warning")
            else:
                return ValidationCheck(False, f"Checks CI échoués: {status}", "error")
        except Exception as e:
            return ValidationCheck(False, f"Erreur CI check: {str(e)}", "warning")

    @staticmethod
    def check_secrets_encrypted(secrets_file: Path) -> ValidationCheck:
        """Vérifie que les secrets sont chiffrés"""
        if not secrets_file.exists():
            return ValidationCheck(True, "Pas de fichier secrets (OK)")

        try:
            content = secrets_file.read_text()
            # Vérifier que le fichier contient des signatures SOPS/age
            if any(marker in content for marker in ["sops", "encrypted", "age:"]):
                return ValidationCheck(True, "Secrets chiffrés ✅")
            return ValidationCheck(False, "Secrets en clair détectés!", "error")
        except Exception as e:
            return ValidationCheck(False, f"Erreur lecture secrets: {str(e)}", "error")


def validate_work_start(client: str, issue_num: int, repo: str, branch: str, path: Path) -> ValidationResult:
    """Validation complète pour 'pacadev work start'"""
    checks = [
        PreFlightChecker.check_github_issue(repo, issue_num),
        PreFlightChecker.check_branch_name(branch),
        PreFlightChecker.check_git_repo(path),
    ]
    return ValidationResult(all(c.passed for c in checks), checks)


def validate_deploy_staging(client: str, module: Optional[str] = None) -> ValidationResult:
    """Validation pour déploiement en staging"""
    checks = [
        PreFlightChecker.check_backup_exists(client),
    ]
    if module:
        checks.append(PreFlightChecker.check_local_tests(module))
    return ValidationResult(all(c.passed for c in checks), checks)


def validate_deploy_prod(client: str) -> ValidationResult:
    """Validation stricte pour déploiement en prod"""
    checks = [
        PreFlightChecker.check_backup_exists(client),
    ]
    return ValidationResult(all(c.passed for c in checks), checks)
