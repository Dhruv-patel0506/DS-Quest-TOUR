'use strict';
/* =====================================================================
   Module: pandas  (7 lessons, 14 graded exercises, generated module assessment)
   ===================================================================== */
DSQ.defModule({
  id: 'pandas', boss: [], lessons: [],
  outcomes: ['Load, inspect and clean real-world tables', 'Select rows and columns exactly (loc, iloc, masks, query)', 'Group, aggregate, pivot and merge like an analyst', 'Work with dates and turn a messy CSV into a business insight'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'pandas');
  const STU = `import pandas as pd

df = pd.DataFrame({
    "name":   ["Asha", "Ben", "Chen", "Dara", "Esha", "Farid", "Gita", "Hari"],
    "city":   ["Pune", "Delhi", "Pune", "Mumbai", "Delhi", "Mumbai", "Pune", "Delhi"],
    "age":    [21, 24, 22, 20, 23, 25, 22, 21],
    "score":  [88, 72, 95, 55, 81, 47, 69, 90],
    "passed": [True, True, True, False, True, False, True, True],
})`;

  /* ===================== L1 ===================== */
  M.lessons.push({
    id: 'frames', title: 'Series and DataFrame', minutes: 30, blurb: 'The two core objects, loading a CSV and the first-look toolkit.',
    pages: [
      RD('A DataFrame is a table with labels', `<p>pandas gives you two objects:</p>${UL(['<b>Series</b> - one labelled column (like a NumPy array with an index)', '<b>DataFrame</b> - a table: many Series sharing one row index'])}
        <p>Behind every column is a NumPy array, so everything you learned about vectorisation still applies: <code>df["price"] * 2</code> works on the whole column.</p>
        ${NOTE('', 'First look, always:', '<code>df.head()</code>, <code>df.shape</code>, <code>df.info()</code>, <code>df.describe()</code>, <code>df.dtypes</code>, <code>df.isna().sum()</code>. Do these before any analysis.')}`),
      VZ('Columns are Series', 'dfSelect', { pick: 0 }, 'Pick <code>df["name"]</code> (one column, a Series) and <code>df[["name", "score"]]</code> (a list of names, a DataFrame). The highlighted blue cells are what comes back.'),
      DM('Build one and look at it', `${STU}

print(df.head(3))
print(df.shape)
print(df.dtypes)
print(df["score"].mean(), df["score"].max())
print(df.describe())`, 'A DataFrame from a dict: keys become column names. Notice how <code>describe()</code> summarises the numeric columns.'),
      DM('Read a CSV', `import pandas as pd
import io

csv_text = """city,visits,rating
Pune,120,4.5
Delhi,200,4.1
Mumbai,310,3.9
Pune,95,4.7"""

df = pd.read_csv(io.StringIO(csv_text))      # normally: pd.read_csv("file.csv")
df.info()
print(df)
print(df["city"].value_counts())
print(df.groupby("city")["visits"].sum())`, 'In real projects you pass a file path to <code>pd.read_csv</code>. The project at the end of this module gives you a CSV file.'),
      EX({
        id: 'pd-1-1', title: 'Build and inspect', est: 120, xp: 20,
        prompt: `<p>Complete the code:</p>${UL(['<code>df</code>: a DataFrame made from <code>data</code>', '<code>n_rows</code>: the number of rows (from the shape)', '<code>avg_score</code>: mean of the score column', '<code>best</code>: the <b>name</b> of the student with the highest score (use <code>idxmax</code>)'])}`,
        starter: `import pandas as pd

data = {"name": ["Asha", "Ben", "Chen", "Dara"],
        "age": [21, 24, 22, 20],
        "score": [88, 72, 95, 55]}
df = pd.___(data)
n_rows = df.___[0]
avg_score = df["score"].___()
best = df.loc[df["score"].___(), "name"]
print(n_rows, avg_score, best)`,
        solution: `import pandas as pd

data = {"name": ["Asha", "Ben", "Chen", "Dara"],
        "age": [21, 24, 22, 20],
        "score": [88, 72, 95, 55]}
df = pd.DataFrame(data)
n_rows = df.shape[0]
avg_score = df["score"].mean()
best = df.loc[df["score"].idxmax(), "name"]
print(n_rows, avg_score, best)`,
        bank: ['DataFrame', 'Series', 'shape', 'size', 'mean', 'sum', 'idxmax', 'max'], hints: ['pd.DataFrame(dict) builds the table.', 'idxmax gives the row LABEL of the biggest value; loc then reads that row.'],
        tests: `check(isinstance(df, pd.DataFrame) and df.shape == (4, 3), 'df is a 4x3 DataFrame', 'pd.DataFrame(data)')
check(n_rows == 4, 'n_rows = 4', 'df.shape[0]')
check(abs(avg_score - 77.5) < 1e-9, 'avg_score = 77.5', 'df["score"].mean()')
check(best == 'Chen', 'best = Chen', 'df["score"].idxmax() gives the label of the max')`,
      }),
      EX({
        id: 'pd-1-2', title: 'Read and describe a CSV', est: 180, xp: 25,
        prompt: `<p>The text <code>csv_text</code> holds a small table. Read it with <code>pd.read_csv</code> (via <code>io.StringIO</code>), then:</p>${UL(['<code>df</code>: the DataFrame', '<code>numeric_cols</code>: a <b>list</b> of the numeric column names (<code>select_dtypes</code>)', '<code>busiest</code>: the city with the most total visits (groupby + sum + idxmax)'])}`,
        starter: `import pandas as pd
import io

csv_text = """city,visits,rating
Pune,120,4.5
Delhi,200,4.1
Mumbai,310,3.9
Pune,95,4.7
Delhi,150,4.3"""

df = ...
numeric_cols = ...
busiest = ...
print(numeric_cols, busiest)`,
        solution: `import pandas as pd
import io

csv_text = """city,visits,rating
Pune,120,4.5
Delhi,200,4.1
Mumbai,310,3.9
Pune,95,4.7
Delhi,150,4.3"""

df = pd.read_csv(io.StringIO(csv_text))
numeric_cols = list(df.select_dtypes("number").columns)
busiest = df.groupby("city")["visits"].sum().idxmax()
print(numeric_cols, busiest)`,
        hints: ['pd.read_csv(io.StringIO(csv_text))', 'df.select_dtypes("number").columns', 'Delhi: 200 + 150 = 350 beats Mumbai: 310.'],
        tests: `check(df.shape == (5, 3), 'df has 5 rows and 3 columns', 'pd.read_csv(io.StringIO(csv_text))')
check(list(numeric_cols) == ['visits', 'rating'], 'numeric_cols = [visits, rating]', 'df.select_dtypes("number").columns')
check(busiest == 'Delhi', 'busiest = Delhi (350 visits in total)', 'df.groupby("city")["visits"].sum().idxmax()')`,
      }),
      QZ('pandas', [
        { q: 'What does `df["score"]` return?', o: ['A Series (one column)', 'A DataFrame with one column', 'A list', 'A NumPy scalar'], a: 0, why: 'A single label gives a Series. Use double brackets `df[["score"]]` to keep a DataFrame.' },
        { q: 'Which call gives you the number of rows and columns?', o: ['df.shape', 'df.size()', 'len(df.columns)', 'df.count'], a: 0, why: 'shape is an attribute holding (rows, columns).' },
        { q: 'You want a quick statistical summary of all numeric columns. Use...', o: ['df.describe()', 'df.info()', 'df.head()', 'df.dtypes'], a: 0, why: 'describe() gives count, mean, std, min, quartiles and max.' },
        { q: 'What is the index of a DataFrame?', o: ['The row labels (0, 1, 2, ... by default)', 'The first column', 'The column names', 'A sorted copy'], a: 0, why: 'Labels for rows - they travel with the rows when you filter or sort.' },
      ], 'Quick check'),
      TY({ id: 'pd-t1', title: 'Typing sprint: first look', goal: 24, code: `df = pd.read_csv("data/trips.csv")
print(df.shape)
print(df.head())
df.info()
print(df.describe())
print(df.isna().sum())` }),
    ],
    recap: ['Series = one column, DataFrame = table; both keep labels.', 'First look: head, shape, info, describe, dtypes, isna().sum().', 'read_csv loads a file into a DataFrame.'],
  });

  /* ===================== L2 ===================== */
  M.lessons.push({
    id: 'select', title: 'Selecting rows and columns', minutes: 40, blurb: 'df[...], loc vs iloc, boolean filters, isin, query.',
    pages: [
      RD('Four ways to pick data', `${TABLE(['Tool', 'Picks by', 'Example'], [['<code>df["a"]</code>, <code>df[["a","b"]]</code>', 'column name(s)', 'columns'], ['<code>df.loc[rows, cols]</code>', '<b>labels</b> (end of a slice INCLUDED)', '<code>df.loc[1:3, "name":"score"]</code>'], ['<code>df.iloc[rows, cols]</code>', '<b>positions</b> (end EXCLUDED)', '<code>df.iloc[:3, [0, 2]]</code>'], ['<code>df[condition]</code>', 'a True/False mask', '<code>df[df["score"] &gt; 80]</code>']])}
        ${NOTE('warn', 'Remember:', '<code>loc</code> = Labels, <code>iloc</code> = Integer positions. With the default index they look similar until you slice - then loc includes the end and iloc does not.')}`),
      VZ('Try each selector', 'dfSelect', { pick: 3 }, 'Choose any selection from the list: the blue cells show exactly what that code returns.'),
      VZ('Build a filter', 'dfFilter', {}, 'Change the column, operator and value; add an AND / OR on the city. Remember to wrap each condition in brackets when you combine them with <code>&amp;</code> or <code>|</code>.'),
      DM('Selection in code', `${STU}

print(df["name"].head(3).tolist())
print(df.loc[2, "name"], df.iloc[2, 0])
print(df.loc[1:3, "city":"score"])        # labels: end INCLUDED
print(df.iloc[1:3, 1:3])                  # positions: end EXCLUDED
print(df[df["score"] > 80]["name"].tolist())
print(df[(df["city"] == "Pune") & (df["score"] > 70)])
print(df[df["city"].isin(["Pune", "Delhi"])].shape)
print(df.query("age < 23 and passed")["name"].tolist())`, 'Four equivalent ways to filter exist; <code>query</code> reads like English but only for simple conditions.'),
      EX({
        id: 'pd-2-1', title: 'Pick the right selector', est: 150, xp: 20,
        prompt: `<p>Using the student table <code>df</code>:</p>${UL(['<code>names</code>: the column of names', '<code>first_two</code>: the first two ROWS (by position)', '<code>pune</code>: all students whose city is Pune', '<code>cell</code>: the score of the row labelled 3'])}`,
        starter: `${STU}

names = df[___]
first_two = df.iloc[:___]
pune = df[df["city"] ___ "Pune"]
cell = df.loc[___, "score"]
print(names.tolist(), len(first_two), len(pune), cell)`,
        solution: `${STU}

names = df["name"]
first_two = df.iloc[:2]
pune = df[df["city"] == "Pune"]
cell = df.loc[3, "score"]
print(names.tolist(), len(first_two), len(pune), cell)`,
        bank: ['"name"', '2', '3', '==', '=', 'is', '"score"'], hints: ['A comparison (==) gives a True/False column; use it inside df[...].', 'iloc slices exclude the stop: the first two rows are :2.'],
        tests: `check(list(names) == ['Asha', 'Ben', 'Chen', 'Dara', 'Esha', 'Farid', 'Gita', 'Hari'], 'names is the name column', 'df["name"]')
check(len(first_two) == 2 and first_two.iloc[1]['name'] == 'Ben', 'first_two has the first two rows', 'df.iloc[:2]')
check(list(pune['name']) == ['Asha', 'Chen', 'Gita'], 'pune holds the 3 Pune students', 'df[df["city"] == "Pune"]')
check(cell == 55, 'cell = 55 (row label 3)', 'df.loc[3, "score"]')`,
      }),
      EX({
        id: 'pd-2-2', title: 'Compound filters', est: 240, xp: 30,
        prompt: `<ol><li><code>a</code>: students from Pune <b>and</b> with score above 70 (a DataFrame)</li><li><code>b</code>: a <b>list</b> of the names of students who are 22 or younger <b>and</b> live in Pune or Delhi (use <code>isin</code>)</li><li><code>c</code>: how many students did <b>not</b> pass (use <code>~</code>)</li></ol>`,
        starter: `${STU}

a = ...
b = ...
c = ...
print(len(a), b, c)`,
        solution: `${STU}

a = df[(df["city"] == "Pune") & (df["score"] > 70)]
b = df[(df["age"] <= 22) & df["city"].isin(["Pune", "Delhi"])]["name"].tolist()
c = (~df["passed"]).sum()
print(len(a), b, c)`,
        hints: ['Wrap each condition in brackets and join with &.', 'isin takes a list of allowed values.', '~ flips True/False; sum counts the Trues.'],
        tests: `check(isinstance(a, pd.DataFrame) and list(a['name']) == ['Asha', 'Chen'], 'a = Asha and Chen', '(df["city"] == "Pune") & (df["score"] > 70)')
check(list(b) == ['Asha', 'Chen', 'Gita', 'Hari'], 'b = Asha, Chen, Gita, Hari', 'isin(["Pune", "Delhi"]) & age <= 22')
check(int(c) == 2, 'c = 2 students failed', '(~df["passed"]).sum()')`,
      }),
      QZ('pandas', [
        { q: '`df.loc[1:3]` and `df.iloc[1:3]` on a default index return how many rows?', o: ['3 and 2', '2 and 2', '3 and 3', '2 and 3'], a: 0, why: 'loc slices by label and INCLUDES the end (1, 2, 3); iloc excludes it (1, 2).' },
        { q: 'Which expression is correct for "score above 70 and city Pune"?', o: ['df[(df.score > 70) & (df.city == "Pune")]', 'df[df.score > 70 and df.city == "Pune"]', 'df[df.score > 70 & df.city == "Pune"]', 'df[(df.score > 70) && (df.city == "Pune")]'], a: 0, why: 'Use & with brackets. `and` fails on Series and without brackets `&` binds too tightly.' },
        { gen: r => { const n = r.int(8, 15), k = r.int(2, 5); return { q: `A DataFrame has ${n} rows. \`df.iloc[:${k}]\` returns how many rows?`, correct: k, wrong: distract(k, [k + 1, k - 1, n - k, n]), why: 'iloc[:k] is the first k rows (positions 0..k-1).' }; } },
        { q: 'How do you select columns "a" and "b" as a DataFrame?', o: ['df[["a", "b"]]', 'df["a", "b"]', 'df.a.b', 'df("a", "b")'], a: 0, why: 'Pass a LIST of names, so the double brackets.' },
      ], 'Quick check'),
      TY({ id: 'pd-t2', title: 'Typing sprint: filters', goal: 26, code: `hot = df[df["temp"] > 35]
pune = df[df["city"] == "Pune"]
both = df[(df["age"] < 30) & (df["score"] >= 60)]
cols = df[["name", "score"]]
rows = df.loc[2:5, "name":"score"]` }),
    ],
    recap: ['`loc` = labels (end included), `iloc` = positions (end excluded).', 'Filters: `df[(cond1) & (cond2)]`, `isin`, `~`.', 'Single brackets give a Series, double brackets a DataFrame.'],
  });

  /* ===================== L3 ===================== */
  M.lessons.push({
    id: 'clean', title: 'Cleaning messy data', minutes: 40, blurb: 'Missing values, duplicates, wrong types, dirty text.',
    pages: [
      RD('Real data is messy', `<p>Analysts spend most of their time here. A solid cleaning pass handles:</p>${UL(['<b>Missing values</b> - find with <code>isna().sum()</code>; then <code>dropna</code>, <code>fillna</code> (mean/median/constant), or <code>ffill</code>', '<b>Duplicates</b> - <code>duplicated().sum()</code>, <code>drop_duplicates()</code>', '<b>Wrong types</b> - numbers stored as text: <code>pd.to_numeric(col, errors="coerce")</code>, dates: <code>pd.to_datetime</code>', '<b>Dirty text</b> - <code>.str.strip().str.lower()</code>, <code>.str.replace</code>', '<b>Impossible values</b> - negative ages, 999 placeholders: filter or replace with NaN'])}
        ${NOTE('', 'Rule of thumb:', 'median is safer than mean for filling skewed numbers (like prices or durations). And always check <code>shape</code> before and after each step so you know exactly how many rows you changed.')}`),
      VZ('Missing values, four remedies', 'dfNA', {}, 'Switch between finding the gaps and fixing them. Red = missing; green = filled. <code>dropna</code> loses whole rows - it is the cheapest fix and often the most wasteful.'),
      DM('A cleaning pass', `import pandas as pd
import numpy as np

df = pd.DataFrame({
    "city":  [" Pune", "delhi ", "PUNE", "Mumbai", "delhi ", "Mumbai"],
    "price": ["120", "340", "n/a", "99", "340", "99"],
    "rating": [4.5, np.nan, 4.1, np.nan, np.nan, 3.9],
})
print(df.isna().sum())
df["city"] = df["city"].str.strip().str.title()
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["rating"] = df["rating"].fillna(df["rating"].median())
df = df.drop_duplicates()
print(df)
print(df.dtypes)`, 'Follow the order: text first, then types, then missing values, then duplicates (rows only become identical once the text is tidy).'),
      EX({
        id: 'pd-3-1', title: 'Find and fix the gaps', est: 180, xp: 25,
        prompt: `<p><code>df</code> has missing ages and scores.</p>${UL(['<code>missing</code>: number of missing values per column (a Series)', '<code>no_age</code>: <code>df</code> without the rows where <b>age</b> is missing', '<code>filled</code>: <code>df</code> with the missing <b>score</b> replaced by the mean score'])}`,
        starter: `import pandas as pd
import numpy as np

df = pd.DataFrame({"name": ["A", "B", "C", "D", "E"],
                   "age": [21, np.nan, 22, 20, np.nan],
                   "score": [88, 72, np.nan, 55, 81]})
missing = df.isna().___()
no_age = df.___(subset=["age"])
filled = df.fillna({"score": df["score"].___()})
print(missing.to_dict(), len(no_age), filled["score"].tolist())`,
        solution: `import pandas as pd
import numpy as np

df = pd.DataFrame({"name": ["A", "B", "C", "D", "E"],
                   "age": [21, np.nan, 22, 20, np.nan],
                   "score": [88, 72, np.nan, 55, 81]})
missing = df.isna().sum()
no_age = df.dropna(subset=["age"])
filled = df.fillna({"score": df["score"].mean()})
print(missing.to_dict(), len(no_age), filled["score"].tolist())`,
        bank: ['sum', 'count', 'dropna', 'drop', 'mean', 'median', 'max'], hints: ['isna() gives True/False; sum() counts the Trues per column.', 'subset= limits dropna to the listed columns.'],
        tests: `check(missing.to_dict() == {'name': 0, 'age': 2, 'score': 1}, 'missing counts: age 2, score 1', 'df.isna().sum()')
check(len(no_age) == 3 and no_age['age'].notna().all(), 'no_age keeps the 3 rows with an age', 'df.dropna(subset=["age"])')
check(filled['score'].isna().sum() == 0 and abs(filled['score'][2] - 74.0) < 1e-9, 'the missing score becomes the mean (74.0)', 'df["score"].mean()')`,
      }),
      EX({
        id: 'pd-3-2', title: 'Tidy a dirty table', est: 300, xp: 35,
        prompt: `<p>Clean <code>df</code> in this order (re-assign each time):</p><ol><li>city: strip spaces and make it Title Case</li><li>price: convert to numbers; unreadable values become NaN (<code>errors="coerce"</code>)</li><li>price: fill the NaN with the <b>median</b> price</li><li>remove duplicate rows</li></ol><p>Save the final result in <code>df</code> (it should end with 3 rows).</p>`,
        starter: `import pandas as pd

df = pd.DataFrame({
    "city":  [" Pune", "delhi ", "PUNE", "Mumbai", "delhi ", "Mumbai", "Pune"],
    "price": ["120", "340", "n/a", "99", "340", "99", "120"],
})
...
print(df)`,
        solution: `import pandas as pd

df = pd.DataFrame({
    "city":  [" Pune", "delhi ", "PUNE", "Mumbai", "delhi ", "Mumbai", "Pune"],
    "price": ["120", "340", "n/a", "99", "340", "99", "120"],
})
df["city"] = df["city"].str.strip().str.title()
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["price"] = df["price"].fillna(df["price"].median())
df = df.drop_duplicates()
print(df)`,
        hints: ['Chain string methods: .str.strip().str.title()', 'median() skips NaN automatically.', 'Duplicates only appear after cleaning the text and converting types.'],
        tests: `check(sorted(df['city'].unique()) == ['Delhi', 'Mumbai', 'Pune'], 'cities are tidy: Delhi, Mumbai, Pune', '.str.strip().str.title()')
check(str(df['price'].dtype).startswith('float') and df['price'].isna().sum() == 0, 'price is numeric with no gaps', 'to_numeric(..., errors="coerce") then fillna(median)')
check(len(df) == 3, 'duplicates are removed: 3 rows remain', 'df.drop_duplicates()')`,
      }),
      QZ('pandas', [
        { gen: r => { const n = r.int(10, 20), k = r.int(2, 5), d = r.int(1, 3); return { q: `A table has ${n} rows. ${k} rows have a missing age and ${d} other rows have a missing score (different rows). How many rows does \`df.dropna()\` keep?`, correct: n - k - d, wrong: distract(n - k - d, [n - k, n - d, n - Math.max(k, d), n]), why: 'dropna() removes every row with at least one missing value: ' + k + ' + ' + d + ' rows are removed.' }; } },
        { q: 'Prices arrived as the text "12", "7", "n/a". Which call converts them to numbers and turns "n/a" into NaN?', o: ['pd.to_numeric(s, errors="coerce")', 's.astype(int)', 's.str.to_int()', 'int(s)'], a: 0, why: 'astype(int) would crash on "n/a"; errors="coerce" converts failures to NaN.' },
        { q: 'Why is the median often better than the mean for filling missing values?', o: ['It is not pulled by extreme values', 'It is always larger', 'It needs no data', 'It keeps the column an integer'], a: 0, why: 'One huge outlier can drag the mean far from a typical value; the median stays put.' },
        { q: 'When should you drop duplicate rows?', o: ['After tidying text and types', 'Before reading the file', 'Never', 'Only on numeric data'], a: 0, why: '" Pune" and "Pune" only become identical after cleaning the text.' },
      ], 'Quick check'),
      TY({ id: 'pd-t3', title: 'Typing sprint: cleaning', goal: 28, code: `df = df.drop_duplicates()
df["city"] = df["city"].str.strip().str.title()
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["rating"] = df["rating"].fillna(df["rating"].median())
df["date"] = pd.to_datetime(df["date"])` }),
    ],
    recap: ['Find gaps with isna().sum(); fix with fillna / dropna.', 'Clean text, then types, then gaps, then duplicates.', 'Median is the safe default fill for skewed numbers.'],
  });

  /* ===================== L4 ===================== */
  M.lessons.push({
    id: 'columns', title: 'New columns, apply and sorting', minutes: 35, blurb: 'Vectorised columns, np.where, apply/map, pd.cut, sort_values.',
    pages: [
      RD('Make new columns from old ones', `<p>Assign to a new column name: <code>df["total"] = df["qty"] * df["price"]</code>. Prefer <b>vectorised</b> expressions; use <code>apply</code> only when no vectorised form exists.</p>${UL(['<code>np.where(cond, a, b)</code> - two-way choice', '<code>pd.cut(col, bins, labels)</code> - turn numbers into bands (0-50, 50-70, ...)', '<code>pd.qcut(col, 4)</code> - quartiles (equal-sized groups)', '<code>col.map({"M": 1, "F": 0})</code> - recode with a dict', '<code>col.apply(func)</code> - run any function on each value (slowest)', '<code>df.sort_values(["a", "b"], ascending=[True, False])</code>'])}`),
      VZ('Sorting keeps rows together', 'dfSort', {}, 'Pick a column and order. The row labels on the left travel with their rows - that is how pandas remembers which row is which.'),
      DM('Columns in code', `${STU}
import numpy as np

df["bonus"] = df["score"] * 0.1
df["status"] = np.where(df["score"] >= 70, "good", "needs work")
df["band"] = pd.cut(df["score"], bins=[0, 50, 70, 85, 100], labels=["D", "C", "B", "A"])
df["name_len"] = df["name"].apply(len)
df["city_code"] = df["city"].map({"Pune": "PNQ", "Delhi": "DEL", "Mumbai": "BOM"})
print(df.sort_values(["city", "score"], ascending=[True, False]).head(4))
print(df["band"].value_counts().sort_index())`, 'Note how <code>pd.cut</code> labels make a category column; <code>value_counts().sort_index()</code> reports bands in order.'),
      EX({
        id: 'pd-4-1', title: 'Totals and flags', est: 180, xp: 25,
        prompt: `<p>Add columns to the order table:</p>${UL(['<code>total</code> = qty x price', '<code>big</code> = <code>"yes"</code> if total is at least 1000, else <code>"no"</code> (np.where)'])}<p>Then <code>ranked</code>: the table sorted by total, highest first.</p>`,
        starter: `import pandas as pd
import numpy as np

df = pd.DataFrame({"item": ["pen", "bag", "lamp", "desk"],
                   "qty": [10, 2, 3, 1],
                   "price": [20, 450, 300, 2500]})
df["total"] = df["qty"] ___ df["price"]
df["big"] = np.___(df["total"] >= 1000, "yes", "no")
ranked = df.sort_values("total", ascending=___)
print(ranked)`,
        solution: `import pandas as pd
import numpy as np

df = pd.DataFrame({"item": ["pen", "bag", "lamp", "desk"],
                   "qty": [10, 2, 3, 1],
                   "price": [20, 450, 300, 2500]})
df["total"] = df["qty"] * df["price"]
df["big"] = np.where(df["total"] >= 1000, "yes", "no")
ranked = df.sort_values("total", ascending=False)
print(ranked)`,
        bank: ['*', '+', 'where', 'select', 'False', 'True', 'cut'], hints: ['Highest first means ascending=False.'],
        tests: `check(df['total'].tolist() == [200, 900, 900, 2500], 'total = qty x price', 'df["qty"] * df["price"]')
check(df['big'].tolist() == ['no', 'no', 'no', 'yes'], 'big flags totals >= 1000', 'np.where(df["total"] >= 1000, "yes", "no")')
check(ranked['item'].tolist() == ['desk', 'bag', 'lamp', 'pen'] or ranked['item'].tolist() == ['desk', 'lamp', 'bag', 'pen'], 'ranked is sorted by total, highest first', 'sort_values("total", ascending=False)')`,
      }),
      EX({
        id: 'pd-4-2', title: 'Bands and lengths', est: 240, xp: 30,
        prompt: `<ol><li><code>grade</code>: a column with <code>pd.cut</code> bands on score: 0-50 D, 50-70 C, 70-85 B, 85-100 A (bins <code>[0, 50, 70, 85, 100]</code>)</li><li><code>name_len</code>: the length of each name (<code>apply</code> or <code>.str.len()</code>)</li><li><code>counts</code>: how many students in each grade (in order A, B, C, D) as a plain <b>list</b></li></ol>`,
        starter: `${STU}

df["grade"] = ...
df["name_len"] = ...
counts = ...
print(counts)`,
        solution: `${STU}

df["grade"] = pd.cut(df["score"], bins=[0, 50, 70, 85, 100], labels=["D", "C", "B", "A"])
df["name_len"] = df["name"].str.len()
counts = [int((df["grade"] == g).sum()) for g in ["A", "B", "C", "D"]]
print(counts)`,
        hints: ['labels=["D","C","B","A"] must follow the bin order (lowest band first).', '(df["grade"] == "A").sum() counts one grade.'],
        tests: `check(df['grade'].astype(str).tolist() == ['A', 'B', 'A', 'C', 'B', 'D', 'C', 'A'], 'grade bands are right', 'pd.cut(df["score"], bins=[0, 50, 70, 85, 100], labels=["D", "C", "B", "A"])')
check(df['name_len'].tolist() == [4, 3, 4, 4, 4, 5, 4, 4], 'name_len is the length of each name', 'df["name"].str.len()')
check(list(counts) == [3, 2, 2, 1], 'counts = [3, 2, 2, 1] for A, B, C, D', 'count each grade in the order A, B, C, D')`,
      }),
      QZ('pandas', [
        { q: 'Which is the fastest way to add a 10% bonus column?', o: ['df["bonus"] = df["score"] * 0.1', 'df["bonus"] = df["score"].apply(lambda x: x * 0.1)', 'a for loop over rows with iterrows()', 'df.append(...)'], a: 0, why: 'Vectorised arithmetic runs in compiled code; apply and loops run Python code per row.' },
        { q: 'pd.cut(scores, bins=[0, 50, 100]) puts a score of exactly 50 in...', o: ['(0, 50]  - the first bin', '(50, 100] - the second bin', 'neither bin', 'it raises an error'], a: 0, why: 'Bins are right-inclusive by default: (0, 50] and (50, 100].' },
        { q: 'To sort by city A-Z and, within each city, score high to low:', o: ['df.sort_values(["city", "score"], ascending=[True, False])', 'df.sort_values("city", "score")', 'df.sort(["city", "score"])', 'df.sort_values(["city", "score"], ascending=False)'], a: 0, why: 'Pass a list of columns and a matching list of booleans.' },
        { q: 'np.where(df["x"] > 0, "pos", "neg") returns...', o: ['An array with "pos" or "neg" per row', 'Only the positive rows', 'The row numbers where x > 0', 'A DataFrame'], a: 0, why: 'A vectorised if/else you can assign to a new column.' },
      ], 'Quick check'),
      TY({ id: 'pd-t4', title: 'Typing sprint: new columns', goal: 28, code: `df["total"] = df["qty"] * df["price"]
df["big"] = np.where(df["total"] >= 1000, "yes", "no")
df["band"] = pd.cut(df["score"], bins=[0, 50, 70, 100], labels=["C", "B", "A"])
ranked = df.sort_values("total", ascending=False)
print(ranked.head())` }),
    ],
    recap: ['New column = assign a vectorised expression.', 'np.where, pd.cut, map and apply cover almost every recoding.', 'sort_values accepts lists for multi-level sorting.'],
  });

  /* ===================== L5 ===================== */
  M.lessons.push({
    id: 'group', title: 'GroupBy, aggregation and pivots', minutes: 45, blurb: 'Split-apply-combine, agg with named outputs, value_counts, pivot_table, crosstab.',
    pages: [
      RD('Split, apply, combine', `<p><code>groupby</code> is the core of analysis: <b>split</b> the rows into groups, <b>apply</b> a function to each group, <b>combine</b> the answers into one table.</p>${UL(['<code>df.groupby("city")["score"].mean()</code> - one number per city', '<code>df.groupby("city").agg(avg=("score","mean"), n=("name","count"))</code> - several named results', '<code>df.groupby(["city","passed"]).size()</code> - counts per combination', '<code>df["city"].value_counts()</code> - the quick frequency table', '<code>pd.pivot_table(df, index="city", columns="passed", values="score", aggfunc="mean")</code> - a grid', '<code>pd.crosstab(df["city"], df["passed"])</code> - counts as a grid (normalize="index" for shares)'])}`),
      VZ('Watch a groupby happen', 'dfGroup', {}, 'The rows get coloured by group (split), the aggregate is computed per group (apply) and a small result table appears (combine). Try different group columns and functions.'),
      DM('GroupBy in code', `${STU}

print(df.groupby("city")["score"].mean())
print(df.groupby("city").agg(avg=("score", "mean"), best=("score", "max"), n=("name", "count")))
print(df["city"].value_counts())
print(pd.pivot_table(df, index="city", columns="passed", values="score", aggfunc="mean"))
print(pd.crosstab(df["city"], df["passed"]))
print(df.groupby("city")["score"].transform("mean").round(1).tolist())`, '<code>transform</code> returns one value per ORIGINAL row (the group mean repeated) - perfect for "compare each row with its group".'),
      EX({
        id: 'pd-5-1', title: 'Group the students', est: 180, xp: 25,
        prompt: `<ul><li><code>by_city</code>: average score per city</li><li><code>counts</code>: number of students per city (value_counts)</li><li><code>pt</code>: pivot table: rows = city, columns = passed, values = score, aggregated with the <b>max</b></li></ul>`,
        starter: `${STU}

by_city = df.groupby("city")["score"].___()
counts = df["city"].___()
pt = df.pivot_table(index="city", columns="passed", values="score", aggfunc="___")
print(by_city, counts, pt, sep=" | ")`,
        solution: `${STU}

by_city = df.groupby("city")["score"].mean()
counts = df["city"].value_counts()
pt = df.pivot_table(index="city", columns="passed", values="score", aggfunc="max")
print(by_city, counts, pt, sep=" | ")`,
        bank: ['mean', 'sum', 'value_counts', 'unique', 'max', 'min', 'count'], hints: ['groupby(...)[col].mean() gives one number per group.', 'value_counts() is the shortcut for counting categories.'],
        tests: `check(abs(by_city['Pune'] - 84.0) < 1e-9 and abs(by_city['Delhi'] - 81.0) < 1e-9, 'by_city: Pune 84.0, Delhi 81.0', 'df.groupby("city")["score"].mean()')
check(counts['Pune'] == 3 and counts['Delhi'] == 3 and counts['Mumbai'] == 2, 'counts: Pune 3, Delhi 3, Mumbai 2', 'df["city"].value_counts()')
check(pt.loc['Pune', True] == 95 and pt.loc['Mumbai', False] == 55, 'pt holds the max score per city x passed', 'aggfunc="max"')`,
      }),
      EX({
        id: 'pd-5-2', title: 'Sales summary', est: 300, xp: 35,
        prompt: `<p>From the sales table build:</p>${UL(['<code>summary</code>: a DataFrame grouped by <code>cat</code> with two named columns: <code>total</code> (sum of revenue) and <code>orders</code> (count of revenue)', '<code>top_cat</code>: the category with the largest total', '<code>share</code>: each category\'s share of overall revenue (a Series of fractions that sum to 1, named by category)'])}`,
        starter: `import pandas as pd

sales = pd.DataFrame({"cat": ["Toys", "Books", "Toys", "Games", "Books", "Toys", "Games"],
                      "revenue": [120, 80, 200, 150, 60, 40, 250]})
summary = ...
top_cat = ...
share = ...
print(summary)
print(top_cat)`,
        solution: `import pandas as pd

sales = pd.DataFrame({"cat": ["Toys", "Books", "Toys", "Games", "Books", "Toys", "Games"],
                      "revenue": [120, 80, 200, 150, 60, 40, 250]})
summary = sales.groupby("cat").agg(total=("revenue", "sum"), orders=("revenue", "count"))
top_cat = summary["total"].idxmax()
share = summary["total"] / summary["total"].sum()
print(summary)
print(top_cat)`,
        hints: ['agg(total=("revenue", "sum"), orders=("revenue", "count"))', 'idxmax on the total column gives the category name.'],
        tests: `check(list(summary.columns) == ['total', 'orders'] and summary.loc['Toys', 'total'] == 360 and summary.loc['Games', 'orders'] == 2, 'summary has total and orders per category', 'groupby("cat").agg(total=(...), orders=(...))')
check(top_cat == 'Games', 'top_cat = Games (400)', 'summary["total"].idxmax()')
check(abs(share.sum() - 1) < 1e-9 and abs(share['Games'] - 400 / 900) < 1e-9, 'share sums to 1; Games = 400/900', 'summary["total"] / summary["total"].sum()')`,
      }),
      QZ('pandas', [
        { gen: r => { const g = ['A', 'B', 'C'], rows = range(8).map(() => [r.pick(g), r.int(1, 9)]); const grp = g.map(k => { const v = rows.filter(x => x[0] === k).map(x => x[1]); return [k, v.length ? sum(v) / v.length : null]; }).filter(x => x[1] != null); const pick = r.pick(grp); const ans = +pick[1].toFixed(2); return { q: `Rows (group, value): ${rows.map(x => x[0] + ':' + x[1]).join(', ')}.\nWhat is \`df.groupby("g")["v"].mean()\` for group ${pick[0]}?`, correct: ans, wrong: distract(ans, [+(sum(rows.filter(x => x[0] === pick[0]).map(x => x[1]))).toFixed(2), +(sum(rows.map(x => x[1])) / rows.length).toFixed(2), +(ans + 1).toFixed(2), +(ans - 1).toFixed(2)]), why: `Average only the values of group ${pick[0]}: ${rows.filter(x => x[0] === pick[0]).map(x => x[1]).join(' + ')} divided by their count.` }; } },
        { q: 'What is the difference between `groupby().agg()` and `groupby().transform()`?', o: ['agg returns one row per group; transform returns one value per original row', 'They are identical', 'transform returns one row per group', 'agg only works on strings'], a: 0, why: 'transform keeps the original shape - useful for "row compared with its group average".' },
        { q: 'Which gives a frequency table of a column?', o: ['df["col"].value_counts()', 'df["col"].freq()', 'df.count("col")', 'df.groupby("col")'], a: 0, why: 'value_counts() counts each distinct value, sorted by frequency.' },
        { q: 'pivot_table(index="city", columns="passed", values="score", aggfunc="mean") gives...', o: ['A grid: one row per city, one column per passed value, mean scores inside', 'A single number', 'A list of cities', 'A series of counts'], a: 0, why: 'A pivot table is a groupby by two keys laid out as a grid.' },
      ], 'Quick check'),
      TY({ id: 'pd-t5', title: 'Typing sprint: groupby', goal: 30, code: `by_city = df.groupby("city")["score"].mean()
summary = df.groupby("cat").agg(total=("revenue", "sum"), n=("revenue", "count"))
counts = df["city"].value_counts()
pt = pd.pivot_table(df, index="city", columns="passed", values="score", aggfunc="mean")
top = summary["total"].idxmax()` }),
    ],
    recap: ['groupby = split, apply, combine.', 'agg with named outputs makes readable summary tables.', 'value_counts, pivot_table and crosstab are shortcuts for common groupbys.'],
  });

  /* ===================== L6 ===================== */
  M.lessons.push({
    id: 'merge', title: 'Combining tables', minutes: 35, blurb: 'concat, merge (inner/left/right/outer), join keys and the row-count check.',
    pages: [
      RD('Stack or match', `${UL(['<b>concat</b> stacks tables: <code>pd.concat([a, b])</code> (rows) or <code>axis=1</code> (side by side)', '<b>merge</b> matches rows by a key, like a SQL JOIN: <code>pd.merge(left, right, on="id", how="left")</code>'])}
        ${TABLE(['how', 'keeps'], [['inner', 'ids found in both tables'], ['left', 'every row of the left table (NaN where right has no match)'], ['right', 'every row of the right table'], ['outer', 'every id from either table']])}
        ${NOTE('warn', 'Always check row counts:', 'a merge on a key that repeats in both tables multiplies rows (many-to-many). Compare <code>len</code> before and after, and use <code>validate="one_to_one"</code> (or <code>"many_to_one"</code>) to make pandas raise if the assumption is wrong.')}`),
      VZ('Four joins, one picture', 'dfMerge', { how: 'inner' }, 'Change <code>how</code> and watch which rows survive. Faded rows in the source tables are dropped from the result; red NaN marks a missing match.'),
      DM('Merge in code', `import pandas as pd

students = pd.DataFrame({"id": [1, 2, 3, 4], "name": ["Asha", "Ben", "Chen", "Dara"]})
courses = pd.DataFrame({"id": [2, 3, 4, 5], "course": ["Stats", "ML", "SQL", "Viz"]})

print(pd.merge(students, courses, on="id", how="inner"))
print(pd.merge(students, courses, on="id", how="left"))
print(pd.merge(students, courses, on="id", how="outer").shape)
print(pd.concat([students, students]).shape)
print(students.merge(courses, on="id", how="left", validate="one_to_one").shape)`, 'Predict the row count of each result before you run it.'),
      EX({
        id: 'pd-6-1', title: 'Pick the join', est: 150, xp: 20,
        prompt: `<p>Fill the blanks to get: <code>inner</code> (ids in both), <code>left</code> (every customer) and <code>stacked</code> (the two customer tables on top of each other).</p>`,
        starter: `import pandas as pd

customers = pd.DataFrame({"id": [1, 2, 3, 4], "name": ["Asha", "Ben", "Chen", "Dara"]})
orders = pd.DataFrame({"id": [2, 3, 3, 9], "amount": [50, 20, 70, 99]})

inner = pd.merge(customers, orders, on="id", how="___")
left = customers.merge(orders, on="id", how="___")
stacked = pd.___([customers, customers])
print(len(inner), len(left), len(stacked))`,
        solution: `import pandas as pd

customers = pd.DataFrame({"id": [1, 2, 3, 4], "name": ["Asha", "Ben", "Chen", "Dara"]})
orders = pd.DataFrame({"id": [2, 3, 3, 9], "amount": [50, 20, 70, 99]})

inner = pd.merge(customers, orders, on="id", how="inner")
left = customers.merge(orders, on="id", how="left")
stacked = pd.concat([customers, customers])
print(len(inner), len(left), len(stacked))`,
        bank: ['inner', 'left', 'right', 'outer', 'concat', 'append', 'merge'], hints: ['Customer 3 has two orders, so it appears twice in the result.'],
        tests: `check(len(inner) == 3, 'inner has 3 rows (ids 2, 3, 3)', 'how="inner"')
check(len(left) == 5 and left['amount'].isna().sum() == 2, 'left has 5 rows with 2 missing amounts', 'how="left" keeps every customer')
check(len(stacked) == 8, 'stacked has 8 rows', 'pd.concat([a, b])')`,
      }),
      EX({
        id: 'pd-6-2', title: 'Spend per customer', est: 300, xp: 35,
        prompt: `<p>For <b>every</b> customer (even those who never ordered) compute their total spend:</p>${UL(['<code>spend</code>: a DataFrame with columns <code>name</code> and <code>amount</code> - customer name and total amount (0 for no orders)', '<code>best</code>: the name of the biggest spender'])}<p>Plan: total the orders per customer id first, then left-merge onto customers, then fill the gaps with 0.</p>`,
        starter: `import pandas as pd

customers = pd.DataFrame({"id": [1, 2, 3, 4], "name": ["Asha", "Ben", "Chen", "Dara"]})
orders = pd.DataFrame({"id": [2, 3, 3, 9], "amount": [50, 20, 70, 99]})

totals = ...
spend = ...
best = ...
print(spend)
print(best)`,
        solution: `import pandas as pd

customers = pd.DataFrame({"id": [1, 2, 3, 4], "name": ["Asha", "Ben", "Chen", "Dara"]})
orders = pd.DataFrame({"id": [2, 3, 3, 9], "amount": [50, 20, 70, 99]})

totals = orders.groupby("id", as_index=False)["amount"].sum()
spend = customers.merge(totals, on="id", how="left").fillna({"amount": 0})[["name", "amount"]]
best = spend.loc[spend["amount"].idxmax(), "name"]
print(spend)
print(best)`,
        hints: ['groupby("id", as_index=False)["amount"].sum() gives a table with id and amount.', 'A left merge leaves NaN for customers without orders; fillna({"amount": 0}).'],
        tests: `check(list(spend.columns) == ['name', 'amount'] and len(spend) == 4, 'spend has name and amount for all 4 customers', 'left merge, keep every customer')
check(spend.set_index('name')['amount'].to_dict() == {'Asha': 0, 'Ben': 50, 'Chen': 90, 'Dara': 0}, 'amounts: Asha 0, Ben 50, Chen 90, Dara 0', 'sum per id, left merge, fillna(0)')
check(best == 'Chen', 'best = Chen', 'idxmax of amount')`,
      }),
      QZ('pandas', [
        { gen: r => { const L = r.shuffle([1, 2, 3, 4, 5, 6]).slice(0, r.int(3, 5)), R = r.shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, r.int(3, 5)); const both = L.filter(x => R.includes(x)).length; if (!both) return null; const op = r.pick(['inner', 'left', 'right', 'outer']); const ans = op === 'inner' ? both : op === 'left' ? L.length : op === 'right' ? R.length : new Set([...L, ...R]).size; return { q: `Left ids: ${JSON.stringify(L)}. Right ids: ${JSON.stringify(R)} (all unique).\nHow many rows does \`how="${op}"\` give?`, correct: ans, wrong: distract(ans, [both, L.length, R.length, new Set([...L, ...R]).size, L.length + R.length, both + 1]), why: `Ids in both: ${both}. inner = ${both}, left = ${L.length}, right = ${R.length}, outer = ${new Set([...L, ...R]).size}.` }; } },
        { q: 'You merge customers (4 rows) with orders (200 rows) on id, how="left". The result has 200+ rows. Why?', o: ['Each customer appears once per order', 'pandas duplicated the customers by mistake', 'The merge failed', 'left always doubles rows'], a: 0, why: 'One-to-many merges repeat the left row for every match. That is correct, but check it.' },
        { q: 'pd.concat([a, b]) with default settings...', o: ['stacks b under a (more rows)', 'matches rows by a key', 'adds b as extra columns', 'drops duplicates'], a: 0, why: 'concat glues; merge matches. Use axis=1 for side by side.' },
        { q: 'validate="one_to_one" in merge does what?', o: ['Raises an error if a key is repeated on either side', 'Speeds up the merge', 'Drops duplicates silently', 'Changes the join to inner'], a: 0, why: 'A safety net against accidental row multiplication.' },
      ], 'Quick check'),
      TY({ id: 'pd-t6', title: 'Typing sprint: merge', goal: 30, code: `inner = pd.merge(customers, orders, on="id", how="inner")
left = customers.merge(orders, on="id", how="left")
stacked = pd.concat([a, b], ignore_index=True)
totals = orders.groupby("id", as_index=False)["amount"].sum()
spend = left.fillna({"amount": 0})` }),
    ],
    recap: ['concat stacks, merge matches on keys.', 'inner/left/right/outer decide which unmatched rows survive.', 'Check len before and after; use validate=.'],
  });

  /* ===================== L7 ===================== */
  M.lessons.push({
    id: 'dates', title: 'Dates, text and time series', minutes: 40, blurb: 'to_datetime, the .dt accessor, resample, rolling windows, .str methods.',
    pages: [
      RD('Dates are a type of their own', `<p>Convert text to real dates with <code>pd.to_datetime</code>. A datetime column unlocks the <b>.dt</b> accessor:</p>${UL(['<code>.dt.year  .dt.month  .dt.day  .dt.dayofweek  .dt.day_name()  .dt.hour</code>', '<code>df.set_index("date").resample("W")["sales"].sum()</code> - weekly totals ("D", "W", "ME" month-end, "QE")', '<code>s.rolling(7).mean()</code> - 7-day moving average (first 6 values are NaN)', '<code>s.pct_change()</code> - growth from one row to the next', '<code>s.shift(1)</code> and <code>s.diff()</code> - compare with the previous row'])}
        <p>Text columns have the same pattern with <b>.str</b>: <code>.str.lower() .str.contains("pune") .str.split(" ") .str.extract(...) .str.replace(...)</code>.</p>`),
      VZ('A moving average smooths noise', 'plotTypes', { type: 'line' }, 'A rolling mean replaces each point by the average of its neighbours, hiding day-to-day noise so the trend is visible. That is what <code>s.rolling(7).mean()</code> does for daily data.'),
      DM('Dates in code', `import pandas as pd
import numpy as np

days = pd.date_range("2026-01-01", periods=14, freq="D")
sales = pd.Series([5, 7, 6, 9, 12, 20, 18, 6, 8, 7, 10, 13, 22, 19], index=days, name="sales")
df = sales.reset_index().rename(columns={"index": "date"})

df["weekday"] = df["date"].dt.day_name()
df["is_weekend"] = df["date"].dt.dayofweek >= 5
print(df.groupby("weekday")["sales"].sum().sort_values(ascending=False).head(3))
print(sales.resample("W").sum())
print(sales.rolling(3).mean().round(2).tolist())
print(sales.pct_change().round(2).tolist()[:4])
print(pd.Series(["Pune-411", "Delhi-110"]).str.split("-").str[1].tolist())`, 'Look at how the first values of the rolling mean are NaN: a 3-day window needs 3 days of history.'),
      EX({
        id: 'pd-7-1', title: 'Weekday patterns', est: 240, xp: 30,
        prompt: `<p><code>df</code> has a text column <code>date</code> and daily <code>sales</code>.</p>${UL(['convert <code>date</code> to real datetimes (re-assign it)', '<code>df["month"]</code>: the month number', '<code>monthly</code>: total sales per month (a Series indexed by month)', '<code>best_weekday</code>: the weekday NAME (e.g. "Saturday") with the highest <b>average</b> sales'])}`,
        starter: `import pandas as pd

df = pd.DataFrame({"date": ["2026-01-29", "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-07", "2026-02-08"],
                   "sales": [10, 12, 30, 28, 9, 11, 33, 27]})
df["date"] = ...
df["month"] = ...
monthly = ...
best_weekday = ...
print(monthly.to_dict(), best_weekday)`,
        solution: `import pandas as pd

df = pd.DataFrame({"date": ["2026-01-29", "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-07", "2026-02-08"],
                   "sales": [10, 12, 30, 28, 9, 11, 33, 27]})
df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.month
monthly = df.groupby("month")["sales"].sum()
best_weekday = df.groupby(df["date"].dt.day_name())["sales"].mean().idxmax()
print(monthly.to_dict(), best_weekday)`,
        hints: ['pd.to_datetime(df["date"]) converts the whole column.', 'You can group by a computed Series: df.groupby(df["date"].dt.day_name())'],
        tests: `check(str(df['date'].dtype).startswith('datetime64'), 'date is a real datetime column', 'pd.to_datetime(df["date"])')
check(df['month'].tolist() == [1, 1, 1, 2, 2, 2, 2, 2], 'month numbers are right', 'df["date"].dt.month')
check(monthly.to_dict() == {1: 52, 2: 108}, 'monthly = {1: 52, 2: 108}', 'df.groupby("month")["sales"].sum()')
check(best_weekday == 'Saturday', 'best_weekday = Saturday', 'group by day_name, take the mean, idxmax')`,
      }),
      EX({
        id: 'pd-7-2', title: 'Smooth the trend', est: 240, xp: 30,
        prompt: `<p>The series <code>s</code> holds daily visitors.</p>${UL(['<code>roll3</code>: the 3-day moving average', '<code>growth</code>: day-over-day percentage change (<code>pct_change</code>)', '<code>weekly</code>: total visitors per week using <code>resample("W")</code>'])}`,
        starter: `import pandas as pd

idx = pd.date_range("2026-03-01", periods=14, freq="D")
s = pd.Series([100, 110, 90, 120, 130, 200, 210, 105, 115, 95, 125, 135, 205, 215], index=idx)
roll3 = s.___(3).mean()
growth = s.___()
weekly = s.___("W").sum()
print(roll3.round(1).tolist()[:4], weekly.tolist())`,
        solution: `import pandas as pd

idx = pd.date_range("2026-03-01", periods=14, freq="D")
s = pd.Series([100, 110, 90, 120, 130, 200, 210, 105, 115, 95, 125, 135, 205, 215], index=idx)
roll3 = s.rolling(3).mean()
growth = s.pct_change()
weekly = s.resample("W").sum()
print(roll3.round(1).tolist()[:4], weekly.tolist())`,
        bank: ['rolling', 'resample', 'pct_change', 'diff', 'shift', 'expanding'], hints: ['rolling(3) needs 3 days, so its first two values are NaN.'],
        tests: `check(roll3.isna().sum() == 2 and abs(roll3.iloc[2] - 100.0) < 1e-9, 'roll3 is the 3-day moving average', 's.rolling(3).mean()')
check(abs(growth.iloc[1] - 0.1) < 1e-9 and growth.isna().sum() == 1, 'growth is the day-over-day fraction', 's.pct_change()')
check(weekly.tolist() == [100, 965, 890], 'weekly totals are [100, 965, 890] (weeks end on Sunday)', 's.resample("W").sum()')`,
      }),
      QZ('pandas', [
        { gen: r => { const n = r.int(3, 6), N = r.int(10, 20); return { q: `A daily series has ${N} values. How many NaN does \`s.rolling(${n}).mean()\` contain?`, correct: n - 1, wrong: distract(n - 1, [n, n + 1, 0, N - n]), why: `A ${n}-day window needs ${n} values, so the first ${n - 1} results are NaN.` }; } },
        { q: 'Which gives the weekday name of a datetime column `d`?', o: ['d.dt.day_name()', 'd.day_name()', 'd.str.weekday()', 'd.dt.weekday_name'], a: 0, why: 'Datetime properties live under the .dt accessor.' },
        { q: 'You have daily data and want monthly totals. Use...', o: ['s.resample("ME").sum() (datetime index)', 's.rolling("ME").sum()', 's.groupby(30).sum()', 's.shift("month")'], a: 0, why: 'resample is groupby for time: it needs a datetime index (or on="date").' },
        { q: 'What does `s.pct_change()` return for [100, 110, 99]?', o: ['[NaN, 0.1, -0.1]', '[10, -11]', '[NaN, 10, -11]', '[0.1, -0.1]'], a: 0, why: 'Each value is (this - previous) / previous; the first has no previous: NaN.' },
      ], 'Quick check'),
      TY({ id: 'pd-t7', title: 'Typing sprint: dates', goal: 30, code: `df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.month
df["weekday"] = df["date"].dt.day_name()
weekly = df.set_index("date")["sales"].resample("W").sum()
roll7 = df["sales"].rolling(7).mean()` }),
    ],
    recap: ['to_datetime then .dt gives year, month, weekday, hour.', 'resample = groupby for time; rolling = moving window.', '.str does the same job for text columns.'],
  });

  /* ===================== boss ===================== */
  M.boss = [
    { q: 'Which line gives the average score per city?', o: ['df.groupby("city")["score"].mean()', 'df["city"].mean("score")', 'df.mean(by="city")', 'df.agg("city", "mean")'], a: 0, why: 'Split by city, pick the column, apply mean.' },
    { q: '`df.loc[2:4]` returns how many rows (default index)?', o: ['3', '2', '4', '1'], a: 0, why: 'loc includes the end label: 2, 3, 4.' },
    { q: 'How do you convert the text column "when" to datetimes?', o: ['df["when"] = pd.to_datetime(df["when"])', 'df["when"].astype(date)', 'df.when.to_date()', 'pd.date(df["when"])'], a: 0, why: 'pd.to_datetime parses many formats and gives a datetime64 column.' },
    { q: 'You merge two tables on "id" with how="left". Which rows are guaranteed to be kept?', o: ['Every row of the left table', 'Every row of the right table', 'Only matching rows', 'Only rows without NaN'], a: 0, why: 'left = keep all left rows; unmatched right columns become NaN.' },
    { q: 'What does `df["city"].value_counts()` return?', o: ['How many times each city appears', 'The number of unique cities', 'A sorted list of cities', 'The first city'], a: 0, why: 'A Series of frequencies, most common first.' },
    { q: 'Which cleans " PUNE " into "Pune"?', o: ['s.str.strip().str.title()', 's.strip().title()', 's.str.title.strip()', 's.replace("Pune")'], a: 0, why: 'String methods on a Series go through .str.' },
    { gen: r => { const n = r.int(12, 30), k = r.int(2, 6); return { q: `A DataFrame has ${n} rows. \`df[df["x"] > 5]\` keeps ${k} of them. What does \`(df["x"] > 5).sum()\` return?`, correct: k, wrong: distract(k, [n, n - k, k + 1, 1]), why: 'A boolean mask sums to the number of True values.' }; } },
    { gen: r => { const L = r.int(4, 8), R = r.int(4, 8), both = r.int(1, Math.min(L, R) - 1); return { q: `Left table: ${L} unique ids. Right table: ${R} unique ids. ${both} ids are in both. How many rows does an OUTER merge give?`, correct: L + R - both, wrong: distract(L + R - both, [L + R, both, Math.max(L, R), L]), why: `outer = left + right - overlap = ${L} + ${R} - ${both}.` }; } },
    { q: 'Which is the fastest way to compute price x qty for every row?', o: ['df["price"] * df["qty"]', 'df.apply(lambda r: r.price * r.qty, axis=1)', 'a for loop with iterrows()', 'df.price.map(lambda p: p)'], a: 0, why: 'Vectorised column arithmetic beats row-wise Python by 10-100x.' },
    { q: 'After `s.rolling(7).mean()`, the first 6 values are...', o: ['NaN', '0', 'the raw values', 'dropped from the Series'], a: 0, why: 'There is not yet a full 7-value window.' },
  ];
})();
