'use strict';
/* pandas extension: loc / iloc / filters / groupby next to the SQL that does the same thing. */
(function () {
  const M = DSQ.modules.find(m => m.id === 'pandas');
  M.lessons.push({
    id: 'sqlmap', title: 'loc, iloc and SQL side by side', minutes: 40, blurb: 'Pick rows and columns exactly, and translate any SQL query into pandas.',
    pages: [
      RD('loc is by LABEL, iloc is by POSITION', `${TABLE(['', '<code>.loc[rows, cols]</code>', '<code>.iloc[rows, cols]</code>'], [['picks by', '<b>labels</b> (the index and column names)', '<b>positions</b> 0, 1, 2, ... (column positions too)'], ['slice end', '<b>included</b>: <code>df.loc[2:4]</code> = labels 2, 3, 4', '<b>excluded</b>: <code>df.iloc[2:4]</code> = positions 2, 3'], ['boolean mask', 'works: <code>df.loc[df.age &gt; 30, "name"]</code>', 'needs a plain list/array of booleans, not a Series'], ['after sorting or filtering', 'the labels travel with the rows, so <code>loc[2]</code> still finds row "2"', 'positions are counted again from 0: <code>iloc[0]</code> is the new first row'], ['setting values', '<code>df.loc[mask, "col"] = value</code> (the safe way)', '<code>df.iloc[0, 2] = value</code>']])}
        <p>Two fast cousins for single cells: <code>df.at[label, "col"]</code> and <code>df.iat[pos, pos]</code>. Never chain <code>df[mask]["col"] = value</code> - it may edit a copy (the SettingWithCopy warning); use one <code>loc</code>.</p>
        <p><b>The SQL dictionary.</b> SQL says WHAT you want; pandas says HOW, step by step - but the pieces map one to one: SELECT = choose columns, WHERE = a row mask, ORDER BY = <code>sort_values</code>, LIMIT = <code>head</code>, GROUP BY = <code>groupby</code>, HAVING = filter the grouped result, JOIN = <code>merge</code>, DISTINCT = <code>drop_duplicates</code>, IN = <code>isin</code>, BETWEEN = <code>between</code>, IS NULL = <code>isna()</code>, LIKE = <code>str.contains</code>, CASE WHEN = <code>np.where</code>.</p>`),
      VZ('See what each selector picks - and the SQL twin', 'sqlCompare', {}, 'Pick a query. The animation follows the order SQL runs a query: FROM (the whole table), then WHERE (row selector), then SELECT (column selector). Compare the index <b>label</b> column with the <b>pos</b> column: that gap is the whole difference between loc and iloc.'),
      DM('The same questions, three ways', `import pandas as pd

df = pd.DataFrame({"name": ["Asha", "Ben", "Chitra", "Dev", "Esha"],
                   "city": ["Pune", "Delhi", "Pune", "Mumbai", "Delhi"],
                   "salary": [72, 48, 66, 55, 81]}, index=[10, 20, 30, 40, 50])
print(df.loc[20:40])                  # labels 20, 30, 40 (end included)
print(df.iloc[1:3])                   # positions 1, 2 (end excluded)
print(df.loc[df["salary"] > 60, ["name", "salary"]])
print(df.query("city == 'Pune' and salary > 50"))
print(df.sort_values("salary", ascending=False).head(2))

top = df.sort_values("salary", ascending=False)
print("label 10 after sorting :", top.loc[10, "name"])
print("position 0 after sorting:", top.iloc[0]["name"])
print(df.groupby("city")["salary"].agg(["count", "mean"]))`, 'After the sort, <code>loc[10]</code> still finds Asha (labels travel with rows) but <code>iloc[0]</code> is whoever is now first (Esha, the highest salary).'),
      EX({
        id: 'pd-8-1', title: 'Label or position?', est: 240, xp: 30,
        prompt: `<p><code>a</code>: the scores of labels 20 to 40 (use <code>loc</code>). <code>b</code>: the scores at positions 1 and 2 (use <code>iloc</code>, end excluded). <code>c</code>: the same three rows as <code>a</code> but written with <code>iloc</code>. <code>d</code>: the single score of label 40.</p>`,
        starter: `import pandas as pd

df = pd.DataFrame({"name": list("ABCDE"), "score": [70, 85, 60, 90, 75]}, index=[10, 20, 30, 40, 50])
a = ...
b = ...
c = ...
d = ...
print(list(a), list(b), list(c), d)`,
        solution: `import pandas as pd

df = pd.DataFrame({"name": list("ABCDE"), "score": [70, 85, 60, 90, 75]}, index=[10, 20, 30, 40, 50])
a = df.loc[20:40, "score"]
b = df.iloc[1:3]["score"]
c = df.iloc[1:4]["score"]
d = df.loc[40, "score"]
print(list(a), list(b), list(c), d)`,
        hints: ['loc slices include the end label; iloc slices exclude the end position.', 'Labels 20, 30, 40 sit at positions 1, 2, 3.'],
        tests: `check(list(a) == [85, 60, 90], 'a = [85, 60, 90] (label slice includes 40)', 'df.loc[20:40, "score"]')
check(list(b) == [85, 60], 'b = [85, 60] (position slice excludes 3)', 'df.iloc[1:3]["score"]')
check(list(c) == [85, 60, 90], 'c selects the same rows as a, by position 1:4', 'df.iloc[1:4]["score"]')
check(int(d) == 90, 'd = 90', 'df.loc[40, "score"]')`,
      }),
      EX({
        id: 'pd-8-2', title: 'Translate SQL into pandas', est: 360, xp: 40,
        prompt: `<p>Write the pandas version of this query and store it in <code>result</code>:</p><pre class="codeblock">SELECT region, SUM(amount) AS total
FROM sales
WHERE amount &gt; 100
GROUP BY region
ORDER BY total DESC
LIMIT 2;</pre>`,
        starter: `import pandas as pd

sales = pd.DataFrame({"region": list("NNSSEEWW"), "amount": [120, 90, 200, 150, 300, 50, 110, 80]})
result = ...
print(result)`,
        solution: `import pandas as pd

sales = pd.DataFrame({"region": list("NNSSEEWW"), "amount": [120, 90, 200, 150, 300, 50, 110, 80]})
result = sales[sales["amount"] > 100].groupby("region")["amount"].sum().sort_values(ascending=False).head(2)
print(result)`,
        hints: ['Order of execution: WHERE (filter) -> GROUP BY -> SUM -> ORDER BY -> LIMIT.'],
        tests: `check(dict(result) == {'S': 350, 'E': 300}, 'S = 350 and E = 300 are the top two', 'filter, groupby, sum, sort_values, head')
check(list(result.index) == ['S', 'E'], 'in descending order: S first', 'sort_values(ascending=False)')`,
      }),
      EX({
        id: 'pd-8-3', title: 'NULLs, BETWEEN and OR', est: 300, xp: 35,
        prompt: `<p>SQL: <code>SELECT * FROM df WHERE city IS NULL OR salary BETWEEN 40 AND 60;</code> Store the matching rows in <code>picked</code>.</p>`,
        starter: `import pandas as pd

df = pd.DataFrame({"city": ["Pune", None, "Delhi", None, "Pune"], "salary": [45, 70, 30, 55, 90]})
picked = ...
print(picked)`,
        solution: `import pandas as pd

df = pd.DataFrame({"city": ["Pune", None, "Delhi", None, "Pune"], "salary": [45, 70, 30, 55, 90]})
picked = df[df["city"].isna() | df["salary"].between(40, 60)]
print(picked)`,
        hints: ['IS NULL = isna(); BETWEEN = between(lo, hi) (inclusive); OR = |.'],
        tests: `check(list(picked.index) == [0, 1, 3], 'rows 0, 1 and 3 match', 'df["city"].isna() | df["salary"].between(40, 60)')`,
      }),
      QZ('pandas', [
        { q: 'df has the index [5, 6, 7, 8]. What does df.iloc[1] return?', o: ['The row with label 6', 'The row with label 1', 'An error', 'The row with label 5'], a: 0, why: 'iloc counts positions from 0; position 1 is the second row (label 6).' },
        { gen: r => { const a = r.int(0, 3), b = r.int(a + 2, a + 6); return { q: `Rows are labelled 0, 1, 2, ... How many rows does df.loc[${a}:${b}] return?`, correct: b - a + 1, wrong: distract(b - a + 1, [b - a, b, b - a + 2, a + b]), why: 'loc includes both ends.' }; } },
        { gen: r => { const a = r.int(0, 3), b = r.int(a + 2, a + 6); return { q: `How many rows does df.iloc[${a}:${b}] return?`, correct: b - a, wrong: distract(b - a, [b - a + 1, b, b - a - 1, a + b]), why: 'iloc excludes the end position.' }; } },
        { q: 'Which pandas code is the SQL "WHERE city IN (\'Pune\', \'Delhi\')"?', o: ['df[df["city"].isin(["Pune", "Delhi"])]', 'df[df["city"] == ["Pune", "Delhi"]]', 'df.loc["Pune", "Delhi"]', 'df.iloc["Pune"]'], a: 0, why: 'isin is IN.' },
        { q: 'The SQL "ORDER BY salary DESC LIMIT 3" is...', o: ['df.sort_values("salary", ascending=False).head(3)', 'df.head(3).sort_values("salary")', 'df.iloc[3]', 'df.groupby("salary")'], a: 0, why: 'Sort first, then take the first three.' },
      ], 'Quick check'),
      TY({ id: 'pd-t8', title: 'Typing sprint: loc and iloc', goal: 30, code: `a = df.loc[20:40, "score"]
b = df.iloc[1:3]["score"]
c = df.loc[df["salary"] > 60, ["name", "salary"]]
d = df.query("city == 'Pune' and salary > 50")
e = df.sort_values("salary", ascending=False).head(2)` }),
    ],
    recap: ['loc = labels (end included); iloc = positions (end excluded).', 'Labels travel with the rows after sorting; positions restart at 0.', 'SELECT/WHERE/ORDER BY/LIMIT/GROUP BY all have a one-line pandas twin; run them in the order SQL does.'],
  });
  M.boss.push({ q: 'After df = df.sort_values("score"), which is guaranteed the same as before?', o: ['df.loc[3] - labels travel with the rows', 'df.iloc[0] - the first row', 'df.iloc[3]', 'The row positions'], a: 0, why: 'Sorting reorders rows but keeps their labels.' },
    { q: 'SQL HAVING corresponds to...', o: ['Filtering the grouped result', 'Filtering rows before grouping', 'Sorting', 'Joining'], a: 0, why: 'WHERE filters rows; HAVING filters groups.' });
})();
