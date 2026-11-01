'use strict';
/* NumPy extension: dot, matrix product and cross product in depth (theory, syntax, animation, practice). */
(function () {
  const M = DSQ.modules.find(m => m.id === 'numpy');
  M.lessons.push({
    id: 'products', title: 'Dot, matrix and cross products - in depth', minutes: 40, blurb: 'The theory, every NumPy spelling, and an animation of what the numbers do.',
    pages: [
      RD('Three different products', `${TABLE(['Name', 'What it does', 'Result', 'NumPy'], [['<b>element-wise</b>', 'multiply matching positions', 'same shape as the inputs', '<code>a * b</code>'], ['<b>dot product</b>', 'multiply matching pairs and add', 'ONE number', '<code>a @ b</code>, <code>np.dot(a, b)</code>'], ['<b>matrix product</b>', 'every row of A dotted with every column of B', 'matrix (m, p)', '<code>A @ B</code>, <code>np.matmul(A, B)</code>'], ['<b>outer product</b>', 'every element of a times every element of b', 'matrix (len a, len b)', '<code>np.outer(a, b)</code>'], ['<b>cross product</b>', 'a vector perpendicular to both (3-D only)', 'vector of length 3', '<code>np.cross(a, b)</code>']])}
        <p><b>Dot product, three views.</b> (1) <b>Algebra</b>: <code>a1 b1 + a2 b2 + a3 b3</code>. (2) <b>Geometry</b>: <code>|a| |b| cos(angle)</code>, so it is positive when the arrows point the same way, 0 when perpendicular, negative when opposed. (3) <b>Similarity</b>: divide by both lengths and you get the cosine similarity used by search engines and embeddings.</p>
        <p><b>Matrix product.</b> Entry <code>C[i][j]</code> is the dot product of <b>row i of A</b> with <b>column j of B</b>. The shapes must <i>chain</i>: <code>(m, n) @ (n, p) -> (m, p)</code>; the inner numbers must match. It is <b>not commutative</b>: <code>A @ B</code> is usually different from <code>B @ A</code>. A neural-network layer is exactly <code>activation(X @ W + b)</code>.</p>
        <p><b>Cross product.</b> <code>a x b</code> is perpendicular to both (right-hand rule); its length is the <b>area of the parallelogram</b> they span; swapping the order flips its direction; parallel vectors give the zero vector.</p>`),
      VZ('Watch a matrix product being built', 'matmulLab', {}, 'Press <b>Play</b> or <b>Step</b>: the orange row of A and the blue column of B light up, the products appear one by one, and the green cell of C fills in. Change the sizes to see the shape rule; set B\'s rows different from A\'s columns to see the real NumPy error.'),
      DM('Every spelling in code', `import numpy as np

a = np.array([1, 2, 3])
b = np.array([4, 5, 6])
print("element-wise a * b  :", a * b)
print("dot a @ b           :", a @ b, " = 1*4 + 2*5 + 3*6")
print("outer               :\\n", np.outer(a, b))
print("cross               :", np.cross(a, b))

A = np.array([[1, 2], [3, 4]])
B = np.array([[0, 1], [1, 0]])
print("A @ B:\\n", A @ B)
print("B @ A:\\n", B @ A, "   <- different: order matters")
print("A * B (NOT a matrix product):\\n", A * B)

X = np.array([[1, 2, 3], [4, 5, 6]])       # (2, 3)
W = np.array([[1, 0], [0, 1], [1, 1]])     # (3, 2)
print((X @ W).shape)`, 'Step through. <code>B @ A</code> swaps rows (B is a swap matrix) while <code>A @ B</code> swaps columns: matrix multiplication is not commutative.'),
      VZ('Dot and cross in 3-D', 'vecLab', {}, 'Drag the six sliders. The green line is the shadow of <b>u</b> on <b>v</b> (its length is the dot product divided by |v|). The purple arrow is the cross product, always at 90 degrees to both; its length is the area of the shaded parallelogram. Press <b>Rotate v around z</b> and watch the dot product swing from positive to negative while the cross product flips direction.'),
      EX({
        id: 'np-9-1', title: 'Chain the shapes', est: 240, xp: 30,
        prompt: `<p>Compute the matrix product <code>C</code> of <code>A</code> (2x3) and <code>B</code> (3x2), its <code>shape</code>, and <code>trace_C</code> (the sum of its diagonal).</p>`,
        starter: `import numpy as np

A = np.array([[1, 2, 3], [4, 5, 6]])
B = np.array([[1, 0], [0, 1], [2, 2]])
C = ...
shape = ...
trace_C = ...
print(C, shape, trace_C)`,
        solution: `import numpy as np

A = np.array([[1, 2, 3], [4, 5, 6]])
B = np.array([[1, 0], [0, 1], [2, 2]])
C = A @ B
shape = C.shape
trace_C = np.trace(C)
print(C, shape, trace_C)`,
        hints: ['A @ B (not A * B).', 'np.trace(C) sums the diagonal; C.shape is a tuple.'],
        tests: `check(np.array_equal(C, np.array([[7, 8], [16, 17]])), 'C = [[7, 8], [16, 17]]', 'A @ B')
check(tuple(shape) == (2, 2) and int(trace_C) == 24, 'shape (2, 2) and trace 24', 'C.shape, np.trace(C)')`,
      }),
      EX({
        id: 'np-9-2', title: 'Angle, area and the perpendicular vector', est: 360, xp: 40,
        prompt: `<p>For <code>u</code> and <code>v</code> compute: <code>d</code> (dot product), <code>cos</code> (cosine of the angle), <code>angle</code> (in degrees), <code>w</code> (cross product), <code>area</code> (area of the parallelogram = length of <code>w</code>) and <code>perp</code> (<code>True</code> if <code>w</code> is perpendicular to both).</p>`,
        starter: `import numpy as np

u = np.array([1.0, 2.0, 2.0])
v = np.array([2.0, 0.0, 1.0])
d = ...
cos = ...
angle = ...
w = ...
area = ...
perp = ...
print(d, round(angle, 1), w, round(area, 3), perp)`,
        solution: `import numpy as np

u = np.array([1.0, 2.0, 2.0])
v = np.array([2.0, 0.0, 1.0])
d = u @ v
cos = d / (np.linalg.norm(u) * np.linalg.norm(v))
angle = np.degrees(np.arccos(cos))
w = np.cross(u, v)
area = np.linalg.norm(w)
perp = bool(abs(w @ u) < 1e-9 and abs(w @ v) < 1e-9)
print(d, round(angle, 1), w, round(area, 3), perp)`,
        hints: ['cos = dot / (|u| |v|); np.arccos then np.degrees.', 'Two vectors are perpendicular when their dot product is 0.'],
        tests: `check(abs(d - 4) < 1e-9 and abs(cos - 0.5963) < 1e-3, 'dot = 4, cosine about 0.596', 'u @ v, divide by both norms')
check(abs(angle - 53.4) < 0.1, 'the angle is about 53.4 degrees', 'np.degrees(np.arccos(cos))')
check(np.allclose(w, [2, 3, -4]) and abs(area - 5.385) < 1e-3, 'cross = [2, 3, -4], area about 5.385', 'np.cross(u, v), np.linalg.norm(w)')
check(perp is True, 'the cross product is perpendicular to both vectors', 'dot with u and v is 0')`,
      }),
      EX({
        id: 'np-9-3', title: 'Score many rows at once', est: 300, xp: 35,
        prompt: `<p>Each row of <code>X</code> is a customer, <code>w</code> are model weights. Without a loop compute <code>scores</code> (one dot product per row), <code>norms</code> (length of each row) and <code>cos</code> (cosine similarity of each row with <code>w</code>).</p>`,
        starter: `import numpy as np

X = np.array([[1.0, 2.0, 2.0], [0.0, 3.0, 4.0], [2.0, 0.0, 0.0], [1.0, 1.0, 1.0]])
w = np.array([1.0, 0.0, 1.0])
scores = ...
norms = ...
cos = ...
print(scores, np.round(cos, 3))`,
        solution: `import numpy as np

X = np.array([[1.0, 2.0, 2.0], [0.0, 3.0, 4.0], [2.0, 0.0, 0.0], [1.0, 1.0, 1.0]])
w = np.array([1.0, 0.0, 1.0])
scores = X @ w
norms = np.linalg.norm(X, axis=1)
cos = scores / (norms * np.linalg.norm(w))
print(scores, np.round(cos, 3))`,
        hints: ['(4, 3) @ (3,) gives 4 numbers.', 'axis=1 takes the norm of every row.'],
        tests: `check(np.allclose(scores, [3, 4, 2, 2]), 'scores = [3, 4, 2, 2]', 'X @ w')
check(np.allclose(norms, [3, 5, 2, 3 ** .5]), 'row lengths are right', 'np.linalg.norm(X, axis=1)')
check(np.allclose(cos, [3 / (3 * 2 ** .5), 4 / (5 * 2 ** .5), 2 / (2 * 2 ** .5), 2 / (3 ** .5 * 2 ** .5)]), 'cosine similarities are right', 'scores / (norms * np.linalg.norm(w))')`,
      }),
      QZ('numpy', [
        { q: 'A has shape (3, 4). Which B can you multiply as A @ B?', o: ['(4, 5)', '(3, 4)', '(5, 3)', '(5, 4)'], a: 0, why: 'The inner numbers must match: (3, 4) @ (4, 5) -> (3, 5).' },
        { gen: r => { const m = r.int(2, 6), n = r.int(2, 6), p = r.int(2, 6); return { q: `A has shape (${m}, ${n}) and B has shape (${n}, ${p}). What is the shape of A @ B?`, correct: `(${m}, ${p})`, wrong: distract(`(${m}, ${p})`, [`(${n}, ${n})`, `(${p}, ${m})`, `(${m}, ${n})`, `(${n}, ${p})`]), why: '(m, n) @ (n, p) -> (m, p).' }; } },
        { gen: r => { const a = [r.int(1, 5), r.int(1, 5), r.int(1, 5)], b = [r.int(1, 5), r.int(1, 5), r.int(1, 5)], d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return { q: `a = [${a}], b = [${b}]. What is np.dot(a, b)?`, correct: d, wrong: distract(d, [a[0] * b[0], d + a[1], d - b[2], a.reduce((s, x) => s + x, 0) * b.reduce((s, x) => s + x, 0)]), why: `${a[0]}x${b[0]} + ${a[1]}x${b[1]} + ${a[2]}x${b[2]}.` }; } },
        { q: 'Two vectors are perpendicular. Their dot product is...', o: ['0', '1', '-1', 'their lengths multiplied'], a: 0, why: 'cos(90 degrees) = 0.' },
        { q: 'a x b and b x a are...', o: ['Opposite vectors', 'Identical', 'Both zero', 'Perpendicular to each other'], a: 0, why: 'Swapping the order flips the right-hand-rule direction.' },
        { q: 'The length of the cross product a x b equals...', o: ['The area of the parallelogram spanned by a and b', 'The dot product', 'The angle', 'The sum of the lengths'], a: 0, why: '|a||b| sin(angle).' },
      ], 'Quick check'),
      TY({ id: 'np-t9', title: 'Typing sprint: products', goal: 30, code: `d = u @ v
cos = d / (np.linalg.norm(u) * np.linalg.norm(v))
w = np.cross(u, v)
C = A @ B
scores = X @ w` }),
    ],
    recap: ['* is element-wise; @ is the dot / matrix product; np.cross is 3-D only.', '(m, n) @ (n, p) -> (m, p); order matters.', 'dot = |a||b|cos(angle); cross length = parallelogram area; X @ w scores every row at once.'],
  });
  M.boss.push({ q: 'Which operator does the matrix product in NumPy?', o: ['@', '*', '**', '//'], a: 0, why: '* multiplies element by element.' },
    { q: 'You compute np.cross of two parallel vectors. The result is...', o: ['The zero vector', 'Their sum', 'A unit vector', 'An error'], a: 0, why: 'The parallelogram has no area.' });
})();
