'use strict';
/* Python shims that let real libraries run where the browser has no threads or network.
   fastapi: the real FastAPI and Starlette run unchanged; only two things are replaced.
     1. the thread pool (sync endpoints are simply called, in the same thread)
     2. TestClient, which needs threads and a network stack: a small version drives the app through the ASGI interface by hand
   Learners write the same code as on a real server: `from fastapi.testclient import TestClient`, `client.get(...)`, `with TestClient(app) as client:`.
   Not supported: streaming responses, websockets and background timers (they need a real event loop). */
const SHIMS = {
  fastapi: `
def _dsq_fastapi_shim():
    import sys, json, types, urllib.parse
    import starlette.concurrency as _sc
    async def _direct(func, *a, **k):
        return func(*a, **k)
    _sc.run_in_threadpool = _direct
    import fastapi.routing as _fr
    _fr.run_in_threadpool = _direct
    import fastapi.dependencies.utils as _fu
    _fu.run_in_threadpool = _direct
    import contextlib as _cl
    @_cl.asynccontextmanager
    async def _cm_direct(cm):
        with cm as value:
            yield value
    import fastapi.concurrency as _fc
    _fc.contextmanager_in_threadpool = _cm_direct
    _fu.contextmanager_in_threadpool = _cm_direct

    class _Wait:
        def __await__(self):
            yield

    class Response:
        def __init__(self, status, headers, content):
            self.status_code = status
            self.headers = headers
            self.content = content
        def json(self):
            return json.loads(self.content or b'null')
        @property
        def text(self):
            return self.content.decode()
        @property
        def is_success(self):
            return 200 <= self.status_code < 300
        def raise_for_status(self):
            if self.status_code >= 400:
                raise RuntimeError('HTTP %d' % self.status_code)
        def __repr__(self):
            return '<Response [%d]>' % self.status_code

    class TestClient:
        def __init__(self, app, base_url='http://testserver', raise_server_exceptions=True, **kw):
            self.app = app
            self.raise_server_exceptions = raise_server_exceptions
            self._life = None
            self.headers = {}
        def request(self, method, url, params=None, json=None, data=None, headers=None, **kw):
            import json as _j
            path, _, qs = url.partition('?')
            if params:
                items = []
                for k, v in params.items():
                    for x in (v if isinstance(v, (list, tuple)) else [v]):
                        items.append((k, str(x).lower() if isinstance(x, bool) else x))
                qs = (qs + '&' if qs else '') + urllib.parse.urlencode(items)
            hdrs = {}
            hdrs.update(self.headers)
            hdrs.update(headers or {})
            raw = b''
            if json is not None:
                raw = _j.dumps(json).encode()
                hdrs.setdefault('content-type', 'application/json')
            elif data is not None:
                raw = urllib.parse.urlencode(data).encode()
                hdrs.setdefault('content-type', 'application/x-www-form-urlencoded')
            hl = [(k.lower().encode(), str(v).encode()) for k, v in hdrs.items()]
            scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': method.upper(), 'path': path, 'raw_path': path.encode(), 'query_string': qs.encode(), 'headers': hl, 'scheme': 'http', 'server': ('testserver', 80), 'client': ('testclient', 50000), 'root_path': '', 'state': {}}
            sent, st = [], {'once': False}
            async def receive():
                if not st['once']:
                    st['once'] = True
                    return {'type': 'http.request', 'body': raw, 'more_body': False}
                return {'type': 'http.disconnect'}
            async def send(m):
                sent.append(m)
            co = self.app(scope, receive, send)
            try:
                while True:
                    y = co.send(None)
                    if y is not None:
                        raise RuntimeError('this app waits for something the browser cannot provide (a thread, a timer or a stream)')
            except StopIteration:
                pass
            start = next(m for m in sent if m['type'] == 'http.response.start')
            return Response(start['status'], {k.decode(): v.decode() for k, v in start['headers']}, b''.join(m.get('body', b'') for m in sent if m['type'] == 'http.response.body'))
        def get(self, url, **kw): return self.request('GET', url, **kw)
        def post(self, url, **kw): return self.request('POST', url, **kw)
        def put(self, url, **kw): return self.request('PUT', url, **kw)
        def patch(self, url, **kw): return self.request('PATCH', url, **kw)
        def delete(self, url, **kw): return self.request('DELETE', url, **kw)
        def head(self, url, **kw): return self.request('HEAD', url, **kw)
        def options(self, url, **kw): return self.request('OPTIONS', url, **kw)
        def __enter__(self):
            st, sent = {'phase': 0, 'stop': False}, []
            async def receive():
                if st['phase'] == 0:
                    st['phase'] = 1
                    return {'type': 'lifespan.startup'}
                while not st['stop']:
                    await _Wait()
                return {'type': 'lifespan.shutdown'}
            async def send(m):
                sent.append(m)
            co = self.app({'type': 'lifespan', 'asgi': {'version': '3.0'}, 'state': {}}, receive, send)
            self._life = (co, st, sent)
            try:
                while not any(m['type'].startswith('lifespan.startup') for m in sent):
                    co.send(None)
            except StopIteration:
                pass
            bad = [m for m in sent if m['type'] == 'lifespan.startup.failed']
            if bad:
                raise RuntimeError(bad[0].get('message', 'startup failed'))
            return self
        def __exit__(self, *a):
            if self._life:
                co, st, sent = self._life
                st['stop'] = True
                try:
                    while True:
                        co.send(None)
                except StopIteration:
                    pass
                self._life = None
            return False

    for name in ('starlette.testclient', 'fastapi.testclient'):
        m = types.ModuleType(name)
        m.TestClient = TestClient
        sys.modules[name] = m
_dsq_fastapi_shim()
`,
};
