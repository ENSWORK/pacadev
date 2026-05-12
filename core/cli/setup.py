from setuptools import setup, find_packages

setup(
    name="pacadev",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "typer[all]>=0.9.0",
        "rich>=13.0.0",
        "pyyaml>=6.0",
        "jinja2>=3.1.0",
        "gitpython>=3.1.0",
        "docker>=6.0.0",
        "requests>=2.31.0",
    ],
    entry_points={
        "console_scripts": [
            "pacadev=cli.main:app",
        ],
    },
    python_requires=">=3.10",
)
