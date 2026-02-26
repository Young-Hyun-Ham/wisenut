import http.server
import socketserver
from functools import partial
from pathlib import Path


def run():
    root = Path(__file__).resolve().parent
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    with socketserver.TCPServer(("0.0.0.0", 8081), handler) as httpd:
        print(f"Serving {root} at http://localhost:8081")
        httpd.serve_forever()


if __name__ == "__main__":
    run()
