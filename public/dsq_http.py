"""A tiny in-browser HTTP client for ASGI apps (FastAPI, Starlette).

Browsers cannot start a web server or threads, so this talks to your FastAPI `app` object directly:

    from fastapi import FastAPI
    from dsq_http import Client
    app = FastAPI()
    @app.get('/hello/{name}')
    def hello(name: str): return {'hello': name}
    c = Client(app)
    r = c.get('/hello/Asha')
    print(r.status_code, r.json())

It builds the same ASGI request a real server (uvicorn) would send, so the code you write here is the code you deploy.
"""
import json as _json
from urllib.parse import urlsplit, urlencode


def _patch_threads():
    """FastAPI runs plain `def` endpoints in a worker thread; a browser has none, so run them inline."""
    async def _inline(func, *a, **k):
        return func(*a, **k)
    import sys
    try:
        import starlette.concurrency as c
        c.run_in_threadpool = _inline
        for name in ('fastapi.routing', 'fastapi.dependencies.utils', 'starlette.routing', 'starlette.endpoints'):
            m = sys.modules.get(name)
            if m is not None and hasattr(m, 'run_in_threadpool'):
                m.run_in_threadpool = _inline
    except Exception:
        pass


class Response:
    def __init__(self, status, headers, body):
        self.status_code = status
        self.headers = {k.decode().lower(): v.decode() for k, v in headers}
        self.content = body

    @property
    def text(self):
        return self.content.decode('utf-8', 'replace')

    def json(self):
        return _json.loads(self.content or b'null')

    @property
    def ok(self):
        return self.status_code < 400

    def __repr__(self):
        return '<Response [%d]>' % self.status_code


def _drive(coro):
    """Run a coroutine that never waits on real I/O to completion."""
    for _ in range(100000):
        try:
            coro.send(None)
        except StopIteration as e:
            return e.value
    raise RuntimeError('the app waited on something this browser client cannot provide (a sleep, a socket, a thread)')


class Client:
    def __init__(self, app):
        self.app = app
        _patch_threads()

    def request(self, method, url, json=None, data=None, params=None, headers=None):
        parts = urlsplit(url)
        qs = parts.query
        if params:
            qs = (qs + '&' if qs else '') + urlencode(params, doseq=True)
        hdrs = {'host': 'testserver', 'user-agent': 'dsquest-client'}
        body = b''
        if json is not None:
            body = _json.dumps(json).encode()
            hdrs['content-type'] = 'application/json'
        elif data is not None:
            body = urlencode(data).encode()
            hdrs['content-type'] = 'application/x-www-form-urlencoded'
        for k, v in (headers or {}).items():
            hdrs[k.lower()] = v
        hdrs['content-length'] = str(len(body))
        scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': method.upper(), 'scheme': 'http', 'path': parts.path or '/', 'raw_path': (parts.path or '/').encode(),
                 'query_string': qs.encode(), 'root_path': '', 'headers': [(k.encode(), v.encode()) for k, v in hdrs.items()], 'client': ('127.0.0.1', 5000), 'server': ('testserver', 80)}
        sent, state = [], {'done': False}

        async def receive():
            if not state['done']:
                state['done'] = True
                return {'type': 'http.request', 'body': body, 'more_body': False}
            return {'type': 'http.disconnect'}

        async def send(msg):
            sent.append(msg)

        _drive(self.app(scope, receive, send))
        status, hd, out = 500, [], b''
        for m in sent:
            if m['type'] == 'http.response.start':
                status, hd = m['status'], m.get('headers', [])
            elif m['type'] == 'http.response.body':
                out += m.get('body', b'')
        return Response(status, hd, out)

    def get(self, url, **k):
        return self.request('GET', url, **k)

    def post(self, url, **k):
        return self.request('POST', url, **k)

    def put(self, url, **k):
        return self.request('PUT', url, **k)

    def patch(self, url, **k):
        return self.request('PATCH', url, **k)

    def delete(self, url, **k):
        return self.request('DELETE', url, **k)
