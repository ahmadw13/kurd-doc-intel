"""
Cross-platform development runner for KurdDocIntel.
Spawns both backend (FastAPI/Uvicorn) and frontend (Next.js) concurrently,
streams prefixed logs to stdout, and cleanly terminates both processes on Ctrl+C.
"""

import os
import shutil
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def get_backend_python() -> str:
    if sys.platform == "win32":
        venv_py = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    else:
        venv_py = BACKEND_DIR / "venv" / "bin" / "python"

    if venv_py.is_file():
        return str(venv_py)

    print("[WARN] Backend virtual environment not found at backend/venv. Falling back to system python.")
    return sys.executable


def get_npm_cmd() -> str:
    npm_name = "npm.cmd" if sys.platform == "win32" else "npm"
    npm_path = shutil.which(npm_name)
    if npm_path:
        return npm_path

    print("[ERROR] npm executable not found in PATH.")
    sys.exit(1)


def stream_pipe(pipe, prefix: str):
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            print(f"[{prefix}] {line.rstrip()}")
    except Exception:
        pass
    finally:
        pipe.close()


def main():
    print("[INFO] Starting KurdDocIntel local development environment...")

    backend_env = BACKEND_DIR / ".env"
    if not backend_env.is_file():
        print("[WARN] backend/.env file not found. AI features may fail without API keys.")

    frontend_modules = FRONTEND_DIR / "node_modules"
    if not frontend_modules.is_dir():
        print("[ERROR] frontend/node_modules not found. Please run 'npm install' inside the frontend directory first.")
        sys.exit(1)

    py_executable = get_backend_python()
    npm_executable = get_npm_cmd()

    backend_cmd = [
        py_executable,
        "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8080",
        "--reload"
    ]
    frontend_cmd = [npm_executable, "run", "dev"]

    print(f"[INFO] Backend command:  {' '.join(backend_cmd)}")
    print(f"[INFO] Frontend command: {' '.join(frontend_cmd)}")
    print("[INFO] Press Ctrl+C to stop all services.\n")

    backend_proc = None
    frontend_proc = None

    def terminate_processes():
        print("\n[INFO] Shutting down services...")
        for name, proc in [("frontend", frontend_proc), ("backend", backend_proc)]:
            if proc and proc.poll() is None:
                try:
                    if sys.platform == "win32":
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL
                        )
                    else:
                        proc.terminate()
                        proc.wait(timeout=3)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
        print("[INFO] All services stopped.")

    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=os.environ.copy()
        )

        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=os.environ.copy()
        )

        t_backend = threading.Thread(target=stream_pipe, args=(backend_proc.stdout, "backend"), daemon=True)
        t_frontend = threading.Thread(target=stream_pipe, args=(frontend_proc.stdout, "frontend"), daemon=True)

        t_backend.start()
        t_frontend.start()

        while True:
            b_code = backend_proc.poll()
            f_code = frontend_proc.poll()

            if b_code is not None:
                print(f"[ERROR] Backend exited unexpectedly with code {b_code}.")
                break
            if f_code is not None:
                print(f"[ERROR] Frontend exited unexpectedly with code {f_code}.")
                break

            threading.Event().wait(0.5)

    except KeyboardInterrupt:
        pass
    finally:
        terminate_processes()


if __name__ == "__main__":
    main()
