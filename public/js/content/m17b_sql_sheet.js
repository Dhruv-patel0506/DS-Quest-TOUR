'use strict';
/* =====================================================================
   SQL function sheet: every keyword and function of everyday SQL, on one small shop database, in the order you meet them.
   The database lives inside the page (SQLite). q("...") runs a query and shows the answer as a table.
   ===================================================================== */
(function () {
  const BASE = `import sqlite3
import pandas as pd

con = sqlite3.connect(":memory:")
con.executescript("""
CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT, city TEXT, signup_date TEXT);
INSERT INTO customers VALUES
 (1,'Asha','Pune','2024-01-05'), (2,'Ben','Delhi','2024-01-20'), (3,'Chen','Pune','2024-02-11'),
 (4,'Dara','Mumbai','2024-02-14'), (5,'Eli','Delhi','2024-03-02'), (6,'Fay','Pune','2024-03-09');
CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT, status TEXT, amount REAL);
INSERT INTO orders VALUES
 (101,1,'2024-02-01','paid',120), (102,1,'2024-02-15','paid',80), (103,2,'2024-02-03','paid',200),
 (104,2,'2024-03-01','refunded',60), (105,3,'2024-03-05','paid',150), (106,4,'2024-03-07','paid',90),
 (107,1,'2024-03-12','paid',40), (108,3,'2024-03-20','cancelled',75), (109,5,'2024-03-22','paid',300);
""")

def q(sql):
    """Run a query and return the answer as a table."""
    return pd.read_sql(sql, con)`;
  DSQ.defSheet('sql', {
    title: 'SQL: every keyword, explained on one small shop',
    intro: '<p><b>What SQL is.</b> A database holds <b>tables</b>, like sheets in a workbook. SQL is the language for asking them questions. You do not say <i>how</i> to find the answer, only <i>what</i> you want, and the database works it out. It is the first skill analysts are asked for.</p><p><b>The database here.</b> Two tables: <code>customers</code> (6 people) and <code>orders</code> (9 orders; customer 6, Fay, never ordered). Open "The data used in this group" to read the setup. <code>q("...")</code> runs the SQL between the quotes and shows the answer as a table. Every query is built from the same few clauses, in this order: <b>SELECT</b> (which columns) <b>FROM</b> (which table) <b>WHERE</b> (which rows) <b>GROUP BY</b> (how to bundle) <b>HAVING</b> (which bundles) <b>ORDER BY</b> (how to sort) <b>LIMIT</b> (how many).</p>',
    sections: [
      SEC('ask', '1. Ask a question: SELECT, FROM, WHERE', '<p>Every query says which columns to show (SELECT), from which table (FROM), and, optionally, which rows to keep (WHERE).</p>', [
        FN('SELECT * FROM table', 'Shows every column and every row of a table. The star means "all columns". A good first look at any table.', 'q("SELECT * FROM customers")', 'On a huge table add <code>LIMIT 10</code>.', 'opening a sheet', [['SELECT', 'show me...'], ['*', 'all columns'], ['FROM customers', 'taken from the table named customers']]),
        FN('SELECT col1, col2 FROM table', 'Shows only the columns you name, in the order you name them.', 'q("SELECT name, city FROM customers")', 'SQL keywords are not case-sensitive, but writing them in capitals makes queries easier to read.', 'hiding columns'),
        FN('WHERE condition', 'Keeps only the rows that pass a test. Text goes in single quotes.', 'q("SELECT * FROM orders WHERE status = \'paid\'")', 'One equals sign compares in SQL (unlike Python). Text needs single quotes: <code>\'paid\'</code>.', 'AutoFilter'),
        FN('>   <   >=   <=   <>', 'Comparisons: bigger, smaller, at least, at most, not equal.', 'q("SELECT order_id, amount FROM orders WHERE amount >= 150")', '<code><></code> means "not equal" (<code>!=</code> works too).', '=B2>=150'),
        FN('AND   OR   NOT', 'Combine tests. AND needs both, OR needs either, NOT flips. Use brackets when mixing.', 'q("SELECT * FROM orders WHERE status = \'paid\' AND amount > 100")', 'AND is applied before OR; add brackets to make your intention clear.', 'AutoFilter on two columns'),
        FN('IN (...)', 'Is the value one of this list?', 'q("SELECT name, city FROM customers WHERE city IN (\'Pune\', \'Delhi\')")', 'Shorter than writing <code>city = \'Pune\' OR city = \'Delhi\'</code>.', '=OR(A1="Pune", A1="Delhi")'),
        FN('BETWEEN a AND b', 'Is the value between two limits, both included?', 'q("SELECT * FROM orders WHERE order_date BETWEEN \'2024-03-01\' AND \'2024-03-10\'")', 'Dates written as <code>YYYY-MM-DD</code> text sort and compare correctly.', '=AND(x>=a, x<=b)'),
        FN('LIKE \'pattern\'', 'Match text patterns. <code>%</code> means any characters; <code>_</code> means exactly one.', 'q("SELECT name FROM customers WHERE name LIKE \'%a\'")', 'In SQLite LIKE ignores capitals; in other databases it may not.', 'Text Filters > Ends with'),
        FN('IS NULL   IS NOT NULL', 'NULL means "no value". You cannot test it with an equals sign: use IS NULL.', 'q("SELECT * FROM orders WHERE amount IS NOT NULL LIMIT 3")', '<code>amount = NULL</code> never matches anything.', 'blank cells'),
        FN('ORDER BY col DESC', 'Sorts the answer. ASC (smallest first) is the default; DESC puts the largest first.', 'q("SELECT order_id, amount FROM orders ORDER BY amount DESC")', 'Sort by several columns by separating them with commas.', 'Sort Z to A'),
        FN('LIMIT n', 'Keeps only the first n rows. With a sort it gives "the top 3".', 'q("SELECT order_id, amount FROM orders ORDER BY amount DESC LIMIT 3")', 'Without ORDER BY the "first" rows are arbitrary.', 'Top 10 filter'),
        FN('SELECT DISTINCT col', 'Removes duplicate rows from the answer: the list of different values.', 'q("SELECT DISTINCT city FROM customers")', '', 'Remove Duplicates'),
        FN('col AS new_name', 'Gives a column (or a calculation) a friendlier name in the answer.', 'q("SELECT name AS customer, city AS home FROM customers LIMIT 3")', '', 'a header label'),
        FN('calculations in SELECT', 'Columns can be calculated: plus, minus, times, divide.', 'q("SELECT order_id, amount, amount * 0.18 AS gst, amount * 1.18 AS total FROM orders LIMIT 4")', 'Whole-number division drops decimals in some databases: <code>7 / 2</code> can be 3. Multiply by 1.0 to be safe.', '=B2*0.18 filled down'),
      ], BASE),
      SEC('sum', '2. Summarise: COUNT, SUM, AVG and GROUP BY', '<p>A summary turns many rows into one number, or one number per group. <b>GROUP BY</b> is the SQL pivot table.</p>', [
        FN('COUNT(*)', 'How many rows.', 'q("SELECT COUNT(*) AS orders FROM orders")', '<code>COUNT(col)</code> counts only rows where that column is not NULL.', '=COUNTA()'),
        FN('SUM(col)   AVG(col)   MIN(col)   MAX(col)', 'Total, average, smallest, largest of a column.', 'q("SELECT SUM(amount) AS total, AVG(amount) AS average, MIN(amount) AS smallest, MAX(amount) AS largest FROM orders")', 'These skip NULLs.', '=SUM() =AVERAGE() =MIN() =MAX()'),
        FN('ROUND(x, n)', 'Rounds a number to n decimals.', 'q("SELECT ROUND(AVG(amount), 2) AS average FROM orders")', '', '=ROUND()'),
        FN('GROUP BY col', 'Bundle rows that share a value, then summarise each bundle. Read it as "for each city, ..." .', 'q("SELECT city, COUNT(*) AS customers FROM customers GROUP BY city")', 'Every column in SELECT must either be in GROUP BY or inside a summary like COUNT or SUM.', 'a PivotTable', [['SELECT city', 'show the city'], ['COUNT(*) AS customers', 'and how many rows are in each bundle'], ['GROUP BY city', 'one bundle per city']]),
        FN('GROUP BY with SUM', 'The most common analyst query: total per group.', 'q("SELECT customer_id, SUM(amount) AS spent, COUNT(*) AS orders FROM orders WHERE status = \'paid\' GROUP BY customer_id ORDER BY spent DESC")', 'WHERE filters rows <i>before</i> they are bundled.', '=SUMIF(range, key, sum_range)'),
        FN('HAVING condition', 'Filters the <b>bundles</b> after summarising (WHERE cannot, because it runs earlier).', 'q("SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id HAVING COUNT(*) >= 2")', 'WHERE is for rows, HAVING is for groups.', 'filtering a PivotTable'),
        FN('COUNT(DISTINCT col)', 'How many different values.', 'q("SELECT COUNT(DISTINCT customer_id) AS buyers FROM orders")', '', '=SUMPRODUCT(1/COUNTIF(...))'),
        FN('GROUP BY two columns', 'One bundle for each combination.', 'q("SELECT status, strftime(\'%Y-%m\', order_date) AS month, COUNT(*) AS orders, SUM(amount) AS amount FROM orders GROUP BY status, month ORDER BY month, status")', 'The alias <code>month</code> can be used in GROUP BY in SQLite.', 'a PivotTable with row and column fields'),
        FN('CASE WHEN ... THEN ... ELSE ... END', 'An IF inside SQL: choose a value depending on a test. Combine with SUM to count things that meet a test.', 'q("SELECT SUM(CASE WHEN status = \'paid\' THEN amount ELSE 0 END) AS paid_total, SUM(CASE WHEN status <> \'paid\' THEN 1 ELSE 0 END) AS problem_orders FROM orders")', 'Every CASE ends with END.', '=SUMIF() / =IF()'),
      ], BASE),
      SEC('join', '3. Join tables: JOIN ... ON', '<p>Data is split over tables. A <b>JOIN</b> glues them side by side on a shared column (here <code>customer_id</code>).</p>', [
        FN('INNER JOIN ... ON', 'Keeps only rows that have a match in <b>both</b> tables. Name each table\'s column as <code>table.column</code>, and give tables short aliases.', 'q("SELECT o.order_id, c.name, o.amount FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = \'paid\' ORDER BY o.order_id")', 'JOIN and INNER JOIN are the same. Forgetting <code>ON</code> multiplies every row by every row.', '=VLOOKUP() filled down', [['orders o', 'the orders table, nicknamed o'], ['JOIN customers c', 'glue the customers table, nicknamed c'], ['ON c.customer_id = o.customer_id', 'match rows where the ids are equal']]),
        FN('LEFT JOIN', 'Keeps <b>every row of the left table</b>, with NULLs where the right table has no match. Use it when "no match" is a result you want to see.', 'q("SELECT c.name, o.order_id, o.amount FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id ORDER BY c.name")', 'Fay has no orders, so her order columns are empty.', 'VLOOKUP that keeps unmatched rows'),
        FN('LEFT JOIN ... WHERE right.id IS NULL', 'Rows with <b>no match</b>: "customers who never ordered".', 'q("SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL")', 'The classic "who is missing?" query.', '=COUNTIF(orders, name)=0'),
        FN('JOIN with GROUP BY', 'Join first, then summarise: revenue per customer name.', 'q("SELECT c.name, COUNT(o.order_id) AS orders, COALESCE(SUM(o.amount), 0) AS spent FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = \'paid\' GROUP BY c.name ORDER BY spent DESC")', 'Putting the status test inside <code>ON</code> keeps customers with no paid orders in the answer.', 'a PivotTable on joined data'),
        FN('COALESCE(a, b)', 'The first value that is not NULL: a safe default.', 'q("SELECT c.name, COALESCE(SUM(o.amount), 0) AS spent FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.name")', '', '=IFNA(x, 0)'),
      ], BASE),
      SEC('funcs', '4. Text, dates and conditions', '<p>Functions that reshape values inside a query.</p>', [
        FN('UPPER(text)   LOWER(text)   LENGTH(text)', 'Change case; count letters.', 'q("SELECT name, UPPER(name) AS shout, LENGTH(name) AS letters FROM customers")', '', '=UPPER() =LOWER() =LEN()'),
        FN('SUBSTR(text, start, length)', 'Cuts a piece of text. The first letter is position 1 (not 0).', 'q("SELECT name, SUBSTR(name, 1, 2) AS first_two FROM customers")', 'SQL counts from 1, Python from 0.', '=MID(text, 1, 2)'),
        FN('text || text', 'Joins text together.', 'q("SELECT name || \' from \' || city AS label FROM customers")', 'Some databases use <code>CONCAT()</code> instead.', '=A1&" from "&B1'),
        FN('strftime(format, date)', 'Pulls parts out of a date: <code>%Y</code> year, <code>%m</code> month, <code>%d</code> day, <code>%w</code> weekday.', 'q("SELECT order_id, strftime(\'%Y-%m\', order_date) AS month, strftime(\'%w\', order_date) AS weekday FROM orders LIMIT 4")', 'Function names differ between databases (SQLite: strftime; others: DATE_TRUNC, EXTRACT).', '=TEXT(date, "yyyy-mm")'),
        FN('julianday(a) - julianday(b)', 'Days between two dates.', 'q("SELECT name, signup_date, CAST(julianday(\'2024-04-01\') - julianday(signup_date) AS INTEGER) AS days_since_signup FROM customers")', '', '=DATEDIF() or =B2-A2'),
        FN('CAST(x AS type)', 'Converts to another type: INTEGER, REAL (decimal), TEXT.', 'q("SELECT amount, CAST(amount AS INTEGER) AS whole, CAST(amount AS TEXT) AS as_text FROM orders LIMIT 3")', '', 'Format Cells'),
        FN('CASE WHEN (a column of labels)', 'Turn numbers into named bands.', 'q("SELECT order_id, amount, CASE WHEN amount >= 150 THEN \'large\' WHEN amount >= 80 THEN \'medium\' ELSE \'small\' END AS size FROM orders")', 'Tests are checked in order; the first true one wins.', '=IFS()'),
        FN('ABS   ROUND   MAX(a, b)', 'Row-level maths: absolute value, rounding, and the larger of two values.', 'q("SELECT amount, ROUND(amount / 7, 2) AS weekly, MAX(amount, 100) AS at_least_100 FROM orders LIMIT 3")', 'With two arguments, <code>MAX</code> / <code>MIN</code> compare the values on one row; with one column they summarise.', ''),
      ], BASE),
      SEC('steps', '5. Break a question into steps: subqueries, CTEs, windows', '<p>When one query is not enough, nest a query inside another, or name the steps with <b>WITH</b>.</p>', [
        FN('subquery in WHERE', 'A query inside brackets whose answer feeds the outer one: "orders bigger than the average".', 'q("SELECT order_id, amount FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)")', '', 'a helper cell holding the average'),
        FN('IN (SELECT ...)', 'The inner query makes a list; the outer one keeps rows that match it.', 'q("SELECT name FROM customers WHERE customer_id IN (SELECT customer_id FROM orders WHERE amount > 150)")', '', ''),
        FN('WITH name AS ( ... )   (a CTE)', 'Name an intermediate result and use it like a table: queries read top to bottom like a recipe.', 'q("WITH spend AS (SELECT customer_id, SUM(amount) AS total FROM orders WHERE status = \'paid\' GROUP BY customer_id) SELECT c.name, s.total FROM spend s JOIN customers c ON c.customer_id = s.customer_id WHERE s.total > 150 ORDER BY s.total DESC")', 'Easier to read and debug than a deep nest of brackets.', 'a helper sheet', [['WITH spend AS (...)', 'make a temporary table called spend'], ['FROM spend s', 'use it like any table']]),
        FN('ROW_NUMBER() OVER (ORDER BY ...)', 'A <b>window function</b>: a calculation across rows without collapsing them. ROW_NUMBER numbers the rows in a chosen order.', 'q("SELECT order_id, amount, ROW_NUMBER() OVER (ORDER BY amount DESC) AS rank_no FROM orders")', 'Window functions keep every row; GROUP BY would have collapsed them.', '=RANK() filled down'),
        FN('RANK() OVER (PARTITION BY ... ORDER BY ...)', 'Rank <b>within each group</b>: PARTITION BY restarts the count for each customer (or city, or month).', 'q("SELECT customer_id, order_id, amount, RANK() OVER (PARTITION BY customer_id ORDER BY amount DESC) AS rank_in_customer FROM orders ORDER BY customer_id, rank_in_customer")', 'Add <code>WHERE rank_in_customer = 1</code> by wrapping it in a CTE to get "the biggest order per customer".', 'RANK per group'),
        FN('SUM(...) OVER (ORDER BY ...)', 'A running total.', 'q("SELECT order_date, amount, SUM(amount) OVER (ORDER BY order_date, order_id) AS running_total FROM orders WHERE status = \'paid\'")', '', 'a running-total column'),
        FN('LAG(col)   LEAD(col)', 'The value from the previous (LAG) or next (LEAD) row: for changes over time.', 'q("SELECT order_date, amount, LAG(amount) OVER (ORDER BY order_date, order_id) AS previous, amount - LAG(amount) OVER (ORDER BY order_date, order_id) AS change FROM orders WHERE status = \'paid\'")', 'The first row has no previous: NULL.', '=B3-B2'),
        FN('UNION   INTERSECT   EXCEPT', 'Combine two answers: everything from both, only what is in both, only what is in the first.', 'q("SELECT city FROM customers WHERE city = \'Pune\' UNION SELECT city FROM customers WHERE city = \'Delhi\'")', 'Both answers need the same number of columns.', 'stacking two lists'),
      ], BASE),
      SEC('change', '6. Create and change data', '<p>Reading data is SELECT. These statements <i>change</i> it. On this page they run on a private copy that vanishes when you leave.</p>', [
        FN('CREATE TABLE', 'Makes a new empty table: name each column and its type (INTEGER, REAL, TEXT).', 'con.execute("CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT, price REAL)")\nq("SELECT * FROM products")', '<code>PRIMARY KEY</code> marks the column that identifies each row; it must be unique.', 'a new sheet with headers', [['con.execute(...)', 'send a statement that changes data (no table comes back)'], ['CREATE TABLE products', 'make a table called products'], ['(... name TEXT, price REAL)', 'its columns and what each holds']]),
        FN('INSERT INTO ... VALUES', 'Adds rows.', 'con.execute("INSERT INTO products VALUES (1, \'Tea\', 30), (2, \'Coffee\', 50), (3, \'Juice\', 40)")\nq("SELECT * FROM products")', 'The values must match the column order.', 'typing new rows'),
        FN('UPDATE ... SET ... WHERE', 'Changes values in existing rows. <b>Always include WHERE</b>, or every row changes.', 'con.execute("UPDATE products SET price = price * 1.1 WHERE name = \'Tea\'")\nq("SELECT * FROM products")', 'Run the same condition as a SELECT first to check which rows you will touch.', 'Find and Replace'),
        FN('DELETE FROM ... WHERE', 'Removes rows. Again: without WHERE, all of them go.', 'con.execute("DELETE FROM products WHERE name = \'Juice\'")\nq("SELECT * FROM products")', 'Deleting cannot be undone on a real database.', 'Delete rows'),
        FN('CREATE VIEW', 'Saves a query under a name so you can query it like a table.', 'con.execute("CREATE VIEW paid_orders AS SELECT * FROM orders WHERE status = \'paid\'")\nq("SELECT COUNT(*) AS n FROM paid_orders")', '', 'a saved filter'),
        FN('pd.read_sql / df.to_sql', 'Python and SQL together: run a query into a pandas table, or write a pandas table into the database.', 'df = q("SELECT * FROM orders")\nprint(df.shape)\ndf.head(3).to_sql("order_copy", con, index=False)\nq("SELECT COUNT(*) AS rows_copied FROM order_copy")', 'This is how analysts move between SQL and pandas.', 'Power Query'),
      ], BASE),
    ],
  });
})();
