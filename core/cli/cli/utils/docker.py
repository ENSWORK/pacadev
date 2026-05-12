import subprocess
from pathlib import Path


def compose_up(cwd: Path, detach: bool = True) -> bool:
    args = ["docker", "compose", "up"]
    if detach:
        args.append("-d")
    result = subprocess.run(args, cwd=cwd)
    return result.returncode == 0


def compose_down(cwd: Path) -> bool:
    result = subprocess.run(["docker", "compose", "down"], cwd=cwd)
    return result.returncode == 0


def container_logs(name: str, tail: int = 50) -> str:
    result = subprocess.run(
        ["docker", "logs", "--tail", str(tail), name],
        capture_output=True, text=True
    )
    return result.stdout + result.stderr


def container_running(name: str) -> bool:
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", name],
        capture_output=True, text=True
    )
    return result.stdout.strip() == "true"
