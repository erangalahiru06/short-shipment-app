import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import uvicorn


FRONTEND_PORT = 5500
API_PORT = 8002


def project_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent


class FrontendServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run_api() -> None:
    config = uvicorn.Config(
        "api.main:app",
        host="127.0.0.1",
        port=API_PORT,
        log_level="info",
    )
    uvicorn.Server(config).run()


def run_frontend(root: Path) -> None:
    os.chdir(root)
    server = FrontendServer(("127.0.0.1", FRONTEND_PORT), SimpleHTTPRequestHandler)
    server.serve_forever()


def main() -> None:
    root = project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    if getattr(sys, "frozen", False):
        os.environ.setdefault(
            "API_DB_PATH",
            str(Path(sys.executable).resolve().parent / "shipment_api.sqlite3"),
        )

    api_thread = threading.Thread(target=run_api, daemon=True)
    api_thread.start()

    frontend_thread = threading.Thread(target=run_frontend, args=(root,), daemon=True)
    frontend_thread.start()

    url = f"http://127.0.0.1:{FRONTEND_PORT}/index.html"
    print(f"Short Shipment app running at {url}")
    print("Close this window to stop the app.")
    webbrowser.open(url)

    try:
        frontend_thread.join()
    except KeyboardInterrupt:
        print("Stopping Short Shipment app...")


if __name__ == "__main__":
    main()
