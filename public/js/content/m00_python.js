'use strict';
/* =====================================================================
   Module: Python for Data Science  (4 lessons, 8 graded exercises)
   ===================================================================== */
DSQ.defModule({
  id: 'python', boss: [], lessons: [],
  outcomes: ['Write correct Python with variables, collections, loops and functions', 'Read and write CSV/JSON files', 'Use comprehensions, sorting with keys and error handling', 'Read other people\'s code and the traceback when it breaks'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'python');

  M.lessons.push({
    id: 'basics', title: 'Values, variables and f-strings', minutes: 25, blurb: 'int, float, str, bool, operators and printing results.',
    pages: [
      RD('Everything is a value with a type', `<p>A <b>variable</b> is a name for a value. Python figures out the type: whole numbers are <code>int</code>, decimals <code>float</code>, text <code>str</code>, and <code>bool</code> is <code>True</code>/<code>False</code>.</p>
        ${TABLE(['Operator', 'Meaning', 'Example'], [['<code>+ - * /</code>', 'maths (/ always gives a float)', '<code>7 / 2 = 3.5</code>'], ['<code>//  %</code>', 'floor division and remainder', '<code>7 // 2 = 3</code>, <code>7 % 2 = 1</code>'], ['<code>**</code>', 'power', '<code>2 ** 10 = 1024</code>'], ['<code>== != &lt; &gt; and or not</code>', 'comparisons and logic', '<code>3 &gt; 2 and 1 == 1</code>']])}
        <p>Build text with <b>f-strings</b>: <code>f"{name} scored {score:.1f}%"</code>. The part after the colon formats the number.</p>`),
      DM('Play with values', `name = "Asha"
age = 21
score = 87.456
passed = score >= 40

print(type(name), type(age), type(score), type(passed))
print(f"{name} is {age} and scored {score:.1f}%")
print(7 / 2, 7 // 2, 7 % 2, 2 ** 10)
print("ha" * 3, "data" + " science", len(name))
print(round(score), int("42") + 1, str(3.5) + "!")`, 'Change the values and run again. Which line surprises you?'),
      EX({
        id: 'py-1-1', title: 'A bill with GST', est: 150, xp: 20,
        prompt: `<p>Fill the blanks: <code>total</code> is price plus 18% GST; <code>message</code> is an f-string like <code>"Total: 118.00"</code> (two decimals).</p>`,
        starter: `price = 100
gst_rate = 0.18
total = price * (1 + ___)
message = f"Total: {total:.___f}"
print(message)`,
        solution: `price = 100
gst_rate = 0.18
total = price * (1 + gst_rate)
message = f"Total: {total:.2f}"
print(message)`,
        bank: ['gst_rate', 'price', '2', '0', '18'], hints: ['1 + rate is the multiplier; {x:.2f} prints two decimals.'],
        tests: `check(abs(total - 118) < 1e-9, 'total = 118', 'price * (1 + gst_rate)')
check(message == 'Total: 118.00', 'message is "Total: 118.00"', 'f"Total: {total:.2f}"')`,
      }),
      EX({
        id: 'py-1-2', title: 'Divide and remainder', est: 150, xp: 20,
        prompt: `<p>You have 47 sweets to pack into boxes of 6. Store the number of <b>full boxes</b> in <code>boxes</code>, the sweets <b>left over</b> in <code>left</code>, and a boolean <code>all_packed</code> that is True only when nothing is left over.</p>`,
        starter: `sweets = 47
boxes = ...
left = ...
all_packed = ...
print(boxes, left, all_packed)`,
        solution: `sweets = 47
boxes = sweets // 6
left = sweets % 6
all_packed = left == 0
print(boxes, left, all_packed)`,
        hints: ['// is floor division, % is the remainder.'],
        tests: `check(boxes == 7, 'boxes = 7', 'sweets // 6')
check(left == 5, 'left = 5', 'sweets % 6')
check(all_packed is False, 'all_packed is False', 'left == 0')`,
      }),
      QZ('python', [
        { q: 'What is `7 // 2`?', o: ['3', '3.5', '4', '1'], a: 0, why: '// is floor division: it throws away the remainder.' },
        { q: 'What does `f"{3.14159:.2f}"` give?', o: ['"3.14"', '"3.1"', '"3.142"', '"3.14159"'], a: 0, why: '.2f = fixed point, 2 decimals.' },
        { q: 'What is `type(5 / 2)`?', o: ['float', 'int', 'str', 'bool'], a: 0, why: '/ always returns a float, even for 4 / 2 (2.0).' },
      ], 'Quick check'),
      TY({ id: 'py-t1', title: 'Typing sprint: values', goal: 22, code: `price = 100
total = price * 1.18
message = f"Total: {total:.2f}"
boxes, left = divmod(47, 6)
print(message, boxes, left)` }),
    ],
    recap: ['int, float, str, bool; / always gives float, // floors.', 'f-strings format output: {x:.2f}.', 'Names point to values; = assigns.'],
  });

  M.lessons.push({
    id: 'collections', title: 'Lists, dicts and slicing', minutes: 35, blurb: 'The containers every data task uses, and how to index them.',
    pages: [
      RD('Four containers', `${TABLE(['Type', 'Looks like', 'Use it for'], [['list', '<code>[3, 1, 4]</code>', 'ordered, changeable collection'], ['tuple', '<code>(3, 1)</code>', 'fixed record (e.g. coordinates)'], ['dict', '<code>{"a": 1}</code>', 'look things up by key'], ['set', '<code>{1, 2, 3}</code>', 'unique values, fast membership']])}
        <p>Lists and strings use <b>0-based indexing</b> and the same <code>[start:stop:step]</code> slices you will meet in NumPy (stop excluded; negative indices count from the end).</p>`),
      VZ('Slice a list', 'slicer', { oneD: true, cols: 10, expr: 'a[2:7:2]' }, 'This is a 1-D list of 0..9. Try <code>a[::-1]</code>, <code>a[-3:]</code>, <code>a[1:8:3]</code>. The same rules work on Python lists, strings and NumPy arrays.'),
      DM('Lists and dicts', `nums = [5, 3, 8, 1]
nums.append(9); nums.sort()
print(nums, nums[0], nums[-1], nums[1:3])

ages = {"Asha": 21, "Ben": 24}
ages["Chen"] = 22
print(ages["Ben"], ages.get("Zed", "unknown"), list(ages.keys()))
for name, age in ages.items():
    print(name, age)

tags = {"ml", "python", "ml"}
print(tags, "ml" in tags)
point = (3, 4)
x, y = point
print(x + y)`, '<code>dict.get(key, default)</code> avoids a KeyError; tuple unpacking <code>x, y = point</code> is everywhere in Python.'),
      EX({
        id: 'py-2-1', title: 'Slice and index', est: 150, xp: 20,
        prompt: `<p>Fill the blanks to get: the first three marks, the last mark, every second mark, and the marks reversed.</p>`,
        starter: `marks = [72, 88, 95, 61, 79, 55, 90]
first3 = marks[:___]
last = marks[___]
every2 = marks[::___]
rev = marks[::___]
print(first3, last, every2, rev)`,
        solution: `marks = [72, 88, 95, 61, 79, 55, 90]
first3 = marks[:3]
last = marks[-1]
every2 = marks[::2]
rev = marks[::-1]
print(first3, last, every2, rev)`,
        bank: ['3', '-1', '2', '1', '0'], hints: ['A negative index counts from the end; a negative step walks backwards.'],
        tests: `check(first3 == [72, 88, 95], 'first3 = the first three marks', 'marks[:3]')
check(last == 90, 'last = 90', 'marks[-1]')
check(every2 == [72, 95, 79, 90], 'every2 = every second mark', 'marks[::2]')
check(rev == [90, 55, 79, 61, 95, 88, 72], 'rev = reversed', 'marks[::-1]')`,
      }),
      EX({
        id: 'py-2-2', title: 'Count with a dict', est: 240, xp: 30,
        prompt: `<p>Count how many times each word appears in <code>words</code> and store it in the dict <code>counts</code> (no imports). Then <code>most_common</code> is the word with the highest count.</p>`,
        starter: `words = ["data", "model", "data", "plot", "model", "data"]
counts = {}
for w in words:
    ...
most_common = ...
print(counts, most_common)`,
        solution: `words = ["data", "model", "data", "plot", "model", "data"]
counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
most_common = max(counts, key=counts.get)
print(counts, most_common)`,
        hints: ['counts.get(w, 0) returns 0 for a new word.', 'max(counts, key=counts.get) returns the key with the biggest value.'],
        tests: `check(counts == {'data': 3, 'model': 2, 'plot': 1}, 'counts = {data: 3, model: 2, plot: 1}', 'counts[w] = counts.get(w, 0) + 1')
check(most_common == 'data', 'most_common = data', 'max(counts, key=counts.get)')`,
      }),
      QZ('python', [
        { q: 'What is `[10, 20, 30, 40][1:3]`?', o: ['[20, 30]', '[10, 20, 30]', '[20, 30, 40]', '[10, 20]'], a: 0, why: 'start 1 included, stop 3 excluded.' },
        { q: 'How do you read a dict value without crashing when the key might be missing?', o: ['d.get(key, default)', 'd[key]', 'd.find(key)', 'd.at(key)'], a: 0, why: 'get returns the default instead of raising KeyError.' },
        { q: 'Which container removes duplicates?', o: ['set', 'list', 'tuple', 'dict values'], a: 0, why: 'A set holds each value once.' },
      ], 'Quick check'),
      TY({ id: 'py-t2', title: 'Typing sprint: collections', goal: 24, code: `marks = [72, 88, 95, 61]
best = max(marks)
first3 = marks[:3]
ages = {"Asha": 21, "Ben": 24}
ages["Chen"] = 22
for name, age in ages.items():
    print(name, age)` }),
    ],
    recap: ['list, tuple, dict, set; 0-based indexing; slices exclude the stop.', 'dict.get(key, default) is the safe lookup.', 'The slice rules carry over to NumPy and pandas.'],
  });

  M.lessons.push({
    id: 'control', title: 'Decisions, loops and comprehensions', minutes: 35, blurb: 'if/elif/else, for and while, list comprehensions and enumerate/zip.',
    pages: [
      RD('Making choices and repeating work', `<pre class="codeblock">if score >= 90:
    grade = "A"
elif score >= 75:
    grade = "B"
else:
    grade = "C"

for i, name in enumerate(names):      # index + value
    print(i, name)
for a, b in zip(xs, ys):               # walk two lists together
    ...
squares = [n * n for n in range(10) if n % 2 == 0]   # comprehension</pre>
        <p>Indentation <i>is</i> the syntax: everything inside a block is indented by the same amount. A <b>list comprehension</b> is a loop that builds a list in one line - read it as "n*n for each n in range(10) where n is even".</p>
        ${NOTE('', 'Later:', 'in NumPy and pandas you will avoid most explicit loops - but you must be fluent in them first.')}`),
      DM('Loops in action', `scores = [88, 45, 72, 95, 60]

grades = []
for s in scores:
    if s >= 90:
        grades.append("A")
    elif s >= 60:
        grades.append("P")
    else:
        grades.append("F")
print(grades)

passed = [s for s in scores if s >= 60]
doubled = [s * 2 for s in scores]
print(passed, doubled)
for i, s in enumerate(scores, start=1):
    print(f"student {i}: {s}")
print(sum(scores) / len(scores), max(scores), sorted(scores, reverse=True))
total = 0
n = 0
while total < 200:
    total += scores[n % len(scores)]
    n += 1
print(n, total)`, 'Predict each printed line, then run it. <code>while</code> repeats until its condition is False - make sure something changes inside the loop!'),
      EX({
        id: 'py-3-1', title: 'Filter and transform', est: 180, xp: 25,
        prompt: `<p>Use list comprehensions: <code>evens</code> (the even numbers), <code>squares_of_odds</code> (the squares of the odd numbers) and <code>labels</code> (<code>"big"</code> if the number is over 5 else <code>"small"</code>, for each number).</p>`,
        starter: `nums = [1, 2, 3, 4, 5, 6, 7, 8]
evens = [n for n in nums if n % 2 == ___]
squares_of_odds = [n ** 2 for n in nums if n % 2 ___ 0]
labels = ["big" if n > 5 else "small" for n in ___]
print(evens, squares_of_odds, labels)`,
        solution: `nums = [1, 2, 3, 4, 5, 6, 7, 8]
evens = [n for n in nums if n % 2 == 0]
squares_of_odds = [n ** 2 for n in nums if n % 2 != 0]
labels = ["big" if n > 5 else "small" for n in nums]
print(evens, squares_of_odds, labels)`,
        bank: ['0', '1', '!=', '==', 'nums', 'evens'], hints: ['Odd numbers have a remainder that is not zero.'],
        tests: `check(evens == [2, 4, 6, 8], 'evens = [2, 4, 6, 8]', 'n % 2 == 0')
check(squares_of_odds == [1, 9, 25, 49], 'squares_of_odds = [1, 9, 25, 49]', 'n % 2 != 0')
check(labels == ['small'] * 5 + ['big'] * 3, 'labels are right', '"big" if n > 5 else "small"')`,
      }),
      EX({
        id: 'py-3-2', title: 'FizzBuzz, the data way', est: 300, xp: 30,
        prompt: `<p>Build the list <code>out</code> for the numbers 1 to 15: <code>"FizzBuzz"</code> if divisible by 3 and 5, <code>"Fizz"</code> if by 3, <code>"Buzz"</code> if by 5, otherwise the number itself. Also set <code>n_fizz</code> to how many entries are exactly <code>"Fizz"</code>.</p>`,
        starter: `out = []
for n in range(1, 16):
    ...
n_fizz = ...
print(out, n_fizz)`,
        solution: `out = []
for n in range(1, 16):
    if n % 15 == 0:
        out.append("FizzBuzz")
    elif n % 3 == 0:
        out.append("Fizz")
    elif n % 5 == 0:
        out.append("Buzz")
    else:
        out.append(n)
n_fizz = out.count("Fizz")
print(out, n_fizz)`,
        hints: ['Check the most specific case (divisible by 15) first.'],
        tests: `check(out[:5] == [1, 2, 'Fizz', 4, 'Buzz'] and out[14] == 'FizzBuzz', 'the first five and the last entry are right', 'if / elif / elif / else')
check(len(out) == 15 and out.count('Buzz') == 2, 'there are 15 entries and 2 Buzz', 'range(1, 16)')
check(n_fizz == 4, 'n_fizz = 4', 'out.count("Fizz")')`,
      }),
      QZ('python', [
        { gen: r => { const n = r.int(5, 20), k = r.int(2, 4); const ans = Math.floor(n / k); return { q: `How many items does \`[x for x in range(${n}) if x % ${k} == 0]\` contain?`, correct: Math.ceil(n / k), wrong: distract(Math.ceil(n / k), [Math.floor(n / k), Math.ceil(n / k) + 1, n, k]), why: `x runs 0..${n - 1}; multiples of ${k} are 0, ${k}, ${2 * k}, ... - that is ${Math.ceil(n / k)} numbers.` }; } },
        { q: 'What does `enumerate(names)` give you?', o: ['(index, value) pairs', 'only the values', 'only the indices', 'a sorted copy'], a: 0, why: 'Use `for i, name in enumerate(names):`.' },
        { q: 'What is wrong with: `while n < 5: print(n)`?', o: ['n never changes, so it loops forever', 'while needs brackets', 'print cannot be inside while', 'nothing'], a: 0, why: 'Always update the variable the condition depends on.' },
      ], 'Quick check'),
      TY({ id: 'py-t3', title: 'Typing sprint: loops', goal: 26, code: `passed = [s for s in scores if s >= 60]
for i, s in enumerate(scores, start=1):
    if s >= 90:
        print(i, "A")
    else:
        print(i, "other")
total = sum(s * 2 for s in scores)` }),
    ],
    recap: ['if/elif/else, for, while; indentation is syntax.', 'Comprehensions filter and transform in one line.', 'enumerate and zip replace manual index counting.'],
  });

  M.lessons.push({
    id: 'functions', title: 'Functions, files and errors', minutes: 40, blurb: 'def, defaults, lambda, sorted with key, reading CSV/JSON and try/except.',
    pages: [
      RD('Package your logic', `<pre class="codeblock">def mean(values, ndigits=2):          # default argument
    """Average of a list."""
    return round(sum(values) / len(values), ndigits)

square = lambda x: x * x             # tiny anonymous function
people = [("Asha", 21), ("Ben", 24)]
oldest_first = sorted(people, key=lambda p: p[1], reverse=True)</pre>
        <p><b>Reading files</b> is the bridge to data science: <code>open("a.csv")</code> or the <code>csv</code> / <code>json</code> modules. Wrap risky steps in <code>try / except</code> so one bad row does not kill the run:</p>
        <pre class="codeblock">try:
    value = float(text)
except ValueError:
    value = None</pre>`),
      DM('CSV, JSON and try/except', `import csv
import io
import json

text = """name,score
Asha,88
Ben,seventy
Chen,95
"""
rows = list(csv.DictReader(io.StringIO(text)))     # normally: open("file.csv")
good = []
for r in rows:
    try:
        good.append((r["name"], float(r["score"])))
    except ValueError:
        print("skipping bad row:", r)
print(good)
best = max(good, key=lambda p: p[1])
print("best:", best)
print(json.dumps({"best": best[0], "score": best[1]}))
print(json.loads('{"a": [1, 2, 3]}')["a"][2])`, 'The <code>io.StringIO</code> trick lets us pretend a string is a file; with a real file you would write <code>open("scores.csv")</code>.'),
      EX({
        id: 'py-4-1', title: 'A reusable function', est: 240, xp: 30,
        prompt: `<p>Write a function <code>summary(values, ndigits=1)</code> that returns a dictionary with keys <code>"min"</code>, <code>"max"</code> and <code>"mean"</code> (the mean rounded to <code>ndigits</code>).</p>`,
        starter: `def summary(values, ndigits=1):
    ...

print(summary([4, 8, 15, 16, 23, 42]))
print(summary([1, 2], ndigits=3))`,
        solution: `def summary(values, ndigits=1):
    return {"min": min(values), "max": max(values), "mean": round(sum(values) / len(values), ndigits)}

print(summary([4, 8, 15, 16, 23, 42]))
print(summary([1, 2], ndigits=3))`,
        hints: ['return a dict literal with the three keys.', 'round(x, ndigits)'],
        tests: `check(summary([4, 8, 15, 16, 23, 42]) == {'min': 4, 'max': 42, 'mean': 18.0}, 'summary works on the first list', 'return {"min": ..., "max": ..., "mean": ...}')
check(summary([1, 2], ndigits=3) == {'min': 1, 'max': 2, 'mean': 1.5}, 'the ndigits argument is respected', 'round(..., ndigits)')
check(summary([5])['mean'] == 5.0, 'one value works too', 'sum / len')`,
      }),
      EX({
        id: 'py-4-2', title: 'Parse a CSV, safely', est: 360, xp: 35,
        prompt: `<p>Read <code>text</code> with <code>csv.DictReader</code>. Build <code>scores</code>: a dict name -> score (float) for the rows whose score can be converted, <b>skipping</b> bad rows with try/except. Then <code>ranking</code>: the names sorted by score, highest first.</p>`,
        starter: `import csv
import io

text = """name,score
Asha,88
Ben,seventy
Chen,95
Dara,61.5
"""
scores = {}
ranking = []
...
print(scores, ranking)`,
        solution: `import csv
import io

text = """name,score
Asha,88
Ben,seventy
Chen,95
Dara,61.5
"""
scores = {}
for row in csv.DictReader(io.StringIO(text)):
    try:
        scores[row["name"]] = float(row["score"])
    except ValueError:
        pass
ranking = sorted(scores, key=scores.get, reverse=True)
print(scores, ranking)`,
        hints: ['float("seventy") raises ValueError - catch it.', 'sorted(scores, key=scores.get, reverse=True)'],
        tests: `check(scores == {'Asha': 88.0, 'Chen': 95.0, 'Dara': 61.5}, 'scores holds the three valid rows as floats', 'try: float(...) except ValueError')
check(ranking == ['Chen', 'Asha', 'Dara'], 'ranking = Chen, Asha, Dara', 'sorted(scores, key=scores.get, reverse=True)')`,
      }),
      QZ('python', [
        { q: 'What does `sorted(words, key=len)` do?', o: ['Sorts by word length, shortest first', 'Sorts alphabetically', 'Sorts by the number of vowels', 'Returns the lengths'], a: 0, why: 'key is a function applied to each item to decide the order.' },
        { q: 'Which exception does `float("abc")` raise?', o: ['ValueError', 'TypeError', 'KeyError', 'IndexError'], a: 0, why: 'The value has the right type (a string) but cannot be converted.' },
        { q: 'Why use `with open("a.csv") as f:`?', o: ['The file is closed automatically, even after an error', 'It makes reading faster', 'It is required for CSV files', 'It loads the file in memory twice'], a: 0, why: 'Context managers handle clean-up for you.' },
      ], 'Quick check'),
      TY({ id: 'py-t4', title: 'Typing sprint: functions', goal: 26, code: `def mean(values, ndigits=2):
    return round(sum(values) / len(values), ndigits)

ranking = sorted(scores, key=scores.get, reverse=True)
try:
    value = float(text)
except ValueError:
    value = None` }),
    ],
    recap: ['def with defaults; lambda for tiny keys.', 'csv.DictReader/json read files; try/except keeps one bad row from stopping everything.', 'sorted(..., key=...) is the pattern you will use constantly.'],
  });

  M.boss = [
    { q: 'What is `"data"[1:3]`?', o: ['"at"', '"da"', '"ata"', '"dat"'], a: 0, why: 'Characters at positions 1 and 2.' },
    { q: 'Which line creates a dict with one key?', o: ['{"a": 1}', '["a": 1]', '("a": 1)', '{"a", 1}'], a: 0, why: 'Curly braces with key: value.' },
    { gen: r => { const a = r.int(10, 60), b = r.int(3, 9); return { q: `What is \`${a} % ${b}\`?`, correct: a % b, wrong: distract(a % b, [Math.floor(a / b), (a % b) + 1, b, a - b]), why: `${a} = ${Math.floor(a / b)} x ${b} + ${a % b}, so the remainder is ${a % b}.` }; } },
    { gen: r => { const n = r.int(4, 12); return { q: `What is \`len([x for x in range(${n}) if x > 2])\`?`, correct: Math.max(0, n - 3), wrong: distract(Math.max(0, n - 3), [n - 2, n, n - 4 < 0 ? 5 : n - 4, 3]), why: `Values 3..${n - 1} pass the test.` }; } },
    { q: 'You call `scores["Zed"]` and Zed is not a key. What happens?', o: ['KeyError', 'It returns None', 'It returns 0', 'It adds Zed'], a: 0, why: 'Use scores.get("Zed") for None or a default.' },
    { q: 'What does `x, y = (3, 4)` do?', o: ['Unpacks the tuple: x = 3, y = 4', 'Raises an error', 'Makes x a tuple', 'Swaps x and y'], a: 0, why: 'Tuple unpacking.' },
    { q: 'Which is the best way to count items that satisfy a condition?', o: ['sum(1 for x in xs if cond(x))', 'len(xs)', 'xs.count(cond)', 'xs.sum()'], a: 0, why: 'A generator expression feeding sum counts the matches.' },
    { q: 'Which statement about indentation is TRUE?', o: ['It defines which lines belong to a block', 'It is only cosmetic', 'It must always be 8 spaces', 'Tabs and spaces may be mixed freely'], a: 0, why: 'Python uses indentation for blocks.' },
    { q: 'What does `round(2.675, 2)` print in Python?', o: ['2.67 (floating-point representation)', '2.68', '2.7', '3'], a: 0, why: '2.675 is stored as 2.67499999... - a classic floating-point surprise; use Decimal when you need exact decimals.' },
    { q: 'What does `return` do inside a function?', o: ['Sends a value back and ends the function', 'Prints a value', 'Restarts the function', 'Defines a variable'], a: 0, why: 'After return executes, the function stops.' },
  ];
})();
