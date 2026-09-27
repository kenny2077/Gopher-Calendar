# Local server for the dev preview (http://localhost:5178/dev/preview.html).
# Caching is off so edits show on reload. It refuses secrets and private data,
# only answers requests addressed to localhost, and accepts POST /save (used
# once to capture your own courses into gitignored fixtures) only from itself.
import http.server, functools, os, re
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PRIVATE = os.path.join(ROOT, 'test', 'fixtures', 'private')
HOSTS = {'localhost:5178', '127.0.0.1:5178'}
BLOCKED = re.compile(r'(^|/)(\.git|node_modules|test/fixtures/private)(/|$)|config\.local\.json$')

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def allowed(self):
        path = urlparse(self.path).path.lstrip('/')
        return self.headers.get('Host') in HOSTS and not BLOCKED.search(path)

    def do_GET(self):
        if not self.allowed(): self.send_error(403); return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed(): self.send_error(403); return
        super().do_HEAD()

    def do_POST(self):
        origin = self.headers.get('Origin', '')
        q = parse_qs(urlparse(self.path).query)
        name = (q.get('name') or [''])[0]
        if (self.headers.get('Host') not in HOSTS or origin not in {f'http://{h}' for h in HOSTS}
                or urlparse(self.path).path != '/save' or not re.fullmatch(r'[\w.-]+\.json', name)):
            self.send_error(403); return
        os.makedirs(PRIVATE, exist_ok=True)
        body = self.rfile.read(min(int(self.headers.get('Content-Length', 0)), 20_000_000))
        with open(os.path.join(PRIVATE, name), 'wb') as f: f.write(body)
        self.send_response(204); self.end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', 5178), functools.partial(Handler, directory=ROOT)).serve_forever()
