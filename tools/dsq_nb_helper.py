# --- Dhruv Patel Academy practice checker (runs in YOUR notebook, on YOUR variables) ---
import json as _json, sys as _sys, urllib.request as _ur

class _DSQ:
    def __init__(self):
        self.qs = {}; self.order = []; self.tries = {}; self.ok = {}; self.url = None; self.key = None; self.module = ''

    def load(self, pack):
        self.module = pack['title']
        for q in pack['questions']:
            self.qs[q['id']] = q; self.order.append(q['id'])
        print(f"Dhruv Patel Academy: {len(self.order)} questions loaded for '{self.module}'. Write your answer, then run the check cell under it.")
        if self._auto(): print('Linked to your Dhruv Patel Academy account: solved questions count in the app.')

    def connect(self, url, key, quiet=False):
        self.url = url.rstrip('/'); self.key = key
        if not quiet: print('Connected: solved questions will be reported to', self.url)

    def _auto(self):
        # Dhruv Patel Academy writes dsq_config.json next to the notebooks when you open them from the app
        import os
        d = os.getcwd()
        for _ in range(4):
            p = os.path.join(d, 'dsq_config.json')
            if os.path.exists(p):
                try:
                    c = _json.load(open(p)); self.connect(c['url'], c['key'], quiet=True); return True
                except Exception:
                    pass
            d = os.path.dirname(d)
        return False

    def _report(self, qid, ok):
        if not self.url: return
        try:
            req = _ur.Request(self.url + '/api/nb/report', data=_json.dumps({'key': self.key, 'qid': qid, 'ok': bool(ok)}).encode(), headers={'Content-Type': 'application/json'})
            _ur.urlopen(req, timeout=4).read()
        except Exception as e:
            print('(could not reach the app:', str(e)[:80] + ')')

    def check(self, qid):
        q = self.qs[qid]
        try:
            ip = get_ipython(); ns = dict(ip.user_ns)
        except NameError:
            ns = dict(_sys.modules['__main__'].__dict__)
        results = []
        def check(cond, msg, hint=''):
            ok = bool(cond); results.append((ok, msg, hint)); return ok
        ns['check'] = check; ns['OUT'] = ''
        for mod, alias in (('numpy', 'np'), ('pandas', 'pd')):
            if alias not in ns:
                try: ns[alias] = __import__(mod)
                except Exception: pass
        if 'plt' not in ns:
            try:
                import matplotlib.pyplot as plt; ns['plt'] = plt
            except Exception: pass
        try:
            exec(compile(q['tests'], '<tests>', 'exec'), ns)
        except BaseException as e:
            results.append((False, 'A check could not finish: ' + type(e).__name__ + ': ' + str(e)[:200], 'Did you create every variable name the task asks for? Did you run your answer cell first?'))
        self.tries[qid] = self.tries.get(qid, 0) + 1
        good = bool(results) and all(r[0] for r in results)
        for ok, msg, hint in results:
            print(('  [PASS] ' if ok else '  [FAIL] ') + msg + ('' if ok or not hint else '\n         hint: ' + hint))
        if good:
            self.ok[qid] = True; print(f"\n  Question solved: {q['title']}  (attempt {self.tries[qid]})")
        else:
            print(f"\n  Not yet - fix your answer cell, run it again, then re-run this check. (attempt {self.tries[qid]})")
        self._report(qid, good)
        return good

    def hint(self, qid):
        hs = self.qs[qid].get('hints') or []
        n = min(self.tries.get(qid, 0), len(hs)) if hs else 0
        print(('hint: ' + hs[max(0, n - 1)]) if hs else 'No hint for this one - re-read the question.')

    def solution(self, qid):
        if self.tries.get(qid, 0) < 3 and not self.ok.get(qid):
            print('Try the check at least 3 times first - the struggle is where the learning happens.'); return
        print(self.qs[qid]['solution'])

    def score(self):
        n = len(self.order); s = sum(1 for q in self.order if self.ok.get(q))
        print(f"Solved {s} of {n}.")
        for q in self.order:
            print(('  [x] ' if self.ok.get(q) else '  [ ] ') + q + ' - ' + self.qs[q]['title'] + ('' if self.ok.get(q) else f"  (tries: {self.tries.get(q, 0)})"))

dsq = _DSQ()
