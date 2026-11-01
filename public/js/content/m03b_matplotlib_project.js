'use strict';
/* =====================================================================
   Matplotlib projects: 3 variants (each becomes a published "visual story" dashboard)
   Datasets are re-generated per learner from the same generators the pandas projects use.
   ===================================================================== */
(function () {
  const M = DSQ.modules.find(m => m.id === 'matplotlib');
  const LABELS = `check(ax.get_title() and ax.get_xlabel() and ax.get_ylabel(), 'title and both axis labels are set', 'set_title, set_xlabel, set_ylabel')`;
  const DASH = (n) => `fig = plt.gcf()
check(len(fig.axes) >= ${n}, 'the dashboard has ${n} charts', 'plt.subplots(2, 2)')
check(all(a.get_title() for a in fig.axes[:${n}]), 'every chart has a title', 'set_title on each axes')
check(fig._suptitle is not None and len(fig._suptitle.get_text()) > 5, 'the dashboard has an overall title (suptitle)', 'fig.suptitle("...")')`;

  M.project = {
    variants: [
      /* ====================================================== rides */
      {
        id: 'rideviz', flagship: true, hours: 4, title: 'RideViz: a visual operations story for a bike-share company',
        pitch: 'The operations director has 90 days of trips and no time to read tables. Turn the data into a four-chart dashboard that answers: is demand growing, which stations earn the most, how do riders differ, and when is the system busiest?',
        real: 'The executive dashboards (Tableau / Power BI style) that every mobility company builds - here made reproducible in code.',
        flagship_note: 'a larger trip log (~4,000 trips) and two extra chart milestones: a 3-D scatter of trip length, time and fare, and an annotated "story" chart.',
        dataset: { file: 'bikes.csv', desc: 'Synthetic bike-share trips (Jan-Mar 2026) in the same messy format as the pandas project: duplicates, missing durations, inconsistent station names. Step 1 cleans just what the charts need.',
          columns: [['trip_id', 'trip id'], ['start_date', 'date'], ['start_hour', '0-23'], ['station', 'start station'], ['user_type', 'member / casual'], ['distance_km', 'distance'], ['duration_min', 'minutes (some missing)'], ['fare', 'amount charged'], ['rating', 'rating (often missing)']], gen: DS.bikes },
        refs: ['Edward Tufte, "The Visual Display of Quantitative Information" - the classic on honest charts.', 'Matplotlib gallery (matplotlib.org/stable/gallery) has copy-ready examples for every chart you build here.'],
        milestones: [
          { id: 'prep', title: 'Prepare the data for charts', xp: 20, est: 150,
            prompt: `<p>The cleaning is written for you; fill the two blanks. <code>daily</code> must be the number of trips per date and <code>rev</code> the revenue per station sorted from the smallest.</p>`,
            starter: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/bikes.csv').drop_duplicates().dropna(subset=['duration_min'])
df['station'] = df['station'].str.strip().str.title()
df['start_date'] = pd.to_datetime(df['start_date'])
daily = df.groupby('start_date').___()
rev = df.groupby('station')['fare'].sum().___()
print(daily.shape, rev.index[-1])`,
            solution: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/bikes.csv').drop_duplicates().dropna(subset=['duration_min'])
df['station'] = df['station'].str.strip().str.title()
df['start_date'] = pd.to_datetime(df['start_date'])
daily = df.groupby('start_date').size()
rev = df.groupby('station')['fare'].sum().sort_values()
print(daily.shape, rev.index[-1])`,
            bank: ['size', 'sum', 'sort_values', 'sort_index', 'max'], hints: ['size() counts rows per group.', 'sort_values() sorts from smallest to largest by default.'],
            tests: `check(int(daily.sum()) == len(df) and len(daily) > 60, 'daily counts trips per date', "groupby('start_date').size()")
check(list(rev.values) == sorted(rev.values) and len(rev) == 6, 'rev is revenue per station, smallest first', 'sum() then sort_values()')` },
          { id: 'trend', title: 'Chart 1: is demand growing?', xp: 30, est: 300,
            prompt: `<p>Draw the daily trips as a faint line and the <b>7-day rolling mean</b> as a thick line on top (<code>daily.rolling(7).mean()</code>). Add a title, axis labels and a legend with two entries.</p>`,
            starter: `fig, ax = plt.subplots(figsize=(9, 3.6))
ax.plot(daily.index, daily.values, alpha=0.35, label='daily trips')
ax.plot(daily.index, daily.___(7).mean(), lw=2.5, label='7-day average')
ax.set_title('___')
ax.set_xlabel('date')
ax.set_ylabel('trips')
ax.legend()
fig.autofmt_xdate()`,
            solution: `fig, ax = plt.subplots(figsize=(9, 3.6))
ax.plot(daily.index, daily.values, alpha=0.35, label='daily trips')
ax.plot(daily.index, daily.rolling(7).mean(), lw=2.5, label='7-day average')
ax.set_title('Daily trips and their 7-day average')
ax.set_xlabel('date')
ax.set_ylabel('trips')
ax.legend()
fig.autofmt_xdate()`,
            bank: ['rolling', 'expanding', 'resample', 'Daily trips and their 7-day average', 'Chart'], hints: ['rolling(7).mean() smooths a daily series.'],
            tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) == 2 and np.allclose(ax.lines[0].get_ydata(), daily.values), 'the first line is the daily trips', 'ax.plot(daily.index, daily.values, ...)')
check(np.isnan(ax.lines[1].get_ydata()).sum() == 6, 'the second line is a 7-day rolling mean', 'daily.rolling(7).mean()')
check(len(ax.get_legend().get_texts()) == 2 and len(ax.get_title()) > 5, 'two legend entries and a real title', 'label=... and ax.legend()')
${LABELS}` },
          { id: 'compare', title: 'Chart 2: which stations earn the most?', xp: 30, est: 300,
            prompt: `<p>A horizontal bar chart of revenue by station using <code>rev</code> (already sorted so the biggest ends up at the top), with the revenue written on each bar (<code>bar_label</code>), a title that states the winner, and an x label.</p>`,
            starter: `fig, ax = plt.subplots(figsize=(7, 3.8))
bars = ax.___(rev.index, rev.values, color='#2F6FE0')
ax.___(bars, fmt='%.0f', padding=3)
ax.set_title(f'{rev.index[-1]} earns the most')
ax.set_xlabel('___')`,
            solution: `fig, ax = plt.subplots(figsize=(7, 3.8))
bars = ax.barh(rev.index, rev.values, color='#2F6FE0')
ax.bar_label(bars, fmt='%.0f', padding=3)
ax.set_title(f'{rev.index[-1]} earns the most')
ax.set_xlabel('revenue (INR)')`,
            bank: ['barh', 'bar', 'bar_label', 'annotate', 'revenue (INR)', 'station'], hints: ['barh draws horizontal bars; bar_label writes the values.'],
            tests: `ax = plt.gcf().axes[0]
w = [p.get_width() for p in ax.patches]
check(len(w) == 6 and np.allclose(w, rev.values), 'six horizontal bars with the station revenue', 'ax.barh(rev.index, rev.values)')
check(len(ax.texts) >= 6, 'each bar shows its value', 'ax.bar_label(bars)')
check(rev.index[-1] in ax.get_title() and ax.get_xlabel(), 'the title names the winner and the x axis is labelled', "f'{rev.index[-1]} earns the most'")` },
          { id: 'relation', title: 'Chart 3: how do riders differ?', xp: 35, est: 360,
            prompt: `<p>Scatter <code>distance_km</code> (x) against <code>duration_min</code> (y), one scatter per user type with its own colour and a label, and a dashed trend line from <code>np.polyfit(x, y, 1)</code> over all trips.</p>`,
            starter: `fig, ax = plt.subplots(figsize=(7, 4))
for ut, col in [('member', '#2F6FE0'), ('casual', '#D2600F')]:
    sub = df[df['user_type'] == ut]
    ax.scatter(sub['distance_km'], sub['duration_min'], s=12, alpha=0.4, color=col, label=ut)
m, b = np.polyfit(df['distance_km'], df['duration_min'], ___)
xs = np.linspace(df['distance_km'].min(), df['distance_km'].max(), 50)
ax.plot(xs, m * xs + b, 'k--', label=f'trend: {m:.1f} min per km')
ax.set_title('Longer rides take longer - at every rider type')
ax.set_xlabel('distance (km)')
ax.set_ylabel('duration (min)')
ax.legend()`,
            solution: `fig, ax = plt.subplots(figsize=(7, 4))
for ut, col in [('member', '#2F6FE0'), ('casual', '#D2600F')]:
    sub = df[df['user_type'] == ut]
    ax.scatter(sub['distance_km'], sub['duration_min'], s=12, alpha=0.4, color=col, label=ut)
m, b = np.polyfit(df['distance_km'], df['duration_min'], 1)
xs = np.linspace(df['distance_km'].min(), df['distance_km'].max(), 50)
ax.plot(xs, m * xs + b, 'k--', label=f'trend: {m:.1f} min per km')
ax.set_title('Longer rides take longer - at every rider type')
ax.set_xlabel('distance (km)')
ax.set_ylabel('duration (min)')
ax.legend()`,
            bank: ['1', '2', '0', '3'], hints: ['A straight line is a degree-1 polynomial.'],
            tests: `ax = plt.gcf().axes[0]
check(len(ax.collections) == 2 and sum(len(c.get_offsets()) for c in ax.collections) == len(df), 'two scatter groups holding every trip', 'one scatter per user type')
check(len(ax.lines) == 1 and ax.lines[0].get_linestyle() == '--', 'one dashed trend line', "ax.plot(xs, m * xs + b, 'k--')")
check(len(ax.get_legend().get_texts()) == 3, 'legend has member, casual and the trend', 'label= on every call')
${LABELS}` },
          { id: 'dash', title: 'Publish the 4-chart dashboard', xp: 50, est: 600, star: true,
            prompt: `<p>Assemble the final 2x2 dashboard with an overall title. Top-left: daily trips line. Top-right: station revenue bars (barh). Bottom-left: histogram of trip distance (20 bins). Bottom-right: a <b>heatmap</b> of trip counts by weekday (rows) and hour (columns) via <code>imshow</code>, with a colour bar.</p>`,
            starter: `fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(daily.index, daily.values, color='#2F6FE0')
axes[0, 0].set_title('Daily trips')
axes[0, 1].barh(rev.index, rev.values, color='#1E8E5A')
axes[0, 1].set_title('Revenue by station')
axes[1, 0].hist(df['distance_km'], bins=___, color='#7A4FD0')
axes[1, 0].set_title('Trip distance (km)')
grid = df.pivot_table(index=df['start_date'].dt.dayofweek, columns='start_hour', values='trip_id', aggfunc='count').fillna(0)
im = axes[1, 1].___(grid.values, cmap='viridis', aspect='auto')
axes[1, 1].set_title('Trips by weekday x hour')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('CityBike operations dashboard', fontsize=14)
fig.tight_layout()`,
            solution: `fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(daily.index, daily.values, color='#2F6FE0')
axes[0, 0].set_title('Daily trips')
axes[0, 1].barh(rev.index, rev.values, color='#1E8E5A')
axes[0, 1].set_title('Revenue by station')
axes[1, 0].hist(df['distance_km'], bins=20, color='#7A4FD0')
axes[1, 0].set_title('Trip distance (km)')
grid = df.pivot_table(index=df['start_date'].dt.dayofweek, columns='start_hour', values='trip_id', aggfunc='count').fillna(0)
im = axes[1, 1].imshow(grid.values, cmap='viridis', aspect='auto')
axes[1, 1].set_title('Trips by weekday x hour')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('CityBike operations dashboard', fontsize=14)
fig.tight_layout()`,
            bank: ['20', '5', 'imshow', 'plot', 'bar', 'scatter'], hints: ['imshow paints a 2-D array as colour.'],
            tests: `${DASH(4)}
a = plt.gcf().axes
check(len(a[1].patches) == 6 and len(a[2].patches) == 20, 'six station bars and a 20-bin histogram', 'barh for stations, hist(bins=20)')
check(any(len(x.images) == 1 for x in a), 'the heatmap is drawn with imshow', 'axes[1, 1].imshow(grid.values, ...)')
check(len(a) >= 5, 'the heatmap has a colour bar', 'fig.colorbar(im, ax=...)')` },
        ],
        flagship_ms: [
          { id: 'cube', title: 'Flagship: a 3-D view of the fares', xp: 45, est: 420,
            prompt: `<p>Plot every trip in 3-D: x = distance, y = duration, z = fare, coloured by user type (members blue, casual orange; one scatter call each with a label), all three axes labelled and a legend.</p>`,
            starter: `fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='___')
for ut, col in [('member', '#2F6FE0'), ('casual', '#D2600F')]:
    s = df[df['user_type'] == ut]
    ax.scatter(s['distance_km'], s['duration_min'], s['fare'], s=8, alpha=0.5, color=col, label=ut)
ax.set_xlabel('distance (km)')
ax.set_ylabel('duration (min)')
ax.set_zlabel('fare')
ax.set_title('Fare by distance and duration')
ax.legend()`,
            solution: `fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='3d')
for ut, col in [('member', '#2F6FE0'), ('casual', '#D2600F')]:
    s = df[df['user_type'] == ut]
    ax.scatter(s['distance_km'], s['duration_min'], s['fare'], s=8, alpha=0.5, color=col, label=ut)
ax.set_xlabel('distance (km)')
ax.set_ylabel('duration (min)')
ax.set_zlabel('fare')
ax.set_title('Fare by distance and duration')
ax.legend()`,
            bank: ['3d', '2d', 'polar'], hints: ['projection="3d"'],
            tests: `ax = plt.gcf().axes[0]
check(getattr(ax, 'name', '') == '3d' and len(ax.collections) == 2, 'a 3-D axes with two scatter groups', "projection='3d' and one scatter per user type")
check(ax.get_xlabel() and ax.get_ylabel() and ax.get_zlabel(), 'all three axes are labelled', 'set_xlabel / ylabel / zlabel')
check(ax.get_legend() is not None, 'there is a legend', 'ax.legend()')` },
          { id: 'story', title: 'Flagship: the annotated story chart', xp: 50, est: 480, star: true,
            prompt: `<p>The headline chart for the board: daily trips as a line, the <b>busiest day</b> annotated with an arrow and the text "busiest day: N trips" (use the real numbers), and a title that includes the percentage by which weekends beat weekdays in average daily trips (compute <code>lift</code> as a percentage, e.g. 38).</p>`,
            starter: `is_we = daily.index.dayofweek >= 5
lift = (daily[is_we].mean() / daily[~is_we].mean() - 1) * ___
top = daily.idxmax()

fig, ax = plt.subplots(figsize=(9, 3.8))
ax.plot(daily.index, daily.values, color='#2F6FE0')
ax.annotate(f'busiest day: {daily.max()} trips', xy=(top, daily.max()), xytext=(top, daily.max() * 1.15), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Weekends beat weekdays by {lift:.0f}%')
ax.set_xlabel('date')
ax.set_ylabel('trips')
fig.autofmt_xdate()`,
            solution: `is_we = daily.index.dayofweek >= 5
lift = (daily[is_we].mean() / daily[~is_we].mean() - 1) * 100
top = daily.idxmax()

fig, ax = plt.subplots(figsize=(9, 3.8))
ax.plot(daily.index, daily.values, color='#2F6FE0')
ax.annotate(f'busiest day: {daily.max()} trips', xy=(top, daily.max()), xytext=(top, daily.max() * 1.15), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Weekends beat weekdays by {lift:.0f}%')
ax.set_xlabel('date')
ax.set_ylabel('trips')
fig.autofmt_xdate()`,
            bank: ['100', '10', '1', '0.01'], hints: ['A fraction becomes a percentage when multiplied by 100.'],
            tests: `ax = plt.gcf().axes[0]
_we = daily.index.dayofweek >= 5
_lift = (daily[_we].mean() / daily[~_we].mean() - 1) * 100
check(abs(lift - _lift) < 1e-6, 'lift is the weekend advantage as a percentage', '(weekend mean / weekday mean - 1) * 100')
check(any(str(int(daily.max())) in t.get_text() and 'busiest' in t.get_text() for t in ax.texts), 'the busiest day is annotated with its real count', "ax.annotate(f'busiest day: {daily.max()} trips', ...)")
check('%' in ax.get_title() and ax.get_xlabel(), 'the title states the weekend lift in %', "f'... {lift:.0f}%'")` },
        ],
      },

      /* ====================================================== shop */
      {
        id: 'shopviz', hours: 4, title: 'ShopViz: the monthly business review, as one dashboard',
        pitch: 'Every month the head of e-commerce wants a one-page picture: how is revenue trending, which categories lead, how are order values spread, and where do cities and categories meet. Build it in matplotlib so it can be regenerated every month with one command.',
        real: 'The monthly business-review (MBR) dashboards used by every e-commerce and retail company.',
        flagship_note: 'a larger order log (~4,500 lines) and two extra milestones: a 3-D bar chart of revenue by month and category, and an annotated best-month story.',
        dataset: { file: 'orders.csv', desc: 'Synthetic online-store order lines Jan-Jun 2026 (category, product, quantity, price, discount, city, payment, returned flag). Revenue after discount is calculated in step 1.',
          columns: [['order_id', 'order line'], ['customer_id', 'buyer'], ['order_date', 'date'], ['category', 'category'], ['product', 'product'], ['qty', 'units'], ['unit_price', 'price per unit'], ['discount_pct', 'percent off'], ['city', 'city'], ['payment', 'payment method'], ['returned', 'yes/no']], gen: DS.orders },
        refs: ['Storytelling with Data (Cole Nussbaumer Knaflic) - turning charts into decisions.', 'Plotly Dash and Streamlit turn scripts like this into live web dashboards.'],
        milestones: [
          { id: 'prep', title: 'Prepare the data for charts', xp: 20, est: 150,
            prompt: `<p>Compute revenue per order line and the three tables the charts need. Fill the blanks.</p>`,
            starter: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/orders.csv', parse_dates=['order_date'])
df['revenue'] = df['qty'] * df['unit_price'] * (1 - df['discount_pct'] / 100)
df['month'] = df['order_date'].dt.___
monthly = df.groupby('month')['revenue'].sum()
cat = df.groupby('category')['revenue'].sum().___()
print(monthly.round(0).to_dict(), cat.index[-1])`,
            solution: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/orders.csv', parse_dates=['order_date'])
df['revenue'] = df['qty'] * df['unit_price'] * (1 - df['discount_pct'] / 100)
df['month'] = df['order_date'].dt.month
monthly = df.groupby('month')['revenue'].sum()
cat = df.groupby('category')['revenue'].sum().sort_values()
print(monthly.round(0).to_dict(), cat.index[-1])`,
            bank: ['month', 'day', 'sort_values', 'sort_index'], hints: ['Smallest first so the biggest bar is on top of a barh.'],
            tests: `check(len(monthly) == 6 and monthly.index.min() == 1, 'monthly has 6 months', "groupby('month')")
check(len(cat) == 5 and list(cat.values) == sorted(cat.values), 'cat is revenue per category, smallest first', 'sort_values()')` },
          { id: 'trend', title: 'Chart 1: the revenue trend', xp: 30, est: 300,
            prompt: `<p>Revenue by month as a line with round markers, the area under it lightly filled (<code>fill_between</code>), a title, axis labels and month numbers as x ticks.</p>`,
            starter: `fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(monthly.index, monthly.values, marker='o', color='#2F6FE0')
ax.___(monthly.index, monthly.values, alpha=0.15, color='#2F6FE0')
ax.set_xticks(monthly.index)
ax.set_title('Revenue by month')
ax.set_xlabel('month')
ax.set_ylabel('revenue (INR)')`,
            solution: `fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(monthly.index, monthly.values, marker='o', color='#2F6FE0')
ax.fill_between(monthly.index, monthly.values, alpha=0.15, color='#2F6FE0')
ax.set_xticks(monthly.index)
ax.set_title('Revenue by month')
ax.set_xlabel('month')
ax.set_ylabel('revenue (INR)')`,
            bank: ['fill_between', 'fill', 'stackplot', 'bar'], hints: ['fill_between(x, y, ...) shades from the line down to zero.'],
            tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) == 1 and np.allclose(ax.lines[0].get_ydata(), monthly.values), 'the line shows monthly revenue', 'ax.plot(monthly.index, monthly.values, ...)')
check(len(ax.collections) >= 1, 'the area under the line is filled', 'ax.fill_between(...)')
check(list(ax.get_xticks()) == list(monthly.index), 'x ticks are the month numbers', 'ax.set_xticks(monthly.index)')
${LABELS}` },
          { id: 'compare', title: 'Chart 2: category league table', xp: 30, est: 300,
            prompt: `<p>A horizontal bar chart of revenue by category (already sorted), values written on the bars, the <b>top bar in orange</b> and the rest blue (pass a list of colours), a title and an x label.</p>`,
            starter: `colors = ['#2F6FE0'] * (len(cat) - 1) + ['___']
fig, ax = plt.subplots(figsize=(7, 3.6))
bars = ax.barh(cat.index, cat.values, color=colors)
ax.bar_label(bars, fmt='%.0f', padding=3)
ax.set_title(f'{cat.index[-1]} leads revenue')
ax.set_xlabel('revenue (INR)')`,
            solution: `colors = ['#2F6FE0'] * (len(cat) - 1) + ['#D2600F']
fig, ax = plt.subplots(figsize=(7, 3.6))
bars = ax.barh(cat.index, cat.values, color=colors)
ax.bar_label(bars, fmt='%.0f', padding=3)
ax.set_title(f'{cat.index[-1]} leads revenue')
ax.set_xlabel('revenue (INR)')`,
            bank: ['#D2600F', '#2F6FE0', 'orange', 'red'], hints: ['Use the orange hex colour #D2600F for the last bar.'],
            tests: `import matplotlib.colors as mc
ax = plt.gcf().axes[0]
check(len(ax.patches) == 5 and np.allclose([p.get_width() for p in ax.patches], cat.values), 'five bars with the category revenue', 'ax.barh(cat.index, cat.values)')
cols = [mc.to_hex(p.get_facecolor()).lower() for p in ax.patches]
check(cols[-1] == '#d2600f' and len(set(cols[:-1])) == 1, 'the top bar is orange and the rest share one colour', 'colors list: blue x 4 + orange')
check(len(ax.texts) >= 5 and ax.get_title() and ax.get_xlabel(), 'values on the bars, title and x label set', 'bar_label, set_title, set_xlabel')` },
          { id: 'dist', title: 'Chart 3: how big are orders?', xp: 35, est: 360,
            prompt: `<p>Two charts side by side: a histogram of order-line revenue (30 bins, log-scaled y axis) and a boxplot of revenue per category (labels = category names in the order of <code>cats</code>). Title each.</p>`,
            starter: `cats = list(cat.index)
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
ax1.hist(df['revenue'], bins=___, color='#7A4FD0')
ax1.set_yscale('___')
ax1.set_title('Order revenue distribution')
ax1.set_xlabel('revenue (INR)')
ax1.set_ylabel('order lines (log)')
ax2.boxplot([df.loc[df['category'] == c, 'revenue'] for c in cats])
ax2.set_xticks(range(1, len(cats) + 1), labels=cats)
ax2.set_title('Revenue by category')
ax2.set_ylabel('revenue (INR)')
ax2.tick_params(axis='x', rotation=30)
fig.tight_layout()`,
            solution: `cats = list(cat.index)
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
ax1.hist(df['revenue'], bins=30, color='#7A4FD0')
ax1.set_yscale('log')
ax1.set_title('Order revenue distribution')
ax1.set_xlabel('revenue (INR)')
ax1.set_ylabel('order lines (log)')
ax2.boxplot([df.loc[df['category'] == c, 'revenue'] for c in cats])
ax2.set_xticks(range(1, len(cats) + 1), labels=cats)
ax2.set_title('Revenue by category')
ax2.set_ylabel('revenue (INR)')
ax2.tick_params(axis='x', rotation=30)
fig.tight_layout()`,
            bank: ['30', '10', 'log', 'linear', 'symlog'], hints: ['A log y axis shows both the common small orders and the rare huge ones.'],
            tests: `a1, a2 = plt.gcf().axes[:2]
check(len(a1.patches) == 30, 'the histogram has 30 bins', 'ax1.hist(..., bins=30)')
check(a1.get_yscale() == 'log', 'the y axis is log-scaled', "ax1.set_yscale('log')")
check([t.get_text() for t in a2.get_xticklabels()] == list(cat.index), 'the boxplot has one box per category', 'boxplot([...]) and set_xticks(..., labels=cats)')
check(a1.get_title() and a2.get_title(), 'both charts have titles', 'set_title')` },
          { id: 'dash', title: 'Publish the monthly review', xp: 50, est: 600, star: true,
            prompt: `<p>The final 2x2: revenue trend (line), category bars (barh), order-revenue histogram (30 bins) and a <b>city x category heatmap</b> of revenue with a colour bar and labelled ticks. Add an overall title.</p>`,
            starter: `heat = df.pivot_table(index='city', columns='category', values='revenue', aggfunc='sum').fillna(0)
fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(monthly.index, monthly.values, marker='o')
axes[0, 0].set_title('Revenue by month')
axes[0, 1].barh(cat.index, cat.values, color='#1E8E5A')
axes[0, 1].set_title('Revenue by category')
axes[1, 0].hist(df['revenue'], bins=30, color='#7A4FD0')
axes[1, 0].set_title('Order revenue')
im = axes[1, 1].imshow(heat.values, cmap='magma', aspect='auto')
axes[1, 1].set_xticks(range(len(heat.columns)), labels=heat.___, rotation=30)
axes[1, 1].set_yticks(range(len(heat.index)), labels=heat.index)
axes[1, 1].set_title('Revenue: city x category')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('Monthly business review', fontsize=14)
fig.tight_layout()`,
            solution: `heat = df.pivot_table(index='city', columns='category', values='revenue', aggfunc='sum').fillna(0)
fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(monthly.index, monthly.values, marker='o')
axes[0, 0].set_title('Revenue by month')
axes[0, 1].barh(cat.index, cat.values, color='#1E8E5A')
axes[0, 1].set_title('Revenue by category')
axes[1, 0].hist(df['revenue'], bins=30, color='#7A4FD0')
axes[1, 0].set_title('Order revenue')
im = axes[1, 1].imshow(heat.values, cmap='magma', aspect='auto')
axes[1, 1].set_xticks(range(len(heat.columns)), labels=heat.columns, rotation=30)
axes[1, 1].set_yticks(range(len(heat.index)), labels=heat.index)
axes[1, 1].set_title('Revenue: city x category')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('Monthly business review', fontsize=14)
fig.tight_layout()`,
            bank: ['columns', 'index', 'values', 'T'], hints: ['The x ticks of the heatmap are the pivot-table columns (categories).'],
            tests: `${DASH(4)}
a = plt.gcf().axes
check(len(a[1].patches) == 5 and len(a[2].patches) == 30, 'five category bars and a 30-bin histogram', 'barh and hist(bins=30)')
check(any(len(x.images) == 1 for x in a) and len(a) >= 5, 'a heatmap with a colour bar is present', 'imshow + fig.colorbar')
check(sorted(t.get_text() for t in a[3].get_xticklabels()) == sorted(cat.index), 'the heatmap x ticks are the category names', 'labels=heat.columns')` },
        ],
        flagship_ms: [
          { id: 'bars3d', title: 'Flagship: 3-D bars of month x category', xp: 50, est: 480,
            prompt: `<p>Draw revenue as 3-D bars: x = month index, y = category index, z = revenue, using <code>ax.bar3d</code>. Label the three axes and the category names on the y ticks.</p>`,
            starter: `piv = df.pivot_table(index='month', columns='category', values='revenue', aggfunc='sum').fillna(0)
xs, ys = np.meshgrid(np.arange(piv.shape[0]), np.arange(piv.shape[1]), indexing='ij')
fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='3d')
ax.___(xs.ravel(), ys.ravel(), 0, 0.6, 0.6, piv.values.ravel(), shade=True)
ax.set_xlabel('month')
ax.set_ylabel('category')
ax.set_zlabel('revenue')
ax.set_yticks(range(len(piv.columns)), labels=piv.columns)
ax.set_title('Revenue by month and category')`,
            solution: `piv = df.pivot_table(index='month', columns='category', values='revenue', aggfunc='sum').fillna(0)
xs, ys = np.meshgrid(np.arange(piv.shape[0]), np.arange(piv.shape[1]), indexing='ij')
fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='3d')
ax.bar3d(xs.ravel(), ys.ravel(), 0, 0.6, 0.6, piv.values.ravel(), shade=True)
ax.set_xlabel('month')
ax.set_ylabel('category')
ax.set_zlabel('revenue')
ax.set_yticks(range(len(piv.columns)), labels=piv.columns)
ax.set_title('Revenue by month and category')`,
            bank: ['bar3d', 'bar', 'scatter', 'plot_surface'], hints: ['bar3d(x, y, z0, dx, dy, dz) draws one box per (x, y).'],
            tests: `ax = plt.gcf().axes[0]
check(getattr(ax, 'name', '') == '3d', 'the axes is 3-D', "projection='3d'")
check(len(ax.collections) >= 1 and len(ax.collections[0].get_facecolor()) >= 30, 'there is a 3-D bar for every month x category', 'ax.bar3d(...) with 6 x 5 = 30 bars')
check(ax.get_xlabel() and ax.get_ylabel() and ax.get_zlabel(), 'all three axes are labelled', 'set_xlabel / ylabel / zlabel')` },
          { id: 'story', title: 'Flagship: the best-month story', xp: 50, est: 420, star: true,
            prompt: `<p>On the revenue line chart, annotate the best month with an arrow and the text "best month: M", and put the growth from the first to the last month in the title as a percentage (<code>growth</code>).</p>`,
            starter: `best = monthly.idxmax()
growth = (monthly.iloc[-1] / monthly.iloc[0] - 1) * ___
fig, ax = plt.subplots(figsize=(8, 3.8))
ax.plot(monthly.index, monthly.values, marker='o')
ax.annotate(f'best month: {best}', xy=(best, monthly.max()), xytext=(best, monthly.max() * 1.08), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Revenue grew {growth:.0f}% from month 1 to month 6')
ax.set_xlabel('month')
ax.set_ylabel('revenue (INR)')`,
            solution: `best = monthly.idxmax()
growth = (monthly.iloc[-1] / monthly.iloc[0] - 1) * 100
fig, ax = plt.subplots(figsize=(8, 3.8))
ax.plot(monthly.index, monthly.values, marker='o')
ax.annotate(f'best month: {best}', xy=(best, monthly.max()), xytext=(best, monthly.max() * 1.08), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Revenue grew {growth:.0f}% from month 1 to month 6')
ax.set_xlabel('month')
ax.set_ylabel('revenue (INR)')`,
            bank: ['100', '10', '1'], hints: ['Multiply the fraction by 100 for a percentage.'],
            tests: `ax = plt.gcf().axes[0]
check(abs(growth - (monthly.iloc[-1] / monthly.iloc[0] - 1) * 100) < 1e-6, 'growth is a percentage', '(last / first - 1) * 100')
check(any('best month: ' + str(monthly.idxmax()) in t.get_text() for t in ax.texts), 'the best month is annotated', "ax.annotate(f'best month: {best}', ...)")
check('%' in ax.get_title(), 'the title states the growth in %', "f'... {growth:.0f}%'")` },
        ],
      },

      /* ====================================================== opd */
      {
        id: 'clinicviz', hours: 4, title: 'ClinicViz: show a hospital board where the waiting time hides',
        pitch: 'The hospital board reads pictures, not spreadsheets. Build charts that show the trend of weekly visits, which departments wait longest (with their variability), who the patients are, and how age and cost relate - then combine them into one dashboard.',
        real: 'Hospital operations dashboards (capacity, wait-time and demand views) used by health systems and health-tech teams.',
        flagship_note: 'a larger visit log (~3,500 visits) and two extra milestones: a 3-D scatter of age, wait and cost, and an annotated "busiest week" story.',
        dataset: { file: 'opd.csv', desc: 'Synthetic outpatient visits Jan-Apr 2026: department, age, gender, wait and consultation minutes, cost, insurance and follow-up. No real patients.',
          columns: [['visit_id', 'id'], ['visit_date', 'date'], ['department', 'department'], ['age', 'years'], ['gender', 'F/M'], ['wait_min', 'wait (minutes)'], ['consult_min', 'consultation minutes'], ['cost', 'bill (INR)'], ['insured', 'yes/no'], ['follow_up', 'yes/no']], gen: DS.opd },
        refs: ['The Lancet and WHO publish outpatient wait-time studies; look for how they chart variability.', 'Error bars should show spread (standard deviation) or uncertainty - always say which.'],
        milestones: [
          { id: 'prep', title: 'Prepare the data for charts', xp: 20, est: 150,
            prompt: `<p>Create the tables the charts need: weekly visit counts and the mean waiting time per department (smallest first) with its standard deviation in the same order.</p>`,
            starter: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/opd.csv', parse_dates=['visit_date'])
weekly = df.resample('W', on='visit_date').___()
wait = df.groupby('department')['wait_min'].mean().sort_values()
wait_sd = df.groupby('department')['wait_min'].___().reindex(wait.index)
print(len(weekly), wait.index[-1])`,
            solution: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data/opd.csv', parse_dates=['visit_date'])
weekly = df.resample('W', on='visit_date').size()
wait = df.groupby('department')['wait_min'].mean().sort_values()
wait_sd = df.groupby('department')['wait_min'].std().reindex(wait.index)
print(len(weekly), wait.index[-1])`,
            bank: ['size', 'sum', 'std', 'var', 'mean'], hints: ['std() is the spread; reindex keeps it in the same order as wait.'],
            tests: `check(int(weekly.sum()) == len(df) and len(weekly) > 10, 'weekly counts the visits per week', "resample('W', on='visit_date').size()")
check(len(wait) == 6 and list(wait.values) == sorted(wait.values) and list(wait_sd.index) == list(wait.index), 'wait and wait_sd are aligned per department', 'sort_values() and reindex(wait.index)')` },
          { id: 'trend', title: 'Chart 1: visits per week', xp: 30, est: 300,
            prompt: `<p>Weekly visits as a line with the <b>4-week moving average</b> on top (thicker), a title, labels and a two-entry legend.</p>`,
            starter: `fig, ax = plt.subplots(figsize=(9, 3.6))
ax.plot(weekly.index, weekly.values, marker='o', alpha=0.5, label='weekly visits')
ax.plot(weekly.index, weekly.rolling(___).mean(), lw=3, label='4-week average')
ax.set_title('Weekly outpatient visits')
ax.set_xlabel('week ending')
ax.set_ylabel('visits')
ax.legend()
fig.autofmt_xdate()`,
            solution: `fig, ax = plt.subplots(figsize=(9, 3.6))
ax.plot(weekly.index, weekly.values, marker='o', alpha=0.5, label='weekly visits')
ax.plot(weekly.index, weekly.rolling(4).mean(), lw=3, label='4-week average')
ax.set_title('Weekly outpatient visits')
ax.set_xlabel('week ending')
ax.set_ylabel('visits')
ax.legend()
fig.autofmt_xdate()`,
            bank: ['4', '7', '2', '12'], hints: ['Four weeks = a window of 4.'],
            tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) == 2 and np.allclose(ax.lines[0].get_ydata(), weekly.values), 'the first line shows weekly visits', 'ax.plot(weekly.index, weekly.values, ...)')
check(np.isnan(ax.lines[1].get_ydata()).sum() == 3, 'the second line is a 4-week moving average', 'weekly.rolling(4).mean()')
check(len(ax.get_legend().get_texts()) == 2, 'the legend has two entries', 'label= on both lines')
${LABELS}` },
          { id: 'compare', title: 'Chart 2: waiting time with error bars', xp: 35, est: 360,
            prompt: `<p>Horizontal bars of mean wait per department with <b>error bars showing one standard deviation</b> (<code>xerr=wait_sd.values</code>), the longest wait in orange, a title naming that department and an x label with the unit.</p>`,
            starter: `colors = ['#2F6FE0'] * (len(wait) - 1) + ['#D2600F']
fig, ax = plt.subplots(figsize=(7, 3.8))
ax.barh(wait.index, wait.values, ___=wait_sd.values, color=colors, capsize=3)
ax.set_title(f'{wait.index[-1]} waits longest')
ax.set_xlabel('mean wait (min), bars = 1 SD')`,
            solution: `colors = ['#2F6FE0'] * (len(wait) - 1) + ['#D2600F']
fig, ax = plt.subplots(figsize=(7, 3.8))
ax.barh(wait.index, wait.values, xerr=wait_sd.values, color=colors, capsize=3)
ax.set_title(f'{wait.index[-1]} waits longest')
ax.set_xlabel('mean wait (min), bars = 1 SD')`,
            bank: ['xerr', 'yerr', 'error', 'width'], hints: ['For horizontal bars the error is along x: xerr.'],
            tests: `ax = plt.gcf().axes[0]
check(len(ax.patches) == 6 and np.allclose([p.get_width() for p in ax.patches], wait.values), 'six bars with the mean waits', 'ax.barh(wait.index, wait.values, ...)')
check(any(type(c).__name__ == 'ErrorbarContainer' or getattr(c, 'errorbar', None) is not None for c in ax.containers), 'the bars have error bars', 'xerr=wait_sd.values')
check(wait.index[-1] in ax.get_title() and ax.get_xlabel(), 'the title names the longest-wait department and x is labelled', "f'{wait.index[-1]} waits longest'")` },
          { id: 'people', title: 'Chart 3: who are the patients?', xp: 35, est: 360,
            prompt: `<p>Two charts: a <b>stacked histogram</b> of age by gender (15 bins; <code>ax.hist([ages_f, ages_m], stacked=True, label=["F", "M"])</code>) and a scatter of age vs cost coloured by insurance (insured blue, not insured grey, with labels).</p>`,
            starter: `fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
ages_f = df.loc[df['gender'] == 'F', 'age']
ages_m = df.loc[df['gender'] == 'M', 'age']
ax1.hist([ages_f, ages_m], bins=15, stacked=___, label=['F', 'M'])
ax1.set_title('Patient age by gender')
ax1.set_xlabel('age')
ax1.set_ylabel('visits')
ax1.legend()
for ins, col in [('yes', '#2F6FE0'), ('no', '#8A958F')]:
    s = df[df['insured'] == ins]
    ax2.scatter(s['age'], s['cost'], s=8, alpha=0.4, color=col, label='insured' if ins == 'yes' else 'not insured')
ax2.set_title('Age vs cost')
ax2.set_xlabel('age')
ax2.set_ylabel('cost (INR)')
ax2.legend()
fig.tight_layout()`,
            solution: `fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
ages_f = df.loc[df['gender'] == 'F', 'age']
ages_m = df.loc[df['gender'] == 'M', 'age']
ax1.hist([ages_f, ages_m], bins=15, stacked=True, label=['F', 'M'])
ax1.set_title('Patient age by gender')
ax1.set_xlabel('age')
ax1.set_ylabel('visits')
ax1.legend()
for ins, col in [('yes', '#2F6FE0'), ('no', '#8A958F')]:
    s = df[df['insured'] == ins]
    ax2.scatter(s['age'], s['cost'], s=8, alpha=0.4, color=col, label='insured' if ins == 'yes' else 'not insured')
ax2.set_title('Age vs cost')
ax2.set_xlabel('age')
ax2.set_ylabel('cost (INR)')
ax2.legend()
fig.tight_layout()`,
            bank: ['True', 'False', 'None'], hints: ['stacked=True stacks the two groups in each bin.'],
            tests: `a1, a2 = plt.gcf().axes[:2]
check(len(a1.patches) == 30, 'the stacked histogram has 15 bins x 2 groups', 'ax.hist([f, m], bins=15, stacked=True)')
check(len(a2.collections) == 2 and sum(len(c.get_offsets()) for c in a2.collections) == len(df), 'the scatter holds every visit in two groups', 'one scatter per insurance value')
check(a1.get_legend() is not None and a2.get_legend() is not None, 'both charts have legends', 'ax.legend()')
check(a1.get_title() and a2.get_title(), 'both charts have titles', 'set_title')` },
          { id: 'dash', title: 'Publish the board dashboard', xp: 50, est: 600, star: true,
            prompt: `<p>The final 2x2: weekly line, department wait bars with error bars, age histogram (20 bins) and a <b>department x weekday heatmap</b> of visit counts with a colour bar. Add an overall title.</p>`,
            starter: `days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
grid = pd.crosstab(df['department'], df['visit_date'].dt.dayofweek)
fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(weekly.index, weekly.values, marker='o')
axes[0, 0].set_title('Weekly visits')
axes[0, 1].barh(wait.index, wait.values, xerr=wait_sd.values, color='#D2600F', capsize=3)
axes[0, 1].set_title('Mean wait by department')
axes[1, 0].hist(df['age'], bins=___, color='#7A4FD0')
axes[1, 0].set_title('Patient ages')
im = axes[1, 1].imshow(grid.values, cmap='YlOrRd', aspect='auto')
axes[1, 1].set_xticks(range(7), labels=days)
axes[1, 1].set_yticks(range(len(grid.index)), labels=grid.index)
axes[1, 1].set_title('Visits: department x weekday')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('Outpatient department board', fontsize=14)
fig.tight_layout()`,
            solution: `days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
grid = pd.crosstab(df['department'], df['visit_date'].dt.dayofweek)
fig, axes = plt.subplots(2, 2, figsize=(11, 7))
axes[0, 0].plot(weekly.index, weekly.values, marker='o')
axes[0, 0].set_title('Weekly visits')
axes[0, 1].barh(wait.index, wait.values, xerr=wait_sd.values, color='#D2600F', capsize=3)
axes[0, 1].set_title('Mean wait by department')
axes[1, 0].hist(df['age'], bins=20, color='#7A4FD0')
axes[1, 0].set_title('Patient ages')
im = axes[1, 1].imshow(grid.values, cmap='YlOrRd', aspect='auto')
axes[1, 1].set_xticks(range(7), labels=days)
axes[1, 1].set_yticks(range(len(grid.index)), labels=grid.index)
axes[1, 1].set_title('Visits: department x weekday')
fig.colorbar(im, ax=axes[1, 1])
fig.suptitle('Outpatient department board', fontsize=14)
fig.tight_layout()`,
            bank: ['20', '10', '5'], hints: ['20 bins for the age histogram.'],
            tests: `${DASH(4)}
a = plt.gcf().axes
check(len(a[1].patches) == 6 and len(a[2].patches) == 20, 'six department bars and a 20-bin histogram', 'barh and hist(bins=20)')
check(any(len(x.images) == 1 for x in a) and len(a) >= 5, 'the heatmap and its colour bar are present', 'imshow + fig.colorbar')` },
        ],
        flagship_ms: [
          { id: 'cube', title: 'Flagship: a 3-D view of age, wait and cost', xp: 45, est: 420,
            prompt: `<p>Scatter every visit in 3-D: x = age, y = wait, z = cost, coloured by department number (<code>c=codes</code>, a numeric code per department), all axes labelled and a colour bar.</p>`,
            starter: `codes = pd.Categorical(df['department']).codes
fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='3d')
p = ax.scatter(df['age'], df['wait_min'], df['cost'], c=___, s=6, cmap='tab10', alpha=0.6)
ax.set_xlabel('age')
ax.set_ylabel('wait (min)')
ax.set_zlabel('cost (INR)')
ax.set_title('Age, wait and cost by department')
fig.colorbar(p, ax=ax, shrink=0.6, label='department code')`,
            solution: `codes = pd.Categorical(df['department']).codes
fig = plt.figure(figsize=(7, 5))
ax = fig.add_subplot(projection='3d')
p = ax.scatter(df['age'], df['wait_min'], df['cost'], c=codes, s=6, cmap='tab10', alpha=0.6)
ax.set_xlabel('age')
ax.set_ylabel('wait (min)')
ax.set_zlabel('cost (INR)')
ax.set_title('Age, wait and cost by department')
fig.colorbar(p, ax=ax, shrink=0.6, label='department code')`,
            bank: ['codes', 'df["department"]', 'df["age"]'], hints: ['c= takes the numeric codes so each department gets a colour.'],
            tests: `ax = plt.gcf().axes[0]
check(getattr(ax, 'name', '') == '3d' and len(ax.collections) == 1 and len(ax.collections[0]._offsets3d[0]) == len(df), 'all visits are plotted in 3-D', "projection='3d' and one scatter")
check(len(plt.gcf().axes) >= 2, 'there is a colour bar', 'fig.colorbar(p, ax=ax)')
check(ax.get_xlabel() and ax.get_ylabel() and ax.get_zlabel(), 'all three axes are labelled', 'set_xlabel / ylabel / zlabel')` },
          { id: 'story', title: 'Flagship: the busiest-week story', xp: 50, est: 420, star: true,
            prompt: `<p>Annotate the busiest week on the weekly line with an arrow and the text "busiest week: N visits" (use the real number), and put the ratio of the busiest week to the average week in the title (<code>ratio</code>, e.g. 1.3x).</p>`,
            starter: `top = weekly.idxmax()
ratio = weekly.max() / weekly.___()
fig, ax = plt.subplots(figsize=(9, 3.8))
ax.plot(weekly.index, weekly.values, marker='o')
ax.annotate(f'busiest week: {weekly.max()} visits', xy=(top, weekly.max()), xytext=(top, weekly.max() * 1.1), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Peak week is {ratio:.1f}x the average')
ax.set_xlabel('week ending')
ax.set_ylabel('visits')
fig.autofmt_xdate()`,
            solution: `top = weekly.idxmax()
ratio = weekly.max() / weekly.mean()
fig, ax = plt.subplots(figsize=(9, 3.8))
ax.plot(weekly.index, weekly.values, marker='o')
ax.annotate(f'busiest week: {weekly.max()} visits', xy=(top, weekly.max()), xytext=(top, weekly.max() * 1.1), arrowprops=dict(arrowstyle='->'))
ax.set_title(f'Peak week is {ratio:.1f}x the average')
ax.set_xlabel('week ending')
ax.set_ylabel('visits')
fig.autofmt_xdate()`,
            bank: ['mean', 'median', 'sum', 'max'], hints: ['The average week is the mean of the weekly counts.'],
            tests: `ax = plt.gcf().axes[0]
check(abs(ratio - weekly.max() / weekly.mean()) < 1e-9, 'ratio = busiest week / average week', 'weekly.max() / weekly.mean()')
check(any(str(int(weekly.max())) in t.get_text() and 'busiest' in t.get_text() for t in ax.texts), 'the busiest week is annotated with its real count', "f'busiest week: {weekly.max()} visits'")
check('x' in ax.get_title() and ax.get_xlabel(), 'the title states the ratio', "f'Peak week is {ratio:.1f}x the average'")` },
        ],
      },
    ],
  };
})();
