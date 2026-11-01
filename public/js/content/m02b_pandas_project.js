'use strict';
/* =====================================================================
   pandas projects: 3 variants (bike-share, online store, hospital OPD)
   ===================================================================== */
(function () {
  const M = DSQ.modules.find(m => m.id === 'pandas');
  const FIG = (n) => `fig = plt.gcf()
check(len(fig.axes) == ${n}, 'the figure has ${n} chart${n > 1 ? 's' : ''}', 'plt.subplots(1, ${n})')
check(all(a.get_title() for a in fig.axes), 'every chart has a title', 'ax.set_title(...)')
check(all(a.get_ylabel() for a in fig.axes), 'every chart has a y label', 'ax.set_ylabel(...)')`;
  const DAYS = `['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']`;

  M.project = {
    variants: [
      /* ====================================================== bikes */
      {
        id: 'citybike', flagship: true, hours: 5, title: 'CityBike Insights: from messy trip logs to a station plan',
        pitch: 'A bike-share company exports its raw trip log every night. It has duplicate rows, missing durations and station names typed five different ways. Clean it, engineer features, and answer the operations team: which station earns the most per trip, when is the peak, and how do weekends differ?',
        real: 'The analysis behind bike-share and scooter-share operations (Lime, Bird, Yulu, Citi Bike) - rebalancing bikes, pricing and station planning.',
        flagship_note: 'a log of ~4,000 trips (instead of ~1,500) and two extra milestones: station-aware rating imputation and a 7-day revenue trend with best-day detection.',
        dataset: { file: 'bikes.csv', desc: 'Synthetic city bike-share trips for Jan-Mar 2026: one row per trip with date, hour, station, user type, distance, duration, fare and an optional rating. It is deliberately messy: duplicate rows, a few missing durations, ~20% missing ratings and inconsistent station spelling.',
          columns: [['trip_id', 'unique id of the trip'], ['start_date', 'date the trip began (text, YYYY-MM-DD)'], ['start_hour', 'hour of day 0-23'], ['station', 'start station (spelling is inconsistent!)'], ['user_type', 'member or casual'], ['distance_km', 'distance ridden'], ['duration_min', 'trip duration (some missing)'], ['fare', 'amount charged'], ['rating', 'rider rating 1-5 (often missing)']], gen: DS.bikes },
        refs: ['Real open data: Citi Bike (citibikenyc.com/system-data) and Capital Bikeshare publish monthly trip files with the same structure.', 'pandas user guide: "Merge, join, concatenate" and "Group by: split-apply-combine".'],
        milestones: [
          { id: 'load', title: 'Load and diagnose', xp: 20, est: 150,
            prompt: `<p>Load the file and take stock before touching anything: the shape, the missing values per column and the number of duplicated rows.</p>`,
            starter: `import pandas as pd

df = pd.read_csv('data/bikes.csv')
n_rows, n_cols = df.___
missing = df.isna().___()
n_dupes = df.___().sum()
print(n_rows, n_cols)
print(missing)
print(n_dupes)`,
            solution: `import pandas as pd

df = pd.read_csv('data/bikes.csv')
n_rows, n_cols = df.shape
missing = df.isna().sum()
n_dupes = df.duplicated().sum()
print(n_rows, n_cols)
print(missing)
print(n_dupes)`,
            bank: ['shape', 'size', 'sum', 'count', 'duplicated', 'drop_duplicates', 'unique'], hints: ['shape is (rows, columns).', 'duplicated() flags repeated rows as True; sum counts them.'],
            tests: `_r = pd.read_csv('data/bikes.csv')
check((n_rows, n_cols) == _r.shape, 'n_rows and n_cols come from the shape', 'df.shape')
check(missing.to_dict() == _r.isna().sum().to_dict(), 'missing counts per column are right', 'df.isna().sum()')
check(int(n_dupes) == int(_r.duplicated().sum()) and n_dupes > 0, 'n_dupes counts the duplicated rows', 'df.duplicated().sum()')` },
          { id: 'clean', title: 'Clean it', xp: 30, est: 300,
            prompt: `<p>In this order: drop duplicate rows; tidy the station names (strip spaces, Title Case); fill missing durations with the <b>median</b> duration; turn <code>start_date</code> into real dates. There should be exactly 6 stations afterwards.</p>`,
            starter: `df = df.___()
df['station'] = df['station'].str.___().str.title()
df['duration_min'] = df['duration_min'].fillna(df['duration_min'].___())
df['start_date'] = pd.___(df['start_date'])
print(df.shape, df['station'].nunique())`,
            solution: `df = df.drop_duplicates()
df['station'] = df['station'].str.strip().str.title()
df['duration_min'] = df['duration_min'].fillna(df['duration_min'].median())
df['start_date'] = pd.to_datetime(df['start_date'])
print(df.shape, df['station'].nunique())`,
            bank: ['drop_duplicates', 'dropna', 'strip', 'lower', 'median', 'mean', 'to_datetime', 'to_numeric'], hints: ['Tidy the text before you look for duplicates or count stations.'],
            tests: `_c = pd.read_csv('data/bikes.csv').drop_duplicates()
_c['station'] = _c['station'].str.strip().str.title()
_c['duration_min'] = _c['duration_min'].fillna(_c['duration_min'].median())
check(len(df) == len(_c), 'duplicate rows are gone', 'df.drop_duplicates()')
check(df['station'].nunique() == 6, 'exactly 6 stations remain', 'strip() then title()')
check(df['duration_min'].isna().sum() == 0 and abs(df['duration_min'].sum() - _c['duration_min'].sum()) < 1e-6, 'missing durations are filled with the median', "fillna(df['duration_min'].median())")
check(str(df['start_date'].dtype).startswith('datetime64'), 'start_date is a real datetime', 'pd.to_datetime(...)')` },
          { id: 'features', title: 'Engineer features', xp: 30, est: 300,
            prompt: `<p>Add four columns:</p>${UL(['<code>speed_kmh</code> = distance / (duration in hours)', '<code>weekday</code> = day name (Monday...)', '<code>is_weekend</code> = True for Saturday/Sunday (<code>dayofweek</code> 5 and 6)', '<code>peak</code> = True when <code>start_hour</code> is one of 7, 8, 9, 17, 18, 19'])}`,
            starter: `df['speed_kmh'] = df['distance_km'] / (df['duration_min'] / ___)
df['weekday'] = df['start_date'].dt.___()
df['is_weekend'] = df['start_date'].dt.dayofweek >= ___
df['peak'] = df['start_hour'].___([7, 8, 9, 17, 18, 19])
print(df[['speed_kmh', 'weekday', 'is_weekend', 'peak']].head())`,
            solution: `df['speed_kmh'] = df['distance_km'] / (df['duration_min'] / 60)
df['weekday'] = df['start_date'].dt.day_name()
df['is_weekend'] = df['start_date'].dt.dayofweek >= 5
df['peak'] = df['start_hour'].isin([7, 8, 9, 17, 18, 19])
print(df[['speed_kmh', 'weekday', 'is_weekend', 'peak']].head())`,
            bank: ['60', '24', '5', '6', 'day_name', 'dayofweek', 'isin', 'between'], hints: ['Hours = minutes / 60.', 'Monday is 0 ... Saturday is 5, Sunday 6.'],
            tests: `check(np.allclose(df['speed_kmh'], df['distance_km'] / (df['duration_min'] / 60)), 'speed_kmh = distance / hours', 'df["duration_min"] / 60')
check(df['weekday'].iloc[0] == df['start_date'].iloc[0].day_name(), 'weekday holds day names', 'dt.day_name()')
check((df['is_weekend'] == (df['start_date'].dt.dayofweek >= 5)).all(), 'is_weekend is True on Saturday and Sunday', 'dt.dayofweek >= 5')
check((df['peak'] == df['start_hour'].isin([7, 8, 9, 17, 18, 19])).all(), 'peak marks the rush hours', 'start_hour.isin([...])')` },
          { id: 'insights', title: 'Which station earns the most per trip?', xp: 45, est: 480, star: true,
            prompt: `<p>The operations team asks five questions:</p>${UL(['<code>by_station</code>: per station, <code>trips</code> (count of trip_id) and <code>revenue</code> (sum of fare)', '<code>rev_per_trip</code>: revenue divided by trips, per station (a Series)', '<code>best_station</code>: the station with the highest revenue per trip', '<code>member_share</code>: the fraction of trips made by <code>member</code> users', '<code>peak_hour</code>: the hour of day with the most trips'])}<p>Use the Logic Lab to describe the plan for the first three.</p>`,
            starter: `by_station = ...
rev_per_trip = ...
best_station = ...
member_share = ...
peak_hour = ...
print(best_station, round(member_share, 3), peak_hour)`,
            solution: `by_station = df.groupby('station').agg(trips=('trip_id', 'count'), revenue=('fare', 'sum'))
rev_per_trip = by_station['revenue'] / by_station['trips']
best_station = rev_per_trip.idxmax()
member_share = (df['user_type'] == 'member').mean()
peak_hour = df.groupby('start_hour').size().idxmax()
print(best_station, round(member_share, 3), peak_hour)`,
            hints: ['agg(trips=("trip_id", "count"), revenue=("fare", "sum"))', 'The mean of a True/False column is the share of Trues.'],
            logic: { task: 'Explain how you would find the station that earns the most per trip.', xp: 25, minWords: 14,
              rubric: [
                { id: 'grp', label: 'group the trips by station', any: ['group', 'each station', 'per station', 'by station', 'split'], hint: 'Revenue per trip is a per-station number. How do you make pandas work station by station?', code: "by_station = df.groupby('station').agg(trips=('trip_id', 'count'), revenue=('fare', 'sum'))" },
                { id: 'agg', label: 'total revenue and number of trips', any: ['sum', 'total', 'add up', 'count', 'number of trips', 'how many trips'], hint: 'Which two numbers do you need for each station before you can form a ratio?', code: '' },
                { id: 'div', label: 'divide revenue by trips', any: ['divide', 'divided', 'ratio', '/', 'per trip', 'average', 'mean'], hint: 'How do you turn "total revenue" and "number of trips" into "revenue per trip"?', code: "rev_per_trip = by_station['revenue'] / by_station['trips']" },
                { id: 'best', label: 'pick the biggest', any: ['biggest', 'largest', 'highest', 'max', 'best', 'top', 'idxmax', 'sort'], hint: 'Last step: which station do you report, and which pandas call returns its NAME?', code: 'best_station = rev_per_trip.idxmax()' },
              ] },
            tests: `_g = df.groupby('station').agg(trips=('trip_id', 'count'), revenue=('fare', 'sum'))
_rp = _g['revenue'] / _g['trips']
check(list(by_station.columns) == ['trips', 'revenue'] and by_station['trips'].sum() == len(df), 'by_station has trips and revenue per station', "groupby('station').agg(...)")
check(np.allclose(rev_per_trip.sort_index(), _rp.sort_index()), 'rev_per_trip = revenue / trips', "by_station['revenue'] / by_station['trips']")
check(best_station == _rp.idxmax(), 'best_station has the highest revenue per trip', 'rev_per_trip.idxmax()')
check(abs(member_share - (df['user_type'] == 'member').mean()) < 1e-9, 'member_share is the share of member trips', "(df['user_type'] == 'member').mean()")
check(int(peak_hour) == int(df.groupby('start_hour').size().idxmax()), 'peak_hour is the busiest hour', "df.groupby('start_hour').size().idxmax()")` },
          { id: 'pivot', title: 'Weekday x rider-type grid', xp: 35, est: 360,
            prompt: `<ul><li><code>pivot</code>: number of trips with rows = weekday and columns = user_type (<code>pivot_table</code> with <code>aggfunc="count"</code> on trip_id), rows ordered Monday to Sunday</li><li><code>rating_by_station</code>: mean rating per station, rounded to 2 decimals, best first</li><li><code>weekend_len</code>: mean distance for weekend vs weekday trips (index False/True)</li></ul>`,
            starter: `days = ${DAYS}
pivot = df.pivot_table(index='weekday', columns='user_type', values='trip_id', aggfunc='count')
pivot = pivot.___(days)
rating_by_station = df.groupby('station')['rating'].mean().___(2).sort_values(ascending=___)
weekend_len = df.groupby('is_weekend')['distance_km'].___()
print(pivot)
print(rating_by_station)`,
            solution: `days = ${DAYS}
pivot = df.pivot_table(index='weekday', columns='user_type', values='trip_id', aggfunc='count')
pivot = pivot.reindex(days)
rating_by_station = df.groupby('station')['rating'].mean().round(2).sort_values(ascending=False)
weekend_len = df.groupby('is_weekend')['distance_km'].mean()
print(pivot)
print(rating_by_station)`,
            bank: ['reindex', 'sort_index', 'round', 'floor', 'False', 'True', 'mean', 'sum'], hints: ['reindex(list) puts the rows in exactly that order.', 'Best first = ascending=False.'],
            tests: `_p = df.pivot_table(index='weekday', columns='user_type', values='trip_id', aggfunc='count').reindex(${DAYS})
check(list(pivot.index) == ${DAYS} and pivot.shape == (7, 2), 'pivot is 7 weekdays x 2 user types in calendar order', 'reindex the weekday names')
check(pivot.fillna(0).values.tolist() == _p.fillna(0).values.tolist(), 'pivot counts are right', "pivot_table(..., aggfunc='count')")
_r = df.groupby('station')['rating'].mean().round(2).sort_values(ascending=False)
check(np.allclose(rating_by_station.values, _r.values) and list(rating_by_station.index) == list(_r.index), 'rating_by_station is rounded and sorted best first', 'round(2).sort_values(ascending=False)')
check(np.allclose(weekend_len.sort_index().values, df.groupby('is_weekend')['distance_km'].mean().sort_index().values), 'weekend_len compares weekday and weekend trips', "groupby('is_weekend')['distance_km'].mean()")` },
          { id: 'report', title: 'Operations dashboard', xp: 30, est: 300,
            prompt: `<p>One figure, two charts side by side: trips per station (bars) and trips per hour of day (line).</p>`,
            starter: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
st_counts = df['station'].value_counts()
ax1.bar(st_counts.index, st_counts.values, color='#2F6FE0')
ax1.set_title('Trips per station')
ax1.set_ylabel('trips')
ax1.tick_params(axis='x', rotation=40)
hourly = df.groupby('start_hour').___()
ax2.plot(hourly.index, hourly.values, marker='o', color='#D2600F')
ax2.set_title('Trips by hour of day')
ax2.set_ylabel('trips')
ax2.set_xlabel('hour')
plt.tight_layout()
print('dashboard ready')`,
            solution: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
st_counts = df['station'].value_counts()
ax1.bar(st_counts.index, st_counts.values, color='#2F6FE0')
ax1.set_title('Trips per station')
ax1.set_ylabel('trips')
ax1.tick_params(axis='x', rotation=40)
hourly = df.groupby('start_hour').size()
ax2.plot(hourly.index, hourly.values, marker='o', color='#D2600F')
ax2.set_title('Trips by hour of day')
ax2.set_ylabel('trips')
ax2.set_xlabel('hour')
plt.tight_layout()
print('dashboard ready')`,
            bank: ['size', 'count', 'sum', 'mean'], hints: ['You need the number of trips per hour: size() counts rows per group.'],
            tests: `${FIG(2)}
check(len(plt.gcf().axes[0].patches) == 6 and len(plt.gcf().axes[1].lines) >= 1, 'left chart has 6 bars, right chart has a line', 'bar for stations, plot for hours')` },
        ],
        flagship_ms: [
          { id: 'ratings', title: 'Flagship: smarter rating imputation', xp: 45, est: 420, star: true,
            prompt: `<p>About 20% of ratings are missing. Instead of one global value, fill each gap with the <b>median rating of that station</b> (a <code>groupby(...).transform("median")</code> trick). Then report how many ratings remain missing (<code>left</code>) and the new overall mean rating (<code>new_mean</code>).</p>`,
            starter: `station_median = df.groupby('station')['rating'].___('median')
df['rating'] = df['rating'].fillna(___)
left = df['rating'].isna().sum()
new_mean = df['rating'].mean()
print(left, round(new_mean, 3))`,
            solution: `station_median = df.groupby('station')['rating'].transform('median')
df['rating'] = df['rating'].fillna(station_median)
left = df['rating'].isna().sum()
new_mean = df['rating'].mean()
print(left, round(new_mean, 3))`,
            bank: ['transform', 'agg', 'apply', 'station_median', "df['rating'].median()", '0'], hints: ['transform returns one value per ORIGINAL row (the group median repeated), so it lines up with fillna.'],
            tests: `check(df['rating'].isna().sum() == 0 and int(left) == 0, 'no ratings are missing any more', "fillna(df.groupby('station')['rating'].transform('median'))")
check(len(station_median) == len(df), 'station_median has one value per trip', 'use transform, not agg')
check(1 <= new_mean <= 5, 'new_mean is a believable rating', 'df["rating"].mean()')` },
          { id: 'trend', title: 'Flagship: revenue trend', xp: 45, est: 420,
            prompt: `<ul><li><code>daily</code>: total fare per start_date (a Series indexed by date)</li><li><code>roll7</code>: the 7-day moving average of daily revenue</li><li><code>best_day</code>: the date with the highest daily revenue</li><li><code>weekend_lift</code>: average daily revenue on weekend days divided by the average on weekdays</li></ul>`,
            starter: `daily = df.groupby('start_date')['fare'].___()
roll7 = daily.___(7).mean()
best_day = daily.___()
is_we = daily.index.dayofweek >= 5
weekend_lift = daily[is_we].mean() / daily[~is_we].mean()
print(best_day.date(), round(weekend_lift, 2))`,
            solution: `daily = df.groupby('start_date')['fare'].sum()
roll7 = daily.rolling(7).mean()
best_day = daily.idxmax()
is_we = daily.index.dayofweek >= 5
weekend_lift = daily[is_we].mean() / daily[~is_we].mean()
print(best_day.date(), round(weekend_lift, 2))`,
            bank: ['sum', 'mean', 'rolling', 'resample', 'idxmax', 'max'], hints: ['idxmax returns the index LABEL (the date) of the maximum.'],
            tests: `_d = df.groupby('start_date')['fare'].sum()
check(np.allclose(daily.values, _d.values) and len(daily) == len(_d), 'daily is total fare per date', "groupby('start_date')['fare'].sum()")
check(roll7.isna().sum() == 6, 'roll7 is a 7-day moving average (first 6 are NaN)', 'daily.rolling(7).mean()')
check(best_day == _d.idxmax(), 'best_day is the date with most revenue', 'daily.idxmax()')
_we = _d.index.dayofweek >= 5
check(abs(weekend_lift - _d[_we].mean() / _d[~_we].mean()) < 1e-9, 'weekend_lift compares weekend and weekday averages', 'two means, divided')` },
        ],
      },

      /* ====================================================== shop */
      {
        id: 'shoplens', hours: 5, title: 'ShopLens: find where an online store really makes (and loses) money',
        pitch: 'You are the new analyst at an online store. Orders carry quantity, price and discount - and some come back as returns. Compute true revenue, compare categories and cities, spot the best month, and identify the customers who matter.',
        real: 'The core e-commerce analytics behind Shopify, Amazon-seller and Flipkart dashboards: revenue, return rate, cohort-style customer metrics.',
        flagship_note: 'a log of ~4,500 orders (instead of ~1,600) and two extra milestones: quartile customer segments and a payment-mix analysis by city.',
        dataset: { file: 'orders.csv', desc: 'Synthetic order lines for Jan-Jun 2026 with category, product, quantity, unit price, discount percentage, city, payment method and a returned flag. Sales are higher in March and May (festival sales).',
          columns: [['order_id', 'unique order line'], ['customer_id', 'who bought'], ['order_date', 'YYYY-MM-DD'], ['category', 'product category'], ['product', 'product name'], ['qty', 'units bought'], ['unit_price', 'price per unit (INR)'], ['discount_pct', 'percent discount'], ['city', 'delivery city'], ['payment', 'UPI / Card / COD / Wallet'], ['returned', 'yes if the order came back']], gen: DS.orders },
        refs: ['Kaggle hosts real transaction datasets such as "Online Retail II (UCI)" - apply the same steps.', 'Revenue after returns is what finance reports: always say whether a number includes returned orders.'],
        milestones: [
          { id: 'load', title: 'Load and parse', xp: 20, est: 150,
            prompt: `<p>Load the file with dates parsed at read time (<code>parse_dates=[...]</code>), then record how many order lines and distinct customers there are, and the first and last order date.</p>`,
            starter: `import pandas as pd

df = pd.read_csv('data/orders.csv', ___=['order_date'])
n_lines = len(df)
n_customers = df['customer_id'].___()
first, last = df['order_date'].min(), df['order_date'].___()
print(n_lines, n_customers, first.date(), last.date())`,
            solution: `import pandas as pd

df = pd.read_csv('data/orders.csv', parse_dates=['order_date'])
n_lines = len(df)
n_customers = df['customer_id'].nunique()
first, last = df['order_date'].min(), df['order_date'].max()
print(n_lines, n_customers, first.date(), last.date())`,
            bank: ['parse_dates', 'dtype', 'nunique', 'unique', 'count', 'max', 'min'], hints: ['nunique counts distinct values.'],
            tests: `_r = pd.read_csv('data/orders.csv', parse_dates=['order_date'])
check(str(df['order_date'].dtype).startswith('datetime64'), 'order_date is a datetime column', "read_csv(..., parse_dates=['order_date'])")
check(n_lines == len(_r) and n_customers == _r['customer_id'].nunique(), 'n_lines and n_customers are right', "len(df), df['customer_id'].nunique()")
check(first == _r['order_date'].min() and last == _r['order_date'].max(), 'first and last order dates are right', 'min() and max()')` },
          { id: 'revenue', title: 'True revenue', xp: 30, est: 300,
            prompt: `<ul><li><code>gross</code> = qty x unit_price</li><li><code>revenue</code> = gross after the percentage discount: <code>gross * (1 - discount_pct / 100)</code></li><li><code>month</code> = month number of the order date</li><li><code>total_revenue</code>: sum of revenue for orders that were <b>not</b> returned</li><li><code>return_rate</code>: fraction of order lines with <code>returned == "yes"</code></li></ul>`,
            starter: `df['gross'] = df['qty'] * df['unit_price']
df['revenue'] = df['gross'] * (1 - df['discount_pct'] / ___)
df['month'] = df['order_date'].dt.___
total_revenue = df.loc[df['returned'] == '___', 'revenue'].sum()
return_rate = (df['returned'] == 'yes').___()
print(round(total_revenue), round(return_rate, 3))`,
            solution: `df['gross'] = df['qty'] * df['unit_price']
df['revenue'] = df['gross'] * (1 - df['discount_pct'] / 100)
df['month'] = df['order_date'].dt.month
total_revenue = df.loc[df['returned'] == 'no', 'revenue'].sum()
return_rate = (df['returned'] == 'yes').mean()
print(round(total_revenue), round(return_rate, 3))`,
            bank: ['100', '10', 'month', 'day', 'no', 'yes', 'mean', 'sum'], hints: ['A discount of 20 means multiply by (1 - 20/100).'],
            tests: `_g = df['qty'] * df['unit_price']; _rv = _g * (1 - df['discount_pct'] / 100)
check(np.allclose(df['gross'], _g) and np.allclose(df['revenue'], _rv), 'gross and revenue are right', 'revenue = gross * (1 - discount_pct / 100)')
check((df['month'] == df['order_date'].dt.month).all(), 'month holds the month number', "df['order_date'].dt.month")
check(abs(total_revenue - _rv[df['returned'] == 'no'].sum()) < 1e-6, 'total_revenue excludes returned orders', "df.loc[df['returned'] == 'no', 'revenue'].sum()")
check(abs(return_rate - (df['returned'] == 'yes').mean()) < 1e-9, 'return_rate is the share of returned lines', "(df['returned'] == 'yes').mean()")` },
          { id: 'categories', title: 'Category scorecard', xp: 35, est: 360,
            prompt: `<ul><li><code>cat</code>: grouped by category with columns <code>orders</code> (count of order_id), <code>revenue</code> (sum) and <code>return_rate</code> (share of lines returned)</li><li><code>top_cat</code>: category with the most revenue</li><li><code>riskiest</code>: category with the highest return rate</li><li><code>best_product</code>: the product with the highest total revenue</li></ul>`,
            starter: `df['ret'] = (df['returned'] == 'yes')
cat = df.groupby('category').___(orders=('order_id', 'count'), revenue=('revenue', 'sum'), return_rate=('ret', 'mean'))
top_cat = cat['revenue'].___()
riskiest = cat['return_rate'].idxmax()
best_product = df.groupby('product')['revenue'].sum().___()
print(top_cat, riskiest, best_product)`,
            solution: `df['ret'] = (df['returned'] == 'yes')
cat = df.groupby('category').agg(orders=('order_id', 'count'), revenue=('revenue', 'sum'), return_rate=('ret', 'mean'))
top_cat = cat['revenue'].idxmax()
riskiest = cat['return_rate'].idxmax()
best_product = df.groupby('product')['revenue'].sum().idxmax()
print(top_cat, riskiest, best_product)`,
            bank: ['agg', 'apply', 'transform', 'idxmax', 'max', 'argmax', 'idxmin'], hints: ['The mean of a True/False column is a rate.'],
            tests: `_c = df.groupby('category').agg(orders=('order_id', 'count'), revenue=('revenue', 'sum'), return_rate=('ret', 'mean'))
check(list(cat.columns) == ['orders', 'revenue', 'return_rate'] and np.allclose(cat['revenue'], _c['revenue']), 'cat has orders, revenue, return_rate per category', "groupby('category').agg(...)")
check(top_cat == _c['revenue'].idxmax() and riskiest == _c['return_rate'].idxmax(), 'top_cat and riskiest are right', 'idxmax of the right column')
check(best_product == df.groupby('product')['revenue'].sum().idxmax(), 'best_product is right', "groupby('product')['revenue'].sum().idxmax()")` },
          { id: 'monthly', title: 'Months and cities', xp: 45, est: 480, star: true,
            prompt: `<ul><li><code>monthly</code>: revenue per month (all orders), a Series by month number</li><li><code>growth</code>: month-over-month growth (<code>pct_change</code>)</li><li><code>best_month</code>: month with the highest revenue</li><li><code>city_aov</code>: average revenue per order line for each city, <b>ignoring returned orders</b>, sorted highest first</li><li><code>top_city</code>: the first city of that list</li></ul><p>Use the Logic Lab to plan the city question.</p>`,
            starter: `monthly = ...
growth = ...
best_month = ...
city_aov = ...
top_city = ...
print(best_month, top_city)`,
            solution: `monthly = df.groupby('month')['revenue'].sum()
growth = monthly.pct_change()
best_month = monthly.idxmax()
kept = df[df['returned'] == 'no']
city_aov = kept.groupby('city')['revenue'].mean().sort_values(ascending=False)
top_city = city_aov.idxmax()
print(best_month, top_city)`,
            hints: ['Filter first (keep returned == "no"), then group by city, then average, then sort.'],
            logic: { task: 'Explain how to find the city whose customers spend the most per order, ignoring returned orders.', xp: 25, minWords: 14,
              rubric: [
                { id: 'drop', label: 'leave out the returned orders', any: ['return', 'exclude', 'ignore', 'remove', 'filter', 'only the', 'not returned', 'drop'], hint: 'Some orders came back. What should you do with them before measuring spending?', code: "kept = df[df['returned'] == 'no']" },
                { id: 'grp', label: 'group by city', any: ['group', 'by city', 'each city', 'per city', 'city'], hint: 'You need one answer per city. How do you make pandas work city by city?', code: '' },
                { id: 'avg', label: 'average revenue per order', any: ['average', 'mean', 'avg', 'per order'], hint: 'Which summary of revenue describes spending per order?', code: "city_aov = kept.groupby('city')['revenue'].mean().sort_values(ascending=False)" },
                { id: 'top', label: 'take the highest', any: ['highest', 'biggest', 'largest', 'top', 'max', 'best', 'sort', 'idxmax'], hint: 'Finally, how do you pick the winner (its NAME)?', code: 'top_city = city_aov.idxmax()' },
              ] },
            tests: `_m = df.groupby('month')['revenue'].sum()
check(np.allclose(monthly.values, _m.values), 'monthly is revenue per month', "groupby('month')['revenue'].sum()")
check(np.allclose(growth.dropna().values, _m.pct_change().dropna().values) and int(best_month) == int(_m.idxmax()), 'growth and best_month are right', 'pct_change() and idxmax()')
_k = df[df['returned'] == 'no'].groupby('city')['revenue'].mean().sort_values(ascending=False)
check(list(city_aov.index) == list(_k.index) and np.allclose(city_aov.values, _k.values), 'city_aov ignores returned orders and is sorted high to low', 'filter, groupby, mean, sort_values(ascending=False)')
check(top_city == _k.index[0], 'top_city is the first city', 'city_aov.idxmax()')` },
          { id: 'customers', title: 'Who are the best customers?', xp: 35, est: 360,
            prompt: `<ul><li><code>cust</code>: per customer: <code>orders</code> (count), <code>spend</code> (sum of revenue), <code>last</code> (latest order date)</li><li><code>top10</code>: the 10 customers with the highest spend (<code>nlargest</code>)</li><li><code>repeat_rate</code>: the share of customers with more than one order</li></ul>`,
            starter: `cust = df.groupby('customer_id').agg(orders=('order_id', 'count'), spend=('revenue', 'sum'), last=('order_date', '___'))
top10 = cust.___(10, 'spend')
repeat_rate = (cust['orders'] > ___).mean()
print(len(top10), round(repeat_rate, 3))`,
            solution: `cust = df.groupby('customer_id').agg(orders=('order_id', 'count'), spend=('revenue', 'sum'), last=('order_date', 'max'))
top10 = cust.nlargest(10, 'spend')
repeat_rate = (cust['orders'] > 1).mean()
print(len(top10), round(repeat_rate, 3))`,
            bank: ['max', 'min', 'nlargest', 'nsmallest', 'head', '1', '2'], hints: ['nlargest(10, "spend") sorts for you.'],
            tests: `_c = df.groupby('customer_id').agg(orders=('order_id', 'count'), spend=('revenue', 'sum'), last=('order_date', 'max'))
check(len(cust) == len(_c) and np.allclose(cust['spend'].sort_index(), _c['spend'].sort_index()), 'cust has one row per customer', "groupby('customer_id').agg(...)")
check(len(top10) == 10 and abs(top10['spend'].iloc[0] - _c['spend'].max()) < 1e-6, 'top10 holds the 10 biggest spenders', "cust.nlargest(10, 'spend')")
check(abs(repeat_rate - (_c['orders'] > 1).mean()) < 1e-9, 'repeat_rate is the share with > 1 order', "(cust['orders'] > 1).mean()")` },
          { id: 'report', title: 'Revenue dashboard', xp: 30, est: 300,
            prompt: `<p>Two charts: revenue per month (line) and revenue per category (bars).</p>`,
            starter: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
ax1.plot(monthly.index, monthly.values, marker='o', color='#2F6FE0')
ax1.set_title('Revenue by month')
ax1.set_ylabel('revenue (INR)')
ax1.set_xlabel('month')
ax2.bar(cat.index, cat['___'], color='#1E8E5A')
ax2.set_title('Revenue by category')
ax2.set_ylabel('revenue (INR)')
ax2.tick_params(axis='x', rotation=30)
plt.tight_layout()
print('dashboard ready')`,
            solution: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
ax1.plot(monthly.index, monthly.values, marker='o', color='#2F6FE0')
ax1.set_title('Revenue by month')
ax1.set_ylabel('revenue (INR)')
ax1.set_xlabel('month')
ax2.bar(cat.index, cat['revenue'], color='#1E8E5A')
ax2.set_title('Revenue by category')
ax2.set_ylabel('revenue (INR)')
ax2.tick_params(axis='x', rotation=30)
plt.tight_layout()
print('dashboard ready')`,
            bank: ['revenue', 'orders', 'return_rate'], hints: ['The bars show revenue.'],
            tests: `${FIG(2)}
check(len(plt.gcf().axes[1].patches) == 5, 'the right chart has 5 bars (one per category)', 'ax2.bar(cat.index, cat["revenue"])')` },
        ],
        flagship_ms: [
          { id: 'segments', title: 'Flagship: customer segments', xp: 45, est: 420, star: true,
            prompt: `<p>Split customers into four equal-sized spend segments with <code>pd.qcut</code> (labels Bronze, Silver, Gold, Platinum, lowest to highest spend), then measure how much of total spend each segment contributes.</p><ul><li><code>cust['segment']</code></li><li><code>segment_share</code>: Series of spend share per segment (sums to 1)</li><li><code>top_share</code>: the Platinum share</li></ul>`,
            starter: `cust['segment'] = pd.qcut(cust['spend'], ___, labels=['Bronze', 'Silver', 'Gold', 'Platinum'])
segment_share = cust.groupby('segment', observed=True)['spend'].sum() / cust['spend'].___()
top_share = segment_share['___']
print(round(top_share, 3))`,
            solution: `cust['segment'] = pd.qcut(cust['spend'], 4, labels=['Bronze', 'Silver', 'Gold', 'Platinum'])
segment_share = cust.groupby('segment', observed=True)['spend'].sum() / cust['spend'].sum()
top_share = segment_share['Platinum']
print(round(top_share, 3))`,
            bank: ['4', '5', '10', 'sum', 'mean', 'Platinum', 'Gold'], hints: ['qcut(x, 4) makes quartiles: four groups of (nearly) equal size.'],
            tests: `check(cust['segment'].astype(str).nunique() == 4 and abs(cust['segment'].value_counts().max() - cust['segment'].value_counts().min()) <= 1, 'four segments of nearly equal size', 'pd.qcut(spend, 4, labels=[...])')
check(abs(segment_share.sum() - 1) < 1e-9, 'segment_share sums to 1', 'segment spend / total spend')
check(top_share == segment_share['Platinum'] and top_share > 0.4, 'Platinum customers carry the biggest share', "segment_share['Platinum']")` },
          { id: 'payment', title: 'Flagship: payment mix by city', xp: 40, est: 360,
            prompt: `<ul><li><code>mix</code>: for each city, the share of orders by payment method: <code>pd.crosstab(df['city'], df['payment'], normalize='index')</code></li><li><code>cod_city</code>: the city with the highest Cash-on-Delivery (COD) share</li><li><code>cod_ret</code>: return rate of COD orders divided by return rate of non-COD orders</li></ul>`,
            starter: `mix = pd.crosstab(df['city'], df['payment'], ___='index')
cod_city = mix['COD'].___()
is_cod = df['payment'] == 'COD'
cod_ret = df.loc[is_cod, 'ret'].mean() / df.loc[~is_cod, 'ret'].mean()
print(cod_city, round(cod_ret, 2))`,
            solution: `mix = pd.crosstab(df['city'], df['payment'], normalize='index')
cod_city = mix['COD'].idxmax()
is_cod = df['payment'] == 'COD'
cod_ret = df.loc[is_cod, 'ret'].mean() / df.loc[~is_cod, 'ret'].mean()
print(cod_city, round(cod_ret, 2))`,
            bank: ['normalize', 'margins', 'idxmax', 'max', 'argmax'], hints: ['normalize="index" makes each ROW sum to 1.'],
            tests: `_x = pd.crosstab(df['city'], df['payment'], normalize='index')
check(np.allclose(mix.values, _x.values) and np.allclose(mix.sum(axis=1), 1), 'mix rows each sum to 1', "normalize='index'")
check(cod_city == _x['COD'].idxmax(), 'cod_city has the highest COD share', "mix['COD'].idxmax()")
_c = df['payment'] == 'COD'
check(abs(cod_ret - df.loc[_c, 'ret'].mean() / df.loc[~_c, 'ret'].mean()) < 1e-9, 'cod_ret compares return rates', 'two means, divided')` },
        ],
      },

      /* ====================================================== opd */
      {
        id: 'clinicflow', hours: 5, title: 'ClinicFlow: cut waiting times in a hospital outpatient department',
        pitch: 'A hospital wants to shorten patient waits. You have four months of outpatient visits. Find which departments are overloaded, which weekdays are worst, how insurance and follow-up behaviour differ, and which waits are statistical outliers.',
        real: 'The operations analytics used by hospital networks and health-tech startups (Practo-style scheduling, queue and capacity planning).',
        flagship_note: 'a log of ~3,500 visits (instead of ~1,300) and two extra milestones: outlier waiting times by department (IQR rule) and a weekly capacity trend.',
        dataset: { file: 'opd.csv', desc: 'Synthetic outpatient-department visits for Jan-Apr 2026: department, patient age and gender, waiting time, consultation time, cost, insurance and whether a follow-up was booked. No real patients; Mondays are busiest.',
          columns: [['visit_id', 'unique visit'], ['visit_date', 'YYYY-MM-DD'], ['department', 'General, Cardiology, Orthopaedics, Paediatrics, ENT or Dermatology'], ['age', 'patient age in years'], ['gender', 'F or M'], ['wait_min', 'minutes waited before the consultation'], ['consult_min', 'consultation length in minutes'], ['cost', 'bill in INR'], ['insured', 'yes/no'], ['follow_up', 'yes if a follow-up visit was booked']], gen: DS.opd },
        refs: ['The WHO and national health portals publish aggregated outpatient statistics; MIMIC and eICU (PhysioNet) are real de-identified clinical datasets for later.', 'Never publish real patient data: aggregate and anonymise first.'],
        milestones: [
          { id: 'load', title: 'Load and age bands', xp: 25, est: 240,
            prompt: `<p>Load the CSV with dates parsed, then create <code>age_group</code> with <code>pd.cut</code> using bins <code>[-1, 14, 30, 50, 70, 120]</code> and labels <code>child, young, adult, mature, senior</code>. Store the number of visits in each group, in label order, in <code>group_counts</code>.</p>`,
            starter: `import pandas as pd

df = pd.read_csv('data/opd.csv', parse_dates=['visit_date'])
n_visits = len(df)
df['age_group'] = pd.___(df['age'], bins=[-1, 14, 30, 50, 70, 120], labels=['child', 'young', 'adult', 'mature', 'senior'])
group_counts = df['age_group'].value_counts().___()
print(n_visits)
print(group_counts)`,
            solution: `import pandas as pd

df = pd.read_csv('data/opd.csv', parse_dates=['visit_date'])
n_visits = len(df)
df['age_group'] = pd.cut(df['age'], bins=[-1, 14, 30, 50, 70, 120], labels=['child', 'young', 'adult', 'mature', 'senior'])
group_counts = df['age_group'].value_counts().sort_index()
print(n_visits)
print(group_counts)`,
            bank: ['cut', 'qcut', 'sort_index', 'sort_values', 'reset_index'], hints: ['cut uses the bins you give; qcut makes equal-sized groups.', 'sort_index() orders the labels child..senior.'],
            tests: `_r = pd.read_csv('data/opd.csv', parse_dates=['visit_date'])
check(n_visits == len(_r) and str(df['visit_date'].dtype).startswith('datetime64'), 'visits loaded with real dates', 'parse_dates=["visit_date"]')
_a = pd.cut(_r['age'], bins=[-1, 14, 30, 50, 70, 120], labels=['child', 'young', 'adult', 'mature', 'senior'])
check(df['age_group'].astype(str).tolist() == _a.astype(str).tolist(), 'age_group bands are right', 'pd.cut(df["age"], bins=[...], labels=[...])')
check(list(group_counts.index) == ['child', 'young', 'adult', 'mature', 'senior'] and int(group_counts.sum()) == len(df), 'group_counts is in label order', 'value_counts().sort_index()')` },
          { id: 'dept', title: 'Department scorecard', xp: 35, est: 360,
            prompt: `<ul><li><code>dept</code>: per department: <code>visits</code> (count of visit_id), <code>avg_wait</code> (mean wait_min), <code>avg_cost</code> (mean cost)</li><li><code>busiest_dept</code>: most visits</li><li><code>longest_wait_dept</code>: highest average wait</li><li><code>priciest_dept</code>: highest average cost</li></ul>`,
            starter: `dept = df.groupby('department').___(visits=('visit_id', 'count'), avg_wait=('wait_min', 'mean'), avg_cost=('cost', 'mean'))
busiest_dept = dept['visits'].___()
longest_wait_dept = dept['avg_wait'].idxmax()
priciest_dept = dept['avg_cost'].idxmax()
print(busiest_dept, longest_wait_dept, priciest_dept)`,
            solution: `dept = df.groupby('department').agg(visits=('visit_id', 'count'), avg_wait=('wait_min', 'mean'), avg_cost=('cost', 'mean'))
busiest_dept = dept['visits'].idxmax()
longest_wait_dept = dept['avg_wait'].idxmax()
priciest_dept = dept['avg_cost'].idxmax()
print(busiest_dept, longest_wait_dept, priciest_dept)`,
            bank: ['agg', 'apply', 'transform', 'idxmax', 'max', 'idxmin'], hints: ['idxmax returns the department NAME.'],
            tests: `_d = df.groupby('department').agg(visits=('visit_id', 'count'), avg_wait=('wait_min', 'mean'), avg_cost=('cost', 'mean'))
check(list(dept.columns) == ['visits', 'avg_wait', 'avg_cost'] and np.allclose(dept.values, _d.values), 'dept has visits, avg_wait, avg_cost', "groupby('department').agg(...)")
check((busiest_dept, longest_wait_dept, priciest_dept) == (_d['visits'].idxmax(), _d['avg_wait'].idxmax(), _d['avg_cost'].idxmax()), 'the three winners are right', 'idxmax of each column')` },
          { id: 'weekday', title: 'The worst weekday', xp: 35, est: 360,
            prompt: `<ul><li><code>weekday</code>: add a column with the day name of each visit</li><li><code>by_day</code>: visits per weekday, in calendar order (Monday...Sunday) via <code>reindex</code></li><li><code>busiest_day</code>: the weekday with the most visits</li><li><code>wait_by_day</code>: mean wait per weekday, rounded to 1 decimal, in calendar order</li></ul>`,
            starter: `days = ${DAYS}
df['weekday'] = df['visit_date'].dt.___()
by_day = df.groupby('weekday').size().___(days)
busiest_day = by_day.idxmax()
wait_by_day = df.groupby('weekday')['wait_min'].mean().___(1).reindex(days)
print(busiest_day)
print(wait_by_day)`,
            solution: `days = ${DAYS}
df['weekday'] = df['visit_date'].dt.day_name()
by_day = df.groupby('weekday').size().reindex(days)
busiest_day = by_day.idxmax()
wait_by_day = df.groupby('weekday')['wait_min'].mean().round(1).reindex(days)
print(busiest_day)
print(wait_by_day)`,
            bank: ['day_name', 'weekday_name', 'reindex', 'sort_index', 'round', 'floor'], hints: ['reindex(days) forces calendar order.'],
            tests: `_by = df.groupby(df['visit_date'].dt.day_name()).size().reindex(${DAYS})
check(list(by_day.index) == ${DAYS} and np.array_equal(by_day.values, _by.values), 'by_day counts visits in calendar order', 'groupby("weekday").size().reindex(days)')
check(busiest_day == _by.idxmax(), 'busiest_day is right', 'by_day.idxmax()')
_w = df.groupby(df['visit_date'].dt.day_name())['wait_min'].mean().round(1).reindex(${DAYS})
check(list(wait_by_day.index) == ${DAYS} and np.allclose(wait_by_day.values, _w.values), 'wait_by_day is rounded and in calendar order', 'mean().round(1).reindex(days)')` },
          { id: 'insured', title: 'Insurance and follow-ups', xp: 45, est: 480, star: true,
            prompt: `<ul><li><code>cost_by_ins</code>: mean cost for insured = yes / no</li><li><code>fu_rate</code>: for <b>insured</b> patients only, the follow-up rate per department (share of visits with follow_up == "yes"), as a Series</li><li><code>top_fu_dept</code>: the department with the highest such rate</li></ul><p>Use the Logic Lab to plan the follow-up question.</p>`,
            starter: `cost_by_ins = ...
fu_rate = ...
top_fu_dept = ...
print(top_fu_dept)`,
            solution: `cost_by_ins = df.groupby('insured')['cost'].mean()
ins = df[df['insured'] == 'yes'].copy()
ins['fu'] = ins['follow_up'] == 'yes'
fu_rate = ins.groupby('department')['fu'].mean()
top_fu_dept = fu_rate.idxmax()
print(top_fu_dept)`,
            hints: ['Keep only insured == "yes", then turn follow_up into True/False so its mean is a rate.'],
            logic: { task: 'Explain how you would find which department books follow-ups most often among insured patients.', xp: 25, minWords: 14,
              rubric: [
                { id: 'only', label: 'keep only insured patients', any: ['insured', 'insurance', 'only', 'filter', 'keep', 'restrict'], hint: 'The question is only about one group of patients. Which rows do you keep first?', code: "ins = df[df['insured'] == 'yes'].copy()" },
                { id: 'bool', label: 'turn yes/no into True/False (or 1/0)', any: ['true', 'false', 'boolean', 'convert', 'number', '1 and 0', 'yes.*no', 'flag', 'indicator', '== ?.yes'], hint: 'A rate is an average. How can "yes/no" become something you can average?', code: "ins['fu'] = ins['follow_up'] == 'yes'" },
                { id: 'grp', label: 'average per department', any: ['group', 'per department', 'each department', 'by department', 'mean', 'average', 'rate', 'share', 'percentage'], hint: 'Then summarise it department by department.', code: "fu_rate = ins.groupby('department')['fu'].mean()" },
                { id: 'top', label: 'choose the highest', any: ['highest', 'largest', 'biggest', 'max', 'top', 'best', 'idxmax'], hint: 'Lastly, which department (NAME) do you report?', code: 'top_fu_dept = fu_rate.idxmax()' },
              ] },
            tests: `check(abs(cost_by_ins['yes'] - df[df['insured'] == 'yes']['cost'].mean()) < 1e-9 and abs(cost_by_ins['no'] - df[df['insured'] == 'no']['cost'].mean()) < 1e-9, 'cost_by_ins has the mean cost for yes and no', "groupby('insured')['cost'].mean()")
_i = df[df['insured'] == 'yes']
_f = (_i['follow_up'] == 'yes').groupby(_i['department']).mean()
check(len(fu_rate) == 6 and np.allclose(fu_rate.sort_index().values, _f.sort_index().values), 'fu_rate is the follow-up rate per department (insured only)', 'filter, convert, groupby, mean')
check(top_fu_dept == _f.idxmax(), 'top_fu_dept is right', 'fu_rate.idxmax()')` },
          { id: 'cross', title: 'Who visits which department?', xp: 30, est: 300,
            prompt: `<ul><li><code>ct</code>: counts of visits: rows = department, columns = age_group (<code>pd.crosstab</code>)</li><li><code>senior_dept</code>: department that sees the most seniors</li><li><code>share</code>: the same table as row shares (each row sums to 1; <code>normalize="index"</code>)</li><li><code>child_share_peds</code>: the share of Paediatrics visits that are children</li></ul>`,
            starter: `ct = pd.crosstab(df['department'], df['___'])
senior_dept = ct['senior'].idxmax()
share = pd.crosstab(df['department'], df['age_group'], normalize='___')
child_share_peds = share.loc['Paediatrics', 'child']
print(senior_dept, round(child_share_peds, 3))`,
            solution: `ct = pd.crosstab(df['department'], df['age_group'])
senior_dept = ct['senior'].idxmax()
share = pd.crosstab(df['department'], df['age_group'], normalize='index')
child_share_peds = share.loc['Paediatrics', 'child']
print(senior_dept, round(child_share_peds, 3))`,
            bank: ['age_group', 'age', 'index', 'columns', 'all'], hints: ['normalize="index" divides each row by its own total.'],
            tests: `_c = pd.crosstab(df['department'], df['age_group'])
check(ct.shape == _c.shape and np.array_equal(ct.values, _c.values), 'ct counts visits by department and age group', "pd.crosstab(df['department'], df['age_group'])")
check(senior_dept == _c['senior'].idxmax(), 'senior_dept is right', "ct['senior'].idxmax()")
check(np.allclose(share.sum(axis=1), 1) and share.loc['Paediatrics', 'child'] > 0.9, 'share rows sum to 1 and Paediatrics is almost all children', "normalize='index'")` },
          { id: 'report', title: 'Waiting-time dashboard', xp: 30, est: 300,
            prompt: `<p>Two charts: average wait by department (bars) and the age distribution of patients (histogram).</p>`,
            starter: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
ax1.bar(dept.index, dept['___'], color='#D2600F')
ax1.set_title('Average wait by department')
ax1.set_ylabel('minutes')
ax1.tick_params(axis='x', rotation=35)
ax2.hist(df['age'], bins=20, color='#7A4FD0')
ax2.set_title('Patient ages')
ax2.set_xlabel('age')
ax2.set_ylabel('visits')
plt.tight_layout()
print('dashboard ready')`,
            solution: `import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 3.8))
ax1.bar(dept.index, dept['avg_wait'], color='#D2600F')
ax1.set_title('Average wait by department')
ax1.set_ylabel('minutes')
ax1.tick_params(axis='x', rotation=35)
ax2.hist(df['age'], bins=20, color='#7A4FD0')
ax2.set_title('Patient ages')
ax2.set_xlabel('age')
ax2.set_ylabel('visits')
plt.tight_layout()
print('dashboard ready')`,
            bank: ['avg_wait', 'visits', 'avg_cost'], hints: ['The first chart is about waiting time.'],
            tests: `${FIG(2)}
check(len(plt.gcf().axes[0].patches) == 6, 'the left chart has 6 bars', 'one bar per department')` },
        ],
        flagship_ms: [
          { id: 'outliers', title: 'Flagship: unusual waits', xp: 45, est: 480, star: true,
            prompt: `<p>Find waits that are unusually long <b>for their department</b> with the IQR rule: a wait is an outlier if it is greater than <code>Q3 + 1.5 * IQR</code> of its own department.</p><ul><li><code>q1</code>, <code>q3</code>: per-row quartiles of the department (use <code>groupby(...).transform(lambda s: s.quantile(...))</code>)</li><li><code>outlier</code>: boolean column</li><li><code>n_outliers</code> and <code>worst_dept</code>: the department with the highest <b>share</b> of outliers</li></ul>`,
            starter: `g = df.groupby('department')['wait_min']
q1 = g.transform(lambda s: s.quantile(0.25))
q3 = g.transform(lambda s: s.quantile(___))
iqr = q3 - q1
df['outlier'] = df['wait_min'] > q3 + ___ * iqr
n_outliers = df['outlier'].sum()
worst_dept = df.groupby('department')['outlier'].___().idxmax()
print(n_outliers, worst_dept)`,
            solution: `g = df.groupby('department')['wait_min']
q1 = g.transform(lambda s: s.quantile(0.25))
q3 = g.transform(lambda s: s.quantile(0.75))
iqr = q3 - q1
df['outlier'] = df['wait_min'] > q3 + 1.5 * iqr
n_outliers = df['outlier'].sum()
worst_dept = df.groupby('department')['outlier'].mean().idxmax()
print(n_outliers, worst_dept)`,
            bank: ['0.75', '0.5', '1.5', '3', 'mean', 'sum'], hints: ['Q3 is the 0.75 quantile; the classic fence multiplier is 1.5.'],
            tests: `_g = df.groupby('department')['wait_min']
_q1 = _g.transform(lambda s: s.quantile(0.25)); _q3 = _g.transform(lambda s: s.quantile(0.75))
_o = df['wait_min'] > _q3 + 1.5 * (_q3 - _q1)
check(df['outlier'].tolist() == _o.tolist(), 'outlier flags waits above Q3 + 1.5 x IQR of the department', 'compare wait_min with q3 + 1.5 * iqr')
check(int(n_outliers) == int(_o.sum()) and n_outliers > 0, 'n_outliers is right', "df['outlier'].sum()")
check(worst_dept == _o.groupby(df['department']).mean().idxmax(), 'worst_dept has the highest outlier share', "groupby('department')['outlier'].mean().idxmax()")` },
          { id: 'weekly', title: 'Flagship: weekly capacity trend', xp: 45, est: 420,
            prompt: `<ul><li><code>weekly</code>: visits per week (<code>resample("W", on="visit_date")</code>, then <code>.size()</code>)</li><li><code>trend</code>: the 4-week moving average of <code>weekly</code></li><li><code>busiest_week</code>: the week-ending date with the most visits</li><li><code>peak_ratio</code>: busiest week visits divided by the average week</li></ul>`,
            starter: `weekly = df.___('W', on='visit_date').size()
trend = weekly.___(4).mean()
busiest_week = weekly.idxmax()
peak_ratio = weekly.max() / weekly.___()
print(busiest_week.date(), round(peak_ratio, 2))`,
            solution: `weekly = df.resample('W', on='visit_date').size()
trend = weekly.rolling(4).mean()
busiest_week = weekly.idxmax()
peak_ratio = weekly.max() / weekly.mean()
print(busiest_week.date(), round(peak_ratio, 2))`,
            bank: ['resample', 'groupby', 'rolling', 'expanding', 'mean', 'median'], hints: ['resample("W", on="visit_date") groups by calendar week using the date COLUMN.'],
            tests: `_w = df.resample('W', on='visit_date').size()
check(np.array_equal(weekly.values, _w.values) and len(weekly) == len(_w), 'weekly counts visits per week', "df.resample('W', on='visit_date').size()")
check(trend.isna().sum() == 3, 'trend is a 4-week moving average', 'weekly.rolling(4).mean()')
check(busiest_week == _w.idxmax() and abs(peak_ratio - _w.max() / _w.mean()) < 1e-9, 'busiest_week and peak_ratio are right', 'idxmax() and max() / mean()')` },
        ],
      },
    ],
  };
})();
