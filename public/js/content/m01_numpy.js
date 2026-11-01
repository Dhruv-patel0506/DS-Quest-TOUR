'use strict';
/* =====================================================================
   Module: NumPy  (8 lessons, 14 graded exercises, generated module assessment)
   ===================================================================== */
DSQ.defModule({
  id: 'numpy', boss: [], lessons: [],
  outcomes: ['Create, reshape and combine n-dimensional arrays', 'Slice and mask data without loops', 'Use broadcasting and axis reductions fluently', 'Do the linear algebra and random sampling that ML code relies on'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'numpy');

  /* ===================== L1 ===================== */
  M.lessons.push({
    id: 'why', title: 'Why NumPy? Your first array', minutes: 25, blurb: 'Lists vs arrays, speed, and thinking in whole-array operations.',
    pages: [
      RD('Why NumPy exists', `<p>A Python <b>list</b> can hold anything, but every item is a full Python object stored somewhere else in memory. Doing maths on a million of them means a million tiny Python steps.</p>
        <p>A NumPy <b>array</b> is one tidy block of memory holding numbers of the <i>same type</i>. When you write <code>arr * 2</code> the loop runs inside compiled C, on the whole block at once. This idea is called <b>vectorisation</b>.</p>
        ${NOTE('', 'Why it matters:', 'pandas, scikit-learn, PyTorch and matplotlib all sit on arrays. If you can think in arrays, every later module gets easier.')}
        <p>Two habits to build from day one: <b>no loops when an array operation exists</b>, and <b>always know the shape</b> of what you are holding.</p>`),
      VZ('Numbers become pictures', 'sketch', { expr: 'sin(x) * x / 3', n: 40 }, 'Edit the equation, then drag "points n" down to 6. <code>np.linspace</code> makes n evenly spaced x-values, one formula is applied to the WHOLE array, and matplotlib joins the dots. Every chart in this course is built that way.'),
      DM('Race: list vs array', `import numpy as np
import time

n = 1_000_000
py_list = list(range(n))
arr = np.arange(n)

t0 = time.perf_counter()
squares_list = [x * x for x in py_list]
t_list = time.perf_counter() - t0

t0 = time.perf_counter()
squares_arr = arr * arr
t_arr = time.perf_counter() - t0

print(f"list : {t_list * 1000:.1f} ms")
print(f"numpy: {t_arr * 1000:.1f} ms")
print(f"numpy was about {t_list / t_arr:.0f}x faster")`, 'Run it. The exact numbers depend on your computer and the browser, but the gap is always large. Try changing <code>n</code>.'),
      RD('Your first arrays', `<p>Create an array from a list with <code>np.array</code>. Arithmetic then works on <i>every element</i>:</p>`),
      DM('List maths vs array maths', `import numpy as np

py_list = [1, 2, 3]
arr = np.array([1, 2, 3])

print("list  * 2   :", py_list * 2)      # a list REPEATS
print("array * 2   :", arr * 2)          # an array does MATHS
print("list  + list:", py_list + py_list)
print("array + array:", arr + arr)
print(type(arr), arr.dtype, arr.shape)`, 'Same symbols, very different meaning. Notice <code>dtype</code> (what kind of number) and <code>shape</code> (how many).'),
      EX({
        id: 'np-1-1', title: 'Curve the marks', est: 90, xp: 15,
        prompt: `<p>Five students scored <code>72, 88, 95, 61, 79</code>.</p><ol><li>Put the marks in a NumPy array called <code>scores</code>.</li><li>Give <b>every</b> student 5 bonus marks in one operation and call it <code>curved</code>.</li></ol>`,
        starter: `import numpy as np

scores = np.___([72, 88, 95, 61, 79])
curved = scores + ___
print(curved)
print(type(scores))`,
        solution: `import numpy as np

scores = np.array([72, 88, 95, 61, 79])
curved = scores + 5
print(curved)
print(type(scores))`,
        bank: ['array', 'list', 'arange', 'zeros', '5', '10', '[5]'], hints: ['np.array turns a Python list into an array.', 'Adding a single number to an array adds it to every element (no loop needed).'],
        tests: `check(isinstance(scores, np.ndarray), 'scores is a NumPy array', 'use np.array([...])')
check(list(scores) == [72, 88, 95, 61, 79], 'scores holds the five original marks', 'keep the five numbers exactly as given')
check(list(curved) == [77, 93, 100, 66, 84], 'curved = every mark + 5', 'scores + 5 adds 5 to each element')`,
      }),
      EX({
        id: 'np-1-2', title: 'GST without a loop', est: 150, xp: 20,
        prompt: `<p>Prices: <code>120, 340, 99, 560, 275</code>. Replace each <code>...</code>:</p><ol><li><code>with_gst</code>: every price plus 18% GST, <b>one line, no loop</b>.</li><li><code>total</code>: the total bill (sum of <code>with_gst</code>).</li></ol>`,
        starter: `import numpy as np

prices = np.array([120, 340, 99, 560, 275])

# 1) add 18% GST to every price
with_gst = ...

# 2) the total bill
total = ...
print(with_gst)
print(total)`,
        solution: `import numpy as np

prices = np.array([120, 340, 99, 560, 275])
with_gst = prices * 1.18
total = with_gst.sum()
print(with_gst)
print(total)`,
        hints: ['Adding 18% is the same as multiplying by 1.18.', 'Arrays have a .sum() method (or use np.sum).'],
        tests: `check(isinstance(with_gst, np.ndarray) and with_gst.shape == (5,), 'with_gst is an array of 5 prices', 'multiply the whole array: prices * 1.18')
check(np.allclose(with_gst, [141.6, 401.2, 116.82, 660.8, 324.5]), 'each price has 18% added', 'prices * 1.18')
check(abs(float(total) - 1644.92) < 1e-6, 'total = 1644.92', 'with_gst.sum()')`,
      }),
      QZ('numpy', [
        { q: 'What does `np.array([1, 2, 3]) * 2` give?', o: ['array([2, 4, 6])', '[1, 2, 3, 1, 2, 3]', 'array([1, 2, 3, 2])', 'An error'], a: 0, why: 'Arrays do element-wise maths. (The list version `[1,2,3]*2` repeats the list.)' },
        { q: 'Why is NumPy faster than a Python loop over a list?', o: ['The loop runs in compiled code over one typed block of memory', 'NumPy skips some of the numbers', 'NumPy uses the GPU automatically', 'Lists are stored on disk'], a: 0, why: 'Vectorisation: one call, compiled loop, contiguous same-type data.' },
        { q: 'Which line applies a formula to every element at once?', o: ['y = x ** 2 + 3 (x is an array)', 'for i in x: y.append(i**2+3)', 'y = [x] * 2', 'y = len(x)'], a: 0, why: 'Operators on arrays act on all elements - no loop needed.' },
      ], 'Quick check'),
      TY({ id: 'np-t1', title: 'Warm-up: your first array', goal: 20, code: `import numpy as np

scores = np.array([72, 88, 95, 61, 79])
mean = scores.mean()
passed = scores[scores >= 70]
print(mean, passed)` }),
    ],
    recap: ['Arrays hold one type of number in one block - maths runs on all elements at once.', '`arr * 2` multiplies; `list * 2` repeats.', 'Think: no loop if an array operation exists.'],
  });

  /* ===================== L2 ===================== */
  M.lessons.push({
    id: 'create', title: 'Creating arrays', minutes: 30, blurb: 'array, arange, linspace, zeros, ones, full, eye and random.',
    pages: [
      RD('The constructors you will use daily', `${TABLE(['Call', 'Gives you', 'Typical use'], [
        ['<code>np.array([..])</code>', 'array from a list', 'small hand-typed data'],
        ['<code>np.arange(a, b, step)</code>', 'a, a+step, ... (b excluded)', 'index ranges, counters'],
        ['<code>np.linspace(a, b, n)</code>', 'n evenly spaced points, b included', 'x-axis for plots'],
        ['<code>np.zeros(shape)</code> / <code>np.ones(shape)</code>', 'filled with 0 / 1', 'empty canvases, masks, starting values'],
        ['<code>np.full(shape, v)</code>', 'filled with v', 'constant arrays'],
        ['<code>np.eye(n)</code>', 'n x n identity matrix', 'linear algebra'],
        ['<code>rng.random(shape)</code>', 'random numbers in [0, 1)', 'simulation, test data']])}
        ${NOTE('warn', 'Classic trap:', '<code>arange</code> <b>excludes</b> the stop value but <code>linspace</code> <b>includes</b> it. Also: shapes are passed as a tuple, <code>np.zeros((2, 3))</code> - note the double brackets.')}`),
      DM('Try every constructor', `import numpy as np

print(np.arange(0, 10, 2))          # start, stop (excluded), step
print(np.linspace(0, 1, 5))         # start, stop (included), how many
print(np.zeros((2, 3)))
print(np.ones(4))
print(np.full((2, 2), 7))
print(np.eye(3))
print(np.arange(6).reshape(2, 3))`, 'Change the numbers and re-run. Predict the output first - that is how you learn fastest.'),
      VZ('Random numbers pile up', 'histLive', { dist: 'normal', n: 500 }, 'A histogram counts how many random values fall into each bin. More samples give a smoother shape; <code>normal</code> gives the bell curve you will meet again in statistics.'),
      EX({
        id: 'np-2-1', title: 'Pick the right constructor', est: 120, xp: 20,
        prompt: `<p>Complete each line with the right NumPy function:</p>${UL(['<code>a</code>: 10, 20, 30, 40', '<code>b</code>: 5 evenly spaced numbers from 0 to 1 (both included)', '<code>c</code>: a 2x3 array of zeros', '<code>d</code>: the 3x3 identity matrix', '<code>e</code>: a 2x2 array where every value is 7'])}`,
        starter: `import numpy as np

a = np.___(10, 50, 10)
b = np.___(0, 1, 5)
c = np.___((2, 3))
d = np.___(3)
e = np.___((2, 2), 7)
print(a, b, c, d, e, sep=" | ")`,
        solution: `import numpy as np

a = np.arange(10, 50, 10)
b = np.linspace(0, 1, 5)
c = np.zeros((2, 3))
d = np.eye(3)
e = np.full((2, 2), 7)
print(a, b, c, d, e, sep=" | ")`,
        bank: ['arange', 'linspace', 'zeros', 'ones', 'eye', 'full', 'array', 'empty'], hints: ['a stops BEFORE 50 - which function excludes the end?', 'b must include both 0 and 1 - which one includes the end?'],
        tests: `check(list(a) == [10, 20, 30, 40], 'a = 10, 20, 30, 40', 'np.arange(start, stop, step) excludes stop')
check(np.allclose(b, [0, .25, .5, .75, 1]), 'b = 0, .25, .5, .75, 1', 'np.linspace(0, 1, 5)')
check(c.shape == (2, 3) and c.sum() == 0, 'c is a 2x3 array of zeros', 'np.zeros((2, 3))')
check(d.shape == (3, 3) and np.trace(d) == 3 and d.sum() == 3, 'd is the 3x3 identity matrix', 'np.eye(3)')
check(e.shape == (2, 2) and (e == 7).all(), 'e is a 2x2 array filled with 7', 'np.full((2, 2), 7)')`,
      }),
      EX({
        id: 'np-2-2', title: 'Sample a curve', est: 150, xp: 20,
        prompt: `<p>Build the data for a parabola plot:</p><ol><li><code>x</code>: 11 evenly spaced numbers from 0 to 10 (both included).</li><li><code>y</code>: the square of every x, computed in one line.</li></ol>`,
        starter: `import numpy as np

x = ...
y = ...
print(x)
print(y)`,
        solution: `import numpy as np

x = np.linspace(0, 10, 11)
y = x ** 2
print(x)
print(y)`,
        hints: ['You need 11 points, so the third argument of linspace is 11.', 'The power operator is **.'],
        tests: `check(x.shape == (11,), 'x has 11 points', 'np.linspace(0, 10, 11)')
check(x[0] == 0 and x[-1] == 10, 'x runs from 0 to 10', 'linspace includes the end value')
check(np.allclose(y, x ** 2), 'y = x squared', 'y = x ** 2')`,
      }),
      QZ('numpy', [
        { gen: r => { const a = r.int(0, 5), s = r.pick([2, 3, 4]), b = a + s * r.int(3, 6) + r.int(0, s - 1); const n = Math.ceil((b - a) / s); return { q: `How many numbers are in \`np.arange(${a}, ${b}, ${s})\`?`, correct: n, wrong: distract(n, [n - 1, n + 1, b - a, Math.floor((b - a) / s) + 2, (b - a) / s]), why: `arange stops BEFORE ${b}. Count of values = ceil((${b} - ${a}) / ${s}) = ${n}.` }; } },
        { gen: r => { const a = r.int(0, 3), b = a + r.int(2, 5), n = r.int(4, 9); const st = (b - a) / (n - 1); return { q: `\`np.linspace(${a}, ${b}, ${n})\` - what is the gap between neighbouring points?`, correct: +st.toFixed(4), wrong: distract(+st.toFixed(4), [+((b - a) / n).toFixed(4), +((b - a) / (n + 1)).toFixed(4), b - a, +((b - a) / (n - 2)).toFixed(4)]), why: `n points include both ends, so there are n - 1 = ${n - 1} gaps: (${b} - ${a}) / ${n - 1} = ${st.toFixed(4)}.` }; } },
        { q: 'Which creates a 3 x 4 array of zeros?', o: ['np.zeros((3, 4))', 'np.zeros(3, 4)', 'np.zeros[3, 4]', 'np.zero(3, 4)'], a: 0, why: 'The shape is ONE argument: a tuple (3, 4).' },
        { q: 'Which function includes the end value?', o: ['np.linspace(0, 1, 5)', 'np.arange(0, 1, 0.25)', 'range(0, 5)', 'np.arange(5)'], a: 0, why: 'linspace includes both ends; arange and range stop before the stop value.' },
      ], 'Quick check'),
      TY({ id: 'np-t2', title: 'Typing sprint: constructors', goal: 22, code: `x = np.linspace(0, 10, 11)
y = x ** 2
grid = np.zeros((4, 4))
ids = np.arange(1, 6)
eye = np.eye(3)` }),
    ],
    recap: ['`arange` excludes the stop, `linspace` includes it.', 'Shapes are tuples: `np.zeros((2, 3))`.', 'Apply a formula to a whole array to sample a curve.'],
  });

  /* ===================== L3 ===================== */
  M.lessons.push({
    id: 'shape', title: 'Shape, dtype and reshaping', minutes: 35, blurb: 'ndim, shape, size, dtype, reshape, transpose, stack, concatenate.',
    pages: [
      RD('Four facts about every array', `${UL(['<b>shape</b> - length along each axis: <code>(2, 3, 4)</code>', '<b>ndim</b> - number of axes (1 = list-like, 2 = table, 3 = a stack of tables)', '<b>size</b> - total number of elements = product of the shape', '<b>dtype</b> - the kind of number: <code>int64</code>, <code>float64</code>, <code>bool</code>, <code>&lt;U5</code> (text) ...'])}
        <p>A 3D array is just a <b>stack of tables</b>. Axis 0 picks which table, axis 1 the row, axis 2 the column. Drag the picture to rotate it.</p>`),
      VZ('A 3-D array you can walk around', 'cube3d', { d: 3, r: 3, c: 4 }, 'Change the three sizes and pick which axis to slice along: the orange layer is what <code>a[k]</code>, <code>a[:, k]</code> or <code>a[:, :, k]</code> returns.'),
      VZ('reshape moves the same numbers into a new shape', 'reshape', { n: 12 }, '<code>reshape</code> never changes the numbers or their order, only how they are cut into rows. Use <code>-1</code> to let NumPy work out one dimension: <code>a.reshape(3, -1)</code>. Switch the order to F to see column-by-column filling.'),
      DM('Inspect and reshape', `import numpy as np

a = np.arange(24).reshape(2, 3, 4)
print(a.shape, a.ndim, a.size, a.dtype)
print(a[1, 2, 3])                 # last element: [table, row, column]
print(a.reshape(4, -1).shape)     # -1 means "work it out"
print(a.T.shape)                  # transpose reverses the axes
print(a.astype(float).dtype)
b = np.array([[1, 2], [3, 4]])
print(np.vstack([b, b]).shape, np.hstack([b, b]).shape)
print(np.concatenate([b, b], axis=0).shape)`, 'Check each printed shape against the cube picture.'),
      EX({
        id: 'np-3-1', title: 'Reshape and transpose', est: 120, xp: 20,
        prompt: `<p>Turn <code>a</code> (12 numbers) into a matrix <code>m</code> with <b>3 rows</b>, letting NumPy find the number of columns. Then store its transpose in <code>t</code>.</p>`,
        starter: `import numpy as np

a = np.arange(12)
m = a.___(3, ___)
print(m.shape)
print(m.ndim, m.size, m.dtype)
t = m.___
print(t.shape)`,
        solution: `import numpy as np

a = np.arange(12)
m = a.reshape(3, -1)
print(m.shape)
print(m.ndim, m.size, m.dtype)
t = m.T
print(t.shape)`,
        bank: ['reshape', '-1', '4', 'T', 'flatten', 'resize', 'shape'], hints: ['The method is reshape.', 'A -1 in a reshape means "figure this dimension out".'],
        tests: `check(m.shape == (3, 4), 'm has shape (3, 4)', 'a.reshape(3, -1)')
check(t.shape == (4, 3), 't has shape (4, 3)', 'the transpose is m.T')
check((t == m.T).all(), 't is the transpose of m', 'use m.T')`,
      }),
      EX({
        id: 'np-3-2', title: 'Stack, join, convert', est: 180, xp: 25,
        prompt: `<p>Given <code>a</code> and <code>b</code>:</p><ol><li><code>stacked</code>: place them as two <b>rows</b> of a 2x3 array.</li><li><code>joined</code>: glue them end to end into one array of 6 numbers.</li><li><code>as_float</code>: <code>joined</code> converted to floating-point numbers.</li></ol>`,
        starter: `import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

stacked = ...
joined = ...
as_float = ...
print(stacked.shape, joined.shape, as_float.dtype)`,
        solution: `import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

stacked = np.vstack((a, b))
joined = np.concatenate((a, b))
as_float = joined.astype(float)
print(stacked.shape, joined.shape, as_float.dtype)`,
        hints: ['np.vstack((a, b)) or np.stack((a, b)) stacks as rows.', 'np.concatenate((a, b)) joins end to end.', 'The method that changes the dtype is .astype(float).'],
        tests: `check(stacked.shape == (2, 3) and stacked[1, 0] == 4, 'stacked is 2x3 with b as the second row', 'np.vstack((a, b))')
check(joined.shape == (6,) and list(joined) == [1, 2, 3, 4, 5, 6], 'joined is [1..6]', 'np.concatenate((a, b))')
check(as_float.dtype == np.float64, 'as_float has dtype float64', 'joined.astype(float)')`,
      }),
      QZ('numpy', [
        { gen: r => { const a = r.int(2, 5), b = r.int(2, 6), c = r.int(2, 5), n = a * b * c; const f = r.pick([2, 3, 4, 6].filter(x => n % x === 0)); const sh = [f, n / f]; return { q: `\`a\` has shape ${tup([a, b, c])}. What is \`a.reshape(${f}, -1).shape\`?`, correct: tup(sh), wrong: distract(tup(sh), [tup([n / f, f]), tup([f, a * b]), tup([f]), tup([a, b * c]), tup([f, n])]), why: `size = ${a}x${b}x${c} = ${n}. With ${f} rows, -1 becomes ${n}/${f} = ${n / f}.` }; } },
        { gen: r => { const a = r.int(2, 6), b = r.int(2, 6), c = r.int(2, 6); return { q: `\`a.shape\` is ${tup([a, b, c])}. What is \`a.T.shape\`?`, correct: tup([c, b, a]), wrong: distract(tup([c, b, a]), [tup([a, b, c]), tup([b, a, c]), tup([a, c, b]), tup([c, a, b])]), why: 'Transposing reverses the order of the axes.' }; } },
        { q: 'What is the dtype of `np.array([1, 2.5, 3])`?', o: ['float64', 'int64', 'object', 'str'], a: 0, why: 'NumPy upgrades everything to the most general type in the list: floats.' },
        { gen: r => { const n = r.int(2, 5), m = r.int(2, 5); return { q: `\`np.vstack\` of two arrays each shaped ${tup([n, m])} gives shape...`, correct: tup([2 * n, m]), wrong: distract(tup([2 * n, m]), [tup([n, 2 * m]), tup([2, n, m]), tup([n, m]), tup([n + 1, m])]), why: 'vstack stacks vertically: rows add up, columns stay the same.' }; } },
      ], 'Quick check'),
      TY({ id: 'np-t3', title: 'Typing sprint: shapes', goal: 24, code: `a = np.arange(12)
m = a.reshape(3, -1)
print(m.shape, m.ndim, m.size)
t = m.T
both = np.vstack((m, m))` }),
    ],
    recap: ['shape, ndim, size, dtype tell you everything about an array.', 'reshape keeps the numbers; -1 means "work it out".', 'vstack/hstack/concatenate join arrays; astype converts types.'],
  });

  /* ===================== L4 ===================== */
  M.lessons.push({
    id: 'index', title: 'Indexing and slicing', minutes: 40, blurb: 'a[i, j], start:stop:step, negative index, views vs copies.',
    pages: [
      RD('Pick elements by position', `<p>Positions start at <b>0</b>. For a 2D array use <code>a[row, col]</code>. A <b>slice</b> is <code>start:stop:step</code>: it includes <code>start</code>, excludes <code>stop</code>, and any part may be left out.</p>
        ${TABLE(['Expression', 'Meaning'], [['<code>a[2]</code>', 'row 2'], ['<code>a[:, 0]</code>', 'every row, column 0'], ['<code>a[1:3, 2:5]</code>', 'rows 1-2, columns 2-4'], ['<code>a[::2, ::2]</code>', 'every 2nd row and column'], ['<code>a[-1, -1]</code>', 'bottom-right'], ['<code>a[::-1]</code>', 'rows reversed']])}`),
      VZ('Slice playground', 'slicer', { rows: 5, cols: 6, expr: 'a[1:4, ::2]' }, 'Type any slice (e.g. <code>a[:, 1]</code>, <code>a[::-1, 2:]</code>, <code>a[-2:, -3:]</code>). The blue cells are selected; the panel shows the real result and its shape.'),
      VZ('Game: Slicing drill', 'slicer', { rows: 5, cols: 6, sniper: true, expr: 'a[:, :]' }, 'Write a slice that selects exactly the dashed gold cells. Each hit earns pts and counts toward the Slice-sniper badge.'),
      DM('Slicing in code', `import numpy as np

a = np.arange(30).reshape(5, 6)
print(a)
print("row 1      :", a[1])
print("col 2      :", a[:, 2])
print("block      :", a[1:3, 2:5].tolist())
print("every other:", a[::2, ::2].tolist())
print("reversed r0:", a[0, ::-1])
view = a[0:2]          # a slice is a VIEW, not a copy
view[0, 0] = 99
print("original changed too:", a[0, 0])`, 'The last two lines are the most important: slices share memory with the original. Use <code>.copy()</code> when you need independence.'),
      RD('Views vs copies', `${NOTE('warn', 'The #1 NumPy surprise:', 'A slice is a <b>view</b> - a window onto the same numbers. Changing the view changes the original. Boolean-mask and list indexing create <b>copies</b>. When in doubt, <code>b = a[...].copy()</code>.')}`),
      EX({
        id: 'np-4-1', title: 'Cut the matrix', est: 180, xp: 25,
        prompt: `<p><code>a</code> is a 5x6 matrix of 0..29. Fill each blank so the variable gets the described part:</p>${UL(['<code>row2</code>: the whole third row', '<code>col0</code>: the whole first column', '<code>block</code>: rows 1-2 and columns 2-4', '<code>every2</code>: every 2nd row and every 2nd column', '<code>last</code>: the bottom-right element'])}`,
        starter: `import numpy as np

a = np.arange(30).reshape(5, 6)
row2   = a[___]
col0   = a[___, 0]
block  = a[1:___, 2:5]
every2 = a[::___, ::2]
last   = a[___, ___]
print(row2, col0, block, every2, last, sep=" | ")`,
        solution: `import numpy as np

a = np.arange(30).reshape(5, 6)
row2   = a[2]
col0   = a[:, 0]
block  = a[1:3, 2:5]
every2 = a[::2, ::2]
last   = a[-1, -1]
print(row2, col0, block, every2, last, sep=" | ")`,
        bank: ['2', ':', '3', '-1', '1', '0', '5', '4'], hints: ['A lone colon : means "everything along this axis".', 'Slice stops are excluded: rows 1 and 2 need the stop 3.', 'Negative indices count from the end.'],
        tests: `A = np.arange(30).reshape(5, 6)
check(np.array_equal(row2, A[2]), 'row2 = third row', 'a[2]')
check(np.array_equal(col0, A[:, 0]), 'col0 = first column', 'a[:, 0]')
check(np.array_equal(block, A[1:3, 2:5]), 'block = rows 1-2, columns 2-4', 'the stop of 1:? must be 3')
check(np.array_equal(every2, A[::2, ::2]), 'every2 = every 2nd row and column', 'a[::2, ::2]')
check(last == 29, 'last = 29', 'a[-1, -1]')`,
      }),
      EX({
        id: 'np-4-2', title: 'Edit safely', est: 240, xp: 30,
        prompt: `<ol><li>Set the inner 2x2 block (rows 1-2, columns 1-2) of <code>a</code> to 0, <b>in place</b>.</li><li>Make <code>b</code> a <b>safe copy</b> of the first row of <code>a</code>, then set <code>b[0] = 99</code>. The first row of <code>a</code> must stay unchanged.</li></ol>`,
        starter: `import numpy as np

a = np.arange(1, 17).reshape(4, 4)
# 1) zero the inner block of a
...
# 2) a safe copy of the first row, then change it
b = ...
b[0] = 99
print(a)
print(b)`,
        solution: `import numpy as np

a = np.arange(1, 17).reshape(4, 4)
a[1:3, 1:3] = 0
b = a[0].copy()
b[0] = 99
print(a)
print(b)`,
        hints: ['You can assign to a slice: a[1:3, 1:3] = 0', 'A copy is made with the .copy() method.'],
        tests: `check((a[1:3, 1:3] == 0).all(), 'the inner 2x2 block of a is 0', 'a[1:3, 1:3] = 0')
check(a[0].tolist() == [1, 2, 3, 4], 'the first row of a is untouched', 'use a[0].copy() so b is independent')
check(b[0] == 99 and not np.shares_memory(a, b), 'b is an independent copy with b[0] = 99', 'b = a[0].copy()')
check(a[0, 0] == 1 and a[3, 3] == 16, 'the corners of a are unchanged', 'only the inner block should be zero')`,
      }),
      QZ('numpy', [
        { gen: r => { const R = r.int(4, 9), C = r.int(4, 9); const s = [r.int(0, 2), r.int(R - 2, R)], t = [r.int(0, 2), r.int(C - 2, C)], st = r.pick([1, 2]); const rows = DSQ.parseSlices ? DSQ.parseSlices(`${s[0]}:${s[1]}:${st}, ${t[0]}:${t[1]}`, [R, C]) : null; if (!rows) return null; const sh = [rows[0].idx.length, rows[1].idx.length]; return { q: `\`a.shape\` is ${tup([R, C])}. What is the shape of \`a[${s[0]}:${s[1]}${st > 1 ? ':' + st : ''}, ${t[0]}:${t[1]}]\`?`, correct: tup(sh), wrong: distract(tup(sh), [tup([s[1] - s[0], t[1] - t[0]]), tup([sh[0] + 1, sh[1]]), tup([sh[0], sh[1] + 1]), tup([sh[1], sh[0]]), tup([R, C])]), why: `Rows: ${rows[0].idx.length} (start ${s[0]}, stop ${s[1]} excluded, step ${st}). Columns: ${rows[1].idx.length}.` }; } },
        { q: 'You do `v = a[:2]` and then `v[0] = 100`. What happened to `a`?', o: ['a[0] also became 100 (v is a view)', 'a is unchanged (v is a copy)', 'An error is raised', 'a becomes empty'], a: 0, why: 'Slicing returns a view onto the same memory. Use .copy() to detach.' },
        { gen: r => { const n = r.int(6, 12), k = r.int(2, 4); const a = range(n).map(i => i * r.int(2, 5) + i); return { q: `\`a = ${JSON.stringify(a)}\` (as an array). What does \`a[-${k}]\` return?`, correct: a[n - k], wrong: distract(a[n - k], [a[k], a[n - k - 1], a[n - k + 1], a[k - 1], a[n - 1]]), why: `Index -${k} is the ${k}-th from the end, i.e. position ${n - k}: ${a[n - k]}.` }; } },
        { q: 'Which slice reverses a 1-D array `a`?', o: ['a[::-1]', 'a[-1::]', 'a[:-1]', 'a[::0]'], a: 0, why: 'A step of -1 walks backwards from the end to the start.' },
      ], 'Quick check'),
      TY({ id: 'np-t4', title: 'Typing sprint: slicing', goal: 26, code: `a = np.arange(30).reshape(5, 6)
row = a[2]
col = a[:, 0]
block = a[1:3, 2:5]
safe = a[0].copy()
a[1:3, 1:3] = 0` }),
    ],
    recap: ['`a[row, col]`, and slices `start:stop:step` (stop excluded).', 'Negative indices count from the end; `::-1` reverses.', 'Slices are views. Use `.copy()` for an independent array.'],
  });

  /* ===================== L5 ===================== */
  M.lessons.push({
    id: 'mask', title: 'Boolean masks and np.where', minutes: 35, blurb: 'Filter and choose with conditions instead of loops.',
    pages: [
      RD('A condition is an array of True/False', `<p>Compare an array with a number and you get an array of the same shape holding <code>True</code>/<code>False</code> - a <b>mask</b>. Use the mask as an index to keep only the True positions.</p>
        ${UL(['<code>a &gt; 4</code> - the mask', '<code>a[a &gt; 4]</code> - the values where it is True', '<code>(a &gt; 4).sum()</code> - how many (True counts as 1)', '<code>(a &gt; 4).mean()</code> - the fraction that match', 'combine with <code>&amp;</code> (and), <code>|</code> (or), <code>~</code> (not) and put <b>brackets</b> around each condition'])}`),
      VZ('Move the threshold', 'mask', { seed: 5 }, 'Drag the threshold and change the operator. Green bars are True. The panel shows the mask, the filtered values and the counts - exactly what NumPy returns.'),
      DM('Masks in code', `import numpy as np

a = np.array([3, 8, 1, 9, 4, 7])
mask = a > 4
print(mask)
print(a[mask])
print(a[(a > 2) & (a < 8)])        # & = and, | = or, ~ = not
print(np.where(a > 4, "big", "small"))
print(np.where(a > 4))             # positions where True
print((a > 4).sum(), (a > 4).mean())`, 'Notice: <code>np.where(cond, x, y)</code> is "if cond then x else y", for every element at once.'),
      EX({
        id: 'np-5-1', title: 'Hot days', est: 120, xp: 20,
        prompt: `<p>Daily temperatures are in <code>temps</code>. Find the hot days (strictly above 35).</p>${UL(['<code>hot</code>: True/False for each day', '<code>n_hot</code>: how many hot days', '<code>hot_vals</code>: only the hot temperatures'])}`,
        starter: `import numpy as np

temps = np.array([31.5, 28.0, 35.2, 40.1, 22.8, 36.6, 38.9])

hot = temps ___ 35
n_hot = hot.___()
hot_vals = temps[___]
print(hot, n_hot, hot_vals)`,
        solution: `import numpy as np

temps = np.array([31.5, 28.0, 35.2, 40.1, 22.8, 36.6, 38.9])

hot = temps > 35
n_hot = hot.sum()
hot_vals = temps[hot]
print(hot, n_hot, hot_vals)`,
        bank: ['>', '<', '==', 'sum', 'mean', 'hot', 'temps', '~hot'], hints: ['A comparison gives an array of booleans.', 'True counts as 1 when you sum.', 'Index with the mask itself.'],
        tests: `check(hot.dtype == bool and hot.tolist() == [False, False, True, True, False, True, True], 'hot is the right True/False mask', 'temps > 35')
check(int(n_hot) == 4, 'n_hot = 4', 'hot.sum()')
check(np.allclose(hot_vals, [35.2, 40.1, 36.6, 38.9]), 'hot_vals holds the four hot temperatures', 'temps[hot]')`,
      }),
      EX({
        id: 'np-5-2', title: 'Clip losses', est: 180, xp: 25,
        prompt: `<p>Daily profit is in <code>profit</code> (negative = loss).</p>${UL(['<code>clipped</code>: same as profit but every negative becomes 0 - use <code>np.where</code>', '<code>label</code>: the word <code>"gain"</code> where profit &gt;= 0 and <code>"loss"</code> otherwise'])}`,
        starter: `import numpy as np

profit = np.array([120, -40, 15, -300, 80, 0])

clipped = ...
label = ...
print(clipped)
print(label)`,
        solution: `import numpy as np

profit = np.array([120, -40, 15, -300, 80, 0])

clipped = np.where(profit < 0, 0, profit)
label = np.where(profit >= 0, "gain", "loss")
print(clipped)
print(label)`,
        hints: ['np.where(condition, value_if_true, value_if_false)', 'For the label the condition is profit >= 0.'],
        tests: `check(clipped.tolist() == [120, 0, 15, 0, 80, 0], 'clipped = [120, 0, 15, 0, 80, 0]', 'np.where(profit < 0, 0, profit)')
check(label.tolist() == ['gain', 'loss', 'gain', 'loss', 'gain', 'gain'], 'label marks gain / loss correctly', 'zero counts as gain: profit >= 0')`,
      }),
      EX({
        id: 'np-5-3', title: 'Two conditions at once', est: 200, xp: 25,
        prompt: `<p>Students: <code>ages</code> and <code>marks</code> (same order). Find students who are <b>under 18 AND scored at least 60</b>.</p>${UL(['<code>count</code>: how many such students', '<code>avg_mark</code>: their average mark'])}`,
        starter: `import numpy as np

ages  = np.array([17, 19, 16, 18, 15, 17, 20, 16])
marks = np.array([72, 88, 55, 91, 64, 38, 79, 60])

selected = ...
count = ...
avg_mark = ...
print(count, avg_mark)`,
        solution: `import numpy as np

ages  = np.array([17, 19, 16, 18, 15, 17, 20, 16])
marks = np.array([72, 88, 55, 91, 64, 38, 79, 60])

selected = (ages < 18) & (marks >= 60)
count = selected.sum()
avg_mark = marks[selected].mean()
print(count, avg_mark)`,
        hints: ['Combine two masks with & and wrap each condition in brackets.', 'marks[selected] keeps only the chosen students.'],
        tests: `check(int(count) == 3, 'count = 3 (marks 72, 64, 60)', '(ages < 18) & (marks >= 60), then .sum()')
check(abs(float(avg_mark) - 65.33333333) < 1e-6, 'avg_mark = 65.33...', 'marks[selected].mean()')`,
      }),
      QZ('numpy', [
        { gen: r => { const a = range(8).map(() => r.int(1, 20)), t = r.int(5, 15); const m = a.filter(x => x > t); return { q: `\`a = np.array(${JSON.stringify(a)})\`\nHow many True values in \`a > ${t}\`?`, correct: m.length, wrong: distract(m.length, [m.length + 1, m.length - 1 < 0 ? 9 : m.length - 1, a.filter(x => x >= t).length + 1, 8 - m.length]), why: `Values above ${t}: ${JSON.stringify(m)} - that is ${m.length}.` }; } },
        { gen: r => { const a = range(7).map(() => r.int(1, 15)), t = r.int(4, 11); const s = sum(a.filter(x => x > t)); return { q: `\`a = np.array(${JSON.stringify(a)})\`\nWhat does \`a[a > ${t}].sum()\` return?`, correct: s, wrong: distract(s, [a.filter(x => x > t).length, sum(a), sum(a.filter(x => x <= t)), s + t]), why: `Keep values above ${t}: ${JSON.stringify(a.filter(x => x > t))}, add them: ${s}.` }; } },
        { q: 'Which expression keeps values between 2 and 8 (exclusive)?', o: ['a[(a > 2) & (a < 8)]', 'a[a > 2 and a < 8]', 'a[2 < a < 8]', 'a[a > 2 & a < 8]'], a: 0, why: '`and` does not work on arrays and without brackets `&` binds tighter than `>`. Use & with brackets.' },
        { q: 'What does `np.where(a > 0, 1, -1)` return?', o: ['An array of 1 where a > 0 and -1 elsewhere', 'The positions where a > 0', 'Only the positive values of a', 'A single True/False'], a: 0, why: 'With three arguments np.where is a vectorised if/else.' },
      ], 'Quick check'),
      TY({ id: 'np-t5', title: 'Typing sprint: masks', goal: 28, code: `hot = temps > 35
n_hot = hot.sum()
vals = temps[hot]
both = (ages < 18) & (marks >= 60)
clean = np.where(x < 0, 0, x)` }),
    ],
    recap: ['A condition gives a True/False array; use it as an index.', '`&`, `|`, `~` with brackets; `.sum()` counts Trues.', '`np.where(cond, a, b)` is a vectorised if/else.'],
  });

  /* ===================== L6 ===================== */
  M.lessons.push({
    id: 'broadcast', title: 'Vectorised maths and broadcasting', minutes: 40, blurb: 'ufuncs and the rule that lets different shapes work together.',
    pages: [
      RD('Maths on whole arrays', `<p>Operators (<code>+ - * / ** %</code>) and functions (<code>np.sqrt, np.exp, np.log, np.sin, np.abs, np.round</code>) act <b>element by element</b>. These are called <i>universal functions</i> (ufuncs).</p>
        <p>What if the shapes differ? NumPy tries <b>broadcasting</b>: it lines the shapes up from the <b>right</b>; two dimensions match if they are <b>equal or one of them is 1</b> (the 1 is stretched). Otherwise: <code>ValueError</code>.</p>`),
      VZ('Broadcasting, stretched in front of you', 'broadcast', { a: '(3, 4)', b: '(4,)' }, 'Pick shapes for A and B. Dashed cells are the copies NumPy pretends to make (it does not really copy - that is why it is fast). Try (3,4) with (3,): the red error is the real NumPy message.'),
      VZ('Why broadcasting is powerful', 'surface3d', { expr: 'x^2 + y^2', r: 3 }, 'A 1-D x and a 1-D y combine into a whole 2-D surface: <code>z = x[:, None]**2 + y[None, :]**2</code> uses broadcasting. Change the formula (try <code>sin(x)*cos(y)</code>) and drag to rotate.'),
      DM('Broadcasting in code', `import numpy as np

a = np.array([[1, 2, 3], [4, 5, 6]])
print(a * 10)
print(a + np.array([100, 200, 300]))        # row stretched DOWN
print(a + np.array([[100], [200]]))         # column stretched ACROSS
print(np.sqrt(a).round(2))
x = np.linspace(0, 2 * np.pi, 5)
print(np.sin(x).round(3))
print(a.shape, np.arange(3)[:, None].shape)`, 'Compare each result with the broadcast picture: which array was stretched?'),
      EX({
        id: 'np-6-1', title: 'Standardise the columns', est: 300, xp: 35,
        prompt: `<p>Each row of <code>data</code> is a person: <code>[height_cm, weight_kg]</code>. Standardise <b>each column</b> to have mean 0 and standard deviation 1 (the z-score), without loops:</p>${UL(['<code>mean</code>: mean of each column (shape <code>(2,)</code>)', '<code>std</code>: standard deviation of each column (NumPy default)', '<code>z</code>: <code>(data - mean) / std</code> using broadcasting'])}`,
        starter: `import numpy as np

data = np.array([[170., 65.], [180., 80.], [160., 50.], [175., 72.]])

mean = ...
std = ...
z = ...
print(z.round(3))
print(z.mean(axis=0).round(6), z.std(axis=0).round(6))`,
        solution: `import numpy as np

data = np.array([[170., 65.], [180., 80.], [160., 50.], [175., 72.]])

mean = data.mean(axis=0)
std = data.std(axis=0)
z = (data - mean) / std
print(z.round(3))
print(z.mean(axis=0).round(6), z.std(axis=0).round(6))`,
        hints: ['axis=0 collapses the rows, leaving one answer per column.', 'data (4,2) minus mean (2,) works because (2,) is stretched down the rows.'],
        tests: `check(np.shape(mean) == (2,) and np.allclose(mean, [171.25, 66.75]), 'mean is per column: [171.25, 66.75]', 'data.mean(axis=0)')
check(np.shape(std) == (2,) and np.allclose(std, data.std(axis=0)), 'std is per column', 'data.std(axis=0)')
check(np.allclose(z, (data - data.mean(axis=0)) / data.std(axis=0)), 'z = (data - mean) / std', 'broadcasting does the rest')
check(np.allclose(z.mean(axis=0), 0) and np.allclose(z.std(axis=0), 1), 'each column of z has mean 0 and std 1', 'that is what standardising means')`,
      }),
      EX({
        id: 'np-6-2', title: 'Multiplication table by broadcasting', est: 200, xp: 25,
        prompt: `<p>Build a 3x4 multiplication table (rows 1..3 times columns 1..4) with <b>one</b> broadcast multiplication. Make <code>rows</code> a column vector of shape (3, 1) so it stretches across.</p>`,
        starter: `import numpy as np

rows = np.arange(1, 4)[:, ___]
cols = np.arange(1, 5)
table = rows ___ cols
print(rows.shape, cols.shape)
print(table)`,
        solution: `import numpy as np

rows = np.arange(1, 4)[:, None]
cols = np.arange(1, 5)
table = rows * cols
print(rows.shape, cols.shape)
print(table)`,
        bank: ['None', 'np.newaxis', '0', '*', '+', '@', '1'], hints: ['None (or np.newaxis) inside an index adds a new axis of length 1.', 'A (3,1) times a (4,) gives (3,4).'],
        tests: `check(rows.shape == (3, 1), 'rows is a column vector of shape (3, 1)', 'np.arange(1, 4)[:, None]')
check(table.shape == (3, 4), 'table is 3x4', 'multiply (3,1) by (4,)')
check(np.array_equal(table, np.outer(np.arange(1, 4), np.arange(1, 5))), 'table is the multiplication table', 'rows * cols')`,
      }),
      QZ('numpy', [
        { gen: r => { const dims = [1, 2, 3, 4, 5]; const mk = () => { const k = r.int(1, 3); return range(k).map(() => r.pick(dims)); }; let A = mk(), B = mk(), tries = 0; const bc = (a, b) => { const n = Math.max(a.length, b.length), pa = [...Array(n - a.length).fill(1), ...a], pb = [...Array(n - b.length).fill(1), ...b]; const o = pa.map((x, i) => (x === pb[i] ? x : x === 1 ? pb[i] : pb[i] === 1 ? x : null)); return o.includes(null) ? null : o; }; if (r() < .6) { B = A.slice(Math.max(0, A.length - r.int(1, A.length))).map(x => (r() < .4 ? 1 : x)); } const res = bc(A, B); const ans = res ? tup(res) : 'ValueError'; return { q: `Shapes ${tup(A)} + ${tup(B)}.\nWhat does \`a + b\` give?`, correct: ans, wrong: distract(ans, [res ? 'ValueError' : tup(A), tup(B), res ? tup([...res].reverse()) : tup([...A, ...B].slice(0, 2)), tup([Math.max(...A), Math.max(...B)])]), why: res ? `Align from the right; each pair is equal or has a 1 -> result ${tup(res)}.` : 'Align from the right: some pair differs and neither is 1, so NumPy raises ValueError.' }; } },
        { q: 'Which pair of shapes can NOT be added?', o: ['(3, 4) and (3,)', '(3, 4) and (4,)', '(3, 1) and (1, 4)', '(5,) and (1,)'], a: 0, why: 'Right-aligned, 4 vs 3 differ and neither is 1.' },
        { q: 'What does `x.mean(axis=0)` subtract-and-divide do when you write `(x - x.mean(axis=0)) / x.std(axis=0)`?', o: ['Standardises every column (z-score)', 'Standardises every row', 'Sorts the columns', 'Raises a shape error'], a: 0, why: 'The (n_cols,) vectors are broadcast down the rows.' },
        { q: 'Which is TRUE about broadcasting?', o: ['It does not actually copy the smaller array', 'It always creates a bigger copy in memory', 'It only works for 2-D arrays', 'It aligns shapes from the left'], a: 0, why: 'Strides trick: NumPy re-uses the same data, which is why it is fast. Shapes are aligned from the RIGHT.' },
      ], 'Quick check'),
      TY({ id: 'np-t6', title: 'Typing sprint: z-score', goal: 28, code: `mean = data.mean(axis=0)
std = data.std(axis=0)
z = (data - mean) / std
table = np.arange(1, 4)[:, None] * np.arange(1, 5)
print(z.round(3))` }),
    ],
    recap: ['Operators and np.* functions work on every element.', 'Broadcasting: align shapes from the right; equal or 1 -> OK.', 'Standardising = (x - mean) / std with axis-wise statistics.'],
  });

  /* ===================== L7 ===================== */
  M.lessons.push({
    id: 'axis', title: 'Aggregations and the axis argument', minutes: 35, blurb: 'sum, mean, std, max, argmax, sort, argsort, cumsum, unique - by axis.',
    pages: [
      RD('Reduce a whole array to a few numbers', `<p><code>sum, mean, std, min, max, argmax, argmin</code> shrink an array. The <b>axis</b> says <i>which dimension disappears</i>:</p>${UL(['<code>axis=0</code> - collapse the <b>rows</b>: one answer per column', '<code>axis=1</code> - collapse the <b>columns</b>: one answer per row', 'no axis - collapse everything to a single number'])}
        <p>Memory trick: <b>the axis you name is the one that vanishes from the shape</b>. Shape <code>(3, 4)</code> with <code>axis=0</code> gives <code>(4,)</code>.</p>`),
      VZ('Watch the axis collapse', 'axisReduce', { fn: 'sum', axis: 0 }, 'Switch function and axis. Coloured arrows show which numbers are combined into each answer.'),
      DM('Aggregations in code', `import numpy as np

sales = np.array([[10, 20, 30, 40],
                  [5, 15, 25, 35],
                  [8, 12, 16, 20]])      # 3 stores x 4 quarters
print(sales.sum())
print(sales.sum(axis=0))                 # per quarter
print(sales.sum(axis=1))                 # per store
print(sales.mean(axis=0), sales.max(axis=1))
print(sales.argmax(axis=1))              # best quarter per store
print(np.cumsum(sales[0]))
print(np.sort(sales[0])[::-1], np.argsort(sales[0]))
print(np.unique(np.array([3, 1, 3, 2, 1]), return_counts=True))`, 'Predict every shape before you run. <code>argmax</code> returns a <i>position</i>, <code>max</code> the <i>value</i>.'),
      EX({
        id: 'np-7-1', title: 'Store dashboard', est: 300, xp: 30,
        prompt: `<p><code>sales</code> has one row per store and one column per quarter. Compute:</p>${UL(['<code>store_total</code>: total sales per store', '<code>quarter_avg</code>: average sales per quarter (across stores)', '<code>best_q</code>: for each store, the index of its best quarter', '<code>overall_max</code>: the single biggest number in the table'])}`,
        starter: `import numpy as np

sales = np.array([[10, 20, 30, 40],
                  [5, 15, 25, 35],
                  [8, 12, 16, 20]])

store_total = ...
quarter_avg = ...
best_q = ...
overall_max = ...
print(store_total, quarter_avg, best_q, overall_max)`,
        solution: `import numpy as np

sales = np.array([[10, 20, 30, 40],
                  [5, 15, 25, 35],
                  [8, 12, 16, 20]])

store_total = sales.sum(axis=1)
quarter_avg = sales.mean(axis=0)
best_q = sales.argmax(axis=1)
overall_max = sales.max()
print(store_total, quarter_avg, best_q, overall_max)`,
        hints: ['Per store = one answer per row = collapse the columns = axis=1.', 'argmax gives the index, max gives the value.'],
        tests: `check(store_total.tolist() == [100, 80, 56], 'store_total = [100, 80, 56]', 'sales.sum(axis=1)')
check(np.allclose(quarter_avg, [7.6667, 15.6667, 23.6667, 31.6667], atol=1e-3), 'quarter_avg per quarter', 'sales.mean(axis=0)')
check(best_q.tolist() == [3, 3, 3], 'best_q = [3, 3, 3]', 'sales.argmax(axis=1)')
check(overall_max == 40, 'overall_max = 40', 'sales.max()')`,
      }),
      EX({
        id: 'np-7-2', title: 'Leaderboard', est: 240, xp: 30,
        prompt: `<p><code>names</code> and <code>scores</code> line up. Build the leaderboard:</p>${UL(['<code>order</code>: positions that sort scores from <b>highest to lowest</b>', '<code>top3</code>: the names of the 3 best players, best first', '<code>rank_of_dev</code>: the 1-based rank of "Dev"'])}`,
        starter: `import numpy as np

names = np.array(["Asha", "Ben", "Chen", "Dev", "Esha", "Farid"])
scores = np.array([71, 94, 88, 79, 94.5, 60])

order = ...
top3 = ...
rank_of_dev = ...
print(top3, rank_of_dev)`,
        solution: `import numpy as np

names = np.array(["Asha", "Ben", "Chen", "Dev", "Esha", "Farid"])
scores = np.array([71, 94, 88, 79, 94.5, 60])

order = np.argsort(-scores)
top3 = names[order[:3]]
rank_of_dev = int(np.where(names[order] == "Dev")[0][0]) + 1
print(top3, rank_of_dev)`,
        hints: ['np.argsort(-scores) sorts descending (negate the scores).', 'names[order] reorders the names; slice the first three.', 'Find where "Dev" is in the reordered names and add 1.'],
        tests: `check(order.tolist() == [4, 1, 2, 3, 0, 5], 'order = [4, 1, 2, 3, 0, 5]', 'np.argsort(-scores)')
check(list(top3) == ['Esha', 'Ben', 'Chen'], "top3 = Esha, Ben, Chen", 'names[order[:3]]')
check(int(rank_of_dev) == 4, 'Dev is ranked 4th', 'look for Dev in names[order], then add 1')`,
      }),
      QZ('numpy', [
        { gen: r => { const R = r.int(2, 6), C = r.int(2, 6), ax = r.pick([0, 1]); const fn = r.pick(['sum', 'mean', 'max']); const sh = ax === 0 ? [C] : [R]; return { q: `\`a.shape\` is ${tup([R, C])}. What is the shape of \`a.${fn}(axis=${ax})\`?`, correct: tup(sh), wrong: distract(tup(sh), [tup(ax === 0 ? [R] : [C]), tup([R, C]), '()', tup([1, ax === 0 ? C : R])]), why: `axis=${ax} is the axis that disappears, so the remaining length is ${ax === 0 ? C : R}.` }; } },
        { gen: r => { const m = range(3).map(() => range(4).map(() => r.int(1, 9))), ax = r.pick([0, 1]); const out = ax === 0 ? range(4).map(j => sum(m.map(x => x[j]))) : m.map(x => sum(x)); return { q: `\`a = np.array(${JSON.stringify(m)})\`\nWhat is \`a.sum(axis=${ax})\`?`, correct: JSON.stringify(out).replace(/,/g, ', '), wrong: distract(JSON.stringify(out).replace(/,/g, ', '), [JSON.stringify(ax === 0 ? m.map(x => sum(x)) : range(4).map(j => sum(m.map(x => x[j])))).replace(/,/g, ', '), String(sum(m.flat())), JSON.stringify(out.map(v => v - 1)).replace(/,/g, ', ')]), why: ax === 0 ? 'axis=0 adds down each column.' : 'axis=1 adds across each row.' }; } },
        { q: '`a.argmax()` returns...', o: ['The position of the biggest value', 'The biggest value', 'All positions sorted', 'The mean position'], a: 0, why: 'argmax = index of the maximum (for 2-D without axis, the index in the flattened array).' },
        { q: 'To sort values from largest to smallest you can use...', o: ['np.sort(a)[::-1]', 'np.sort(a, reverse=True)', 'np.sort(a, axis=-1)[0]', 'a.sorted()'], a: 0, why: 'np.sort has no reverse flag; reverse the sorted result with [::-1].' },
      ], 'Quick check'),
      TY({ id: 'np-t7', title: 'Typing sprint: axis', goal: 30, code: `total = sales.sum(axis=1)
avg = sales.mean(axis=0)
best = sales.argmax(axis=1)
order = np.argsort(-scores)
top3 = names[order[:3]]` }),
    ],
    recap: ['The axis you name is the one that disappears.', 'argmax/argsort give positions; max/sort give values.', 'names[np.argsort(-scores)] = leaderboard in two words.'],
  });

  /* ===================== L8 ===================== */
  M.lessons.push({
    id: 'linalg', title: 'Linear algebra and random numbers', minutes: 40, blurb: 'dot, @, solve, inv, det - and reproducible randomness with default_rng.',
    pages: [
      RD('Dot product and matrix product', `<p>The <b>dot product</b> of two vectors multiplies matching elements and adds them: <code>a @ b</code> or <code>np.dot(a, b)</code>. It measures how much two vectors point the same way. Divide by both lengths and you get the <b>cosine similarity</b> - the backbone of search and recommenders.</p>
        <p>For matrices, <code>A @ B</code> is the matrix product (rows of A with columns of B). <code>*</code> is <b>not</b> matrix multiplication - it is element-wise.</p>`),
      VZ('Dot product, angle, cosine', 'dotcos', { ta: 30, tb: 100 }, 'Drag the angles and lengths. When the arrows are perpendicular the dot product is 0; when they point the same way cosine approaches 1; opposite gives -1.'),
      DM('Linear algebra toolbox', `import numpy as np

a = np.array([1, 2, 3]); b = np.array([4, 5, 6])
print(np.dot(a, b), a @ b)
cos = a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
print(round(cos, 4))

A = np.array([[2, 1], [1, -1]]); y = np.array([5, 1])
print(np.linalg.solve(A, y))        # solves A @ x = y
print(np.linalg.inv(A).round(3))
print(round(np.linalg.det(A), 3))
print(A @ A)
print(A * A)`, '<code>A @ A</code> vs <code>A * A</code>: matrix product vs element-wise. The <code>solve</code> line finds x and y with 2x + y = 5 and x - y = 1.'),
      RD('Random numbers you can reproduce', `<p>Create a generator once with a <b>seed</b>, then ask it for numbers: the same seed always gives the same sequence - essential for reproducible experiments.</p>
        ${UL(['<code>rng = np.random.default_rng(42)</code>', '<code>rng.random(5)</code> - floats in [0, 1)', '<code>rng.integers(1, 7, size=10)</code> - dice rolls (7 excluded)', '<code>rng.normal(mu, sigma, size=100)</code> - bell curve', '<code>rng.choice(a, size=3, replace=False)</code> - sample without repeats'])}${NOTE('warn', 'Avoid:', 'the old global <code>np.random.seed()</code> / <code>np.random.rand()</code> style. Use <code>default_rng</code>.')}`),
      EX({
        id: 'np-8-1', title: 'How similar are these two readers?', est: 240, xp: 30,
        prompt: `<p>Two readers rated 5 films. Compute:</p>${UL(['<code>dot</code>: the dot product of <code>u</code> and <code>v</code>', '<code>cos</code>: cosine similarity = dot / (length of u * length of v). Length is <code>np.linalg.norm</code>.'])}`,
        starter: `import numpy as np

u = np.array([5, 3, 0, 1, 4])
v = np.array([4, 0, 0, 1, 5])

dot = ...
cos = ...
print(dot, round(cos, 4))`,
        solution: `import numpy as np

u = np.array([5, 3, 0, 1, 4])
v = np.array([4, 0, 0, 1, 5])

dot = u @ v
cos = dot / (np.linalg.norm(u) * np.linalg.norm(v))
print(dot, round(cos, 4))`,
        hints: ['u @ v or np.dot(u, v).', 'np.linalg.norm(u) is the length of u.'],
        tests: `check(float(dot) == 41, 'dot = 41', 'u @ v')
check(abs(float(cos) - 0.8859) < 1e-3, 'cos is about 0.8859','dot / (np.linalg.norm(u) * np.linalg.norm(v))')`,
      }),
      EX({
        id: 'np-8-2', title: 'Solve the system', est: 200, xp: 25,
        prompt: `<p>Solve: <code>3x + 2y = 16</code> and <code>x - y = 2</code>. Put the coefficients in <code>A</code>, the right-hand sides in <code>rhs</code>, and the answer (x, y) in <code>sol</code>.</p>`,
        starter: `import numpy as np

A = np.array([[..., ...], [..., ...]])
rhs = np.array([..., ...])
sol = ...
print(sol)`,
        solution: `import numpy as np

A = np.array([[3, 2], [1, -1]])
rhs = np.array([16, 2])
sol = np.linalg.solve(A, rhs)
print(sol)`,
        hints: ['Each row of A holds the coefficients of x and y of one equation.', 'np.linalg.solve(A, rhs)'],
        tests: `check(np.array(A).shape == (2, 2) and np.array(A).tolist() == [[3, 2], [1, -1]], 'A = [[3, 2], [1, -1]]', 'one row per equation')
check(np.array(rhs).tolist() == [16, 2], 'rhs = [16, 2]', 'the right-hand sides')
check(np.allclose(sol, [4.0, 2.0]), 'x = 4, y = 2', 'np.linalg.solve(A, rhs)')`,
      }),
      EX({
        id: 'np-8-3', title: 'Roll 10,000 dice', est: 240, xp: 30,
        prompt: `<p>Simulate rolling a fair six-sided die 10,000 times with a seeded generator.</p>${UL(['<code>rng</code>: <code>np.random.default_rng(7)</code>', '<code>rolls</code>: 10,000 integers from 1 to 6', '<code>faces, counts</code>: the distinct faces and how many times each appeared, with <code>np.unique(rolls, return_counts=True)</code>', '<code>avg</code>: the average roll (should be near 3.5)'])}`,
        starter: `import numpy as np

rng = ...
rolls = ...
faces, counts = ...
avg = ...
print(counts)
print(round(avg, 3))`,
        solution: `import numpy as np

rng = np.random.default_rng(7)
rolls = rng.integers(1, 7, size=10_000)
faces, counts = np.unique(rolls, return_counts=True)
avg = rolls.mean()
print(counts)
print(round(avg, 3))`,
        hints: ['integers(low, high) excludes high, so the high is 7.', 'np.unique(rolls, return_counts=True) returns the faces and how many times each appeared.'],
        tests: `check(rolls.shape == (10000,), '10,000 rolls', 'size=10_000')
check(rolls.min() == 1 and rolls.max() == 6, 'rolls are between 1 and 6', 'rng.integers(1, 7, ...)')
check(list(faces) == [1, 2, 3, 4, 5, 6] and counts.sum() == 10000, 'faces are 1..6 and counts add up to 10,000', 'np.unique(rolls, return_counts=True)')
check(abs(float(avg) - 3.5) < 0.1, 'avg is close to 3.5', 'rolls.mean()')`,
      }),
      QZ('numpy', [
        { gen: r => { const n = 3, a = range(n).map(() => r.int(-3, 5)), b = range(n).map(() => r.int(-3, 5)); const d = sum(a.map((x, i) => x * b[i])); return { q: `\`a = ${JSON.stringify(a)}\`, \`b = ${JSON.stringify(b)}\`\nWhat is \`a @ b\`?`, correct: d, wrong: distract(d, [sum(a.map((x, i) => x + b[i])), a.reduce((s, x, i) => s + Math.abs(x * b[i]), 0), d + a[0], d - b[1], d * 2]), why: `Multiply matching elements and add: ${a.map((x, i) => `(${x}*${b[i]})`).join(' + ')} = ${d}.` }; } },
        { q: 'What is the difference between `A * B` and `A @ B` for 2-D arrays?', o: ['* is element-wise, @ is the matrix product', '* is the matrix product, @ is element-wise', 'They are the same', '@ only works for vectors'], a: 0, why: 'Element-wise vs matrix product: a very common source of silent bugs.' },
        { q: 'Why create the generator with `np.random.default_rng(42)`?', o: ['Same seed -> same numbers, so results are reproducible', 'It makes the numbers more random', 'It is faster than all other methods', 'It stores the numbers on disk'], a: 0, why: 'Reproducibility lets others (and future you) get exactly the same simulation.' },
        { q: '`np.linalg.solve(A, y)` finds...', o: ['x such that A @ x = y', 'the inverse of A', 'the determinant of A', 'A times y'], a: 0, why: 'It solves the linear system. It is more accurate and faster than computing inv(A) @ y.' },
      ], 'Quick check'),
      TY({ id: 'np-t8', title: 'Typing sprint: linear algebra', goal: 30, code: `cos = u @ v / (np.linalg.norm(u) * np.linalg.norm(v))
sol = np.linalg.solve(A, rhs)
rng = np.random.default_rng(7)
rolls = rng.integers(1, 7, size=10_000)
faces, counts = np.unique(rolls, return_counts=True)` }),
    ],
    recap: ['`@` is the matrix/dot product; `*` is element-wise.', 'cosine = dot / (norm * norm).', 'Use default_rng(seed) for reproducible randomness.'],
  });

  /* ===================== module assessment ===================== */
  M.boss = [
    { q: 'What is `np.arange(2, 11, 3)`?', o: ['[2, 5, 8]', '[2, 5, 8, 11]', '[2, 3, 6, 9]', '[5, 8, 11]'], a: 0, why: 'Start at 2, step 3, stop BEFORE 11.' },
    { q: 'What is the shape of `np.zeros((3, 1)) + np.ones((1, 4))`?', o: ['(3, 4)', '(3, 1)', '(1, 4)', 'ValueError'], a: 0, why: 'Both 1s stretch: (3,1) and (1,4) broadcast to (3,4).' },
    { q: 'Which line gives the last column of a 2-D array `a`?', o: ['a[:, -1]', 'a[-1]', 'a[-1, :]', 'a[:, 0]'], a: 0, why: 'All rows, last column. `a[-1]` is the last ROW.' },
    { q: 'What does `a[a % 2 == 0]` do?', o: ['Returns the even elements', 'Returns the odd elements', 'Returns the even positions', 'Raises an error'], a: 0, why: 'The mask is True where the remainder is 0, i.e. even numbers.' },
    { q: 'How do you get the average of each ROW of a 2-D array?', o: ['a.mean(axis=1)', 'a.mean(axis=0)', 'a.mean()', 'np.mean(a, 2)'], a: 0, why: 'One answer per row: collapse the columns, axis=1.' },
    { q: 'Which is a safe independent copy of the first row?', o: ['a[0].copy()', 'a[0]', 'a[0:1]', 'a.view()[0]'], a: 0, why: 'Only `.copy()` guarantees separate memory.' },
    { gen: r => { const R = r.int(2, 6), C = r.int(2, 6); return { q: `What is \`np.zeros((${R}, ${C})).size\`?`, correct: R * C, wrong: distract(R * C, [R + C, R * R, C * C, R * C + 1]), why: `size = number of elements = ${R} x ${C} = ${R * C}.` }; } },
    { gen: r => { const a = range(6).map(() => r.int(-5, 9)); const cl = a.map(v => (v < 0 ? 0 : v)); return { q: `\`a = np.array(${JSON.stringify(a)})\`\nWhat is \`np.where(a < 0, 0, a).sum()\`?`, correct: sum(cl), wrong: distract(sum(cl), [sum(a), sum(a.filter(v => v < 0)), sum(cl) + 1, Math.abs(sum(a))]), why: `Negatives become 0: ${JSON.stringify(cl)} -> ${sum(cl)}.` }; } },
    { q: 'Which statement about `reshape` is TRUE?', o: ['It keeps the same numbers in the same order', 'It sorts the numbers', 'It can change the number of elements', 'It always copies'], a: 0, why: 'reshape only changes how the same flat sequence is cut into axes (the size must stay the same).' },
    { q: 'You standardise columns with `(x - x.mean(axis=0)) / x.std(axis=0)`. Which concept makes the subtraction work?', o: ['Broadcasting', 'Fancy indexing', 'Slicing', 'Type promotion'], a: 0, why: 'The (n_cols,) means are stretched down all rows.' },
  ];
})();
