'use strict';
/* =====================================================================
   EDA and data cleaning function sheet: look, find what is wrong, fix it, then build features.
   Every group starts from a clean session with the same small messy table (shown under "The data used in this group");
   lines inside a group build on the ones above.
   ===================================================================== */
const EDA_SETUP = `import numpy as np
import pandas as pd
raw = pd.DataFrame({
    "Order ID": [101, 102, 103, 104, 104, 105, 106, 107, 108, 109, 110, 111],
    " Customer ": ["Asha ", "ravi", "ASHA", "Meera", "Meera", "Ravi", None, "Kiran", "Tara", "ravi", "Meera", "Dev"],
    "city": ["Pune", "pune", "Mumbai", "Delhi", "Delhi", "Mumbai", "Pune", "Delhi", "Mumbai", None, "Pune", "Delhi"],
    "age": ["34", "29", "N/A", "41", "41", "29", "52", "26", "38", "29", "200", "33"],
    "amount": [1200.0, 850.0, 400.0, np.nan, np.nan, 90.0, 15000.0, 640.0, 720.0, 880.0, 950.0, 510.0],
    "order_date": ["2026-01-05", "2026-01-09", "2026-02-11", "2026-02-14", "2026-02-14", "2026-03-02", "2026-03-15", "2026-04-01", "2026-04-20", "2026-05-03", "2026-05-17", "not a date"],
    "status": ["paid", "Paid", "PAID", "refunded", "refunded", "paid", "paid", "pending", "paid", "Pending", "paid", "paid"],
})`;
DSQ.defSheet('eda', {
  title: 'EDA and data cleaning: every function you will use, in order',
  intro: '<p><b>What EDA is.</b> <i>Exploratory data analysis</i> is the work you do <b>before</b> any model or chart: look at the data, find what is wrong with it, fix it, and understand what is in it. Analysts spend more time here than anywhere else, because wrong data gives confidently wrong answers.</p><p><b>The flow of this sheet.</b> (1) First look at the table. (2) Find and handle missing values. (3) Fix wrong types and messy text. (4) Remove duplicates and unify labels. (5) Spot outliers. (6) Build new columns (features). (7) Explore groups and relationships.</p><p>Every group starts with the <b>same small messy table</b> called <code>raw</code> (12 orders). Open "The data used in this group" to read it. It has typical problems: extra spaces, mixed upper/lower case, numbers stored as text, a missing amount, a duplicate row, an impossible age of 200 and a date that is not a date. The lines in each group build on each other.</p>',
  sections: [
    SEC('look', '1. The first look', '<p>Before you change anything, <i>look</i>. These calls answer: how big is it, what is in each column, what types are they, and what does a typical row look like?</p>', [
      FN('df.head(n)  df.tail(n)', 'Show the first or last n rows. The quickest way to see what the data looks like.', `df = raw.copy()
print(df.head(3))
print(df.tail(2))`, 'Always make a <b>copy</b> of the raw data before cleaning (<code>raw.copy()</code>), so you can compare with the original later.', 'scroll to the top / bottom of the sheet'),
      FN('df.shape', 'How many rows and columns: (rows, columns).', `print(df.shape)
rows, cols = df.shape
print(rows, "orders,", cols, "columns")`, 'No brackets: it is an attribute.', 'Ctrl+Down / Ctrl+Right to find the last cell'),
      FN('df.columns', 'The column names. Spot the odd ones: <code>" Customer "</code> has spaces around it, and <code>"Order ID"</code> has a space inside.', `print(list(df.columns))`, 'Names with spaces force you to write <code>df["Order ID"]</code> instead of <code>df.order_id</code>. Clean them early.', ''),
      FN('df.info()', 'A summary: each column, how many values are <b>not missing</b>, and its type. It is the best single call for spotting problems.', `df.info()`, '<code>age</code> shows type <code>object</code> (text) although it looks numeric, and some columns have fewer non-null values than rows.', ''),
      FN('df.dtypes', 'Just the types: int64 (whole numbers), float64 (decimals), object (text or mixed), datetime64 (dates), bool, category.', `print(df.dtypes)`, '', 'the format of a cell: Number / Text / Date'),
      FN('df.describe()', 'Count, mean, spread and quartiles of the <b>numeric</b> columns. Check min and max for impossible values.', `print(df.describe().round(1))`, 'It skips <code>age</code> because it is text, a clue that something is off. Add <code>include="all"</code> to see text columns too.', 'Data Analysis > Descriptive Statistics'),
      FN('df.describe(include="object")', 'For text columns: how many values, how many different ones, the most common and how often it appears.', `print(df.describe(include="object"))`, '', ''),
      FN('df["col"].value_counts()', 'How often each value appears in a column. The fastest way to see inconsistent labels.', `print(df["status"].value_counts())
print(df["city"].value_counts(dropna=False))`, '<code>dropna=False</code> also counts the missing ones. Notice "paid", "Paid" and "PAID" are counted as three different statuses.', 'a PivotTable of counts'),
      FN('df["col"].nunique()  df["col"].unique()', 'How many different values, and what they are.', `print(df["city"].nunique())
print(df["city"].unique())`, '<code>nunique()</code> skips missing values; <code>unique()</code> includes them as <code>None</code> or <code>nan</code>.', 'Remove Duplicates, then count'),
      FN('df.sample(n)', 'A few <b>random</b> rows. The top of a file is often not representative, a random sample is.', `print(df.sample(3, random_state=1))`, 'Set <code>random_state</code> so you get the same rows each time.', ''),
      FN('df.isna().sum()', 'Count the missing values in every column.', `print(df.isna().sum())
print((df.isna().mean() * 100).round(1))`, 'The second line gives the percentage missing per column. Above about 40% missing, a column is often not worth keeping.', '=COUNTBLANK(range)'),
      FN('df.duplicated().sum()', 'How many rows are an exact copy of an earlier row.', `print(df.duplicated().sum())
print(df[df.duplicated(keep=False)])`, '<code>keep=False</code> shows <i>all</i> the copies (the original too), so you can see them together.', 'Conditional Formatting > Duplicate Values'),
    ], EDA_SETUP),
    SEC('missing', '2. Missing values', '<p>Real data has holes. First find them, then decide: <b>drop</b> the row, <b>fill</b> it with a sensible value, or <b>keep</b> it and flag it. The right choice depends on why it is missing.</p>', [
      FN('df.isna()  df.notna()', 'A True/False table the same size as your data: True where a value is missing (<code>isna</code>) or present (<code>notna</code>).', `df = raw.copy()
print(df["amount"].isna())
print(df[df["amount"].isna()])`, 'Use the result inside brackets to pull out just the rows with a problem, as in the second line.', '=ISBLANK(A1)'),
      FN('df.dropna()', 'Delete every row that has <b>any</b> missing value. Simple, but you may lose a lot of data.', `print(len(df), "->", len(df.dropna()))`, 'Check how many rows you lose before you do this for real.', 'Filter and delete blank rows'),
      FN('df.dropna(subset=[...])', 'Only drop rows where <b>particular</b> columns are missing.', `d = df.dropna(subset=["amount"])
print(len(df), "->", len(d))`, 'Drop only on the columns that truly must be present, not the whole table.', ''),
      FN('df["col"].fillna(value)', 'Replace missing values with a fixed value you choose.', `df["city"] = df["city"].fillna("Unknown")
print(df["city"].value_counts())`, 'For a text column a label such as "Unknown" is honest. Do not invent a real-looking value.', 'Find & Select > Go To Special > Blanks'),
      FN('fill with the median or mean', 'For numbers, fill with a typical value. The <b>median</b> is safer when there are outliers.', `med = df["amount"].median()
df["amount_filled"] = df["amount"].fillna(med)
print(med)
print(df[["amount", "amount_filled"]].head(5))`, 'Filling with the mean or median shrinks the spread of the data a little. Keep a note of which values were filled (next item).', '=IF(ISBLANK(A1), MEDIAN(A:A), A1)'),
      FN('flag what you filled', 'Add a True/False column recording that the value was missing. The fact that it was missing can itself be informative.', `df["amount_missing"] = df["amount"].isna()
print(df["amount_missing"].sum())`, '', ''),
      FN('fill by group (transform)', 'Fill each missing value with the median of <i>its own group</i> (for example, its own city) instead of one global number. More accurate.', `df["amount_grp"] = df["amount"].fillna(df.groupby("city")["amount"].transform("median"))
print(df[["city", "amount", "amount_grp"]].head(5))`, 'If a whole group is missing, there is no median for it and the value stays missing. Fall back to the global median.', ''),
      FN('df.ffill()  df.bfill()', 'Fill a gap with the previous value (forward fill) or the next value (backward fill). For ordered data like a daily series.', `s = pd.Series([10, np.nan, np.nan, 13, np.nan])
print(s.ffill().tolist())
print(s.bfill().tolist())`, 'Only sensible when the order means something, such as time.', 'Ctrl+D (fill down)'),
      FN('Series.interpolate()', 'Fill gaps by drawing a straight line between the values on either side.', `print(s.interpolate().tolist())`, 'Good for smooth things such as temperature. Not for categories or lumpy sales.', 'Fill Series'),
      FN('df.fillna(df.median(numeric_only=True))', 'Fill every numeric column with its own median in one line.', `nums = df.select_dtypes("number")
filled = nums.fillna(nums.median())
print(filled.isna().sum().sum())`, '<code>select_dtypes</code> picks only the numeric columns first.', ''),
    ], EDA_SETUP),
    SEC('types', '3. Fix types and messy text', '<p>A column that looks like numbers may be stored as text, and "Pune", "pune " and "PUNE" are three different cities to a computer. Fix both before you count or compare anything.</p>', [
      FN('df.columns = ... / df.rename(columns=...)', 'Rename columns. Tidy names (lowercase, underscores, no spaces) make everything after this easier.', `df = raw.copy()
df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
print(list(df.columns))`, 'The three <code>.str</code> steps chain: strip the outer spaces, lowercase, then swap inner spaces for underscores.', 'rename the header cell'),
      FN('Series.str.strip()', 'Remove spaces at the start and end of text.', `df["customer"] = df["customer"].str.strip()
print(df["customer"].tolist())`, 'The invisible space in <code>"Asha "</code> would stop it matching <code>"Asha"</code>.', '=TRIM(A1)'),
      FN('Series.str.lower()  .upper()  .title()', 'Change the case. Lowercase is the safest for matching; title case ("Asha") looks nice in reports.', `df["customer"] = df["customer"].str.lower().str.title()
df["status"] = df["status"].str.lower()
print(df["customer"].unique())
print(df["status"].value_counts())`, 'Missing values stay missing; the <code>.str</code> methods skip them.', '=LOWER(A1)  =PROPER(A1)'),
      FN('Series.str.replace(old, new)', 'Replace pieces of text.', `print("Order ID".replace(" ", "_"))
df["city"] = df["city"].str.title()
print(df["city"].value_counts(dropna=False))`, '', '=SUBSTITUTE(A1, " ", "_")'),
      FN('Series.str.contains("text")', 'True when the text includes a piece. Use it to filter rows.', `print(df["customer"].str.contains("a", na=False).sum())
print(df[df["city"].str.contains("pu", na=False)])`, 'Set <code>na=False</code> or the missing values produce a NaN and your filter breaks.', '=ISNUMBER(SEARCH("pu", A1))'),
      FN('Series.str.extract(r"(pattern)")', 'Pull a piece of text out with a pattern (a regular expression). Here: just the month number from a date text.', `m = raw["order_date"].str.extract(r"-(\\d{2})-")
print(m[0].tolist())`, '<code>\\d{2}</code> means "two digits". The brackets mark the part to keep.', '=MID(A1, 6, 2)'),
      FN('pd.to_numeric(s, errors="coerce")', 'Turn text into numbers. Anything that cannot be converted becomes missing (NaN) instead of crashing.', `print(df["age"].tolist())
df["age"] = pd.to_numeric(df["age"], errors="coerce")
print(df["age"].tolist())
print(df["age"].dtype)`, '"N/A" became NaN. Without <code>errors="coerce"</code> pandas stops with an error.', '=VALUE(A1)'),
      FN('Series.astype(type)', 'Force a column to a type: <code>int</code>, <code>float</code>, <code>str</code>, <code>"category"</code>.', `d = df.copy()
d["order_id"] = d["order_id"].astype(str)
d["status"] = d["status"].astype("category")
print(d.dtypes[["order_id", "status"]])`, 'You cannot turn NaN into an integer with <code>astype(int)</code>; fill or drop first.', 'Format Cells > Text'),
      FN('pd.to_datetime(s, errors="coerce")', 'Turn date text into real dates. Then you can sort by date, take the month, or subtract dates.', `df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
print(df["order_date"].dtype)
print(df["order_date"].isna().sum(), "bad date(s)")`, 'The text "not a date" became <code>NaT</code> (not-a-time). If your dates are day-first (13/05/2026), add <code>dayfirst=True</code>.', '=DATEVALUE(A1)'),
      FN('Series.dt.month  .dt.year  .dt.day_name()', 'Pull parts out of a real date column.', `df["month"] = df["order_date"].dt.month
df["weekday"] = df["order_date"].dt.day_name()
print(df[["order_date", "month", "weekday"]].head(4))`, 'Only works once the column is a real date (previous item).', '=MONTH(A1)  =TEXT(A1,"dddd")'),
      FN('Series.map({...})', 'Translate values with a lookup dictionary. Good for fixing a handful of known spellings.', `fix = {"pune": "Pune", "mumbai": "Mumbai", "delhi": "Delhi"}
tmp = raw["city"].str.lower().map(fix)
print(tmp.value_counts(dropna=False))`, 'Values <b>not</b> in the dictionary become NaN, which tells you what you forgot. (<code>replace</code> leaves them untouched.)', '=VLOOKUP(A1, table, 2, FALSE)'),
      FN('Series.replace({...})', 'Swap values for others and leave everything else alone.', `print(df["status"].replace({"pending": "open"}).value_counts())`, '', 'Find & Replace'),
    ], EDA_SETUP),
    SEC('dupes', '4. Duplicates and consistent labels', '<p>The same order recorded twice would be counted twice in your totals. Remove exact repeats, and make sure the same thing always has the same label.</p>', [
      FN('df.duplicated(subset=[...])', 'Mark a row as a duplicate when only <b>some</b> columns repeat (for example the same order id).', `df = raw.copy()
print(df.duplicated(subset=["Order ID"]).sum())
print(df[df.duplicated(subset=["Order ID"], keep=False)])`, 'Decide which columns identify "the same thing". Here the order id.', 'Remove Duplicates (choose columns)'),
      FN('df.drop_duplicates()', 'Remove repeated rows, keeping the first one.', `clean = df.drop_duplicates()
print(len(df), "->", len(clean))`, 'It returns a new table. It does not change <code>df</code> unless you assign it back.', 'Data > Remove Duplicates'),
      FN('df.drop_duplicates(subset=[...], keep="last")', 'Keep the first or last record per key. Handy for "latest status per order".', `latest = df.drop_duplicates(subset=["Order ID"], keep="last")
print(len(latest))`, '<code>keep=False</code> would drop <i>all</i> copies, including the original.', ''),
      FN('standardise before comparing', 'Duplicates often hide behind different spelling or spacing. Clean the text first, then look for repeats.', `d = df.copy()
d[" Customer "] = d[" Customer "].str.strip().str.lower()
d["city"] = d["city"].str.lower()
print(d.duplicated(subset=[" Customer ", "city"]).sum())`, 'Cleaning the text <i>reveals</i> more duplicates: "Asha " and "ASHA" now match.', ''),
      FN('df.groupby("col").size()', 'Count the rows per group after cleaning, to check labels are now consistent.', `d["status"] = d["status"].str.lower()
print(d.groupby("status").size())`, 'A good last check: you should see one line per real category.', 'PivotTable count'),
      FN('df.reset_index(drop=True)', 'After dropping rows the row numbers have gaps. This renumbers them 0, 1, 2, ... and discards the old numbers.', `clean = clean.reset_index(drop=True)
print(clean.index.tolist())`, 'Forget <code>drop=True</code> and the old numbers become a new column.', ''),
    ], EDA_SETUP),
    SEC('outliers', '5. Outliers: values that do not fit', '<p>An outlier is a value far from the rest. Sometimes it is an error (an age of 200); sometimes it is the most interesting row (a huge order). <b>Look first, decide second.</b></p>', [
      FN('df.sort_values("col")', 'Sort and look at both ends. The quickest outlier check.', `df = raw.copy()
df["age"] = pd.to_numeric(df["age"], errors="coerce")
print(df.sort_values("amount", ascending=False)[["Order ID", "amount"]].head(3))
print(df.sort_values("age")["age"].tolist())`, 'The largest amount (15000) is far above the rest, and the age 200 is impossible.', 'Data > Sort'),
      FN('Series.quantile(q)', 'The value below which a share q (0 to 1) of the data falls.', `print(df["amount"].quantile([0.25, 0.5, 0.75]))`, 'This is the same idea as the percentile in statistics, but q is 0 to 1.', '=QUARTILE.INC()'),
      FN('the IQR rule', 'Anything more than 1.5 times the IQR (the width of the middle half) below Q1 or above Q3 is flagged as an outlier.', `q1, q3 = df["amount"].quantile([0.25, 0.75])
iqr = q3 - q1
lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
df["amount_outlier"] = (df["amount"] < lo) | (df["amount"] > hi)
print(round(lo, 1), round(hi, 1))
print(df.loc[df["amount_outlier"], ["Order ID", "amount"]])`, 'The rule only <i>flags</i>. A flagged value might still be real.', ''),
      FN('z-score rule', 'Standardise and flag values more than 3 standard deviations from the mean. Works best on bell-shaped data.', `z = (df["amount"] - df["amount"].mean()) / df["amount"].std()
print(z.round(2).tolist())
print((z.abs() > 2).sum())`, 'With few rows a single big outlier inflates the standard deviation and hides itself; the IQR rule copes better.', '=STANDARDIZE()'),
      FN('domain rules', 'Often the best rule is common sense: an age must be between 0 and 110.', `bad = (df["age"] < 0) | (df["age"] > 110)
print(df.loc[bad, ["Order ID", "age"]])
df.loc[bad, "age"] = np.nan
print(df["age"].max())`, 'Turn impossible values into missing, then handle them like any other missing value.', 'Data Validation'),
      FN('Series.clip(lower, upper)  (winsorise)', 'Instead of deleting an outlier, pull it back to a limit. This keeps the row.', `cap = df["amount"].quantile(0.95)
df["amount_capped"] = df["amount"].clip(upper=cap)
print(round(cap, 1))
print(df[["amount", "amount_capped"]].sort_values("amount", ascending=False).head(3))`, 'Capping changes your totals. Be sure that is what you want.', '=MIN(A1, cap)'),
      FN('np.log1p(x)', 'A log transform squeezes a long right tail: huge values come closer to the rest. <code>log1p</code> means log(1 + x) and copes with zeros.', `df["amount_log"] = np.log1p(df["amount"])
print(df[["amount", "amount_log"]].sort_values("amount").tail(3).round(2))`, 'Charts and models of money, prices and counts usually look better on a log scale.', '=LN(1+A1)'),
      FN('df.loc[mask]  vs  df[~mask]', 'Keep the normal rows, or look at only the suspicious ones. The tilde <code>~</code> means NOT.', `mask = df["amount_outlier"].fillna(False)
print(len(df[~mask]), "normal rows")
print(len(df[mask]), "flagged row(s)")`, 'Never delete outliers silently: write down how many you removed and why.', 'AutoFilter'),
    ], EDA_SETUP),
    SEC('features', '6. Build new columns (features)', '<p>Models and reports need columns that tell a story: a size band, a month, a yes/no flag, a ratio. Make them from what you have.</p>', [
      FN('df["new"] = df["a"] * df["b"]', 'A new column from arithmetic on others. It works on every row at once.', `df = raw.copy()
df["age"] = pd.to_numeric(df["age"], errors="coerce")
df["amount_k"] = df["amount"] / 1000
df["amount_per_year_of_age"] = df["amount"] / df["age"]
print(df[["amount", "amount_k", "amount_per_year_of_age"]].head(4).round(2))`, 'A missing value in either column gives a missing result.', '=B2/1000 copied down'),
      FN('np.where(test, a, b)', 'The spreadsheet IF: choose a if the test is true, b otherwise.', `df["big_order"] = np.where(df["amount"] >= 1000, "big", "small")
print(df["big_order"].value_counts())`, 'Missing amounts compare as False, so they land in "small". Handle missing values first.', '=IF(B2>=1000, "big", "small")'),
      FN('pd.cut(s, bins, labels)', 'Put numbers into bands you choose (age groups, price tiers).', `df["age_band"] = pd.cut(df["age"], bins=[0, 30, 40, 120], labels=["under 30", "30-39", "40+"])
print(df["age_band"].value_counts())`, 'The bins are (0, 30], (30, 40], (40, 120]: each includes its right edge.', '=LOOKUP(A1, {0,30,40}, {"under 30","30-39","40+"})'),
      FN('pd.qcut(s, q, labels)', 'Bands with <b>equal numbers of rows</b> in each (quartiles, deciles). Rank customers into top 25%, and so on.', `df["amount_q"] = pd.qcut(df["amount"], 4, labels=["Q1", "Q2", "Q3", "Q4"])
print(df["amount_q"].value_counts().sort_index())`, '<code>cut</code> picks the cut-offs, <code>qcut</code> picks them so each band has the same count.', '=PERCENTRANK.INC()'),
      FN('pd.get_dummies(df, columns=[...])', '<b>One-hot encoding</b>: turn a category into one yes/no column per value. Most models need numbers, not text.', `dummies = pd.get_dummies(df["status"].str.lower(), prefix="status")
print(dummies.head(4))`, 'In some models, drop one dummy column (<code>drop_first=True</code>) to avoid redundancy.', 'one column per category'),
      FN('df.groupby("g")["x"].transform("mean")', 'A group statistic placed back on every row. For example, how each order compares with the average of its city.', `df["city"] = df["city"].str.title()
df["city_avg"] = df.groupby("city")["amount"].transform("mean")
df["vs_city"] = df["amount"] - df["city_avg"]
print(df[["city", "amount", "city_avg", "vs_city"]].head(4).round(1))`, '<code>transform</code> keeps the table the same length; <code>agg</code> shrinks it to one row per group.', ''),
      FN('Series.rank()', 'The rank of each value (1 = smallest). <code>ascending=False</code> makes the biggest rank 1.', `df["amount_rank"] = df["amount"].rank(ascending=False)
print(df[["Order ID", "amount", "amount_rank"]].sort_values("amount_rank").head(3))`, 'Ties get the average rank unless you set <code>method="min"</code>.', '=RANK(A2, A:A)'),
      FN('(x - min) / (max - min)  (min-max scaling)', 'Squeeze a column into 0 to 1.', `a = df["amount"]
df["amount_01"] = (a - a.min()) / (a.max() - a.min())
print(df["amount_01"].round(3).head(5).tolist())`, 'One huge outlier crushes everyone else near 0. Cap or log first.', '=(A2-MIN(A:A))/(MAX(A:A)-MIN(A:A))'),
      FN('(x - mean) / std  (standardising)', 'Re-express a column as "how many standard deviations from average". Many models want this.', `df["amount_z"] = (a - a.mean()) / a.std()
print(round(df["amount_z"].mean(), 6), round(df["amount_z"].std(), 6))`, '', '=STANDARDIZE(A2, AVERAGE(A:A), STDEV.S(A:A))'),
      FN('Series.apply(function)', 'Run your own function on every value. Slower than the built-in tools, so use it only when nothing else fits.', `def tier(x):
    if pd.isna(x):
        return "unknown"
    return "high" if x > 800 else "low"
df["tier"] = df["amount"].apply(tier)
print(df["tier"].value_counts())`, 'Try <code>np.where</code>, <code>cut</code> or <code>map</code> first: they are much faster on big data.', 'a custom formula column'),
      FN('df.select_dtypes(include=...)', 'Pick columns by type: just the numbers, or just the text.', `print(list(df.select_dtypes("number").columns))
print(list(df.select_dtypes("object").columns))`, '', ''),
    ], EDA_SETUP),
    SEC('explore', '7. Explore groups and relationships', '<p>Now the data is clean, ask questions of it: who spends more, which month is busiest, do two columns move together?</p>', [
      FN('df.groupby("g")["x"].agg([...])', 'Summarise a column for every group: counts, totals, averages, all at once.', `df = raw.copy()
df["city"] = df["city"].str.title().fillna("Unknown")
df["amount"] = df["amount"].fillna(df["amount"].median())
out = df.groupby("city")["amount"].agg(["count", "sum", "mean", "median"]).round(1)
print(out)`, 'Group <i>after</i> cleaning, or "pune" and "Pune" become separate groups.', 'PivotTable'),
      FN('df.pivot_table(index, columns, values, aggfunc)', 'A table of summaries across two categories, like an Excel PivotTable.', `df["status"] = df["status"].str.lower()
pt = df.pivot_table(index="city", columns="status", values="amount", aggfunc="sum", fill_value=0)
print(pt.round(0))`, '<code>fill_value=0</code> replaces the gaps (a city with no refunded orders) with 0.', 'Insert > PivotTable'),
      FN('pd.crosstab(a, b)', 'Counts for every combination of two categories.', `print(pd.crosstab(df["city"], df["status"]))
print(pd.crosstab(df["city"], df["status"], normalize="index").round(2))`, '<code>normalize="index"</code> turns the counts into row percentages.', 'PivotTable with counts'),
      FN('df.nlargest(n, "col")  df.nsmallest(n, "col")', 'The top or bottom n rows by a column.', `print(df.nlargest(3, "amount")[["Order ID", "city", "amount"]])`, '', '=LARGE(A:A, 3)'),
      FN('df.corr(numeric_only=True)', 'How strongly the numeric columns move together (-1 to 1).', `df["age"] = pd.to_numeric(df["age"], errors="coerce")
print(df[["age", "amount"]].corr().round(2))`, 'Outliers distort correlation badly. Clean them first.', '=CORREL()'),
      FN('df.groupby(df["order_date"].dt.month)', 'Group by a part of the date to see seasonality.', `df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
print(df.groupby(df["order_date"].dt.month)["amount"].agg(["count", "sum"]))`, 'Rows with a bad date are skipped by the group.', 'PivotTable > Group by Months'),
      FN('df.sort_values(["a", "b"])', 'Sort by several columns: the first decides, the second breaks ties.', `print(df.sort_values(["city", "amount"], ascending=[True, False])[["city", "amount"]].head(5))`, 'Pass a list for <code>ascending</code> to mix directions.', 'Sort with two levels'),
      FN('assertions: check your cleaning', 'Write down what must be true and let the code fail loudly if it is not. The cheapest way to catch mistakes.', `assert df["amount"].notna().all(), "amount still has gaps"
assert df["city"].isin(["Pune", "Mumbai", "Delhi", "Unknown"]).all(), "odd city name"
assert df.duplicated(subset=["Order ID"]).sum() == 1, "expected the one known duplicate"
print("all checks passed")`, 'If a check fails, Python stops with the message you wrote. That is the point.', 'Data Validation rules'),
      FN('df.to_csv("clean.csv", index=False)', 'Save the cleaned table so the next step starts from clean data. <code>index=False</code> leaves out the row numbers.', `print(df.head(2).to_csv(index=False))`, 'Here we print the text instead of writing a file; with a file name it saves to disk (on your own machine).', 'File > Save As > CSV'),
    ], EDA_SETUP),
  ],
});
