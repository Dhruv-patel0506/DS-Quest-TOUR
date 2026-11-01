'use strict';
/* =====================================================================
   Module: SQL for Data Science (4 lessons, 12 exercises)
   Real SQL on a real SQLite database that lives inside the browser's Python (sqlite3 ships with Python): SELECT/WHERE/ORDER BY, GROUP BY/HAVING, JOINs,
   CTEs and window functions. Every exercise builds the same small shop database, you write the query, and the tests compare the rows with a pandas answer.
   ===================================================================== */
DSQ.defModule({
  id: 'sql', boss: [], lessons: [],
  outcomes: ['Write SELECT queries with WHERE, ORDER BY, LIMIT, IN, LIKE and BETWEEN', 'Summarise with GROUP BY, HAVING, CASE and date functions', 'Combine tables with INNER and LEFT JOINs, and find rows that have no match', 'Break a question into steps with CTEs and answer ranking and running-total questions with window functions'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'sql');
  /* the shop database every exercise starts from: 6 customers, 9 orders (customer 6 never ordered) */
  const SETUP = `import sqlite3
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
    return pd.read_sql(sql, con)
`;
  const ask = (hint) => `${SETUP}
result = q("""
${hint}
""")
print(result)`;
  const sol = (query) => `${SETUP}
result = q("""
${query}
""")
print(result)`;

  /* ---------------------------------------------------------------- 1 */
  M.lessons.push({
    id: 'select', title: 'SELECT: asking a database a question', minutes: 40, blurb: 'Choose columns, filter rows, sort and limit: the five clauses behind most queries.',
    pages: [
      RD('A table, and a question in nearly English', `<p>A <b>relational database</b> keeps data in <b>tables</b> (rows = records, columns = fields). <b>SQL</b> is the language for asking it questions. You say <i>what</i> you want and the database works out <i>how</i>.</p>
        ${TABLE(['clause', 'job', 'pandas twin'], [['<code>SELECT</code>', 'which columns to return', '<code>df[[...]]</code>'], ['<code>FROM</code>', 'which table', 'the DataFrame'], ['<code>WHERE</code>', 'keep only rows that pass a test', '<code>df[mask]</code>'], ['<code>ORDER BY</code>', 'sort (<code>DESC</code> = biggest first)', '<code>sort_values</code>'], ['<code>LIMIT</code>', 'only the first n rows', '<code>head(n)</code>']])}
        <p><b>Order of writing:</b> SELECT, FROM, WHERE, ORDER BY, LIMIT. <b>Order the database runs it:</b> FROM, WHERE, SELECT, ORDER BY, LIMIT: that is why you cannot use a column alias you made in SELECT inside WHERE.</p>
        ${UL(['<b>Tests</b> in WHERE: <code>=</code>, <code>&lt;&gt;</code> (not equal), <code>&gt;</code>, <code>BETWEEN a AND b</code>, <code>IN (...)</code>, <code>LIKE &quot;%e%&quot;</code> (% = any text), <code>IS NULL</code>.', 'Combine tests with <code>AND</code>, <code>OR</code>, <code>NOT</code>; use brackets when you mix them.', 'Text goes in <b>single quotes</b>: <code>&#39;paid&#39;</code>. Double quotes are for column names.', 'A missing value is <code>NULL</code>, and <code>NULL = NULL</code> is not true: write <code>IS NULL</code>.'])}`),
      VZ('See what each selector picks - and the SQL twin', 'sqlCompare', {}, 'Pick a query. The animation follows the order the database runs it: FROM (the whole table), then WHERE (rows), then SELECT (columns).'),
      DM('Your first queries on a real SQLite database', `${SETUP}
print(q("SELECT * FROM customers"))
print(q("SELECT order_id, amount FROM orders WHERE status = 'paid' AND amount >= 100 ORDER BY amount DESC"))
print(q("SELECT name FROM customers WHERE city IN ('Pune', 'Delhi') AND name LIKE '%a%'"))`, 'The database is SQLite, running inside this page. <code>q()</code> runs a query and hands you a pandas DataFrame, so you can chart or model the answer straight away.'),
      DM('The same shape on thousands of rows', `import sqlite3
import pandas as pd
from dsq_data import load

con = sqlite3.connect(":memory:")
load("retail", n=3000, seed=3).to_sql("orders", con, index=False)
print(pd.read_sql("SELECT COUNT(*) AS rows, MIN(order_time) AS first, MAX(order_time) AS last FROM orders", con))
print(pd.read_sql("SELECT order_id, category, region, revenue FROM orders WHERE revenue > 400 ORDER BY revenue DESC LIMIT 5", con))`, 'Same clauses, bigger table. Real analysts spend much of their day in queries like these, then move the result into pandas.'),
      EX({
        id: 'sq-1-1', title: 'Paid orders over 100, biggest first', est: 240, xp: 30,
        prompt: `<p>Write a query that returns <code>order_id</code> and <code>amount</code> of every order that is <b>paid</b> and has an amount <b>above 100</b>, biggest amount first. Keep it in <code>result</code>.</p><p>The helper <code>q("...")</code> runs your SQL on the shop database and returns a DataFrame.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT order_id, amount
FROM orders
WHERE status = 'paid' AND amount > 100
ORDER BY amount DESC`),
        hints: ['Two tests joined with AND.', 'ORDER BY amount DESC puts the biggest on top.'],
        tests: `check(list(result.columns) == ['order_id', 'amount'], 'returns exactly the columns order_id and amount', 'SELECT order_id, amount')
check(list(result.order_id) == [109, 103, 105, 101], 'orders 109, 103, 105, 101 in that order', "WHERE status = 'paid' AND amount > 100 ORDER BY amount DESC")`,
      }),
      EX({
        id: 'sq-1-2', title: 'Customers in two cities', est: 240, xp: 30,
        prompt: `<p>Return the <code>name</code> and <code>city</code> of customers who live in <b>Pune or Delhi</b>, ordered by <code>signup_date</code> (oldest first).</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT name, city
FROM customers
WHERE city IN ('Pune', 'Delhi')
ORDER BY signup_date`),
        hints: ["IN ('Pune', 'Delhi') is shorthand for two ORs.", 'Dates written as YYYY-MM-DD sort correctly as plain text.'],
        tests: `check(list(result.columns) == ['name', 'city'], 'columns name and city', 'SELECT name, city')
check(list(result.name) == ['Asha', 'Ben', 'Chen', 'Eli', 'Fay'], 'Asha, Ben, Chen, Eli, Fay by signup date', "WHERE city IN ('Pune', 'Delhi') ORDER BY signup_date")`,
      }),
      EX({
        id: 'sq-1-3', title: 'Names that contain an e', est: 240, xp: 30,
        prompt: `<p>Return only the <code>name</code> column for customers whose name <b>contains the letter e</b> (any position), in alphabetical order.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT name
FROM customers
WHERE name LIKE '%e%'
ORDER BY name`),
        hints: ["LIKE '%e%': the % signs mean 'anything before and after'.", 'SQLite LIKE ignores upper and lower case for plain letters.'],
        tests: `check(list(result.columns) == ['name'], 'one column: name', 'SELECT name')
check(list(result.name) == ['Ben', 'Chen', 'Eli'], 'Ben, Chen, Eli', "WHERE name LIKE '%e%' ORDER BY name")`,
      }),
      QZ('sql', [
        { q: 'Which clause keeps only rows that pass a test?', o: ['WHERE', 'ORDER BY', 'LIMIT', 'FROM'], a: 0, why: 'WHERE filters rows before anything is selected or sorted.' },
        { q: "How do you find rows where a column is missing?", o: ['col IS NULL', 'col = NULL', "col = ''", 'col == None'], a: 0, why: 'NULL means unknown, so comparing with = never gives true. Use IS NULL.' },
        { q: "What does LIKE 'A%' match?", o: ['Text that starts with A', 'Text that ends with A', 'Exactly the text A%', 'Text that contains A anywhere'], a: 0, why: 'The % is a wildcard for any run of characters, so A% means starts with A.' },
        { q: 'Which runs FIRST inside the database?', o: ['FROM / WHERE', 'SELECT', 'ORDER BY', 'LIMIT'], a: 0, why: 'FROM and WHERE pick the rows; SELECT picks columns after; then sort and limit.' },
      ], 'Quick check'),
      TY({ id: 'sq-t1', title: 'Typing sprint: a filtered, sorted query', goal: 30, code: `SELECT order_id, amount
FROM orders
WHERE status = 'paid' AND amount > 100
ORDER BY amount DESC
LIMIT 3;` }),
    ],
    recap: ['SELECT picks columns, FROM the table, WHERE the rows, ORDER BY sorts, LIMIT cuts.', 'IN, LIKE, BETWEEN and IS NULL are the everyday tests.', 'q() returns a DataFrame: SQL gets the rows, pandas does the rest.'],
  });

  /* ---------------------------------------------------------------- 2 */
  M.lessons.push({
    id: 'agg', title: 'GROUP BY: from rows to answers', minutes: 45, blurb: 'COUNT, SUM, AVG per group, HAVING, CASE buckets and monthly totals.',
    pages: [
      RD('Collapse many rows into one answer per group', `<p>An <b>aggregate</b> turns many rows into one number: <code>COUNT(*)</code>, <code>SUM(x)</code>, <code>AVG(x)</code>, <code>MIN</code>, <code>MAX</code>. <code>GROUP BY</code> does it once <i>per group</i>, like pandas <code>groupby</code>.</p>
        <pre class="codeblock">SELECT customer_id, COUNT(*) AS n_orders, SUM(amount) AS revenue
FROM orders
WHERE status = 'paid'        -- filters ROWS, before grouping
GROUP BY customer_id
HAVING SUM(amount) &gt; 100     -- filters GROUPS, after grouping
ORDER BY revenue DESC;</pre>
        ${UL(['<b>WHERE vs HAVING</b>: WHERE removes rows <i>before</i> grouping; HAVING removes whole groups <i>after</i> the aggregate is known.', 'Every selected column must be inside an aggregate or listed in GROUP BY.', '<code>COUNT(*)</code> counts rows; <code>COUNT(col)</code> skips NULLs; <code>COUNT(DISTINCT col)</code> counts different values.', '<b>CASE</b> builds a new column from rules: <code>CASE WHEN amount &gt;= 100 THEN &#39;big&#39; ELSE &#39;small&#39; END</code>.', '<b>Dates</b> are text in SQLite: <code>strftime(&#39;%Y-%m&#39;, order_date)</code> gives the month, ready to group by.'])}`),
      DM('Buckets, months and a grand total', `${SETUP}
print(q("""
SELECT CASE WHEN amount >= 100 THEN 'big' ELSE 'small' END AS size, COUNT(*) AS n, SUM(amount) AS revenue
FROM orders WHERE status = 'paid'
GROUP BY size ORDER BY size"""))
print(q("SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS orders FROM orders GROUP BY month ORDER BY month"))
print(q("SELECT COUNT(*) AS orders, SUM(amount) AS total, ROUND(AVG(amount), 1) AS average FROM orders"))`, 'No GROUP BY means one group: the whole table. The first query defines <code>size</code> in SELECT and groups by it: GROUP BY runs after FROM/WHERE, and SQLite lets you reuse the alias there.'),
      EX({
        id: 'sq-2-1', title: 'Revenue per customer', est: 300, xp: 35,
        prompt: `<p>For <b>paid</b> orders only, return one row per customer: <code>customer_id</code>, <code>n_orders</code> (how many paid orders) and <code>revenue</code> (their sum), with the highest revenue first.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT customer_id, COUNT(*) AS n_orders, SUM(amount) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
ORDER BY revenue DESC`),
        hints: ['Filter with WHERE first, then GROUP BY customer_id.', 'Name the two aggregates with AS n_orders and AS revenue.'],
        tests: `check(list(result.columns) == ['customer_id', 'n_orders', 'revenue'], 'columns customer_id, n_orders, revenue', 'use AS to name the two aggregates')
check(list(result.customer_id) == [5, 1, 2, 3, 4], 'customers 5, 1, 2, 3, 4 by revenue', 'GROUP BY customer_id ORDER BY revenue DESC')
check(list(result.revenue) == [300, 240, 200, 150, 90], 'revenues 300, 240, 200, 150, 90', "only paid orders: WHERE status = 'paid'")
check(int(result.set_index('customer_id').loc[1, 'n_orders']) == 3, 'customer 1 has 3 paid orders', 'COUNT(*)')`,
      }),
      EX({
        id: 'sq-2-2', title: 'Repeat customers with HAVING', est: 300, xp: 35,
        prompt: `<p>Which customers placed <b>at least 2 orders</b> of any status? Return <code>customer_id</code> and <code>n</code> (the number of orders), ordered by <code>customer_id</code>.</p><p>You cannot use <code>WHERE COUNT(*) &gt;= 2</code>: the count only exists after grouping.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT customer_id, COUNT(*) AS n
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY customer_id`),
        hints: ['HAVING goes after GROUP BY.', 'HAVING COUNT(*) >= 2'],
        tests: `check(list(result.columns) == ['customer_id', 'n'], 'columns customer_id and n', 'SELECT customer_id, COUNT(*) AS n')
check(list(result.customer_id) == [1, 2, 3], 'customers 1, 2 and 3', 'HAVING COUNT(*) >= 2')
check(list(result.n) == [3, 2, 2], 'with 3, 2 and 2 orders', 'COUNT(*) counts all orders of the customer')`,
      }),
      EX({
        id: 'sq-2-3', title: 'Monthly paid revenue', est: 300, xp: 35,
        prompt: `<p>Return paid revenue per <b>month</b>: columns <code>month</code> (like <code>2024-02</code>) and <code>revenue</code>, oldest month first. Use <code>strftime('%Y-%m', order_date)</code>.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY month
ORDER BY month`),
        hints: ["strftime('%Y-%m', order_date) AS month", 'GROUP BY the alias, then ORDER BY it.'],
        tests: `check(list(result.columns) == ['month', 'revenue'], 'columns month and revenue', "SELECT strftime('%Y-%m', order_date) AS month, SUM(amount) AS revenue")
check(list(result.month) == ['2024-02', '2024-03'], 'February then March 2024', 'GROUP BY month ORDER BY month')
check(list(result.revenue) == [400, 580], 'revenue 400 and 580', "only paid orders: WHERE status = 'paid'")`,
      }),
      QZ('sql', [
        { q: 'You want to drop customers whose TOTAL spend is under 100. Where does that test go?', o: ['HAVING SUM(amount) >= 100', 'WHERE SUM(amount) >= 100', 'ORDER BY SUM(amount)', 'LIMIT 100'], a: 0, why: 'The total only exists after grouping, so it is tested with HAVING.' },
        { q: 'COUNT(col) differs from COUNT(*) because it...', o: ['skips rows where col is NULL', 'counts distinct values', 'is faster', 'adds the values'], a: 0, why: 'COUNT(*) counts rows; COUNT(col) counts non-missing values of col.' },
        { q: 'SELECT city, name, COUNT(*) FROM customers GROUP BY city fails or misleads because...', o: ['name is neither grouped nor aggregated', 'COUNT cannot be used with GROUP BY', 'city is text', 'GROUP BY needs ORDER BY'], a: 0, why: 'Each output column must be a group column or an aggregate.' },
      ], 'Quick check'),
      TY({ id: 'sq-t2', title: 'Typing sprint: aggregate query', goal: 30, code: `SELECT customer_id, COUNT(*) AS n_orders, SUM(amount) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
HAVING SUM(amount) > 100
ORDER BY revenue DESC;` }),
    ],
    recap: ['GROUP BY gives one row per group; aggregates summarise each group.', 'WHERE filters rows before grouping; HAVING filters groups after.', 'CASE makes buckets; strftime makes months.'],
  });

  /* ---------------------------------------------------------------- 3 */
  M.lessons.push({
    id: 'joins', title: 'JOIN: putting tables together', minutes: 45, blurb: 'INNER and LEFT joins, finding rows with no match, and joining before you group.',
    pages: [
      RD('Real data lives in several tables', `<p>Customers go in one table, orders in another, linked by a <b>key</b> (<code>customer_id</code>). This avoids repeating a customer's name on every order. A <b>JOIN</b> puts the pieces back together for the question you are asking.</p>
        ${TABLE(['join', 'keeps', 'use it when'], [['<code>INNER JOIN</code> (or just <code>JOIN</code>)', 'only rows that match on both sides', 'you need data from both tables'], ['<code>LEFT JOIN</code>', 'every row of the left table, with NULLs where the right has no match', 'you must not lose left rows, or you want the ones with NO match']])}
        <pre class="codeblock">SELECT c.name, o.order_id, o.amount
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
WHERE o.status = 'paid';</pre>
        ${UL(['<b>Aliases</b> (<code>o</code>, <code>c</code>) keep it short and say which table a column comes from.', '<b>ON</b> says how the rows pair up. Forget it and every row meets every row: a cross join (6 x 9 = 54 rows here).', '<b>Anti-join</b>: LEFT JOIN, then keep rows where the right side is NULL: <i>customers who never ordered</i>.', '<b>Join then group</b>: join first, then <code>GROUP BY c.city</code> to total by a column that lives in the other table.', 'Before joining, ask: is the key unique on each side? A one-to-many join repeats the "one" side, and a many-to-many join multiplies rows silently.'])}`),
      DM('Seeing what each join keeps', `${SETUP}
print("customers:", len(q("SELECT * FROM customers")), "orders:", len(q("SELECT * FROM orders")))
print("INNER:", len(q("SELECT * FROM customers c JOIN orders o ON o.customer_id = c.customer_id")), "rows")
print("LEFT: ", len(q("SELECT * FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id")), "rows (Fay appears once with NULLs)")
print("CROSS:", len(q("SELECT * FROM customers c, orders o")), "rows (no ON: every pairing!)")
print(q("SELECT c.name, o.order_id FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE c.customer_id IN (5, 6)"))`, 'The LEFT JOIN row for Fay has a NULL order_id: that NULL is how you find customers with no orders.'),
      EX({
        id: 'sq-3-1', title: 'Paid orders with the customer name', est: 300, xp: 35,
        prompt: `<p>Return <code>order_id</code>, <code>name</code>, <code>city</code> and <code>amount</code> for every <b>paid</b> order, joining <code>orders</code> to <code>customers</code>. Order by <code>order_id</code>.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT o.order_id, c.name, c.city, o.amount
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
WHERE o.status = 'paid'
ORDER BY o.order_id`),
        hints: ['JOIN customers AS c ON c.customer_id = o.customer_id', "Filter with WHERE o.status = 'paid'."],
        tests: `check(list(result.columns) == ['order_id', 'name', 'city', 'amount'], 'columns order_id, name, city, amount', 'SELECT o.order_id, c.name, c.city, o.amount')
check(list(result.order_id) == [101, 102, 103, 105, 106, 107, 109], 'the seven paid orders', "WHERE o.status = 'paid'")
check(list(result.name) == ['Asha', 'Asha', 'Ben', 'Chen', 'Dara', 'Asha', 'Eli'], 'each with the right customer name', 'JOIN on customer_id')`,
      }),
      EX({
        id: 'sq-3-2', title: 'Customers who never ordered', est: 300, xp: 40,
        prompt: `<p>Which customers have <b>no orders at all</b>? Return their <code>name</code>. Use a <code>LEFT JOIN</code> and keep the rows where the order side is <code>NULL</code>.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT c.name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL`),
        hints: ['Start FROM customers so none are lost.', 'WHERE o.order_id IS NULL keeps only the unmatched ones.'],
        tests: `check(list(result.columns) == ['name'], 'one column: name', 'SELECT c.name')
check(list(result.name) == ['Fay'], 'only Fay never ordered', 'LEFT JOIN ... WHERE o.order_id IS NULL')`,
      }),
      EX({
        id: 'sq-3-3', title: 'Paid revenue by city', est: 360, xp: 40,
        prompt: `<p>The city lives in <code>customers</code>, the money in <code>orders</code>. Return <code>city</code> and <code>revenue</code> (sum of <b>paid</b> amounts), highest revenue first.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT c.city, SUM(o.amount) AS revenue
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
WHERE o.status = 'paid'
GROUP BY c.city
ORDER BY revenue DESC`),
        hints: ['Join first, then GROUP BY c.city.', 'Delhi: Ben 200 + Eli 300.'],
        tests: `check(list(result.columns) == ['city', 'revenue'], 'columns city and revenue', 'SELECT c.city, SUM(o.amount) AS revenue')
check(list(result.city) == ['Delhi', 'Pune', 'Mumbai'], 'Delhi, Pune, Mumbai by revenue', 'GROUP BY c.city ORDER BY revenue DESC')
check(list(result.revenue) == [500, 390, 90], 'revenue 500, 390, 90', "only paid orders: WHERE o.status = 'paid'")`,
      }),
      QZ('sql', [
        { q: 'You LEFT JOIN customers to orders. A customer with no orders appears...', o: ['Once, with NULL in the order columns', 'Not at all', 'Twice', 'With 0 in the order columns'], a: 0, why: 'LEFT JOIN keeps every left row; missing matches become NULL.' },
        { q: 'You forget the ON clause when joining 6 customers to 9 orders. How many rows come back?', o: ['54', '9', '15', '6'], a: 0, why: 'Every row pairs with every row: 6 x 9 = 54.' },
        { q: 'Why can a join silently inflate a SUM?', o: ['A one-to-many join repeats the single side for each match', 'JOIN adds NULLs', 'SUM ignores duplicates', 'It cannot'], a: 0, why: 'If you sum a customer-level number after joining to orders, it is counted once per order. Aggregate before joining or check row counts.' },
      ], 'Quick check'),
      TY({ id: 'sq-t3', title: 'Typing sprint: join and group', goal: 30, code: `SELECT c.city, SUM(o.amount) AS revenue
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
WHERE o.status = 'paid'
GROUP BY c.city
ORDER BY revenue DESC;` }),
    ],
    recap: ['A JOIN pairs rows on a key; INNER keeps matches only, LEFT keeps every left row.', 'LEFT JOIN + IS NULL finds rows with no match.', 'Join first, then group, and check row counts after every join.'],
  });

  /* ---------------------------------------------------------------- 4 */
  M.lessons.push({
    id: 'cte', title: 'CTEs and window functions', minutes: 50, blurb: 'Build a query in readable steps, then rank rows and compute running totals without collapsing them.',
    pages: [
      RD('Steps you can read, and calculations that keep every row', `<p>A <b>CTE</b> (<code>WITH name AS (...)</code>) is a named, temporary result you can use below it, like a variable for a query. It turns a tangled nested query into steps you read top to bottom.</p>
        <pre class="codeblock">WITH rev AS (
  SELECT customer_id, SUM(amount) AS revenue
  FROM orders WHERE status = 'paid' GROUP BY customer_id
)
SELECT customer_id, revenue
FROM rev
WHERE revenue &gt; (SELECT AVG(revenue) FROM rev);   -- a subquery returning one number</pre>
        <p>A <b>window function</b> calculates across a set of rows <i>without collapsing them</i>: unlike GROUP BY you still get one output row per input row. The shape is <code>function() OVER (PARTITION BY ... ORDER BY ...)</code>.</p>
        ${TABLE(['function', 'answers'], [['<code>ROW_NUMBER()</code>', 'position 1, 2, 3 within each partition (latest order per customer = number 1)'], ['<code>RANK()</code>', 'like ROW_NUMBER but ties share a rank'], ['<code>SUM(x) OVER (ORDER BY date)</code>', 'a running total'], ['<code>LAG(x)</code> / <code>LEAD(x)</code>', 'the previous / next row\'s value (month-over-month change)']])}
        ${UL(['<b>PARTITION BY</b> = restart for each group (like GROUP BY, but rows stay). <b>ORDER BY</b> inside OVER = the order the function walks.', 'You cannot filter on a window result in the same query\'s WHERE: wrap it in a CTE or subquery, then filter outside.', 'Use CTEs for readability, not speed; the database plans them the same way as nested queries.'])}`),
      DM('Ranking, previous value and a running total', `${SETUP}
print(q("""
SELECT order_id, customer_id, amount,
       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS nth_order,
       LAG(amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS previous_amount,
       SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS customer_running
FROM orders ORDER BY customer_id, order_date"""))`, 'Nine rows in, nine rows out. Each customer\'s orders are numbered, shown next to the previous amount, and summed as they go: the same kind of columns you build in pandas with <code>groupby().cumsum()</code> and <code>shift()</code>.'),
      EX({
        id: 'sq-4-1', title: 'Customers above the average (CTE)', est: 360, xp: 40,
        prompt: `<p>First build each customer's paid revenue in a CTE. Then return the customers whose revenue is <b>above the average customer revenue</b>: columns <code>customer_id</code>, <code>revenue</code>, highest first.</p>`,
        starter: ask('WITH rev AS (\n  SELECT ...\n)\nSELECT ...'),
        solution: sol(`WITH rev AS (
  SELECT customer_id, SUM(amount) AS revenue
  FROM orders
  WHERE status = 'paid'
  GROUP BY customer_id
)
SELECT customer_id, revenue
FROM rev
WHERE revenue > (SELECT AVG(revenue) FROM rev)
ORDER BY revenue DESC`),
        hints: ['The CTE is the same query as the earlier revenue-per-customer one.', '(SELECT AVG(revenue) FROM rev) is a subquery that gives one number: 196.'],
        tests: `check(list(result.columns) == ['customer_id', 'revenue'], 'columns customer_id and revenue', 'SELECT customer_id, revenue FROM rev')
check(list(result.customer_id) == [5, 1, 2], 'customers 5, 1, 2 beat the average of 196', 'WHERE revenue > (SELECT AVG(revenue) FROM rev)')
check(list(result.revenue) == [300, 240, 200], 'revenue 300, 240, 200', 'ORDER BY revenue DESC')`,
      }),
      EX({
        id: 'sq-4-2', title: 'Latest order per customer (ROW_NUMBER)', est: 420, xp: 45,
        prompt: `<p>Return each customer's <b>most recent order</b> (any status): <code>customer_id</code>, <code>order_id</code>, <code>order_date</code>, ordered by <code>customer_id</code>.</p><p>Number each customer's orders newest-first with <code>ROW_NUMBER()</code>, then keep number 1 (do the filtering in an outer query).</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT customer_id, order_id, order_date
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
)
WHERE rn = 1
ORDER BY customer_id`),
        hints: ['ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)', 'Wrap that query in parentheses after FROM and filter WHERE rn = 1.'],
        tests: `check(list(result.columns) == ['customer_id', 'order_id', 'order_date'], 'columns customer_id, order_id, order_date', 'SELECT customer_id, order_id, order_date FROM (...)')
check(list(result.order_id) == [107, 104, 108, 106, 109], 'latest orders 107, 104, 108, 106, 109', 'PARTITION BY customer_id ORDER BY order_date DESC, then rn = 1')`,
      }),
      EX({
        id: 'sq-4-3', title: 'A running total of paid revenue', est: 420, xp: 45,
        prompt: `<p>For <b>paid</b> orders, return <code>order_id</code>, <code>order_date</code>, <code>amount</code> and <code>running</code>: the total of paid amounts so far when the orders are taken in date order (break date ties by <code>order_id</code>). Output in the same order.</p>`,
        starter: ask('SELECT ...'),
        solution: sol(`SELECT order_id, order_date, amount,
       SUM(amount) OVER (ORDER BY order_date, order_id) AS running
FROM orders
WHERE status = 'paid'
ORDER BY order_date, order_id`),
        hints: ['SUM(amount) OVER (ORDER BY order_date, order_id)', 'WHERE removes the unpaid rows before the window is computed.'],
        tests: `check(list(result.columns) == ['order_id', 'order_date', 'amount', 'running'], 'columns order_id, order_date, amount, running', 'name the window column AS running')
check(list(result.order_id) == [101, 103, 102, 105, 106, 107, 109], 'paid orders in date order', 'ORDER BY order_date, order_id')
check(list(result.running) == [120, 320, 400, 550, 640, 680, 980], 'running total 120, 320, 400, 550, 640, 680, 980', 'SUM(amount) OVER (ORDER BY order_date, order_id)')`,
      }),
      QZ('sql', [
        { q: 'How does a window function differ from GROUP BY?', o: ['It keeps one output row per input row', 'It is slower', 'It cannot sum', 'It needs a JOIN'], a: 0, why: 'Window functions add a calculated column without collapsing rows.' },
        { q: 'You want the top 1 order per customer. What is the usual recipe?', o: ['ROW_NUMBER() OVER (PARTITION BY customer ORDER BY date DESC), then keep rn = 1', 'GROUP BY customer LIMIT 1', 'ORDER BY customer LIMIT 1', 'DISTINCT customer'], a: 0, why: 'Number rows inside each customer, then filter in an outer query.' },
        { q: 'What does LAG(amount) return?', o: ['The amount from the previous row in the window order', 'The largest amount', 'The next row\'s amount', 'The average amount'], a: 0, why: 'LAG looks back one row (LEAD looks forward).' },
        { q: 'A CTE mainly gives you...', o: ['A readable, named step you can reuse', 'Automatic speed-ups', 'A permanent table', 'Write access'], a: 0, why: 'It exists only for that one statement; the benefit is clarity.' },
      ], 'Quick check'),
      TY({ id: 'sq-t4', title: 'Typing sprint: window function', goal: 30, code: `SELECT order_id, order_date, amount,
       SUM(amount) OVER (ORDER BY order_date, order_id) AS running
FROM orders
WHERE status = 'paid'
ORDER BY order_date, order_id;` }),
    ],
    recap: ['A CTE names a step so a long query reads top to bottom.', 'Window functions (OVER) add rank, previous value or running total without collapsing rows.', 'To filter on a window result, wrap the query and filter outside.'],
  });

  M.boss = [
    { q: 'Which clause removes whole groups AFTER aggregation?', o: ['HAVING', 'WHERE', 'ORDER BY', 'DISTINCT'], a: 0, why: 'HAVING filters on aggregates; WHERE filters rows before grouping.' },
    { q: "You need customers with NO orders. Which pattern is right?", o: ['customers LEFT JOIN orders ... WHERE orders.id IS NULL', 'customers INNER JOIN orders', 'orders LEFT JOIN customers WHERE customers.id IS NULL', 'customers WHERE id = NULL'], a: 0, why: 'Keep all customers, then keep the rows where the order side is missing.' },
    { gen: r => { const a = r.int(3, 9), b = r.int(4, 12); return { q: `Table A has ${a} rows, table B has ${b} rows. You join them with no ON clause. How many rows come back?`, correct: String(a * b), wrong: distract(String(a * b), [String(a + b), String(Math.max(a, b)), String(Math.abs(a - b) + 1)]), why: 'Without ON every row pairs with every row: a x b.' }; } },
    { q: 'Which is NOT a valid way to test for a missing value?', o: ['col = NULL', 'col IS NULL', 'col IS NOT NULL', 'COALESCE(col, 0) = 0'], a: 0, why: 'NULL is unknown, so = never gives true.' },
    { q: "What does LIKE '%an' match?", o: ['Text that ends with an', 'Text that starts with an', 'Text that contains an anywhere', 'Only the text an'], a: 0, why: '% is a wildcard before the letters, so it must END with them.' },
    { q: 'Where does the SQL engine run SELECT relative to WHERE?', o: ['After WHERE', 'Before WHERE', 'At the same time', 'It depends on the table size'], a: 0, why: 'FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT is the logical order.' },
    { q: 'You sum an amount that is stored once per customer after joining to orders. The total is too big because...', o: ['The customer row is repeated once per order', 'SUM adds NULLs', 'JOIN deletes rows', 'GROUP BY doubles values'], a: 0, why: 'One-to-many joins repeat the one side. Aggregate first or use a CTE.' },
    { q: 'Which gives a running total?', o: ['SUM(x) OVER (ORDER BY date)', 'SUM(x) GROUP BY date', 'COUNT(*) OVER ()', 'MAX(x)'], a: 0, why: 'The window with ORDER BY accumulates row by row.' },
  ];
})();
