import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path

# Resolve paths relative to this script's location
scripts_dir = Path(os.path.dirname(os.path.abspath(__file__)))
project_root = scripts_dir.parent

# Ensure logs/ directory exists
logs_dir = project_root / "logs"
logs_dir.mkdir(exist_ok=True)

# Log file paths
today_str = datetime.now().strftime("%Y%m%d")
log_file = logs_dir / f"update_{today_str}.log"
error_log = logs_dir / "error.log"

# Output data path
data_dir = project_root / "public" / "data"
data_dir.mkdir(parents=True, exist_ok=True)
last_updated_json = data_dir / "last_updated.json"


def timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str, file_path: Path = log_file) -> None:
    line = f"[{timestamp()}] {message}\n"
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(line)
    print(line, end="")


def run_script(script_name: str) -> bool:
    """Run a script under scripts/ and stream its output to the daily log.
    Returns True on success, False on failure."""
    script_path = scripts_dir / script_name
    log(f"--- Starting {script_name} ---")

    result = subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=True,
        text=True,
        cwd=str(project_root),
    )

    # Log stdout lines
    for line in result.stdout.splitlines():
        log(f"[{script_name}] {line}")

    # Log stderr lines
    for line in result.stderr.splitlines():
        log(f"[{script_name}][STDERR] {line}")

    if result.returncode != 0:
        error_message = (
            f"[{timestamp()}] {script_name} failed with return code {result.returncode}\n"
        )
        log(f"ERROR: {script_name} failed (return code {result.returncode})")
        with open(error_log, "a", encoding="utf-8") as f:
            f.write(error_message)
            if result.stderr:
                f.write(result.stderr)
        return False

    log(f"--- Finished {script_name} (success) ---")
    return True


def write_last_updated(success: bool) -> None:
    payload = {
        "updatedAt": timestamp(),
        "success": success,
    }
    with open(last_updated_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    log(f"Wrote {last_updated_json}")


def main() -> None:
    log("=== auto_update.py started ===")

    fetch_ok = run_script("fetch_historical.py")
    screen_ok = run_script("screen_stocks.py")

    overall_success = fetch_ok and screen_ok
    write_last_updated(overall_success)

    log(
        f"=== auto_update.py finished (success={overall_success}) ==="
    )

    if not overall_success:
        sys.exit(1)


if __name__ == "__main__":
    main()
