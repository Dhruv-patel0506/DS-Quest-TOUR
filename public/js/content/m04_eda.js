'use strict';
/* =====================================================================
   Module: EDA & Data Cleaning - the most important skill in data science (4 lessons, 7 exercises, project)
   Every cleaning step is shown four ways in the Cleaning Lab: table, chart, code, notes.
   ===================================================================== */
DSQ.defModule({
  id: 'eda', boss: [], lessons: [],
  outcomes: ['Audit any dataset in five lines and know what is wrong with it', 'Fix text, types, duplicates, missing values and outliers - in the right order, and say why', 'Use matrices (correlation, determinant, covariance) to find redundant and unusual rows', 'Show the effect of every cleaning step with a before/after chart'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'eda');
  const MESSY = `import pandas as pd
import numpy as np

df = pd.DataFrame({
    "age":    [25, 31, np.nan, 29, 187, 31, 40],
    "city":   [" Pune", "delhi", "PUNE", "Delhi ", "Pune", "DELHI", "Mumbai"],
    "income": ["52,000", "61000", "n/a", "58,500", "49000", "61000", "910,000"],
})`;

  M.lessons.push({
    id: 'audit', title: 'Audit first: what is wrong with this data?', minutes: 30, blurb: 'Five lines that tell you the truth about any dataset.',
    pages: [
      RD('Never trust a dataset you have not audited', `<p>Most of a data scientist's time goes into cleaning, because every model, chart and average is only as honest as the data underneath. Real data arrives with <b>missing values</b>, <b>repeated rows</b>, <b>text where numbers should be</b>, <b>inconsistent spelling</b>, <b>impossible values</b> and <b>outliers</b>. Before you fix anything, <i>audit</i>:</p>
        <pre class="codeblock">df.shape                # how many rows and columns?
df.dtypes               # is each column the right type? (numbers stored as object = text!)
df.isna().sum()         # missing values per column
df.duplicated().sum()   # repeated rows
df.describe()           # min / max / mean: impossible values show up here
df["city"].value_counts()   # inconsistent spelling shows up here</pre>
        ${NOTE('', 'The roles of the three libraries:', '<b>pandas</b> holds the table and does the fixing; <b>NumPy</b> supplies the numbers and the matrix tools (NaN, quantiles, correlation, determinant); <b>matplotlib</b> shows you the problem before and after.')}`),
      VZ('Watch a dirty dataset get audited and cleaned', 'cleanLab', { level: 1 }, 'Four panes, one dataset: the <b>table</b> (changed cells flash green, removed rows are struck through), the <b>chart</b>, the <b>pandas code</b> and the <b>notes</b>. Click a step - a dot means there is something to fix. Press <b>New random dataset</b> to practise on a different one every time.'),
      DM('Your first audit', `${MESSY}

print(df.shape)
print(df.dtypes)
print(df.isna().sum())
print("duplicates:", df.duplicated().sum())
print(df.describe().round(1))
print(df["city"].value_counts())`, 'What do you notice? <code>income</code> is <code>object</code> (text) so <code>describe()</code> skips it; <code>age</code> has a 187; the city has 7 spellings of 3 cities. Step through it to watch each column.'),
      EX({
        id: 'eda-1-1', title: 'Write the audit', est: 240, xp: 30,
        prompt: `<p>Compute: <code>n_rows</code>, <code>n_dupes</code> (duplicated rows), <code>missing</code> (missing count per column, a Series), <code>worst_col</code> (the column with the most missing values) and <code>text_cols</code>: a <b>list</b> of the columns whose dtype is <code>object</code>.</p>`,
        starter: `${MESSY}

n_rows = ...
n_dupes = ...
missing = ...
worst_col = ...
text_cols = ...
print(n_rows, n_dupes, worst_col, text_cols)`,
        solution: `${MESSY}

n_rows = len(df)
n_dupes = int(df.duplicated().sum())
missing = df.isna().sum()
worst_col = missing.idxmax()
text_cols = [c for c in df.columns if df[c].dtype == object]
print(n_rows, n_dupes, worst_col, text_cols)`,
        hints: ['df.duplicated().sum() counts repeated rows.', 'idxmax on the missing counts gives the column name.', 'df[c].dtype == object tests for text columns.'],
        tests: `check(n_rows == 7 and n_dupes == 0, '7 rows and no exactly repeated rows (the two "61000" rows differ in city case, so they are not yet exact repeats)', 'len(df), df.duplicated().sum()')
check(missing.to_dict() == {'age': 1, 'city': 0, 'income': 0}, 'missing: age 1 (the "n/a" in income is TEXT, not NaN yet!)', 'df.isna().sum()')
check(worst_col == 'age' and sorted(text_cols) == ['city', 'income'], 'worst_col = age; text columns = city, income', 'a list comprehension over df.columns')`,
      }),
      QZ('eda', [
        { q: 'A column of prices shows dtype `object` and `describe()` ignores it. Most likely...', o: ['The numbers are stored as text (for example "1,200")', 'The column is empty', 'pandas is broken', 'The prices are all equal'], a: 0, why: 'Convert with pd.to_numeric(..., errors="coerce") after removing commas.' },
        { gen: r => { const n = r.int(120, 600), m = r.int(3, 40); return { q: `A column has ${n} rows and ${m} missing values. What percentage is missing (1 decimal)?`, correct: (100 * m / n).toFixed(1) + '%', wrong: distract((100 * m / n).toFixed(1) + '%', [(100 * m / (n - m)).toFixed(1) + '%', (m / n).toFixed(3), (100 * n / m).toFixed(1) + '%', (100 * (n - m) / n).toFixed(1) + '%']), why: `${m} / ${n} x 100.` }; } },
        { q: 'Why audit BEFORE fixing anything?', o: ['You cannot choose the right fix without knowing what is wrong', 'It is a formality', 'It makes the file smaller', 'pandas requires it'], a: 0, why: 'A fix applied blindly (dropping rows, filling with a mean) can do more harm than the problem.' },
      ], 'Quick check'),
      TY({ id: 'eda-t1', title: 'Typing sprint: the audit', goal: 30, code: `print(df.shape)
print(df.dtypes)
print(df.isna().sum())
print(df.duplicated().sum())
print(df.describe())
print(df["city"].value_counts())` }),
    ],
    recap: ['Audit: shape, dtypes, isna().sum(), duplicated().sum(), describe(), value_counts().', 'object dtype on a numeric-looking column = numbers stored as text.', 'Cleaning without an audit is guessing.'],
  });

  M.lessons.push({
    id: 'fix', title: 'Fixing it: text, types, duplicates, missing, outliers', minutes: 45, blurb: 'Each problem, its fix, and why the ORDER of the fixes matters.',
    pages: [
      RD('A repeatable recipe', `${TABLE(['Problem', 'Fix', 'Watch out'], [['numbers stored as text', '<code>pd.to_numeric(s.str.replace(",", ""), errors="coerce")</code>', 'junk becomes NaN, which you then handle'], ['dates in two formats', '<code>pd.to_datetime(s, format="mixed", dayfirst=True)</code>', 'is 04/03 4 March or April 3? decide explicitly'], ['inconsistent text', '<code>s.str.strip().str.title()</code>', 'do this BEFORE duplicates and groupby'], ['repeated rows', '<code>df.drop_duplicates()</code>', 'only after text is tidy'], ['impossible values', '<code>df.loc[~df.age.between(0, 100), "age"] = np.nan</code>', 'blank them BEFORE computing a median'], ['missing values', '<code>fillna(median)</code>, <code>dropna(subset=[...])</code>', 'fill = keep the row; drop = lose it'], ['outliers', 'IQR rule: outside Q1 - 1.5 IQR .. Q3 + 1.5 IQR', 'look at each one: error or real?']])}
        <p><b>Order of operations:</b> types -> text -> duplicates -> impossible values -> fill gaps -> outliers. Try other orders in the Cleaning Lab and read the warning notes: the median of an age column that still contains 187 is wrong.</p>`),
      VZ('Practise on a hard dataset', 'cleanLab', { level: 3 }, 'Level 3 adds outliers and impossible ages. Click the steps in the WRONG order (fill the ages before blanking 187) and read the note; then press <b>Auto-clean</b> to watch the recommended order, and <b>Run this code in real Python</b> to confirm pandas agrees with the picture.'),
      DM('The whole recipe in code', `${MESSY}

df["income"] = pd.to_numeric(df["income"].astype(str).str.replace(",", ""), errors="coerce")
df["city"] = df["city"].str.strip().str.title()
df = df.drop_duplicates()
df.loc[~df["age"].between(0, 100), "age"] = np.nan
df["age"] = df["age"].fillna(df["age"].median())
q1, q3 = df["income"].quantile([0.25, 0.75])
iqr = q3 - q1
lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
print("fences:", round(lo), round(hi))
df = df[df["income"].between(lo, hi) | df["income"].isna()]
print(df)`, 'Step through and watch the table change line by line. Note the order: the 187 became NaN before the median was taken.'),
      EX({
        id: 'eda-2-1', title: 'Clean the text and the numbers', est: 300, xp: 35,
        prompt: `<p>Fix <code>df</code> in this order: (1) <code>income</code> to real numbers (remove commas, unreadable -> NaN), (2) tidy <code>city</code> (strip + Title Case), (3) drop duplicate rows. Keep the result in <code>df</code>.</p>`,
        starter: `${MESSY}

...
print(df)`,
        solution: `${MESSY}

df["income"] = pd.to_numeric(df["income"].astype(str).str.replace(",", ""), errors="coerce")
df["city"] = df["city"].str.strip().str.title()
df = df.drop_duplicates()
print(df)`,
        hints: ['Remove the comma with .str.replace(",", "") before to_numeric.', 'Rows 2 and 5 only become identical after the city text is tidy.'],
        tests: `check(str(df['income'].dtype).startswith('float') and df['income'].isna().sum() == 1, 'income is numeric with exactly one NaN (the "n/a")', 'to_numeric(..., errors="coerce")')
check(sorted(df['city'].unique()) == ['Delhi', 'Mumbai', 'Pune'], 'cities are Delhi, Mumbai, Pune', '.str.strip().str.title()')
check(len(df) == 6, '6 rows remain: the repeated customer only shows up once the text is tidy', 'drop_duplicates() AFTER tidying the text')`,
      }),
      EX({
        id: 'eda-2-2', title: 'The IQR outlier rule, by hand', est: 300, xp: 35,
        prompt: `<p><code>v</code> holds incomes. Compute <code>q1</code>, <code>q3</code>, <code>iqr</code>, the fences <code>lo</code> and <code>hi</code> (1.5 x IQR rule), <code>is_out</code> (boolean mask of outliers) and <code>clean</code> (the values inside the fences).</p>`,
        starter: `import numpy as np

v = np.array([52000, 61000, 58500, 49000, 61000, 910000, 55000, 47000, 63000])
q1 = ...
q3 = ...
iqr = ...
lo, hi = ..., ...
is_out = ...
clean = ...
print(lo, hi, is_out.sum(), clean.size)`,
        solution: `import numpy as np

v = np.array([52000, 61000, 58500, 49000, 61000, 910000, 55000, 47000, 63000])
q1 = np.percentile(v, 25)
q3 = np.percentile(v, 75)
iqr = q3 - q1
lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
is_out = (v < lo) | (v > hi)
clean = v[~is_out]
print(lo, hi, is_out.sum(), clean.size)`,
        hints: ['np.percentile(v, 25) or np.quantile(v, 0.25).', 'Combine two conditions with | and invert a mask with ~.'],
        tests: `_q1, _q3 = np.percentile(v, 25), np.percentile(v, 75); _i = _q3 - _q1
check(abs(q1 - _q1) < 1e-9 and abs(q3 - _q3) < 1e-9 and abs(iqr - _i) < 1e-9, 'q1, q3 and iqr are right', 'np.percentile(v, 25), np.percentile(v, 75)')
check(abs(lo - (_q1 - 1.5 * _i)) < 1e-9 and abs(hi - (_q3 + 1.5 * _i)) < 1e-9, 'the fences are Q1 - 1.5 IQR and Q3 + 1.5 IQR', 'q1 - 1.5 * iqr, q3 + 1.5 * iqr')
check(int(is_out.sum()) == 1 and v[is_out][0] == 910000 and clean.size == 8, 'only 910000 is an outlier; 8 values remain', '(v < lo) | (v > hi)')`,
      }),
      QZ('eda', [
        { q: 'Why blank the impossible age (187) BEFORE filling missing ages with the median?', o: ['Otherwise 187 is included when the median is computed', 'To make the code shorter', 'fillna requires it', 'The median ignores NaN only after sorting'], a: 0, why: 'The median is robust, but a bad value still shifts it; clean first, then summarise.' },
        { gen: r => { const v = range(9).map(() => r.int(20, 60)).sort((a, b) => a - b); v.push(r.int(150, 400)); const q1 = (() => { const s = v, k = (s.length - 1) * .25, i = Math.floor(k); return s[i] + (s[i + 1] - s[i]) * (k - i); })(), q3 = (() => { const s = v, k = (s.length - 1) * .75, i = Math.floor(k); return s[i] + (s[i + 1] - s[i]) * (k - i); })(), hi = q3 + 1.5 * (q3 - q1); return { q: `Values (sorted): ${v.join(', ')}. Q1 = ${q1.toFixed(2)}, Q3 = ${q3.toFixed(2)}. What is the upper IQR fence (2 decimals)?`, correct: hi.toFixed(2), wrong: distract(hi.toFixed(2), [(q3 + (q3 - q1)).toFixed(2), (q3 + 1.5).toFixed(2), (q3 * 1.5).toFixed(2), (q1 - 1.5 * (q3 - q1)).toFixed(2)]), why: `Q3 + 1.5 x (Q3 - Q1) = ${q3.toFixed(2)} + 1.5 x ${(q3 - q1).toFixed(2)}.` }; } },
        { q: 'Dropping every row that has any missing value is a good idea when...', o: ['Very few rows are affected and the data is plentiful', 'Half the rows have gaps', 'You want to keep as much data as possible', 'The missing column is irrelevant'], a: 0, why: 'Dropping is cheap and honest when little is lost; otherwise fill (or model) the gaps.' },
        { q: 'You find an income of 910,000 among values near 55,000. First step?', o: ['Investigate: typo, different unit, or a real rich customer?', 'Delete it automatically', 'Replace it with 0', 'Ignore it'], a: 0, why: 'Remove errors, but keep and model real extremes separately.' },
      ], 'Quick check'),
      TY({ id: 'eda-t2', title: 'Typing sprint: the recipe', goal: 32, code: `df["income"] = pd.to_numeric(df["income"].str.replace(",", ""), errors="coerce")
df["city"] = df["city"].str.strip().str.title()
df = df.drop_duplicates()
df["age"] = df["age"].fillna(df["age"].median())
q1, q3 = df["income"].quantile([0.25, 0.75])
df = df[df["income"].between(q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1))]` }),
    ],
    recap: ['Order: types, text, duplicates, impossible values, fill gaps, outliers.', 'Blank bad values before computing a median; tidy text before dropping duplicates.', 'Outliers: IQR rule to FIND them, judgement to decide what to do.'],
  });

  M.lessons.push({
    id: 'matrix', title: 'Matrices in cleaning: correlation, determinant, distance', minutes: 40, blurb: 'What NumPy matrices tell you about redundant columns and unusual rows.',
    pages: [
      RD('A dataset is a matrix', `<p>Select the numeric columns and you have a matrix <b>X</b> (rows = records, columns = features). Linear algebra then answers cleaning questions:</p>
        ${UL(['<b>Correlation / covariance matrix</b> <code>np.corrcoef(X.T)</code>: which columns move together?', '<b>Determinant</b> <code>np.linalg.det(corr)</code>: the "volume" of the information in the columns. Near <b>0</b> means some column is (almost) a copy or a combination of others - redundant, and a trap for linear models.', '<b>Rank</b> <code>np.linalg.matrix_rank(X)</code>: how many truly independent columns there are', '<b>Distance</b>: how far is a row from the centre? The <b>Mahalanobis distance</b> uses the inverse covariance matrix so it respects correlations - a row can look normal on each column yet be strange as a combination'])}
        <p>Example: <code>income</code> in rupees and <code>income_k</code> in thousands carry the same information. Their correlation is 1.0, so the correlation matrix has determinant 0 and cannot be inverted: drop one.</p>`),
      VZ('Correlation as a picture: points on a line', 'dataLab', { data: 'line', algo: 'regression' }, 'Two columns that are strongly correlated sit near a straight line. Drag a point away from the line and watch R2 fall; this is the picture behind a correlation coefficient. (In the 3-D view the same idea gives a plane.)'),
      DM('Find the redundant column', `import numpy as np

rng = np.random.default_rng(1)
income = rng.normal(55, 12, 200)                 # thousands
X = np.column_stack([income, income * 1000, rng.normal(40, 8, 200), income * 0.5 + rng.normal(0, 8, 200)])
names = ["income_k", "income_rs", "age", "spend"]

corr = np.corrcoef(X.T)
print(corr.round(2))
print("determinant:", round(np.linalg.det(corr), 6), " rank:", np.linalg.matrix_rank(X))
pairs = [(names[i], names[j], round(corr[i, j], 3)) for i in range(4) for j in range(i + 1, 4) if abs(corr[i, j]) > 0.95]
print("redundant pairs:", pairs)`, 'The determinant is about 0 and the rank is 3 (not 4): one of the four columns is a copy. Drop <code>income_rs</code> and the determinant recovers.'),
      EX({
        id: 'eda-3-1', title: 'Spot the redundant column', est: 300, xp: 35,
        prompt: `<p>Compute <code>corr</code> (correlation matrix of the columns of <code>X</code>), <code>det</code> (its determinant), <code>rank</code> (matrix rank of <code>X</code>) and <code>drop</code>: the <b>index</b> of the LATER column of the one pair with |correlation| above 0.99.</p>`,
        starter: `import numpy as np

rng = np.random.default_rng(1)
a = rng.normal(55, 12, 200)
X = np.column_stack([a, rng.normal(40, 8, 200), a * 1000, rng.normal(0, 1, 200)])
corr = ...
det = ...
rank = ...
drop = ...
print(round(det, 6), rank, drop)`,
        solution: `import numpy as np

rng = np.random.default_rng(1)
a = rng.normal(55, 12, 200)
X = np.column_stack([a, rng.normal(40, 8, 200), a * 1000, rng.normal(0, 1, 200)])
corr = np.corrcoef(X.T)
det = np.linalg.det(corr)
rank = np.linalg.matrix_rank(X)
i, j = np.argwhere(np.triu(np.abs(corr) > 0.99, k=1))[0]
drop = int(j)
print(round(det, 6), rank, drop)`,
        hints: ['np.corrcoef expects variables in ROWS, so pass X.T.', 'np.triu(mask, k=1) keeps only the part above the diagonal so each pair appears once.'],
        tests: `_c = np.corrcoef(X.T)
check(corr.shape == (4, 4) and np.allclose(corr, _c), 'corr is the 4x4 correlation matrix', 'np.corrcoef(X.T)')
check(abs(det) < 1e-6 and abs(det - np.linalg.det(_c)) < 1e-9, 'the determinant is ~0: the columns are redundant', 'np.linalg.det(corr)')
check(int(rank) == 3 and drop == 2, 'rank 3 (not 4); drop column 2 (the thousand-times copy)', 'np.linalg.matrix_rank(X); the later column of the correlated pair')`,
      }),
      EX({
        id: 'eda-3-2', title: 'Distance from the centre (Mahalanobis)', est: 360, xp: 40,
        prompt: `<p>Row 0 of <code>X</code> looks ordinary on each column but breaks the correlation. Compute <code>mu</code> (column means), <code>cov</code> (covariance matrix, <code>np.cov(X.T)</code>), <code>inv</code> (its inverse) and <code>d</code>: the Mahalanobis distance of EVERY row, <code>sqrt((x - mu) @ inv @ (x - mu))</code>. <code>worst</code> = index of the largest distance.</p>`,
        starter: `import numpy as np

rng = np.random.default_rng(4)
x1 = rng.normal(0, 1, 150)
X = np.column_stack([x1, x1 + rng.normal(0, 0.15, 150)])
X[0] = [1.5, -1.5]          # fine on each column alone, but x2 should follow x1!
mu = ...
cov = ...
inv = ...
diff = X - mu
d = ...
worst = ...
print(round(d[0], 2), worst)`,
        solution: `import numpy as np

rng = np.random.default_rng(4)
x1 = rng.normal(0, 1, 150)
X = np.column_stack([x1, x1 + rng.normal(0, 0.15, 150)])
X[0] = [1.5, -1.5]          # fine on each column alone, but x2 should follow x1!
mu = X.mean(axis=0)
cov = np.cov(X.T)
inv = np.linalg.inv(cov)
diff = X - mu
d = np.sqrt(np.einsum("ij,jk,ik->i", diff, inv, diff))
worst = int(np.argmax(d))
print(round(d[0], 2), worst)`,
        hints: ['One row: np.sqrt(diff[i] @ inv @ diff[i]). For all rows at once np.einsum("ij,jk,ik->i", diff, inv, diff) does it without a loop.'],
        tests: `_mu = X.mean(axis=0); _cv = np.cov(X.T); _iv = np.linalg.inv(_cv); _df = X - _mu; _d = np.sqrt(np.einsum('ij,jk,ik->i', _df, _iv, _df))
check(np.allclose(mu, _mu) and np.allclose(cov, _cv) and np.allclose(inv, _iv), 'mu, cov and inv are right', 'X.mean(axis=0), np.cov(X.T), np.linalg.inv(cov)')
check(np.allclose(d, _d) and d.shape == (150,), 'd holds the Mahalanobis distance of every row', 'np.sqrt(einsum(...))')
check(worst == 0 and abs(X[0, 0]) < 2 and abs(X[0, 1]) < 2, 'row 0 is the biggest outlier although neither value is extreme on its own', 'np.argmax(d)')`,
      }),
      QZ('eda', [
        { q: 'A correlation matrix of your features has determinant 0.0000001. This suggests...', o: ['Some columns are nearly redundant (collinear)', 'Everything is fine', 'There are too many rows', 'The data are normally distributed'], a: 0, why: 'A near-zero determinant means the columns are almost linearly dependent; linear models become unstable.' },
        { q: 'Why can a row be an outlier for Mahalanobis distance but not for any single column?', o: ['It breaks the relationship BETWEEN columns (the correlation)', 'It has a missing value', 'It is duplicated', 'Mahalanobis ignores columns'], a: 0, why: 'The inverse covariance matrix measures distance in a way that respects how columns move together.' },
        { gen: r => { const n = r.int(3, 6), k = r.int(1, n - 1); return { q: `A table has ${n} numeric columns, but ${k} of them are exact copies or multiples of the others. What is the rank of the numeric matrix?`, correct: n - k, wrong: distract(n - k, [n, k, n + k, n - k + 1]), why: `Only ${n - k} columns are independent.` }; } },
      ], 'Quick check'),
      TY({ id: 'eda-t3', title: 'Typing sprint: matrices', goal: 30, code: `corr = np.corrcoef(X.T)
det = np.linalg.det(corr)
rank = np.linalg.matrix_rank(X)
inv = np.linalg.inv(np.cov(X.T))
d = np.sqrt(np.einsum("ij,jk,ik->i", X - mu, inv, X - mu))` }),
    ],
    recap: ['The numeric columns form a matrix; correlation, determinant and rank reveal redundancy.', 'det ~ 0 or rank < columns means a column is a copy: drop it before linear models.', 'Mahalanobis distance finds rows that are strange as combinations.'],
  });

  M.lessons.push({
    id: 'report', title: 'Show your cleaning: before and after', minutes: 30, blurb: 'A cleaning log and charts that prove the data got better.',
    pages: [
      RD('Cleaning you cannot show is cleaning nobody trusts', `<p>Keep a <b>cleaning log</b>: one line per step with how many rows/cells it touched. Show a <b>before/after</b> chart of the column that changed most. This is what a reviewer (or your future self) needs to trust your numbers. The Cleaning Lab's four panes are exactly that: table, chart, code, notes.</p>`),
      DM('A before/after figure', `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

rng = np.random.default_rng(2)
before = np.concatenate([rng.normal(55, 8, 180), rng.normal(600, 80, 6)])
q1, q3 = np.percentile(before, [25, 75]); fence = q3 + 1.5 * (q3 - q1)
after = before[before <= fence]

fig, (a, b) = plt.subplots(1, 2, figsize=(9, 3.4), sharey=True)
a.hist(before, bins=30, color="#C8323C"); a.set_title(f"before: {before.size} rows")
b.hist(after, bins=30, color="#1E8E5A"); b.set_title(f"after: {after.size} rows")
for ax in (a, b):
    ax.set_xlabel("income (thousand)")
a.set_ylabel("customers")
fig.suptitle("Outliers removed with the IQR rule")
fig.tight_layout()`, 'Same y-axis (<code>sharey=True</code>) so the two pictures are honestly comparable.'),
      EX({
        id: 'eda-4-1', title: 'Cleaning log + before/after chart', est: 360, xp: 40,
        prompt: `<p>Build <code>log</code>: a list of 3 strings describing how many rows each step removed (<code>"dropped 2 duplicates"</code>, etc. - any wording, but it must contain the correct number). Then draw before/after histograms of <code>income</code> side by side (<code>raw</code> vs <code>df</code>), titled "before" and "after" with a y label.</p>`,
        starter: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

raw = pd.DataFrame({"income": [52, 61, 58, 49, 61, 910, 55, 47, 63, 61, 58, 700]})
df = raw.drop_duplicates()
n1 = len(raw) - len(df)
q1, q3 = df["income"].quantile([0.25, 0.75])
df = df[df["income"] <= q3 + 1.5 * (q3 - q1)]
n2 = len(raw) - n1 - len(df)
log = [f"dropped {n1} duplicates", f"removed {n2} outliers", f"{len(df)} rows left"]

fig, (a, b) = plt.subplots(1, 2, figsize=(8, 3.2), sharey=True)
a.hist(raw["income"], bins=10)
a.set_title("___")
b.hist(df["income"], bins=10)
b.set_title("after")
a.set_ylabel("___")`,
        solution: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

raw = pd.DataFrame({"income": [52, 61, 58, 49, 61, 910, 55, 47, 63, 61, 58, 700]})
df = raw.drop_duplicates()
n1 = len(raw) - len(df)
q1, q3 = df["income"].quantile([0.25, 0.75])
df = df[df["income"] <= q3 + 1.5 * (q3 - q1)]
n2 = len(raw) - n1 - len(df)
log = [f"dropped {n1} duplicates", f"removed {n2} outliers", f"{len(df)} rows left"]

fig, (a, b) = plt.subplots(1, 2, figsize=(8, 3.2), sharey=True)
a.hist(raw["income"], bins=10)
a.set_title("before")
b.hist(df["income"], bins=10)
b.set_title("after")
a.set_ylabel("customers")`,
        bank: ['before', 'raw', 'customers', 'income'], hints: ['The left chart shows the data before cleaning.'],
        tests: `fig = plt.gcf(); a_, b_ = fig.axes[:2]
check(len(fig.axes) == 2 and a_.get_title() == 'before' and b_.get_title() == 'after', 'two charts titled "before" and "after"', 'a.set_title("before")')
check(a_.get_ylabel() and a_.get_ylabel() != '___', 'the y axis has a real label', 'a.set_ylabel("customers")')
check(len(log) == 3 and '3' in log[0] and '2' in log[1] and '7' in log[2], 'the log has the right counts (3 duplicates, 2 outliers, 7 left)', 'f-strings with n1, n2, len(df)')`,
      }),
      QZ('eda', [
        { q: 'Why keep a cleaning log?', o: ['So anyone can see and trust exactly what changed', 'It makes pandas faster', 'It is required by matplotlib', 'To save memory'], a: 0, why: 'Reproducibility and trust.' },
        { q: 'Why use `sharey=True` in a before/after pair of histograms?', o: ['So the two charts use the same scale and compare honestly', 'To make them colourful', 'To save space', 'It changes the data'], a: 0, why: 'Different axes can make a small change look huge or hide it.' },
      ], 'Quick check'),
      TY({ id: 'eda-t4', title: 'Typing sprint: before/after', goal: 30, code: `fig, (a, b) = plt.subplots(1, 2, sharey=True)
a.hist(raw["income"], bins=20); a.set_title("before")
b.hist(df["income"], bins=20); b.set_title("after")
a.set_ylabel("customers")
fig.tight_layout()` }),
    ],
    recap: ['Log every step with counts.', 'Show before/after charts on the same scale.', 'The table-chart-code-notes view is a cleaning report.'],
  });

  M.boss = [
    { q: 'Which is the right order of cleaning steps?', o: ['Types, text, duplicates, impossible values, fill gaps, outliers', 'Outliers, fill gaps, types, text', 'Duplicates, then everything else, then types', 'Any order gives the same result'], a: 0, why: 'Each step prepares the next one.' },
    { q: '`df.isna().sum()` returns...', o: ['Missing values per column', 'The total number of rows', 'Duplicates', 'Outliers'], a: 0, why: 'isna marks gaps; sum counts them.' },
    { gen: r => { const n = r.int(40, 400), d = r.int(2, 15), m = r.int(3, 25); return { q: `${n} rows. ${d} are exact duplicates. After dropping them, ${m} rows have a missing income and you drop those too. How many rows remain?`, correct: n - d - m, wrong: distract(n - d - m, [n - d, n - m, n - d - m + 1, n - d - m - 1]), why: `${n} - ${d} - ${m}.` }; } },
    { q: 'Which statistic is least affected by an outlier?', o: ['The median', 'The mean', 'The standard deviation', 'The maximum'], a: 0, why: 'The median depends on the middle of the sorted data, not the extremes.' },
    { q: '`pd.to_numeric(s, errors="coerce")` does what to "n/a"?', o: ['Turns it into NaN', 'Raises an error', 'Turns it into 0', 'Leaves it as text'], a: 0, why: 'coerce converts failures to NaN so you can handle them.' },
    { q: 'A determinant of a correlation matrix close to 0 means...', o: ['Redundant (collinear) columns', 'Perfectly independent columns', 'No missing data', 'Normal data'], a: 0, why: 'Almost linearly dependent columns.' },
    { q: 'You tidy text AFTER dropping duplicates. What can go wrong?', o: ['Rows that differ only by case or spaces survive as "different"', 'Nothing', 'pandas errors', 'The text gets longer'], a: 0, why: '" Pune" and "Pune" are different strings until you strip them.' },
    { q: 'The IQR rule flags a value when it is...', o: ['Below Q1 - 1.5 IQR or above Q3 + 1.5 IQR', 'More than 3 away from 0', 'The maximum', 'Missing'], a: 0, why: 'The fences are built from the middle 50% of the data.' },
  ];

  /* ============================ project ============================ */
  const REF = `_c = pd.read_csv('data/messy.csv')
_c['income'] = pd.to_numeric(_c['income'].astype(str).str.replace(',', ''), errors='coerce')
_c['city'] = _c['city'].str.strip().str.title()
_c['signup'] = pd.to_datetime(_c['signup'], format='mixed', dayfirst=True)
_c = _c.drop_duplicates()`;
  M.project = { variants: [{
    id: 'cleansweep', flagship: true, hours: 4, title: 'CleanSweep: turn a messy customer export into analysis-ready data (and prove it)',
    pitch: 'Marketing sends you a customer export: incomes typed as "52,000", dates in two formats, city names in five spellings, repeated rows, impossible ages, gaps, a few absurd incomes, and a column that is a copy of another. Audit it, fix it in the right order, use matrices to catch the redundant column, and publish a before/after report.',
    real: 'The first week of every analytics or ML job: the data-cleaning pass that precedes any dashboard or model.',
    flagship_note: 'about 700 rows (instead of ~300) and an extra milestone: Mahalanobis outliers.',
    dataset: { file: 'messy.csv', desc: 'A synthetic customer export with every classic problem. Different rows, different mistakes for every learner. Note: income arrives as text for some rows, signup dates come in two formats, and income_k is a copy of income in thousands.', columns: [['customer_id', 'id'], ['age', 'years (some missing / impossible)'], ['city', 'messy spelling'], ['income', 'text like "52,000", sometimes "n/a"'], ['income_k', 'income in thousands (a redundant copy)'], ['signup', 'YYYY-MM-DD or DD/MM/YYYY'], ['score', 'engagement score (some missing)']], gen: DS.messy },
    refs: ['Kaggle "Titanic" and "Data Cleaning Challenge" notebooks show the same steps on real data.', 'pandas docs: "Working with missing data" and "Merge, join, concatenate and compare".'],
    milestones: [
      { id: 'audit', title: 'Audit the file', xp: 30, est: 240,
        prompt: `<p>Load <code>data/messy.csv</code> into <code>df</code> and record: <code>n_rows</code>, <code>n_dupes</code> (exactly repeated rows), <code>missing</code> (missing per column), <code>worst_col</code> (most missing) and <code>text_cols</code> (list of columns with dtype object).</p>`,
        starter: `import pandas as pd
import numpy as np

df = pd.read_csv('data/messy.csv')
n_rows = ___(df)
n_dupes = int(df.___().sum())
missing = df.isna().___()
worst_col = missing.___()
text_cols = [c for c in df.columns if df[c].dtype == object]
print(n_rows, n_dupes, worst_col, text_cols)`,
        solution: `import pandas as pd
import numpy as np

df = pd.read_csv('data/messy.csv')
n_rows = len(df)
n_dupes = int(df.duplicated().sum())
missing = df.isna().sum()
worst_col = missing.idxmax()
text_cols = [c for c in df.columns if df[c].dtype == object]
print(n_rows, n_dupes, worst_col, text_cols)`,
        bank: ['len', 'duplicated', 'sum', 'idxmax', 'count', 'unique'], hints: ['The four audit calls from lesson 1.'],
        tests: `_r = pd.read_csv('data/messy.csv')
check(n_rows == len(_r) and n_dupes == int(_r.duplicated().sum()) and n_dupes > 0, 'n_rows and n_dupes are right (there are repeated rows)', 'len(df), df.duplicated().sum()')
check(missing.to_dict() == _r.isna().sum().to_dict() and worst_col == _r.isna().sum().idxmax(), 'missing and worst_col are right', 'df.isna().sum(), idxmax()')
check(sorted(text_cols) == sorted([c for c in _r.columns if _r[c].dtype == object]) and 'income' in text_cols, 'text_cols includes income (numbers stored as text!)', 'dtype == object')` },
      { id: 'fix1', title: 'Fix types, text and duplicates (in order)', xp: 40, est: 360,
        prompt: `<p>Income to numbers (remove commas, unreadable -> NaN), city tidy (strip + title), signup to real dates (<code>format="mixed", dayfirst=True</code>), THEN drop duplicates. Work on <code>df</code>.</p>`,
        starter: `df['income'] = pd.to_numeric(df['income'].astype(str).str.replace(',', ''), errors='___')
df['city'] = df['city'].str.strip().str.___()
df['signup'] = pd.to_datetime(df['signup'], format='mixed', dayfirst=True)
df = df.___()
print(df.shape, df['city'].nunique())`,
        solution: `df['income'] = pd.to_numeric(df['income'].astype(str).str.replace(',', ''), errors='coerce')
df['city'] = df['city'].str.strip().str.title()
df['signup'] = pd.to_datetime(df['signup'], format='mixed', dayfirst=True)
df = df.drop_duplicates()
print(df.shape, df['city'].nunique())`,
        bank: ['coerce', 'raise', 'title', 'upper', 'drop_duplicates', 'dropna'], hints: ['Tidy the text before dropping duplicates.'],
        tests: `${REF}
check(len(df) == len(_c), 'the same rows remain as the reference pipeline (duplicates removed AFTER tidying)', 'drop_duplicates() last')
check(df['city'].nunique() == 6 and str(df['income'].dtype).startswith('float') and str(df['signup'].dtype).startswith('datetime'), '6 clean cities, numeric income, real dates', 'str.strip().str.title(), to_numeric, to_datetime')
check(abs(df['income'].sum() - _c['income'].sum()) < 1e-6, 'income values match the reference', 'remove commas before to_numeric')` },
      { id: 'fix2', title: 'Impossible values, gaps and outliers', xp: 50, est: 480, star: true,
        prompt: `<p>Continue on <code>df</code>:</p>${UL(['blank ages outside 0-100 (set to NaN), then fill missing <code>age</code> with the median', 'fill missing <code>score</code> with its median', 'drop rows with no <code>income</code>', 'remove income outliers with the IQR rule (keep rows with income inside the fences)'])}<p>Store <code>n_after</code> (rows left) and <code>fences</code> as <code>(lo, hi)</code>. Plan it in the Logic Lab.</p>`,
        starter: `n_after = ...
fences = ...
print(n_after, fences)`,
        solution: `df.loc[~df['age'].between(0, 100), 'age'] = np.nan
df['age'] = df['age'].fillna(df['age'].median())
df['score'] = df['score'].fillna(df['score'].median())
df = df.dropna(subset=['income'])
q1, q3 = df['income'].quantile([0.25, 0.75])
iqr = q3 - q1
fences = (q1 - 1.5 * iqr, q3 + 1.5 * iqr)
df = df[df['income'].between(*fences)]
n_after = len(df)
print(n_after, fences)`,
        hints: ['Impossible ages become NaN BEFORE the median is taken.', 'between(lo, hi) is inclusive on both ends.'],
        logic: { task: 'Explain the order in which you would handle impossible ages, missing values and outliers, and why that order.', xp: 25, minWords: 16,
          rubric: [
            { id: 'bad', label: 'turn impossible values into missing first', any: ['impossible', 'invalid', 'wrong values', '187', 'negative', 'outside', 'blank', 'nan', 'set to missing', 'bad values'], hint: 'Some ages are absurd. What should happen to them before any summary is computed?', code: "df.loc[~df['age'].between(0, 100), 'age'] = np.nan" },
            { id: 'fill', label: 'then fill gaps with the median', any: ['median', 'fill', 'fillna', 'typical'], hint: 'After the bad values are gaps, what typical value can fill them without being pulled by extremes?', code: "df['age'] = df['age'].fillna(df['age'].median())\ndf['score'] = df['score'].fillna(df['score'].median())" },
            { id: 'drop', label: 'drop rows without the analysed column', any: ['drop', 'remove rows', 'dropna', 'no income', 'missing income'], hint: 'Income is what we analyse. What do you do with rows that have none?', code: "df = df.dropna(subset=['income'])" },
            { id: 'iqr', label: 'outliers last, with the IQR rule', any: ['iqr', 'quartile', 'fence', 'outlier', 'last', 'finally'], hint: 'Finally the extreme incomes: which rule builds fences from the quartiles?', code: "q1, q3 = df['income'].quantile([0.25, 0.75])\niqr = q3 - q1\nfences = (q1 - 1.5 * iqr, q3 + 1.5 * iqr)\ndf = df[df['income'].between(*fences)]\nn_after = len(df)" },
          ] },
        tests: `${REF}
_c.loc[~_c['age'].between(0, 100), 'age'] = np.nan
_c['age'] = _c['age'].fillna(_c['age'].median()); _c['score'] = _c['score'].fillna(_c['score'].median())
_c = _c.dropna(subset=['income']); _q1, _q3 = _c['income'].quantile([0.25, 0.75]); _f = (_q1 - 1.5 * (_q3 - _q1), _q3 + 1.5 * (_q3 - _q1)); _c = _c[_c['income'].between(*_f)]
check(n_after == len(_c) and len(df) == len(_c), 'n_after and df match the reference cleaning', 'impossible -> NaN, fill, dropna income, IQR')
check(abs(fences[0] - _f[0]) < 1e-6 and abs(fences[1] - _f[1]) < 1e-6, 'the fences are right', 'q1 - 1.5 * iqr, q3 + 1.5 * iqr')
check(df['age'].between(0, 100).all() and df[['age', 'income', 'score']].isna().sum().sum() == 0, 'ages are plausible and no gaps remain in age, income, score', 'order matters')` },
      { id: 'matrix', title: 'Catch the redundant column with a matrix', xp: 45, est: 420,
        prompt: `<p><code>num</code> = the DataFrame of <code>age, income, income_k, score</code>. Compute <code>corr</code> (<code>num.corr()</code>), <code>det</code> (determinant of its values) and <code>pair</code>: the two column names with |corr| above 0.99 (as a sorted list). Then drop the later one into <code>num2</code> and store <code>det2</code> (the determinant afterwards, which is now clearly above 0).</p>`,
        starter: `num = df[['age', 'income', 'income_k', 'score']]
corr = ...
det = ...
pair = ...
num2 = ...
det2 = ...
print(round(det, 6), pair, round(det2, 3))`,
        solution: `num = df[['age', 'income', 'income_k', 'score']]
corr = num.corr()
det = np.linalg.det(corr.values)
pair = sorted([a for a in corr.columns for b in corr.columns if a < b and abs(corr.loc[a, b]) > 0.99 for a in (a, b)])
pair = sorted(set(pair))
num2 = num.drop(columns=pair[-1])
det2 = np.linalg.det(num2.corr().values)
print(round(det, 6), pair, round(det2, 3))`,
        hints: ['income and income_k are the same number in different units.', 'sorted() puts "income" before "income_k", so pair[-1] is the later one.'],
        tests: `_n = df[['age', 'income', 'income_k', 'score']]; _cr = _n.corr()
check(np.allclose(corr.values, _cr.values) and abs(det - np.linalg.det(_cr.values)) < 1e-9 and abs(det) < 0.05, 'corr and det are right; det is near 0', 'num.corr(), np.linalg.det(corr.values)')
check(sorted(pair) == ['income', 'income_k'], 'the redundant pair is income and income_k', '|corr| > 0.99')
check(list(num2.columns) == ['age', 'income', 'score'] and det2 > 0.5, 'dropping income_k restores a healthy determinant', 'num.drop(columns="income_k")')` },
      { id: 'report', title: 'Publish the before/after report', xp: 40, est: 420,
        prompt: `<p>Two charts: income histogram BEFORE cleaning (<code>raw</code>, numeric only) and AFTER (<code>df</code>), same y scale, titled "before" and "after", plus a bar chart of city counts after cleaning would exceed the space - so make it a 1x3 figure: before, after, and cities (bars). Axis labels on all.</p>`,
        starter: `import matplotlib.pyplot as plt

raw = pd.read_csv('data/messy.csv')
raw['income'] = pd.to_numeric(raw['income'].astype(str).str.replace(',', ''), errors='coerce')
fig, (a, b, c) = plt.subplots(1, 3, figsize=(12, 3.6))
a.hist(raw['income'].dropna(), bins=30, color='#C8323C')
a.set_title('before')
b.hist(df['income'], bins=30, color='#1E8E5A')
b.set_title('___')
cc = df['city'].value_counts()
c.bar(cc.index, cc.values, color='#2F6FE0')
c.set_title('customers per city')
a.set_xlabel('income'); b.set_xlabel('income'); c.set_xlabel('city')
a.set_ylabel('customers'); b.set_ylabel('customers'); c.set_ylabel('customers')
c.tick_params(axis='x', rotation=30)
fig.tight_layout()`,
        solution: `import matplotlib.pyplot as plt

raw = pd.read_csv('data/messy.csv')
raw['income'] = pd.to_numeric(raw['income'].astype(str).str.replace(',', ''), errors='coerce')
fig, (a, b, c) = plt.subplots(1, 3, figsize=(12, 3.6))
a.hist(raw['income'].dropna(), bins=30, color='#C8323C')
a.set_title('before')
b.hist(df['income'], bins=30, color='#1E8E5A')
b.set_title('after')
cc = df['city'].value_counts()
c.bar(cc.index, cc.values, color='#2F6FE0')
c.set_title('customers per city')
a.set_xlabel('income'); b.set_xlabel('income'); c.set_xlabel('city')
a.set_ylabel('customers'); b.set_ylabel('customers'); c.set_ylabel('customers')
c.tick_params(axis='x', rotation=30)
fig.tight_layout()`,
        bank: ['after', 'before', 'cleaned'], hints: ['The middle chart shows the data after cleaning.'],
        tests: `fig = plt.gcf(); a_, b_, c_ = fig.axes[:3]
check(len(fig.axes) == 3 and a_.get_title() == 'before' and b_.get_title() == 'after', 'three charts; the first two are titled "before" and "after"', 'b.set_title("after")')
check(len(c_.patches) == 6 and a_.get_xlabel() and c_.get_ylabel(), 'six city bars and labelled axes', 'c.bar(cc.index, cc.values)')
check(b_.get_xlim()[1] < a_.get_xlim()[1], 'the "after" income axis is much narrower: the outliers are gone', 'compare the x ranges')` },
    ],
    flagship_ms: [
      { id: 'maha', title: 'Flagship: unusual customers by Mahalanobis distance', xp: 50, est: 480, star: true,
        prompt: `<p>On the three columns of <code>num2</code> (<code>age, income, score</code>) compute <code>d</code>: the Mahalanobis distance of every row (use <code>np.cov</code>, <code>np.linalg.inv</code> and <code>einsum</code>), <code>n_far</code>: how many rows have <code>d &gt; 3</code>, and <code>far_ids</code>: the <code>customer_id</code>s of the 3 farthest customers (largest first).</p>`,
        starter: `X = num2.to_numpy(dtype=float)
mu = X.mean(axis=0)
inv = np.linalg.inv(np.cov(X.T))
diff = X - mu
d = np.sqrt(np.einsum("ij,jk,ik->i", diff, inv, diff))
n_far = int((d > ___).sum())
far_ids = df['customer_id'].iloc[np.argsort(-d)[:___]].tolist()
print(n_far, far_ids)`,
        solution: `X = num2.to_numpy(dtype=float)
mu = X.mean(axis=0)
inv = np.linalg.inv(np.cov(X.T))
diff = X - mu
d = np.sqrt(np.einsum("ij,jk,ik->i", diff, inv, diff))
n_far = int((d > 3).sum())
far_ids = df['customer_id'].iloc[np.argsort(-d)[:3]].tolist()
print(n_far, far_ids)`,
        bank: ['3', '2', '5', '0.5'], hints: ['d > 3 is the usual rule of thumb: more than 3 "standard distances" from the centre.'],
        tests: `_X = num2.to_numpy(dtype=float); _m = _X.mean(axis=0); _iv = np.linalg.inv(np.cov(_X.T)); _df = _X - _m; _d = np.sqrt(np.einsum('ij,jk,ik->i', _df, _iv, _df))
check(np.allclose(d, _d), 'd is the Mahalanobis distance of every row', 'sqrt(einsum("ij,jk,ik->i", diff, inv, diff))')
check(n_far == int((_d > 3).sum()), 'n_far counts rows with d > 3', '(d > 3).sum()')
check(far_ids == df['customer_id'].iloc[np.argsort(-_d)[:3]].tolist(), 'far_ids are the three farthest customers', 'argsort(-d)[:3]')` },
    ],
  }] };
})();
