"""Checks for public/dsq_data.py (the big datasets and the generated practice tasks).

    python tools/test_bigdata.py

For every dataset, both tiers and 14 task numbers it builds the task, runs the reference solution on the same data and requires
that the judge accepts it; it also checks that two seeds give different data, that load() never returns the same object twice
(so a learner cannot damage the original), and that sizes up to 500,000 rows build quickly.
"""
import collections
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))
import dsq_data as D  # noqa: E402

D.SEED, D.DEFAULT_N = 7, 50000
bad = 0


def ok(cond, msg):
    global bad
    print(('PASS ' if cond else 'FAIL ') + msg)
    bad += 0 if cond else 1


for name in D.META:
    t = time.time()
    a = D.load(name, 100000, seed=1)
    secs = time.time() - t
    ok(len(a) == 100000 and secs < 10, '%s builds 100,000 rows in %.2fs' % (name, secs))
    b = D.load(name, 100000, seed=2)
    ok(not a.equals(b), '%s differs between two learners (seeds)' % name)
    a['junk'] = 1
    a.drop(a.index[:50000], inplace=True)
    ok(len(D.load(name, 100000, seed=1)) == 100000 and 'junk' not in D.load(name, 100000, seed=1).columns, '%s original is intact after the copy was damaged' % name)

t = time.time()
big = D.load('retail', 500000, seed=3)
ok(len(big) == 500000 and time.time() - t < 20, 'retail builds 500,000 rows in %.1fs' % (time.time() - t))
m = D.load('retail', 50000, seed=3, messy=True)
ok(m.duplicated().sum() > 0 and m['region'].nunique() > 5, 'messy=True adds duplicates and inconsistent text')

keys = collections.Counter()
fails = 0
for name in D.META:
    for tier in ('standard', 'flagship'):
        for k in range(14):
            p = json.loads(D.task_public(name, 7, k, tier, 50000))
            keys[p['key']] += 1
            code = "from dsq_data import load\ndf = load(%r%s)\n%s" % (name, ', messy=True' if p['messy'] else '', p['solution'])
            g = {}
            exec(code, g)
            res = []
            D.judge(name, 7, k, tier, 50000, g['answer'], lambda c, msg='', hint='': res.append(c) or c)
            if not res or not res[0]:
                fails += 1
                print('  reference solution rejected:', name, tier, k, p['key'])
ok(fails == 0, '168 generated tasks: the reference solution is accepted every time (%d template kinds seen)' % len(keys))
ok('rolling' in keys and 'top3share' in keys, 'flagship tasks are generated for the owner tier')

res = []
D.judge('retail', 7, 3, 'standard', 50000, 12345.6, lambda c, msg='', hint='': res.append((c, msg, hint)))
ok(res and res[0][0] is False and res[0][2], 'a wrong answer gets an explanation: ' + (res[0][2][:60] if res else ''))
print('\nALL PASSED' if not bad else '\n%d FAILED' % bad)
sys.exit(1 if bad else 0)
