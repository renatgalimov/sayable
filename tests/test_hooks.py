import pathlib
import shutil
import subprocess
import tempfile
import unittest

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]


class HookTests(unittest.TestCase):
    def test_all_hook_repositories_are_local(self):
        config = yaml.safe_load((ROOT / ".pre-commit-config.yaml").read_text())
        self.assertTrue(config["repos"])
        self.assertTrue(all(repo["repo"] == "local" for repo in config["repos"]))

    def test_checks_accept_good_and_reject_bad_files(self):
        cases = [
            ("check-yaml", "sample.yaml", "key: value\n", "key: [\n"),
            ("check-json", "sample.json", '{"key": 1}\n', '{"key": }\n'),
            ("check-toml", "sample.toml", "key = 1\n", "key = [\n"),
            ("check-merge-conflict", "sample.txt", "ordinary text\n", "<<<<<<< HEAD\n"),
            ("check-added-large-files", "sample.txt", "x" * 512000, "x" * 512001),
            ("end-of-file-fixer", "sample.txt", "text\n", "text"),
            ("end-of-file-fixer", "sample.txt", "text\r\n", "text\r\n\r\n"),
            ("trailing-whitespace", "sample.txt", "text\n", "text \n"),
            ("markdownlint", "sample.md", "# Heading\n", "# Heading\n\n### Skipped\n"),
            ("ruff-check", "sample.py", "x = 1\n", "import os\n"),
            ("ruff-format", "sample.py", "x = 1\n", "x=1\n"),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            repo = pathlib.Path(tmp)
            shutil.copy(ROOT / ".pre-commit-config.yaml", repo)
            shutil.copy(ROOT / ".markdownlint-cli2.yaml", repo)
            if (ROOT / "scripts").exists():
                shutil.copytree(ROOT / "scripts", repo / "scripts")
            if (ROOT / "node_modules").exists():
                (repo / "node_modules").symlink_to(
                    ROOT / "node_modules", target_is_directory=True
                )
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            for hook, filename, good, bad in cases:
                with self.subTest(hook=hook):
                    path = repo / filename
                    for content, expected in ((good, 0), (bad, 1)):
                        path.write_text(content)
                        subprocess.run(["git", "add", filename], cwd=repo, check=True)
                        result = subprocess.run(
                            ["pre-commit", "run", hook, "--files", filename],
                            cwd=repo,
                            text=True,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                        )
                        self.assertEqual(result.returncode, expected, result.stdout)
                    path.unlink()
                    subprocess.run(
                        ["git", "rm", "-q", "--cached", filename], cwd=repo, check=True
                    )


if __name__ == "__main__":
    unittest.main()
