'use strict';
/* =====================================================================
   Python projects (pure Python + csv/json, no libraries): 3 variants
   ===================================================================== */
DS.expenses = (r, tier) => {
  const n = tier === 'flagship' ? 420 : 200, cats = ['Food', 'Transport', 'Rent', 'Fun', 'Health', 'Shopping'], w = [5, 3, 0.35, 2, 0.8, 1.6], rows = ['date,category,amount,note'];
  const notes = { Food: ['lunch', 'groceries', 'chai', 'dinner'], Transport: ['metro', 'auto', 'fuel', 'cab'], Rent: ['rent'], Fun: ['movie', 'game', 'concert'], Health: ['pharmacy', 'gym', 'doctor'], Shopping: ['shirt', 'shoes', 'gadget'] };
  const base = { Food: 180, Transport: 90, Rent: 9000, Fun: 450, Health: 600, Shopping: 1500 };
  for (let i = 0; i < n; i++) {
    const c = pick(r, cats, w), d = isoDate([2026, 1, 1], r.int(0, 89)); let a = base[c] * (.4 + r() * 1.3);
    rows.push([d, c, r() < .03 ? 'n/a' : a.toFixed(2), r.pick(notes[c])].join(','));
  }
  return rows.join('\n');
};
DS.steps = (r, tier) => {
  const n = tier === 'flagship' ? 180 : 90, rows = ['day,steps,minutes,calories'], goal = r.int(6500, 8500);
  for (let i = 0; i < n; i++) {
    const wk = new Date(isoDate([2026, 1, 1], i)).getUTCDay(), st = Math.max(900, Math.round(goal * (wk === 0 || wk === 6 ? 1.1 : .95) + r.norm(0, 2600)));
    const mins = Math.round(st / 105 + r.norm(0, 6)), cal = Math.round(st * .045 + r.norm(0, 25));
    rows.push([isoDate([2026, 1, 1], i), r() < .03 ? '' : st, Math.max(5, mins), Math.max(40, cal)].join(','));
  }
  return rows.join('\n');
};
DS.library = (r, tier) => {
  const n = tier === 'flagship' ? 650 : 320, books = ['Dune', 'Emma', 'Ulysses', 'Hamlet', 'Matilda', 'Kim', 'Beloved', 'Walden', 'Persuasion', 'Middlemarch', 'Dracula', 'Heidi'], rows = ['member,book,days,fine'];
  const bw = books.map((_, i) => 1 + 3 / (i + 1));
  for (let i = 0; i < n; i++) {
    const d = Math.max(2, Math.round(r.norm(13, 6)));
    rows.push(['M' + String(r.int(1, tier === 'flagship' ? 40 : 25)).padStart(2, '0'), pick(r, books, bw), d, Math.max(0, d - 14) * 2].join(','));
  }
  return rows.join('\n');
};

(function () {
  const M = DSQ.modules.find(m => m.id === 'python');
  M.project = {
    variants: [
      /* ============================================================ expenses */
      {
        id: 'spend', flagship: true, hours: 3, title: 'SpendWise: a personal expense tracker in pure Python',
        pitch: 'Read three months of expense records from a CSV file (a few rows are broken), total them by category and month, find where the money goes, and print a tidy report - using nothing but Python itself.',
        real: 'The core logic of personal-finance apps (Walnut, Splitwise, Mint): ingest, clean, categorise and summarise transactions.',
        flagship_note: 'twice the records (~420) and two extra milestones: the three most expensive days and a JSON summary file for an app to read.',
        dataset: { file: 'expenses.csv', desc: 'Synthetic expense log Jan-Mar 2026: date, category, amount (INR) and a note. About 3% of amounts are the text "n/a" - broken rows your code must survive.',
          columns: [['date', 'YYYY-MM-DD'], ['category', 'Food, Transport, Rent, Fun, Health or Shopping'], ['amount', 'rupees, or "n/a" when broken'], ['note', 'free text']], gen: DS.expenses },
        refs: ['Python docs: the csv and json modules.', 'Next module: the same questions answered in two lines with pandas.'],
        milestones: [
          { id: 'read', title: 'Read the file, survive bad rows', xp: 30, est: 300,
            prompt: `<p>Read <code>data/expenses.csv</code> with <code>csv.DictReader</code>. Build <code>clean</code>: a list of dicts with the original keys but <code>amount</code> converted to a float. Rows whose amount cannot be converted must be skipped; count them in <code>n_bad</code>.</p>`,
            starter: `import csv

clean = []
n_bad = 0
with open('data/expenses.csv') as f:
    for row in csv.DictReader(f):
        try:
            row['amount'] = float(row['amount'])
            clean.___(row)
        except ___:
            n_bad += 1
print(len(clean), n_bad)`,
            solution: `import csv

clean = []
n_bad = 0
with open('data/expenses.csv') as f:
    for row in csv.DictReader(f):
        try:
            row['amount'] = float(row['amount'])
            clean.append(row)
        except ValueError:
            n_bad += 1
print(len(clean), n_bad)`,
            bank: ['append', 'add', 'ValueError', 'KeyError', 'Exception', 'extend'], hints: ['float("n/a") raises ValueError.'],
            tests: `import csv as _c
_rows = list(_c.DictReader(open('data/expenses.csv')))
_bad = sum(1 for r in _rows if r['amount'] == 'n/a')
check(len(clean) == len(_rows) - _bad, 'clean holds every valid row', 'append rows whose float() worked')
check(n_bad == _bad and n_bad > 0, 'n_bad counts the broken rows', 'count them in the except block')
check(all(isinstance(r['amount'], float) for r in clean), 'amounts are floats', "row['amount'] = float(row['amount'])")` },
          { id: 'totals', title: 'Where does the money go?', xp: 35, est: 360,
            prompt: `<ul><li><code>by_cat</code>: dict category -> total amount (loop over <code>clean</code>)</li><li><code>total</code>: the grand total</li><li><code>top_cat</code>: the category with the largest total</li><li><code>share</code>: dict category -> percentage of the total, rounded to 1 decimal</li></ul>`,
            starter: `by_cat = {}
for row in clean:
    by_cat[row['category']] = by_cat.get(row['category'], 0) + row['___']
total = sum(by_cat.___())
top_cat = max(by_cat, key=by_cat.___)
share = {c: round(100 * v / total, 1) for c, v in by_cat.items()}
print(top_cat, share)`,
            solution: `by_cat = {}
for row in clean:
    by_cat[row['category']] = by_cat.get(row['category'], 0) + row['amount']
total = sum(by_cat.values())
top_cat = max(by_cat, key=by_cat.get)
share = {c: round(100 * v / total, 1) for c, v in by_cat.items()}
print(top_cat, share)`,
            bank: ['amount', 'category', 'values', 'keys', 'get', 'items'], hints: ['dict.get(key, 0) starts a new category at zero.'],
            tests: `_t = {}
for r in clean: _t[r['category']] = _t.get(r['category'], 0) + r['amount']
check(set(by_cat) == set(_t) and all(abs(by_cat[k] - _t[k]) < 1e-6 for k in _t), 'by_cat totals per category', 'by_cat.get(cat, 0) + amount')
check(abs(total - sum(_t.values())) < 1e-6, 'total is the grand total', 'sum(by_cat.values())')
check(top_cat == max(_t, key=_t.get), 'top_cat is the biggest category', 'max(by_cat, key=by_cat.get)')
check(abs(sum(share.values()) - 100) < 0.5, 'share adds up to about 100%', 'round(100 * v / total, 1)')` },
          { id: 'months', title: 'Month by month', xp: 40, est: 420, star: true,
            prompt: `<ul><li><code>by_month</code>: dict "YYYY-MM" -> total (the month is the first 7 characters of the date)</li><li><code>worst_month</code>: the month with the highest spending</li><li><code>ranking</code>: list of (category, total) tuples sorted from highest to lowest total</li><li><code>over</code>: sorted list of categories whose total is above the <b>average category total</b></li></ul><p>Plan it in the Logic Lab for <code>over</code>.</p>`,
            starter: `by_month = {}
worst_month = ...
ranking = ...
over = ...
print(worst_month, ranking[:2], over)`,
            solution: `by_month = {}
for row in clean:
    m = row['date'][:7]
    by_month[m] = by_month.get(m, 0) + row['amount']
worst_month = max(by_month, key=by_month.get)
ranking = sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)
avg_cat = total / len(by_cat)
over = sorted(c for c, v in by_cat.items() if v > avg_cat)
print(worst_month, ranking[:2], over)`,
            hints: ['date[:7] slices "2026-02-14" down to "2026-02".', 'sorted(d.items(), key=lambda kv: kv[1], reverse=True)'],
            logic: { task: 'Explain how you would list the categories that cost more than the average category.', xp: 20, minWords: 12,
              rubric: [
                { id: 'avg', label: 'work out the average category total', any: ['average', 'mean', 'divide', 'total.*number of categories', 'sum.*count', '/ ?len'], hint: 'Before comparing, you need a yardstick. What single number do you compare each category against?', code: 'avg_cat = total / len(by_cat)' },
                { id: 'cmp', label: 'keep those above it', any: ['above', 'greater', 'more than', 'bigger', 'higher', 'exceed', '>', 'over'], hint: 'How do you pick out the categories that beat the yardstick?', code: 'over = [c for c, v in by_cat.items() if v > avg_cat]' },
                { id: 'sort', label: 'sort the names', any: ['sort', 'alphabet', 'order'], hint: 'The answer should be a sorted list of names.', code: 'over = sorted(over)' },
              ] },
            tests: `_m = {}
for r in clean: _m[r['date'][:7]] = _m.get(r['date'][:7], 0) + r['amount']
check(set(by_month) == set(_m) and all(abs(by_month[k] - _m[k]) < 1e-6 for k in _m), 'by_month totals per YYYY-MM', "row['date'][:7]")
check(worst_month == max(_m, key=_m.get), 'worst_month is the highest-spending month', 'max(by_month, key=by_month.get)')
_t = {}
for r in clean: _t[r['category']] = _t.get(r['category'], 0) + r['amount']
check([k for k, v in ranking] == sorted(_t, key=_t.get, reverse=True), 'ranking is sorted from highest to lowest', 'sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)')
_avg = sum(_t.values()) / len(_t)
check(list(over) == sorted(c for c, v in _t.items() if v > _avg), 'over lists the above-average categories, sorted', 'compare each total with the average')` },
          { id: 'report', title: 'Print the report', xp: 40, est: 420,
            prompt: `<p>Write a function <code>report(by_cat)</code> that returns a multi-line string: one line per category, highest total first, formatted like <code>Rent        12345.67  ( 38.2%)</code> (category left-aligned in 10 characters, amount with 2 decimals right-aligned in 10, percentage with 1 decimal right-aligned in 5). Then print <code>report(by_cat)</code>.</p>`,
            starter: `def report(by_cat):
    tot = sum(by_cat.values())
    lines = []
    for cat, amt in sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True):
        lines.append(f"{cat:<10}{amt:>___.2f}  ({100 * amt / tot:>5.1f}%)")
    return "\\n".join(lines)

print(report(by_cat))`,
            solution: `def report(by_cat):
    tot = sum(by_cat.values())
    lines = []
    for cat, amt in sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True):
        lines.append(f"{cat:<10}{amt:>10.2f}  ({100 * amt / tot:>5.1f}%)")
    return "\\n".join(lines)

print(report(by_cat))`,
            bank: ['10', '5', '8', '20'], hints: ['{x:>10.2f} right-aligns in a field 10 wide with 2 decimals.'],
            tests: `_r = report(by_cat).split(chr(10))
check(len(_r) == len(by_cat), 'one line per category', '"\\\\n".join(lines)')
check(_r[0].startswith(max(by_cat, key=by_cat.get)), 'the first line is the biggest category', 'sorted(..., reverse=True)')
check(all(len(l) == 10 + 10 + 2 + 8 for l in _r), 'every line has the same width (10 + 10 + 2 + 8)', 'use :<10, :>10.2f and :>5.1f')
check(OUT.strip().split(chr(10))[0] == _r[0], 'the report is printed', 'print(report(by_cat))')` },
        ],
        flagship_ms: [
          { id: 'days', title: 'Flagship: the three priciest days', xp: 45, est: 420, star: true,
            prompt: `<ul><li><code>daily</code>: dict date -> total spent that day</li><li><code>top3_days</code>: list of the three (date, amount) pairs with the highest spending, biggest first</li><li><code>avg_daily</code>: average spending per <b>day that has records</b></li></ul>`,
            starter: `daily = {}
for row in clean:
    daily[row['date']] = daily.get(row['date'], 0) + row['amount']
top3_days = sorted(daily.items(), key=lambda kv: kv[1], reverse=___)[:___]
avg_daily = sum(daily.values()) / ___(daily)
print(top3_days, round(avg_daily, 2))`,
            solution: `daily = {}
for row in clean:
    daily[row['date']] = daily.get(row['date'], 0) + row['amount']
top3_days = sorted(daily.items(), key=lambda kv: kv[1], reverse=True)[:3]
avg_daily = sum(daily.values()) / len(daily)
print(top3_days, round(avg_daily, 2))`,
            bank: ['True', 'False', '3', '1', 'len', 'sum'], hints: ['Slice the sorted list with [:3].'],
            tests: `_d = {}
for r in clean: _d[r['date']] = _d.get(r['date'], 0) + r['amount']
_top = sorted(_d.items(), key=lambda kv: kv[1], reverse=True)[:3]
check(len(top3_days) == 3 and [d for d, a in top3_days] == [d for d, a in _top], 'top3_days are the three biggest days, biggest first', 'sorted(daily.items(), key=..., reverse=True)[:3]')
check(abs(avg_daily - sum(_d.values()) / len(_d)) < 1e-6, 'avg_daily is the mean per day with records', 'sum(daily.values()) / len(daily)')` },
          { id: 'json', title: 'Flagship: a JSON summary for an app', xp: 40, est: 360,
            prompt: `<p>Mobile apps read JSON. Build the dict <code>summary</code> with keys <code>"total"</code> (rounded to 2 decimals), <code>"top_category"</code>, <code>"worst_month"</code> and <code>"bad_rows"</code>; then <code>text = json.dumps(summary, indent=2)</code>. Print it.</p>`,
            starter: `import json

summary = {"total": round(total, 2), "top_category": ___, "worst_month": worst_month, "bad_rows": n_bad}
text = json.___(summary, indent=2)
print(text)`,
            solution: `import json

summary = {"total": round(total, 2), "top_category": top_cat, "worst_month": worst_month, "bad_rows": n_bad}
text = json.dumps(summary, indent=2)
print(text)`,
            bank: ['top_cat', 'by_cat', 'dumps', 'loads', 'dump'], hints: ['dumps turns a dict into a JSON string; loads does the reverse.'],
            tests: `import json as _j
back = _j.loads(text)
check(set(back) == {'total', 'top_category', 'worst_month', 'bad_rows'}, 'the JSON has the four keys', 'dict keys: total, top_category, worst_month, bad_rows')
check(back['top_category'] == top_cat and back['worst_month'] == worst_month and back['bad_rows'] == n_bad, 'the values come from your earlier results', 'top_cat, worst_month, n_bad')
check(text.count(chr(10)) >= 4, 'it is pretty-printed (indent=2)', 'json.dumps(..., indent=2)')` },
        ],
      },

      /* ============================================================ steps */
      {
        id: 'stepcoach', hours: 3, title: 'StepCoach: turn raw fitness data into a streak coach',
        pitch: 'A fitness band exports one CSV row per day: steps, active minutes and calories. Clean it, compute your averages and goal days, find your longest streak of goal-hitting days, and rate each week.',
        real: 'The daily-goal, streak and weekly-summary logic of Fitbit, Google Fit and Apple Health.',
        flagship_note: 'twice the days (180) and two extra milestones: a calories-per-step model that predicts calories and a JSON summary for the app.',
        dataset: { file: 'steps.csv', desc: 'Synthetic fitness-band data starting 2026-01-01: steps, active minutes and calories per day. About 3% of days have a blank steps field (band not worn). Weekends are a bit more active. Your daily average differs from other learners.',
          columns: [['day', 'YYYY-MM-DD'], ['steps', 'steps (blank if missing)'], ['minutes', 'active minutes'], ['calories', 'calories burned']], gen: DS.steps },
        refs: ['WHO recommends about 150 minutes of moderate activity per week; the often-quoted 10,000 steps is a marketing number from the 1960s, not a medical rule.', 'The same data takes five lines in pandas - compare later.'],
        milestones: [
          { id: 'read', title: 'Read and clean', xp: 30, est: 300,
            prompt: `<p>Read <code>data/steps.csv</code>. Build <code>days</code>: a list of dicts with <code>day</code> (text), <code>steps</code>, <code>minutes</code>, <code>calories</code> (all ints). Skip rows with a blank/unreadable steps value and count them in <code>n_missing</code>.</p>`,
            starter: `import csv

days = []
n_missing = 0
with open('data/steps.csv') as f:
    for row in csv.DictReader(f):
        try:
            days.append({"day": row["day"], "steps": int(row["steps"]), "minutes": int(row["minutes"]), "calories": int(row["calories"])})
        except ___:
            n_missing += ___
print(len(days), n_missing)`,
            solution: `import csv

days = []
n_missing = 0
with open('data/steps.csv') as f:
    for row in csv.DictReader(f):
        try:
            days.append({"day": row["day"], "steps": int(row["steps"]), "minutes": int(row["minutes"]), "calories": int(row["calories"])})
        except ValueError:
            n_missing += 1
print(len(days), n_missing)`,
            bank: ['ValueError', 'KeyError', '1', '0', 'Exception'], hints: ['int("") raises ValueError.'],
            tests: `import csv as _c
_r = list(_c.DictReader(open('data/steps.csv')))
_m = sum(1 for r in _r if r['steps'] == '')
check(len(days) == len(_r) - _m and n_missing == _m and _m > 0, 'days has every valid row; n_missing counts the blanks', 'except ValueError: n_missing += 1')
check(all(isinstance(d['steps'], int) for d in days), 'steps are ints', 'int(row["steps"])')` },
          { id: 'stats', title: 'Averages and goal days', xp: 35, est: 360,
            prompt: `<ul><li><code>avg_steps</code>: mean steps per day</li><li><code>best_day</code>: the <code>day</code> text with the most steps</li><li><code>goal</code> is set for you: your own average rounded down to the nearest 500. <code>goal_days</code>: how many days reached the goal</li></ul>`,
            starter: `avg_steps = sum(d['steps'] for d in days) / len(days)
best_day = max(days, key=lambda d: d['___'])['day']
goal = int(avg_steps // 500 * 500)
goal_days = sum(1 for d in days if d['steps'] >= ___)
print(round(avg_steps), best_day, goal, goal_days)`,
            solution: `avg_steps = sum(d['steps'] for d in days) / len(days)
best_day = max(days, key=lambda d: d['steps'])['day']
goal = int(avg_steps // 500 * 500)
goal_days = sum(1 for d in days if d['steps'] >= goal)
print(round(avg_steps), best_day, goal, goal_days)`,
            bank: ['steps', 'minutes', 'goal', 'avg_steps', 'calories'], hints: ['max(items, key=...) picks the item with the largest key.'],
            tests: `_a = sum(d['steps'] for d in days) / len(days)
check(abs(avg_steps - _a) < 1e-9, 'avg_steps is the mean', 'sum(...) / len(days)')
check(best_day == max(days, key=lambda d: d['steps'])['day'], 'best_day is the day with the most steps', "max(days, key=lambda d: d['steps'])['day']")
_g = int(_a // 500 * 500)
check(goal == _g and goal_days == sum(1 for d in days if d['steps'] >= _g), 'goal_days counts days >= goal', "sum(1 for d in days if d['steps'] >= goal)")` },
          { id: 'streak', title: 'The longest streak', xp: 45, est: 480, star: true,
            prompt: `<p>A streak is a run of <b>consecutive rows</b> that all reached the goal. Compute <code>best_streak</code>: the length of the longest streak, and <code>streak_end</code>: the <code>day</code> text where that longest streak ends. (If there are ties, take the first.)</p><p>Plan it in the Logic Lab.</p>`,
            starter: `best_streak = 0
streak_end = None
...
print(best_streak, streak_end)`,
            solution: `best_streak = 0
streak_end = None
run = 0
for d in days:
    if d['steps'] >= goal:
        run += 1
        if run > best_streak:
            best_streak = run
            streak_end = d['day']
    else:
        run = 0
print(best_streak, streak_end)`,
            hints: ['Keep a counter that grows on a goal day and resets to 0 on a miss.', 'Update the best only when the current run beats it.'],
            logic: { task: 'Explain how to find the longest run of consecutive goal days with one pass over the data.', xp: 20, minWords: 14,
              rubric: [
                { id: 'run', label: 'keep a running counter', any: ['counter', 'count', 'running', 'current streak', 'keep track', 'variable'], hint: 'You need something that remembers how long the current streak is while you walk through the days.', code: 'best_streak = 0\nstreak_end = None\nrun = 0' },
                { id: 'inc', label: 'add 1 on a goal day', any: ['add', 'increase', 'increment', '\\+ ?1', 'plus one', 'goes up', 'grow'], hint: 'What happens to the counter on a day that reaches the goal?', code: "for d in days:\n    if d['steps'] >= goal:\n        run += 1" },
                { id: 'reset', label: 'reset to zero on a miss', any: ['reset', 'back to (0|zero)', 'set it to (0|zero)', 'start over', 'zero', 'else'], hint: 'And on a day that misses the goal, the streak is broken - what must the counter become?', code: '    else:\n        run = 0' },
                { id: 'best', label: 'remember the best run and where it ended', any: ['best', 'longest', 'maximum', 'max', 'record', 'bigger than', 'longer than', 'beats'], hint: 'How do you remember the longest streak seen so far, and the day it finished?', code: "# remember the best streak\nif run > best_streak:\n    best_streak = run\n    streak_end = d['day']" },
              ] },
            tests: `_run = 0; _b = 0; _e = None
for d in days:
    if d['steps'] >= goal:
        _run += 1
        if _run > _b: _b = _run; _e = d['day']
    else: _run = 0
check(best_streak == _b, 'best_streak is the longest run of goal days', 'counter that resets on a miss')
check(streak_end == _e, 'streak_end is the day the best streak ends', "streak_end = d['day'] when run beats best")` },
          { id: 'weeks', title: 'Rate every week', xp: 40, est: 420,
            prompt: `<ul><li><code>weeks</code>: the list of days cut into chunks of 7 (the last chunk may be shorter) - a list comprehension with slicing</li><li><code>weekly_avg</code>: list with the average steps of each chunk, rounded to the nearest int</li><li><code>best_week</code>: the 1-based number of the week with the highest average</li><li><code>trend</code>: <code>"up"</code> if the last week's average is above the first week's, else <code>"down"</code></li></ul>`,
            starter: `weeks = [days[i:i + ___] for i in range(0, len(days), 7)]
weekly_avg = [round(sum(d['steps'] for d in w) / len(w)) for w in weeks]
best_week = weekly_avg.index(max(weekly_avg)) + ___
trend = "up" if weekly_avg[-1] > weekly_avg[0] else "down"
print(len(weeks), best_week, trend)`,
            solution: `weeks = [days[i:i + 7] for i in range(0, len(days), 7)]
weekly_avg = [round(sum(d['steps'] for d in w) / len(w)) for w in weeks]
best_week = weekly_avg.index(max(weekly_avg)) + 1
trend = "up" if weekly_avg[-1] > weekly_avg[0] else "down"
print(len(weeks), best_week, trend)`,
            bank: ['7', '1', '0', '6'], hints: ['Slice in steps of 7: days[i:i+7].', 'Positions start at 0 but week numbers start at 1.'],
            tests: `_w = [days[i:i + 7] for i in range(0, len(days), 7)]
_a = [round(sum(d['steps'] for d in w) / len(w)) for w in _w]
check(len(weeks) == len(_w) and sum(len(w) for w in weeks) == len(days), 'weeks cuts all days into chunks of 7', 'days[i:i + 7]')
check(list(weekly_avg) == _a, 'weekly_avg is each chunk average (rounded)', 'round(sum(...) / len(w))')
check(best_week == _a.index(max(_a)) + 1 and trend == ('up' if _a[-1] > _a[0] else 'down'), 'best_week (1-based) and trend are right', 'index(max(...)) + 1')` },
        ],
        flagship_ms: [
          { id: 'model', title: 'Flagship: a calories-per-step model', xp: 45, est: 420, star: true,
            prompt: `<ul><li><code>kcal_per_step</code>: total calories divided by total steps (over days with steps)</li><li>a function <code>predict(steps)</code> that returns the expected calories rounded to the nearest int</li><li><code>mae</code>: the mean absolute error of your predictions over all days (mean of |predicted - actual|), rounded to 2 decimals</li></ul>`,
            starter: `kcal_per_step = sum(d['calories'] for d in days) / sum(d['steps'] for d in days)

def predict(steps):
    return round(steps * ___)

mae = round(sum(abs(predict(d['steps']) - d['___']) for d in days) / len(days), 2)
print(round(kcal_per_step, 4), predict(10000), mae)`,
            solution: `kcal_per_step = sum(d['calories'] for d in days) / sum(d['steps'] for d in days)

def predict(steps):
    return round(steps * kcal_per_step)

mae = round(sum(abs(predict(d['steps']) - d['calories']) for d in days) / len(days), 2)
print(round(kcal_per_step, 4), predict(10000), mae)`,
            bank: ['kcal_per_step', 'calories', 'steps', 'minutes'], hints: ['predict multiplies steps by your rate and rounds.'],
            tests: `_k = sum(d['calories'] for d in days) / sum(d['steps'] for d in days)
check(abs(kcal_per_step - _k) < 1e-12, 'kcal_per_step = total calories / total steps', 'sum(calories) / sum(steps)')
check(predict(10000) == round(10000 * _k) and predict(0) == 0, 'predict(steps) returns the rounded estimate', 'round(steps * kcal_per_step)')
check(abs(mae - round(sum(abs(round(d['steps'] * _k) - d['calories']) for d in days) / len(days), 2)) < 1e-9, 'mae is the mean absolute error', 'mean of |predict(steps) - calories|')` },
          { id: 'json', title: 'Flagship: the coach summary (JSON)', xp: 35, est: 300,
            prompt: `<p>Build <code>summary</code> with <code>"avg_steps"</code> (int), <code>"goal"</code>, <code>"goal_days"</code>, <code>"best_streak"</code>, <code>"best_week"</code> and <code>"trend"</code>, then <code>text = json.dumps(summary, indent=2)</code> and print it.</p>`,
            starter: `import json

summary = {"avg_steps": int(avg_steps), "goal": goal, "goal_days": goal_days, "best_streak": ___, "best_week": best_week, "trend": trend}
text = json.dumps(summary, indent=2)
print(text)`,
            solution: `import json

summary = {"avg_steps": int(avg_steps), "goal": goal, "goal_days": goal_days, "best_streak": best_streak, "best_week": best_week, "trend": trend}
text = json.dumps(summary, indent=2)
print(text)`,
            bank: ['best_streak', 'streak_end', 'weeks'], hints: ['Use the value you computed in the streak milestone.'],
            tests: `import json as _j
b = _j.loads(text)
check(set(b) == {'avg_steps', 'goal', 'goal_days', 'best_streak', 'best_week', 'trend'}, 'the JSON has the six keys', 'avg_steps, goal, goal_days, best_streak, best_week, trend')
check(b['best_streak'] == best_streak and b['goal_days'] == goal_days and b['trend'] == trend, 'values match your earlier results', 'reuse your variables')` },
        ],
      },

      /* ============================================================ library */
      {
        id: 'librarydesk', hours: 3, title: 'LibraryDesk: loans, late fees and the most borrowed books',
        pitch: 'A public library exports its loan records: who borrowed what, for how many days, and the fine charged. Reverse-engineer the fine rule, find the most popular books and the members who owe the most, and print a desk report.',
        real: 'The back-office logic of library and rental systems (Koha, Libby, Netflix-DVD-style rentals): loan periods, late fees, popularity ranking.',
        flagship_note: 'twice the records (~650 loans) and two extra milestones: members with above-average fines and a JSON summary.',
        dataset: { file: 'loans.csv', desc: 'Synthetic loan records: member id, book title, days kept and the fine charged. Most people return books within 14 days; some keep them longer. Different members, counts and fines for every learner.',
          columns: [['member', 'member id such as M07'], ['book', 'title'], ['days', 'days the book was kept'], ['fine', 'late fine in rupees']], gen: DS.library },
        refs: ['Open Library (openlibrary.org) has free book data and an API for real titles.', 'The fine rule is hidden in the data: recover it, then verify it on every row.'],
        milestones: [
          { id: 'read', title: 'Read the loans', xp: 25, est: 240,
            prompt: `<p>Read <code>data/loans.csv</code> into <code>loans</code>: a list of dicts with <code>member</code> and <code>book</code> as text and <code>days</code>, <code>fine</code> as ints. Then <code>n_loans</code> and <code>n_members</code> (number of distinct members, use a set).</p>`,
            starter: `import csv

loans = []
with open('data/loans.csv') as f:
    for row in csv.DictReader(f):
        loans.append({"member": row["member"], "book": row["book"], "days": ___(row["days"]), "fine": int(row["fine"])})
n_loans = len(loans)
n_members = len(___(l["member"] for l in loans))
print(n_loans, n_members)`,
            solution: `import csv

loans = []
with open('data/loans.csv') as f:
    for row in csv.DictReader(f):
        loans.append({"member": row["member"], "book": row["book"], "days": int(row["days"]), "fine": int(row["fine"])})
n_loans = len(loans)
n_members = len(set(l["member"] for l in loans))
print(n_loans, n_members)`,
            bank: ['int', 'float', 'str', 'set', 'list', 'dict'], hints: ['A set keeps each member once.'],
            tests: `import csv as _c
_r = list(_c.DictReader(open('data/loans.csv')))
check(len(loans) == len(_r) and all(isinstance(l['days'], int) and isinstance(l['fine'], int) for l in loans), 'loans has every row with int days and fine', 'int(row["days"])')
check(n_loans == len(_r) and n_members == len({r['member'] for r in _r}), 'n_loans and n_members are right', 'len(set(...))')` },
          { id: 'rule', title: 'Recover the fine rule', xp: 40, est: 420, star: true,
            prompt: `<p>Fines follow a simple rule. Write <code>fine_for(days)</code> so that it reproduces <b>every</b> fine in the data. Hint: look at rows with small and large <code>days</code>. Then set <code>all_match</code> to True/False by checking all rows, and <code>overdue_rate</code> to the share of loans kept more than 14 days.</p>`,
            starter: `def fine_for(days):
    ...

all_match = all(fine_for(l['days']) == l['fine'] for l in loans)
overdue_rate = ...
print(all_match, round(overdue_rate, 3))`,
            solution: `def fine_for(days):
    return max(0, days - 14) * 2

all_match = all(fine_for(l['days']) == l['fine'] for l in loans)
overdue_rate = sum(1 for l in loans if l['days'] > 14) / len(loans)
print(all_match, round(overdue_rate, 3))`,
            hints: ['Print a few (days, fine) pairs: when does the fine start, and how fast does it grow?', 'max(0, x) stops negatives.'],
            tests: `check(all(fine_for(l['days']) == l['fine'] for l in loans), 'fine_for reproduces every fine in the data', 'fine = 2 rupees per day beyond 14')
check(all_match is True, 'all_match is True', 'all(...) over the loans')
check(abs(overdue_rate - sum(1 for l in loans if l['days'] > 14) / len(loans)) < 1e-9, 'overdue_rate is the share of loans kept over 14 days', 'count days > 14, divide by the number of loans')` },
          { id: 'members', title: 'Who owes the most?', xp: 35, est: 360,
            prompt: `<ul><li><code>fines_by_member</code>: dict member -> total fines</li><li><code>top_debtor</code>: the member with the highest total (first in sorted order on a tie)</li><li><code>loans_by_member</code>: dict member -> number of loans</li><li><code>fines_total</code>: sum of all fines</li></ul>`,
            starter: `fines_by_member = {}
loans_by_member = {}
for l in loans:
    fines_by_member[l['member']] = fines_by_member.get(l['member'], 0) + l['___']
    loans_by_member[l['member']] = loans_by_member.get(l['member'], 0) + 1
top_debtor = max(sorted(fines_by_member), key=fines_by_member.get)
fines_total = sum(fines_by_member.values())
print(top_debtor, fines_total)`,
            solution: `fines_by_member = {}
loans_by_member = {}
for l in loans:
    fines_by_member[l['member']] = fines_by_member.get(l['member'], 0) + l['fine']
    loans_by_member[l['member']] = loans_by_member.get(l['member'], 0) + 1
top_debtor = max(sorted(fines_by_member), key=fines_by_member.get)
fines_total = sum(fines_by_member.values())
print(top_debtor, fines_total)`,
            bank: ['fine', 'days', 'book', 'member'], hints: ['dict.get(key, 0) + value is the counting pattern.'],
            tests: `_f = {}; _n = {}
for l in loans: _f[l['member']] = _f.get(l['member'], 0) + l['fine']; _n[l['member']] = _n.get(l['member'], 0) + 1
check(fines_by_member == _f and loans_by_member == _n, 'both dicts are right', 'accumulate with .get(key, 0) + value')
check(top_debtor == max(sorted(_f), key=_f.get), 'top_debtor is the highest total', 'max(sorted(d), key=d.get)')
check(fines_total == sum(_f.values()), 'fines_total is the sum', 'sum(fines_by_member.values())')` },
          { id: 'books', title: 'The most borrowed books', xp: 35, est: 360,
            prompt: `<ul><li><code>popularity</code>: dict book -> number of loans</li><li><code>top5</code>: list of the five most borrowed (book, count) pairs, most popular first</li><li><code>avg_days</code>: dict book -> average days kept, rounded to 1 decimal</li></ul>`,
            starter: `popularity = {}
for l in loans:
    popularity[l['book']] = popularity.get(l['book'], 0) + 1
top5 = sorted(popularity.items(), key=lambda kv: kv[1], reverse=True)[:___]
avg_days = {b: round(sum(l['days'] for l in loans if l['book'] == b) / popularity[b], ___) for b in popularity}
print(top5)`,
            solution: `popularity = {}
for l in loans:
    popularity[l['book']] = popularity.get(l['book'], 0) + 1
top5 = sorted(popularity.items(), key=lambda kv: kv[1], reverse=True)[:5]
avg_days = {b: round(sum(l['days'] for l in loans if l['book'] == b) / popularity[b], 1) for b in popularity}
print(top5)`,
            bank: ['5', '1', '3', '2'], hints: ['Slice the sorted list: [:5].'],
            tests: `_p = {}
for l in loans: _p[l['book']] = _p.get(l['book'], 0) + 1
check(popularity == _p, 'popularity counts loans per book', 'dict counting pattern')
check(len(top5) == 5 and [c for b, c in top5] == sorted(_p.values(), reverse=True)[:5], 'top5 are the five most borrowed, most popular first', 'sorted(..., reverse=True)[:5]')
check(all(abs(avg_days[b] - round(sum(l['days'] for l in loans if l['book'] == b) / _p[b], 1)) < 1e-9 for b in _p), 'avg_days is rounded to 1 decimal', 'round(..., 1)')` },
          { id: 'report', title: 'Print the desk report', xp: 35, est: 360,
            prompt: `<p>Print a report: first the line <code>Loans: N  Members: M  Fines: F</code>, then one line per top-5 book as <code>1. Title (count)</code>. Store the full text in <code>text</code> (lines joined with a newline) and print it.</p>`,
            starter: `lines = [f"Loans: {n_loans}  Members: {n_members}  Fines: {fines_total}"]
for rank, (book, count) in enumerate(top5, start=___):
    lines.append(f"{rank}. {book} ({count})")
text = "\\n".join(lines)
print(text)`,
            solution: `lines = [f"Loans: {n_loans}  Members: {n_members}  Fines: {fines_total}"]
for rank, (book, count) in enumerate(top5, start=1):
    lines.append(f"{rank}. {book} ({count})")
text = "\\n".join(lines)
print(text)`,
            bank: ['1', '0', '2'], hints: ['enumerate(items, start=1) numbers from 1.'],
            tests: `_l = text.split(chr(10))
check(_l[0] == f"Loans: {n_loans}  Members: {n_members}  Fines: {fines_total}", 'the first line summarises loans, members and fines', 'f"Loans: {n_loans}  Members: {n_members}  Fines: {fines_total}"')
check(len(_l) == 6 and _l[1].startswith('1. ') and _l[1].endswith(')'), 'five numbered book lines follow', 'enumerate(top5, start=1)')
check(OUT.strip().split(chr(10)) == _l, 'the text is printed', 'print(text)')` },
        ],
        flagship_ms: [
          { id: 'heavy', title: 'Flagship: heavy fine payers', xp: 45, est: 420, star: true,
            prompt: `<ul><li><code>avg_fine</code>: the mean total fine per member</li><li><code>heavy</code>: sorted list of members whose total fine is above <code>avg_fine</code></li><li><code>heavy_share</code>: the share (0-1) of ALL fines that the heavy members pay, rounded to 3 decimals</li></ul>`,
            starter: `avg_fine = fines_total / len(fines_by_member)
heavy = sorted(m for m, f in fines_by_member.items() if f ___ avg_fine)
heavy_share = round(sum(fines_by_member[m] for m in heavy) / ___, 3)
print(len(heavy), heavy_share)`,
            solution: `avg_fine = fines_total / len(fines_by_member)
heavy = sorted(m for m, f in fines_by_member.items() if f > avg_fine)
heavy_share = round(sum(fines_by_member[m] for m in heavy) / fines_total, 3)
print(len(heavy), heavy_share)`,
            bank: ['>', '<', 'fines_total', 'avg_fine', 'n_loans'], hints: ['Heavy = above the average.'],
            tests: `_a = fines_total / len(fines_by_member)
_h = sorted(m for m, f in fines_by_member.items() if f > _a)
check(abs(avg_fine - _a) < 1e-9 and list(heavy) == _h, 'avg_fine and heavy are right', 'f > avg_fine')
check(abs(heavy_share - round(sum(fines_by_member[m] for m in _h) / fines_total, 3)) < 1e-9, 'heavy_share is the heavy members\\' fraction of all fines', 'sum over heavy / fines_total')` },
          { id: 'json', title: 'Flagship: a JSON summary for the website', xp: 35, est: 300,
            prompt: `<p>Create <code>summary</code> with <code>"loans"</code>, <code>"members"</code>, <code>"fines_total"</code>, <code>"overdue_rate"</code> (rounded to 3 decimals), <code>"top_book"</code> and <code>"top_debtor"</code>. <code>text = json.dumps(summary, indent=2)</code>, then print it.</p>`,
            starter: `import json

summary = {"loans": n_loans, "members": n_members, "fines_total": fines_total, "overdue_rate": round(overdue_rate, 3), "top_book": ___, "top_debtor": top_debtor}
text = json.dumps(summary, indent=2)
print(text)`,
            solution: `import json

summary = {"loans": n_loans, "members": n_members, "fines_total": fines_total, "overdue_rate": round(overdue_rate, 3), "top_book": top5[0][0], "top_debtor": top_debtor}
text = json.dumps(summary, indent=2)
print(text)`,
            bank: ['top5[0][0]', 'top5[0]', 'popularity', 'top5'], hints: ['top5[0] is a (book, count) pair - you want the title.'],
            tests: `import json as _j
b = _j.loads(text)
check(set(b) == {'loans', 'members', 'fines_total', 'overdue_rate', 'top_book', 'top_debtor'}, 'the JSON has the six keys', 'loans, members, fines_total, overdue_rate, top_book, top_debtor')
check(b['top_book'] == top5[0][0] and b['top_debtor'] == top_debtor and b['loans'] == n_loans, 'values match your earlier results', 'top5[0][0] is the most borrowed title')` },
        ],
      },
    ],
  };
})();
