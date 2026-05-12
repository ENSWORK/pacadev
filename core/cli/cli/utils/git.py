import subprocess
from pathlib import Path


def current_branch(cwd: Path = None) -> str:
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True, text=True, cwd=cwd
    )
    return result.stdout.strip()


def create_branch(branch: str, cwd: Path = None) -> bool:
    result = subprocess.run(
        ["git", "checkout", "-b", branch],
        capture_output=True, text=True, cwd=cwd
    )
    return result.returncode == 0


def is_git_repo(path: Path) -> bool:
    return (path / ".git").exists()


def git_status(cwd: Path = None) -> str:
    result = subprocess.run(
        ["git", "status", "--short"],
        capture_output=True, text=True, cwd=cwd
    )
    return result.stdout.strip()
