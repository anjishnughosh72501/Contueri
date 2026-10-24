#!/usr/bin/env python3
"""
Contueri Development Server Launcher
Starts both the Cloudflare Worker backend and the Vite frontend simultaneously.
"""

import os
import sys
import subprocess
import threading
import signal
import time

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def stream_output(pipe, prefix, color_code):
    reset_color = "\033[0m"
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            print(f"{color_code}{prefix}{reset_color} {line.rstrip()}")
    except Exception:
        pass
    finally:
        pipe.close()

def kill_process_tree(proc):
    if proc is None:
        return
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

def main():
    print("=" * 60)
    print("🚀 Starting Contueri Development Environment")
    print("=" * 60)

    # 1. Ensure shared package is built
    print("\n📦 Building @contueri/shared package...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    build_shared = subprocess.run(
        [npm_cmd, "--workspace=shared", "run", "build"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    if build_shared.returncode != 0:
        print("❌ Failed to build shared package:")
        print(build_shared.stderr)
        sys.exit(1)
    print("✅ Shared package built successfully.")

    # Colors for output
    CYAN = "\033[36m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RESET = "\033[0m"

    print("\n🔄 Launching backend Worker and frontend Vite...")

    # Start Worker dev server
    worker_proc = subprocess.Popen(
        [npm_cmd, "--workspace=worker", "run", "dev"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1
    )

    # Start Web frontend dev server
    web_proc = subprocess.Popen(
        [npm_cmd, "--workspace=web", "run", "dev"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1
    )

    # Start output streaming threads
    t_worker = threading.Thread(
        target=stream_output,
        args=(worker_proc.stdout, "[Worker]", CYAN),
        daemon=True
    )
    t_web = threading.Thread(
        target=stream_output,
        args=(web_proc.stdout, "[Web]", GREEN),
        daemon=True
    )
    t_worker.start()
    t_web.start()

    print(f"\n{YELLOW}Server endpoints:{RESET}")
    print(f"👉 Frontend:  http://localhost:5173")
    print(f"👉 Backend:   http://localhost:8787")
    print(f"\nPress Ctrl+C to stop both servers.\n")

    def handle_exit(sig=None, frame=None):
        print("\n\n🛑 Shutting down servers...")
        kill_process_tree(worker_proc)
        kill_process_tree(web_proc)
        print("✅ Servers stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_exit)

    try:
        while True:
            # Check if any process exited prematurely
            w_code = worker_proc.poll()
            if w_code is not None:
                print(f"\n❌ Worker process exited with code {w_code}")
                handle_exit()
            f_code = web_proc.poll()
            if f_code is not None:
                print(f"\n❌ Vite process exited with code {f_code}")
                handle_exit()
            time.sleep(1)
    except KeyboardInterrupt:
        handle_exit()

if __name__ == "__main__":
    main()
