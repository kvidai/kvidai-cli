# install-scripts — test artifacts

Unit tests for `install.sh`'s core logic (platform detection, checksum verification, download URL construction, symlink helper) plus a live check that the GitHub releases endpoint used by the real install flow responds. No real download/network calls are made — `download`/`get_latest_version`/`fetch_checksums` are stubbed inside the script.

```bash
bash tests/plan-test/install-scripts/test-install-sh.sh
```

Latest result: `results/20260927-2034-unit.txt` — 9 passed, 0 failed.
