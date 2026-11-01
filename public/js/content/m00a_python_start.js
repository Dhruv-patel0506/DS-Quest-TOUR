'use strict';
/* =====================================================================
   Python for Data Science, the beginner path: two lessons BEFORE the original three (what code is, how a line is built, what each symbol means)
   and two AFTER them (writing your own functions; files, errors and imports). Written for people who have never programmed (managers, analysts, MBA students).
   The function-by-function reference is the "Function sheet" of this module (m00d_python_sheet.js).
   ===================================================================== */
(function () {
  const M = DSQ.modules.find(m => m.id === 'python');
  M.outcomes = ['Read a line of Python and say what each part does', 'Write correct Python with variables, collections, loops and functions', 'Read and write files and JSON, and handle errors without crashing', 'Read other people\'s code and the error message when it breaks'];

  /* ---------- lesson 0a: what is code ---------- */
  M.lessons.unshift({
    id: 'start', title: 'What is code? Read your first lines', minutes: 30, blurb: 'Instructions for a very literal assistant. How a line is built, and how to run one.',
    pages: [
      RD('Code is a list of instructions for a very literal assistant', `<p>Think of Python as an assistant who does <b>exactly</b> what you write, one line at a time, from top to bottom, and nothing else. It never guesses. If you write something it does not understand, it stops and tells you which line was the problem.</p>
        <p>You already do this in a spreadsheet: <code>=B2*1.18</code> means "take the number in B2 and multiply it by 1.18". Python lines are the same idea, but with <b>names</b> instead of cell addresses.</p>
        ${TABLE(['In a spreadsheet', 'In Python', 'What it means'], [['cell B2 holds 100', '<code>price = 100</code>', 'put 100 in a box named <code>price</code>'], ['<code>=B2*1.18</code>', '<code>total = price * 1.18</code>', 'calculate and store the result in <code>total</code>'], ['<code>=SUM(B2:B9)</code>', '<code>sum(prices)</code>', 'add up every number in a list'], ['a note beside a cell', '<code># this is a note</code>', 'Python ignores everything after a #']])}
        <p>Three things you will do all day: <b>store</b> a value under a name, <b>calculate</b> with names, and <b>show</b> a result with <code>print(...)</code>.</p>`),
      RD('Anatomy of a line: the four shapes you will meet', `<p>Almost every line of Python is one of four shapes. Learn to spot them and you can read any code.</p>
        ${TABLE(['Shape', 'Example', 'How to read it aloud'], [['<b>Store</b> (assignment)', '<code>price = 100</code>', '"price <i>becomes</i> 100". The single <code>=</code> means "store", not "equals"'], ['<b>Call a function</b>', '<code>print(price)</code>', '"do the thing called print, using price". The round brackets hold what you hand over (the <i>arguments</i>)'], ['<b>Call a method</b> (a function that belongs to a value)', '<code>name.upper()</code>', '"take <code>name</code> and do <code>upper</code> to it". The dot means "belonging to"'], ['<b>Decide or repeat</b>', '<code>if price &gt; 50:</code>', 'a line ending in a colon <code>:</code> opens an indented block that belongs to it']])}
        <p>Now the words. A <b>value</b> is a piece of data: <code>100</code> (a whole number), <code>3.5</code> (a decimal), <code>"Asha"</code> (text, always in quotes), <code>True</code> / <code>False</code> (yes or no). A <b>variable</b> is a name you give a value so you can use it later. A <b>function</b> is a named recipe: you give it ingredients (arguments) and it gives back a result.</p>
        ${NOTE('', 'Quotes matter.', '<code>"price"</code> in quotes is the <i>text</i> p-r-i-c-e. <code>price</code> without quotes is <i>the box named price</i> and its contents.')}`),
      DM('Run it, then change it', `price = 100              # store: price becomes 100
rate = 0.18              # store: GST rate as a decimal
gst = price * rate       # calculate with the names
total = price + gst
print("GST is", gst)     # show: a function call with two arguments
print("Total is", total)
print(type(price), type(rate))   # what kind of value is each one?`, 'Change price to 250 and run again. Which numbers changed, and why? Then break it on purpose: delete the closing bracket of a print line and read the message.'),
      RD('Errors are not failure, they are directions', `<p>When Python cannot follow a line it prints an <b>error message</b>. It always has the same layout: the <b>line number</b>, the <b>line itself</b>, and a <b>type of error</b> with a plain sentence. Read it from the bottom up.</p>
        ${TABLE(['You see', 'It means', 'Usual cause'], [['<code>SyntaxError</code>', 'the line is not written in a form Python understands', 'a missing bracket, quote or colon'], ['<code>NameError: name \'prce\' is not defined</code>', 'you used a name you never stored', 'a typo, or the line that creates it has not run yet'], ['<code>TypeError</code>', 'you mixed things that do not mix', 'adding text to a number: <code>"5" + 3</code>'], ['<code>ZeroDivisionError</code>', 'you divided by zero', 'a total that was 0']])}
        <p>Nobody writes code without errors. Professionals read the message, fix one thing, and run again. You will do the same, many times, and it gets quick.</p>`),
      EX({
        id: 'py-0-1', title: 'Store, calculate, show', est: 180, xp: 20,
        prompt: `<p>Store the values <code>price = 250</code> and <code>quantity = 4</code>. Calculate <code>subtotal</code> as price times quantity. Store <code>message</code> as the text <code>"Subtotal: 1000"</code> built with an f-string (<code>f"Subtotal: {subtotal}"</code>) and print it.</p>`,
        starter: `price = ___
quantity = ___
subtotal = price ___ quantity
message = f"Subtotal: {___}"
print(message)`,
        solution: `price = 250
quantity = 4
subtotal = price * quantity
message = f"Subtotal: {subtotal}"
print(message)`,
        hints: ['Blanks are filled in order. A star * multiplies.', 'Inside the braces of an f-string you put the NAME of the value.'],
        tests: `check(price == 250 and quantity == 4, 'price and quantity are stored', 'price = 250 and quantity = 4')
check(subtotal == 1000, 'subtotal is price times quantity = 1000', 'use * between the two names')
check(message == 'Subtotal: 1000', 'the message reads Subtotal: 1000', 'f"Subtotal: {subtotal}"')`,
      }),
      EX({
        id: 'py-0-2', title: 'Name the parts of a line', est: 240, xp: 30,
        prompt: `<p>Read this line aloud: <code>discount = round(price * 0.1, 2)</code>. Answer by setting variables: <code>shape</code> to <code>"store"</code>, <code>function_used</code> to the name of the function it calls (text), and <code>argument_count</code> to how many arguments that function receives (a number; the comma separates them).</p>`,
        starter: `shape = ___            # "store", "call" or "decide"
function_used = ___    # text
argument_count = ___   # a number`,
        solution: `shape = "store"
function_used = "round"
argument_count = 2`,
        hints: ['Is a value being put in a name (store), or is a function just being run (call)?', 'round(a, b) has two arguments, separated by a comma.'],
        tests: `check(shape == 'store', 'the line stores a result in discount', 'there is a single = sign putting a value into a name')
check(function_used == 'round', 'it calls round()', 'the word in front of the brackets')
check(argument_count == 2, 'round receives two arguments: the number and the decimals', 'count the commas inside the brackets and add one')`,
      }),
      QZ('python', [
        { q: 'What does the single = sign mean in price = 100?', o: ['Store 100 under the name price', 'Price is equal to 100, as a question', 'Add 100 to price', 'Compare price and 100'], a: 0, why: 'One = stores. Two == compares.' },
        { q: 'What is the difference between "price" and price?', o: ['In quotes it is text; without quotes it is the box named price', 'There is none', 'Quotes make it a number', 'Only the colour differs'], a: 0, why: 'Quotes turn letters into a piece of text.' },
        { q: 'You see NameError: name \'totl\' is not defined. Most likely...', o: ['A typo: you wrote totl but stored total', 'Python is broken', 'Your number is too big', 'You forgot a colon'], a: 0, why: 'A name that was never stored is usually a spelling slip.' },
        { q: 'A line ends with a colon :. What happens next?', o: ['The indented lines below belong to it', 'Python stops', 'The line is a comment', 'A number is printed'], a: 0, why: 'A colon opens a block, such as after if, for or def.' },
      ], 'Check yourself'),
    ],
    recap: ['Python runs one instruction per line, top to bottom, exactly as written.', 'Four shapes: store (=), call a function f(x), call a method x.f(), and decide/repeat (line ending in a colon).', 'Quotes make text; names without quotes are boxes. Errors name the line and the kind of problem.'],
  });

  /* ---------- lesson 0b: the punctuation ---------- */
  M.lessons.splice(1, 0, {
    id: 'syntax', title: 'The punctuation of Python', minutes: 30, blurb: 'Quotes, round, square and curly brackets, the colon, the dot and the indent: what each one is for.',
    pages: [
      RD('Every symbol has one job', `<p>Python uses a small set of symbols, and each one means one thing. Once you know them, code stops looking like noise.</p>
        ${TABLE(['Symbol', 'Job', 'Example'], [['<code>" "</code> or <code>\' \'</code>', 'wrap <b>text</b>', '<code>"hello"</code>'], ['<code>( )</code>', '<b>call</b> a function, or group a calculation', '<code>print(x)</code>, <code>(a + b) * c</code>'], ['<code>[ ]</code>', 'make a <b>list</b>, or pick an item by position', '<code>[1, 2, 3]</code>, <code>items[0]</code>'], ['<code>{ }</code>', 'make a <b>dictionary</b> of label: value pairs (or a set)', '<code>{"name": "Asha", "age": 21}</code>'], ['<code>:</code>', 'open an indented block; also separates label and value; also slices', '<code>if x &gt; 3:</code>, <code>items[1:3]</code>'], ['<code>.</code>', '"belonging to": use a method or a part', '<code>name.upper()</code>, <code>np.mean</code>'], ['<code>,</code>', 'separate items, arguments, values', '<code>max(3, 9, 4)</code>'], ['<code>#</code>', 'a note for humans, ignored by Python', '<code># convert to dollars</code>'], ['<b>indent</b> (4 spaces)', 'shows which lines belong to the line above', 'the lines under <code>if</code>, <code>for</code>, <code>def</code>']])}
        <p><b>Brackets always come in pairs.</b> If you open one you must close it, and the closing ones close in the opposite order, like <code>print(len([1, 2, 3]))</code>.</p>`),
      DM('Three kinds of brackets side by side', `prices = [120, 80, 200]            # square: a LIST of values
person = {"name": "Asha", "city": "Pune"}   # curly: a DICTIONARY, label: value
point = (3, 4)                     # round with commas: a TUPLE (a fixed pair)

print(prices[0])                   # square after a name: pick item number 0 (counting starts at 0)
print(person["city"])              # square with a label: look up the value
print(len(prices))                 # round after a name: CALL the function len

if len(prices) > 2:                # colon opens a block
    print("more than two prices")  # four spaces: this line belongs to the if`, 'Change the 0 to 2, then to 5 and read the error. Python counts from 0, so a list of 3 items has positions 0, 1 and 2.'),
      RD('Indentation is part of the grammar', `<p>In most languages, curly brackets show which lines belong together. Python uses <b>spaces at the start of the line</b>. Everything indented under a line that ends in a colon is "inside" it.</p>
        <pre class="codeblock">for price in prices:        # runs the block once per price
    gst = price * 0.18      # inside the loop (4 spaces)
    print(gst)              # inside the loop
print("done")               # NOT indented: runs once, after the loop</pre>
        <p>Use exactly <b>4 spaces</b> per level. Mixing sizes gives an <code>IndentationError</code>. The editor on this site inserts them when you press Tab.</p>`),
      EX({
        id: 'py-0-3', title: 'Fix the four slips', est: 300, xp: 40,
        prompt: `<p>This code has four small mistakes (a missing closing bracket, a missing colon, wrong quotes, and a name typed wrongly). Fix them so it prints <code>3 items, total 400</code>.</p>`,
        starter: `prices = [120, 80, 200
total = sum(prices)
count = len(prices)
if count > 2
    print(f"{count} items, total {totl}")`,
        solution: `prices = [120, 80, 200]
total = sum(prices)
count = len(prices)
if count > 2:
    print(f"{count} items, total {total}")`,
        hints: ['Count the [ and ] on the first line.', 'A line that opens a block ends with a colon.', 'Check the spelling of the name inside the braces.'],
        tests: `check(prices == [120, 80, 200], 'the list is closed and correct', 'add the closing ] on line 1')
check(total == 400 and count == 3, 'total and count are computed', 'sum(prices) and len(prices)')
check('totl' not in dir(), 'every name is spelled the same everywhere', 'compare the name in the f-string with the one you stored')`,
      }),
      EX({
        id: 'py-0-4', title: 'Pick the right container', est: 300, xp: 30,
        prompt: `<p>Build three values by shape. <code>weekdays</code>: a <b>list</b> of the text values <code>"Mon"</code>, <code>"Tue"</code>, <code>"Wed"</code>. <code>profile</code>: a <b>dictionary</b> with the labels <code>"name"</code> (value <code>"Asha"</code>) and <code>"score"</code> (value <code>87</code>). <code>second_day</code>: the second item of <code>weekdays</code>, picked by position.</p>`,
        starter: `weekdays = ___
profile = ___
second_day = weekdays[___]`,
        solution: `weekdays = ["Mon", "Tue", "Wed"]
profile = {"name": "Asha", "score": 87}
second_day = weekdays[1]`,
        hints: ['Square brackets make a list, curly brackets make a dictionary with label: value.', 'Positions start at 0, so the second item is position 1.'],
        tests: `check(weekdays == ['Mon', 'Tue', 'Wed'], 'a list of three weekday names', 'weekdays = ["Mon", "Tue", "Wed"]')
check(profile == {'name': 'Asha', 'score': 87}, 'a dictionary with name and score', '{"name": "Asha", "score": 87}')
check(second_day == 'Tue', 'the second item is at position 1', 'counting starts at 0')`,
      }),
      QZ('python', [
        { q: 'Which brackets make a list?', o: ['[ ]', '( )', '{ }', '< >'], a: 0, why: 'Square brackets: a list. Curly: a dictionary or set.' },
        { q: 'scores = [70, 80, 90]. What is scores[1]?', o: ['80', '70', '90', 'an error'], a: 0, why: 'Counting starts at 0: positions 0, 1, 2.' },
        { q: 'What does the dot in name.upper() mean?', o: ['upper belongs to name: do it to this text', 'Multiply', 'End of sentence', 'A decimal point'], a: 0, why: 'name.method() calls a method on that value.' },
        { q: 'How does Python know which lines are inside an if?', o: ['They are indented under the line ending in a colon', 'They have a # in front', 'They are in brackets', 'They are shorter'], a: 0, why: 'Indentation is the grammar.' },
      ], 'Check yourself'),
    ],
    recap: ['" " text, ( ) call or group, [ ] list or position, { } dictionary, : opens a block, . belongs to, # comment.', 'Positions start at 0.', 'Four spaces of indent put a line inside the block above it.'],
  });

  /* ---------- lesson 4: functions ---------- */
  M.lessons.push({
    id: 'functions', title: 'Write your own function', minutes: 35, blurb: 'def, parameters, return, default values, and the one-line lambda.',
    pages: [
      RD('A function is a recipe you name once and use many times', `<p>You have used <code>len</code>, <code>print</code> and <code>round</code>: recipes somebody else wrote. Writing your own is how you stop repeating yourself. In a spreadsheet it is a formula you copy down a column; in Python you name it once.</p>
        <pre class="codeblock">def with_gst(price, rate=0.18):     # def = "define"; price and rate are the ingredients
    total = price * (1 + rate)       # the steps (indented)
    return total                     # return = hand the result back

print(with_gst(100))                 # 118.0   uses the default rate
print(with_gst(100, 0.05))           # 105.0   overrides the default
print(with_gst(price=200))           # 236.0   name the ingredient you pass</pre>
        ${TABLE(['Part', 'Meaning'], [['<code>def</code>', 'start defining a function'], ['<code>with_gst</code>', 'the name you will call it by (lower case, underscores between words)'], ['<code>(price, rate=0.18)</code>', 'the <b>parameters</b>: names for the inputs; <code>rate=0.18</code> has a <b>default</b> used when you do not pass one'], ['<code>return</code>', 'the value that comes back; without it you get <code>None</code>'], ['indent', 'everything indented belongs to the function']])}
        ${NOTE('warn', 'print is not return.', '<code>print</code> only shows something on the screen. <code>return</code> gives the value back so you can store it: <code>x = with_gst(100)</code>.')}`),
      DM('Make one, call it, reuse it', `def with_gst(price, rate=0.18):
    return round(price * (1 + rate), 2)

bill = [100, 250, 80]
totals = [with_gst(p) for p in bill]      # call it for every price
print(totals)
print(sum(totals))

square = lambda x: x * x                  # a tiny unnamed function in one line
print(square(7), sorted(bill, key=lambda p: -p))`, 'Change the default rate, then add a third parameter named discount.'),
      EX({
        id: 'py-4-1', title: 'A price with GST and discount', est: 300, xp: 30,
        prompt: `<p>Write <code>final_price(price, gst=0.18, discount=0.0)</code>: take the discount off first (<code>price * (1 - discount)</code>), then add GST, and <b>return</b> the result rounded to 2 decimals.</p>`,
        starter: `def final_price(price, gst=0.18, discount=0.0):
    ...

print(final_price(100))`,
        solution: `def final_price(price, gst=0.18, discount=0.0):
    after_discount = price * (1 - discount)
    return round(after_discount * (1 + gst), 2)

print(final_price(100))`,
        hints: ['Two steps: apply the discount, then multiply by (1 + gst).', 'Use return, not print.'],
        tests: `check(final_price(100) == 118.0, '100 with default GST is 118.0', 'price * (1 + gst)')
check(final_price(200, discount=0.1) == 212.4, 'a 10% discount first: 180, then GST: 212.4', 'discount comes off before GST')
check(final_price(100, gst=0.05) == 105.0, 'another GST rate', 'the parameter gst can be changed')`,
      }),
      EX({
        id: 'py-4-2', title: 'Summarise a list', est: 360, xp: 40,
        prompt: `<p>Write <code>summary(values)</code> that <b>returns</b> a dictionary with the keys <code>"count"</code>, <code>"total"</code>, <code>"average"</code> (rounded to 2 decimals) and <code>"best"</code> (the largest value). For an empty list return <code>{"count": 0}</code>.</p>`,
        starter: `def summary(values):
    ...

print(summary([70, 85, 90]))`,
        solution: `def summary(values):
    if not values:
        return {"count": 0}
    return {"count": len(values), "total": sum(values), "average": round(sum(values) / len(values), 2), "best": max(values)}

print(summary([70, 85, 90]))`,
        hints: ['Handle the empty list first: if not values: return ...', 'len, sum and max do most of the work.'],
        tests: `s = summary([70, 85, 90])
check(s == {'count': 3, 'total': 245, 'average': 81.67, 'best': 90}, 'count, total, average and best', 'len, sum, round(..., 2) and max')
check(summary([]) == {'count': 0}, 'an empty list gives just the count', 'check for the empty list first')
check(summary([5])['average'] == 5.0, 'one value: average equals the value', 'divide total by count')`,
      }),
      QZ('python', [
        { q: 'A function has no return line. What does calling it give back?', o: ['None', '0', 'An empty string', 'An error'], a: 0, why: 'Python returns None when nothing is returned.' },
        { q: 'def f(a, b=2): ... What happens with f(10)?', o: ['b is 2, the default', 'An error: b is missing', 'b is 10', 'b is None'], a: 0, why: 'A default is used when you do not pass the argument.' },
        { q: 'What is the difference between print(x) and return x inside a function?', o: ['print shows it; return hands the value back to the caller', 'No difference', 'return shows it; print stores it', 'print is faster'], a: 0, why: 'Only a returned value can be stored and reused.' },
      ], 'Check yourself'),
    ],
    recap: ['def name(parameters): then an indented block that ends with return.', 'Defaults make a parameter optional; you can pass by name: f(price=200).', 'print shows, return gives back.'],
  });

  /* ---------- lesson 5: files, errors, imports ---------- */
  M.lessons.push({
    id: 'files', title: 'Files, errors and imports', minutes: 35, blurb: 'Read and write text and JSON, catch an error instead of crashing, and borrow ready-made tools with import.',
    pages: [
      RD('Reading and writing files', `<p>Data lives in files. The safe pattern is <code>with open(...) as f:</code>: it opens the file, gives it the nickname <code>f</code>, and <b>closes it for you</b> when the indented block ends.</p>
        <pre class="codeblock">with open("notes.txt", "w") as f:        # "w" = write (creates or replaces the file)
    f.write("first line\\n")             # \\n means "start a new line"
with open("notes.txt") as f:             # default mode "r" = read
    text = f.read()                      # the whole file as one piece of text
    print(text)</pre>
        <p><b>JSON</b> is the standard way to store a dictionary or list as text. <code>json.dumps(x)</code> turns Python data into JSON text; <code>json.loads(text)</code> turns JSON text back into Python data.</p>`),
      RD('Errors you can catch', `<p>An unhandled error stops the program. A <code>try / except</code> block says "attempt this; if this particular kind of error happens, do that instead".</p>
        <pre class="codeblock">try:
    ratio = revenue / orders         # might divide by zero
except ZeroDivisionError:
    ratio = 0                        # a safe fallback
print(ratio)</pre>
        <p>Catch the <b>specific</b> error you expect (<code>ValueError</code>, <code>KeyError</code>, <code>FileNotFoundError</code>), not everything, or you will hide real bugs.</p>
        <p><b>import</b> brings in a ready-made toolbox: <code>import math</code> then <code>math.sqrt(16)</code>; or take one tool: <code>from collections import Counter</code>. The toolboxes that ship with Python (<code>math</code>, <code>json</code>, <code>random</code>, <code>datetime</code>, <code>collections</code>, <code>csv</code>) are called the <b>standard library</b>.</p>`),
      DM('Write a file, read it back, handle a missing one', `import json

record = {"name": "Asha", "scores": [70, 85, 90]}
with open("record.json", "w") as f:
    f.write(json.dumps(record))

with open("record.json") as f:
    back = json.loads(f.read())
print(back["scores"], type(back))

try:
    open("missing.txt")
except FileNotFoundError:
    print("That file does not exist, carrying on.")`, 'Change the name inside the file and read it back. What changes?'),
      EX({
        id: 'py-5-1', title: 'Save and load JSON', est: 360, xp: 40,
        prompt: `<p>Write <code>save_scores(path, scores)</code> that writes the list as JSON text into the file, and <code>load_scores(path)</code> that reads it back and returns the list. If the file does not exist, <code>load_scores</code> should return an empty list <code>[]</code>.</p>`,
        starter: `import json

def save_scores(path, scores):
    ...

def load_scores(path):
    ...

save_scores("scores.json", [70, 85, 90])
print(load_scores("scores.json"), load_scores("nothing.json"))`,
        solution: `import json

def save_scores(path, scores):
    with open(path, "w") as f:
        f.write(json.dumps(scores))

def load_scores(path):
    try:
        with open(path) as f:
            return json.loads(f.read())
    except FileNotFoundError:
        return []

save_scores("scores.json", [70, 85, 90])
print(load_scores("scores.json"), load_scores("nothing.json"))`,
        hints: ['with open(path, "w") as f: then f.write(json.dumps(...)).', 'Catch FileNotFoundError around the read.'],
        tests: `save_scores('t1.json', [1, 2, 3])
check(load_scores('t1.json') == [1, 2, 3], 'what you save is what you load', 'json.dumps then json.loads')
check(load_scores('does_not_exist.json') == [], 'a missing file gives an empty list', 'except FileNotFoundError: return []')
import os
check(os.path.exists('t1.json'), 'the file really exists after saving', 'open(path, "w")')`,
      }),
      EX({
        id: 'py-5-2', title: 'Clean a column without crashing', est: 360, xp: 40,
        prompt: `<p>Survey answers arrive as text, some of them bad. Write <code>to_numbers(raw)</code> that returns a list of floats for the entries that can be converted, skipping the ones that cannot (<code>float("abc")</code> raises <code>ValueError</code>). Then <code>average(raw)</code> returns the mean of the good ones rounded to 2 decimals, or <code>None</code> if there are none.</p>`,
        starter: `def to_numbers(raw):
    ...

def average(raw):
    ...

print(to_numbers(["4", "x", "5.5", ""]), average(["4", "x", "5.5", ""]))`,
        solution: `def to_numbers(raw):
    good = []
    for item in raw:
        try:
            good.append(float(item))
        except ValueError:
            pass
    return good

def average(raw):
    nums = to_numbers(raw)
    if not nums:
        return None
    return round(sum(nums) / len(nums), 2)

print(to_numbers(["4", "x", "5.5", ""]), average(["4", "x", "5.5", ""]))`,
        hints: ['try: float(item) except ValueError: skip.', 'pass means "do nothing".'],
        tests: `check(to_numbers(['4', 'x', '5.5', '']) == [4.0, 5.5], 'only the convertible entries are kept', 'try float(item), skip on ValueError')
check(average(['4', 'x', '5.5', '']) == 4.75, 'the mean of 4 and 5.5 is 4.75', 'sum / len of the good numbers')
check(average(['a', 'b']) is None, 'no good values gives None', 'check for an empty list first')`,
      }),
      QZ('python', [
        { q: 'Why use with open(...) as f: instead of just open(...)?', o: ['The file is closed automatically at the end of the block', 'It is shorter', 'It makes the file bigger', 'It encrypts the file'], a: 0, why: 'A forgotten close can lose data.' },
        { q: 'json.dumps(data) gives you...', o: ['Text in JSON format', 'A file', 'A list', 'A number'], a: 0, why: 'dumps = dump to string; loads = load from string.' },
        { q: 'Why catch ValueError instead of every possible error?', o: ['Catching everything hides real bugs', 'It is faster', 'Python requires it', 'It uses less memory'], a: 0, why: 'Expect specific failures.' },
      ], 'Check yourself'),
    ],
    recap: ['with open(path, "w") as f writes; the default mode reads; json.dumps / json.loads convert data to text and back.', 'try / except SpecificError gives a safe fallback instead of a crash.', 'import brings in the standard library: math, json, random, datetime, collections.'],
  });
})();
