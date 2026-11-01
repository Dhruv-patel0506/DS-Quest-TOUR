'use strict';
/* =====================================================================
   Module: Matplotlib & Seaborn  (5 lessons, 9 graded exercises). Charts are checked by
   inspecting the figure objects (titles, labels, data, number of bars/lines/axes).
   ===================================================================== */
DSQ.defModule({
  id: 'matplotlib', boss: [], lessons: [],
  outcomes: ['Build any common chart with the Figure/Axes API', 'Lay out subplots, annotate and style a chart', 'Draw heatmaps and 3-D plots', 'Pick the right chart and tell a story with it'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'matplotlib');
  const CHK = (n = 1) => `fig = plt.gcf()
check(len(fig.axes) >= ${n}, 'the figure has ${n > 1 ? n + ' axes' : 'an axes'}', 'create it with plt.subplots(...)')`;

  /* ===================== L1 ===================== */
  M.lessons.push({
    id: 'anatomy', title: 'Figure, Axes and your first line chart', minutes: 30, blurb: 'The object model, plot, labels, legend, grid and saving.',
    pages: [
      RD('Think in objects: Figure and Axes', `<p>A <b>Figure</b> is the canvas. It holds one or more <b>Axes</b> - each Axes is one plot with its own x/y axis. The professional pattern is:</p>
        <pre class="codeblock">fig, ax = plt.subplots(figsize=(8, 4))   # make a canvas and one plot area
ax.plot(x, y, label="2026")              # draw on THAT axes
ax.set_title("..."); ax.set_xlabel("..."); ax.set_ylabel("...")
ax.legend(); ax.grid(alpha=0.3)
fig.savefig("chart.png", dpi=150)</pre>
        <p>The shortcut <code>plt.plot(...)</code> works on a hidden "current axes" - fine for quick looks, but use <code>fig, ax</code> for anything you will keep.</p>`),
      VZ('Click the parts', 'anatomy', {}, 'Click any part of the picture (or the buttons) to see the line of code that creates or changes it.'),
      DM('A chart that draws as you type', `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 200)
fig, ax = plt.subplots(figsize=(7, 3.4))
ax.plot(x, np.sin(x), label="sin(x)")
ax.plot(x, np.cos(x), label="cos(x)", linestyle="--")
ax.set_title("Two waves")
ax.set_xlabel("angle (radians)")
ax.set_ylabel("value")
ax.legend()
ax.grid(alpha=0.3)`, 'Turn on <b>Live sketch</b> and change something - a colour, <code>np.sin(2 * x)</code>, the title. The picture redraws about a second after you stop typing, sketching itself left to right.', { live: true }),
      EX({
        id: 'mp-1-1', title: 'Your first labelled chart', est: 180, xp: 25, livePlot: true,
        prompt: `<p>Plot the monthly sales line and make it readable: a title, both axis labels and a legend entry called <code>"2026"</code>.</p>`,
        starter: `import matplotlib.pyplot as plt

months = [1, 2, 3, 4, 5, 6]
sales = [120, 135, 160, 150, 190, 210]

fig, ax = plt.subplots(figsize=(7, 3.4))
ax.plot(months, sales, marker="o", label="___")
ax.set_title("___")
ax.set_xlabel("month")
ax.set_ylabel("sales")
ax.___()`,
        solution: `import matplotlib.pyplot as plt

months = [1, 2, 3, 4, 5, 6]
sales = [120, 135, 160, 150, 190, 210]

fig, ax = plt.subplots(figsize=(7, 3.4))
ax.plot(months, sales, marker="o", label="2026")
ax.set_title("Monthly sales")
ax.set_xlabel("month")
ax.set_ylabel("sales")
ax.legend()`,
        bank: ['2026', 'Monthly sales', 'legend', 'show', 'grid', 'savefig'], hints: ['label= on plot gives the legend its text; ax.legend() draws the legend.'],
        tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) == 1 and list(ax.lines[0].get_ydata()) == [120, 135, 160, 150, 190, 210], 'the line shows the sales data', 'ax.plot(months, sales)')
check(len(ax.get_title()) > 3 and ax.get_xlabel() and ax.get_ylabel(), 'title and both axis labels are set', 'set_title / set_xlabel / set_ylabel')
leg = ax.get_legend()
check(leg is not None and [t.get_text() for t in leg.get_texts()] == ['2026'], 'the legend shows "2026"', 'label="2026" and ax.legend()')`,
      }),
      EX({
        id: 'mp-1-2', title: 'Two series, one axes', est: 240, xp: 25, livePlot: true,
        prompt: `<p>Draw both series on the same axes: <code>a</code> as a solid line labelled <code>"plan"</code> and <code>b</code> as a dashed line labelled <code>"actual"</code>. Add a title, axis labels, a legend and a light grid.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(1, 9)
a = x * 10
b = x * 10 + np.array([2, -3, 4, -6, 5, -8, 9, -4])

fig, ax = plt.subplots(figsize=(7, 3.4))
...`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(1, 9)
a = x * 10
b = x * 10 + np.array([2, -3, 4, -6, 5, -8, 9, -4])

fig, ax = plt.subplots(figsize=(7, 3.4))
ax.plot(x, a, label="plan")
ax.plot(x, b, linestyle="--", label="actual")
ax.set_title("Plan vs actual")
ax.set_xlabel("week")
ax.set_ylabel("units")
ax.legend()
ax.grid(alpha=0.3)`,
        hints: ['Two ax.plot calls on the same ax.', 'linestyle="--" gives a dashed line.'],
        tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) == 2, 'two lines are drawn', 'two ax.plot(...) calls')
check(ax.lines[1].get_linestyle() == '--', 'the second line is dashed', 'linestyle="--"')
check(sorted(t.get_text() for t in ax.get_legend().get_texts()) == ['actual', 'plan'], 'legend shows plan and actual', 'label=... on each plot call')
check(ax.get_title() and ax.get_xlabel() and ax.get_ylabel(), 'title and axis labels are set', 'set_title, set_xlabel, set_ylabel')
check(any(l.get_visible() for l in ax.xaxis.get_gridlines()) and ax.xaxis._major_tick_kw.get('gridOn', False), 'a grid is on', 'ax.grid(alpha=0.3)')`,
      }),
      QZ('matplotlib', [
        { q: 'What is the difference between a Figure and an Axes?', o: ['A Figure is the canvas; an Axes is one plot on it', 'They are the same', 'An Axes holds many Figures', 'Axes only means the x and y lines'], a: 0, why: 'One Figure can contain a grid of Axes (subplots).' },
        { q: 'Which call draws the legend?', o: ['ax.legend()', 'ax.add_legend()', 'plt.key()', 'ax.label()'], a: 0, why: 'Give each series a label= first, then call legend().' },
        { q: 'Why prefer `fig, ax = plt.subplots()` over `plt.plot()` for important charts?', o: ['You control exactly which axes you draw on', 'It is faster', 'plt.plot is deprecated', 'It adds a legend automatically'], a: 0, why: 'Explicit objects scale to multiple subplots and are easier to reuse in functions.' },
      ], 'Quick check'),
      TY({ id: 'mp-t1', title: 'Typing sprint: a chart skeleton', goal: 26, code: `fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, y, marker="o", label="2026")
ax.set_title("Monthly sales")
ax.set_xlabel("month")
ax.set_ylabel("sales")
ax.legend()
fig.savefig("chart.png", dpi=150)` }),
    ],
    recap: ['Figure = canvas, Axes = one plot. Use fig, ax = plt.subplots().', 'Always: title, axis labels with units, legend when there are several series.', 'savefig(dpi=150) writes the image.'],
  });

  /* ===================== L2 ===================== */
  M.lessons.push({
    id: 'charts', title: 'Every common chart', minutes: 40, blurb: 'line, scatter, bar, histogram, box, pie, area and when each one fits.',
    pages: [
      RD('Pick the chart for the question', `${TABLE(['Question', 'Chart', 'Call'], [['How does it change over time?', 'line / area', '<code>ax.plot</code>, <code>ax.fill_between</code>'], ['How do two numbers relate?', 'scatter', '<code>ax.scatter(x, y, c=, s=)</code>'], ['Which category is bigger?', 'bar (barh if labels are long)', '<code>ax.bar</code>, <code>ax.barh</code>'], ['How is one number distributed?', 'histogram / box', '<code>ax.hist(data, bins=)</code>, <code>ax.boxplot</code>'], ['Share of a whole (few parts)', 'pie or stacked bar', '<code>ax.pie</code>'], ['A grid of values', 'heatmap', '<code>ax.imshow</code>']])}`),
      VZ('The gallery, drawn live', 'plotTypes', { type: 'bar' }, 'Switch the type and press "New data" - every chart sketches itself, with the line of code that makes it underneath.'),
      DM('Six charts in one figure', `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(3)
x = np.linspace(0, 10, 40)
fig, axes = plt.subplots(2, 3, figsize=(11, 6))
axes[0, 0].plot(x, np.sin(x)); axes[0, 0].set_title("line")
axes[0, 1].scatter(rng.random(60), rng.random(60), c=rng.random(60), s=40); axes[0, 1].set_title("scatter")
axes[0, 2].bar(["A", "B", "C", "D"], [5, 9, 3, 7]); axes[0, 2].set_title("bar")
axes[1, 0].hist(rng.normal(size=500), bins=20); axes[1, 0].set_title("histogram")
axes[1, 1].boxplot([rng.normal(m, 1, 80) for m in (0, 1, 2)]); axes[1, 1].set_title("box")
axes[1, 2].pie([35, 25, 20, 20], labels=list("ABCD")); axes[1, 2].set_title("pie")
fig.tight_layout()`, 'This is the 2x3 grid pattern: <code>axes[row, col]</code>. Try changing one chart type.', { live: false }),
      EX({
        id: 'mp-2-1', title: 'Scatter by group', est: 240, xp: 30, livePlot: true,
        prompt: `<p>Two groups of points. Draw each group with its own <code>ax.scatter</code> call and a different colour, give each a <code>label</code> (<code>"control"</code> and <code>"treated"</code>), then add a legend and axis labels.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(1)
cx, cy = rng.normal(2, 0.6, 40), rng.normal(3, 0.6, 40)
tx, ty = rng.normal(4, 0.6, 40), rng.normal(5, 0.6, 40)

fig, ax = plt.subplots(figsize=(6, 4))
ax.scatter(cx, cy, color="#2F6FE0", alpha=0.7, label="control")
ax.scatter(___, ___, color="#D2600F", alpha=0.7, label="___")
ax.set_xlabel("dose")
ax.set_ylabel("response")
ax.___()`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(1)
cx, cy = rng.normal(2, 0.6, 40), rng.normal(3, 0.6, 40)
tx, ty = rng.normal(4, 0.6, 40), rng.normal(5, 0.6, 40)

fig, ax = plt.subplots(figsize=(6, 4))
ax.scatter(cx, cy, color="#2F6FE0", alpha=0.7, label="control")
ax.scatter(tx, ty, color="#D2600F", alpha=0.7, label="treated")
ax.set_xlabel("dose")
ax.set_ylabel("response")
ax.legend()`,
        bank: ['tx', 'ty', 'cx', 'cy', 'treated', 'legend', 'grid'], hints: ['The second call plots the treated points: tx, ty.'],
        tests: `ax = plt.gcf().axes[0]
check(len(ax.collections) == 2, 'two scatter groups are drawn', 'one ax.scatter per group')
check(all(len(c.get_offsets()) == 40 for c in ax.collections), 'each group has 40 points', 'scatter(tx, ty) for the second group')
check(sorted(t.get_text() for t in ax.get_legend().get_texts()) == ['control', 'treated'], 'legend shows control and treated', 'label="treated" and ax.legend()')
check(ax.get_xlabel() and ax.get_ylabel(), 'both axes are labelled', 'set_xlabel / set_ylabel')`,
      }),
      EX({
        id: 'mp-2-2', title: 'Bars and a histogram', est: 300, xp: 30, livePlot: true,
        prompt: `<p>Make a figure with two charts side by side: a bar chart of <code>sales</code> per region (left, titled "Sales by region") and a histogram of <code>scores</code> with 12 bins (right, titled "Score distribution"). Give both a y label.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

regions = ["North", "South", "East", "West"]
sales = [320, 280, 410, 190]
scores = np.random.default_rng(5).normal(60, 12, 300)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.6))
ax1.___(regions, sales)
ax1.set_title("Sales by region")
ax1.set_ylabel("sales")
ax2.___(scores, bins=___)
ax2.set_title("Score distribution")
ax2.set_ylabel("students")
fig.tight_layout()`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

regions = ["North", "South", "East", "West"]
sales = [320, 280, 410, 190]
scores = np.random.default_rng(5).normal(60, 12, 300)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.6))
ax1.bar(regions, sales)
ax1.set_title("Sales by region")
ax1.set_ylabel("sales")
ax2.hist(scores, bins=12)
ax2.set_title("Score distribution")
ax2.set_ylabel("students")
fig.tight_layout()`,
        bank: ['bar', 'barh', 'hist', 'plot', '12', '5', '30'], hints: ['bar(categories, heights)', 'hist(data, bins=n) draws n bars.'],
        tests: `fig = plt.gcf(); a1, a2 = fig.axes[0], fig.axes[1]
check(len(a1.patches) == 4 and sorted(p.get_height() for p in a1.patches) == [190, 280, 320, 410], 'left chart has 4 bars with the sales values', 'ax1.bar(regions, sales)')
check(len(a2.patches) == 12, 'right chart is a histogram with 12 bins', 'ax2.hist(scores, bins=12)')
check(a1.get_title() == 'Sales by region' and a2.get_title() == 'Score distribution', 'both charts have the requested titles', 'set_title')
check(a1.get_ylabel() and a2.get_ylabel(), 'both charts have a y label', 'set_ylabel')`,
      }),
      QZ('matplotlib', [
        { q: 'You want to show how 500 exam marks are spread out. Best chart?', o: ['Histogram', 'Pie chart', 'Line chart of the marks in file order', 'Bar chart with one bar per student'], a: 0, why: 'A histogram bins the values to show the shape of the distribution.' },
        { q: 'Which call draws a horizontal bar chart (useful for long category names)?', o: ['ax.barh', 'ax.hbar', 'ax.bar(orientation="h")', 'ax.columns'], a: 0, why: 'barh puts categories on the y axis so labels are easy to read.' },
        { gen: r => { const n = r.int(4, 14); return { q: `\`ax.hist(data, bins=${n})\` draws how many bars?`, correct: n, wrong: distract(n, [n - 1, n + 1, n * 2, 10]), why: 'One bar per bin.' }; } },
        { q: 'A boxplot shows...', o: ['median, quartiles and outliers', 'only the mean', 'only the maximum', 'each individual point exactly'], a: 0, why: 'The box spans Q1-Q3, the line is the median, whiskers and dots show spread and outliers.' },
      ], 'Quick check'),
      TY({ id: 'mp-t2', title: 'Typing sprint: charts', goal: 28, code: `ax.scatter(x, y, c=group, s=40, alpha=0.7)
ax.bar(labels, values, color="#2F6FE0")
ax.hist(data, bins=20)
ax.boxplot([a, b, c])
ax.fill_between(x, y, alpha=0.3)` }),
    ],
    recap: ['Match chart to question: trend=line, relation=scatter, compare=bar, distribution=hist/box.', 'plt.subplots(rows, cols) returns a grid of axes.', 'Each series needs a label to appear in the legend.'],
  });

  /* ===================== L3 ===================== */
  M.lessons.push({
    id: 'polish', title: 'Layout, annotation and style', minutes: 35, blurb: 'Subplots, twin axes, annotate, colours, colormaps, log scale, styles.',
    pages: [
      RD('Polish turns a plot into a message', `${UL(['<b>Layout</b>: <code>plt.subplots(2, 2, figsize=(10, 7), sharex=True)</code>, <code>fig.tight_layout()</code>, <code>fig.suptitle(...)</code>', '<b>Reference lines</b>: <code>ax.axhline(avg, ls="--")</code>, <code>ax.axvspan(a, b, alpha=.1)</code>', '<b>Annotate</b>: <code>ax.annotate("peak", xy=(x, y), xytext=(x+1, y+5), arrowprops=dict(arrowstyle="->"))</code>', '<b>Two scales</b>: <code>ax2 = ax.twinx()</code> (use sparingly)', '<b>Colour</b>: a colormap like <code>cmap="viridis"</code> for ordered data; a few distinct colours for categories', '<b>Scales</b>: <code>ax.set_yscale("log")</code> for data spanning orders of magnitude', '<b>Style</b>: <code>plt.style.use("seaborn-v0_8-whitegrid")</code>'])}
        ${NOTE('warn', 'Colour tip:', 'around 1 in 12 men have colour-vision deficiency. Never rely on red vs green alone - add labels, markers or different line styles.')}`),
      VZ('Gradient descent, annotated', 'gradDescent', { lr: 0.3, steps: 10 }, 'A real chart tells a story: here a ball rolls down a curve and the dotted trail records each step. Notice the labelled minimum - an annotation in matplotlib is just text + an arrow.'),
      DM('Annotate and add a reference line', `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(1, 13)
y = np.array([12, 14, 13, 18, 22, 30, 29, 24, 19, 15, 13, 12])

fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.plot(x, y, marker="o", color="#2F6FE0")
ax.axhline(y.mean(), ls="--", color="gray", label=f"average {y.mean():.1f}")
peak = y.argmax()
ax.annotate("summer peak", xy=(x[peak], y[peak]), xytext=(x[peak] + 1.5, y[peak] + 2),
            arrowprops=dict(arrowstyle="->"))
ax.set_title("Monthly demand")
ax.set_xlabel("month")
ax.set_ylabel("units")
ax.legend()`, 'The annotation points at the data value you computed, so it moves if the data changes.', { live: true }),
      DM('A heatmap with a colour bar', `import numpy as np
import matplotlib.pyplot as plt

days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
hours = ["8", "10", "12", "14", "16", "18", "20"]
rng = np.random.default_rng(7)
grid = rng.integers(2, 30, size=(7, 7)) + np.outer([1, 1, 1, 1, 2, 3, 2], [1, 2, 1, 1, 2, 3, 1]) * 3

fig, ax = plt.subplots(figsize=(6.5, 4.2))
im = ax.imshow(grid, cmap="viridis")
ax.set_xticks(range(7), labels=hours)
ax.set_yticks(range(7), labels=days)
ax.set_xlabel("hour of day")
ax.set_ylabel("weekday")
ax.set_title("Visits by weekday and hour")
fig.colorbar(im, ax=ax, label="visits")`, '<code>imshow</code> paints a 2-D array as colour. Use it for correlation matrices, confusion matrices and time-of-day grids.'),
      EX({
        id: 'mp-3-1', title: 'Annotate the peak', est: 300, xp: 30, livePlot: true,
        prompt: `<p>Plot <code>y</code> against <code>x</code>, draw a dashed horizontal line at the average, and annotate the highest point with the text <code>"peak"</code>. Give the chart a title and axis labels.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(1, 13)
y = np.array([12, 14, 13, 18, 22, 30, 29, 24, 19, 15, 13, 12])

fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(x, y, marker="o")
ax.___(y.mean(), ls="--", color="gray")
i = y.___()
ax.annotate("___", xy=(x[i], y[i]), xytext=(x[i] + 1, y[i] + 2), arrowprops=dict(arrowstyle="->"))
ax.set_title("Monthly demand")
ax.set_xlabel("month")
ax.set_ylabel("units")`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(1, 13)
y = np.array([12, 14, 13, 18, 22, 30, 29, 24, 19, 15, 13, 12])

fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(x, y, marker="o")
ax.axhline(y.mean(), ls="--", color="gray")
i = y.argmax()
ax.annotate("peak", xy=(x[i], y[i]), xytext=(x[i] + 1, y[i] + 2), arrowprops=dict(arrowstyle="->"))
ax.set_title("Monthly demand")
ax.set_xlabel("month")
ax.set_ylabel("units")`,
        bank: ['axhline', 'axvline', 'argmax', 'max', 'peak', 'top'], hints: ['argmax gives the POSITION of the highest value.'],
        tests: `ax = plt.gcf().axes[0]
check(len(ax.lines) >= 2, 'the data line and an average line are drawn', 'ax.axhline(y.mean(), ...)')
hl = [l for l in ax.lines if len(set(l.get_ydata())) == 1]
check(hl and abs(hl[0].get_ydata()[0] - 221 / 12) < 1e-9, 'the reference line sits at the average (about 18.42)', 'ax.axhline(y.mean())')
check(any(t.get_text() == 'peak' for t in ax.texts), 'there is an annotation "peak"', 'ax.annotate("peak", ...)')
check(ax.get_title() and ax.get_xlabel() and ax.get_ylabel(), 'title and axis labels are set', 'set_title / labels')`,
      }),
      EX({
        id: 'mp-3-2', title: 'A 2x2 dashboard', est: 360, xp: 35, livePlot: true,
        prompt: `<p>Build a 2x2 grid of charts with a figure title "Dashboard": top-left a <b>line</b> of <code>y</code>, top-right a <b>bar</b> chart of <code>cats</code>/<code>vals</code>, bottom-left a <b>histogram</b> of <code>data</code>, bottom-right a <b>scatter</b> of <code>x</code> vs <code>y</code>. Give each chart a title.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(10)
y = x ** 1.5
cats, vals = ["a", "b", "c"], [5, 8, 3]
data = np.random.default_rng(2).normal(size=200)

fig, axes = plt.subplots(2, 2, figsize=(8, 6))
...
fig.tight_layout()`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

x = np.arange(10)
y = x ** 1.5
cats, vals = ["a", "b", "c"], [5, 8, 3]
data = np.random.default_rng(2).normal(size=200)

fig, axes = plt.subplots(2, 2, figsize=(8, 6))
axes[0, 0].plot(x, y); axes[0, 0].set_title("line")
axes[0, 1].bar(cats, vals); axes[0, 1].set_title("bar")
axes[1, 0].hist(data, bins=15); axes[1, 0].set_title("histogram")
axes[1, 1].scatter(x, y); axes[1, 1].set_title("scatter")
fig.suptitle("Dashboard")
fig.tight_layout()`,
        hints: ['axes is a 2x2 array: axes[0, 0], axes[0, 1], axes[1, 0], axes[1, 1].', 'fig.suptitle sets the overall title.'],
        tests: `fig = plt.gcf()
check(len(fig.axes) == 4, 'the figure has 4 axes', 'plt.subplots(2, 2)')
a = fig.axes
check(len(a[0].lines) >= 1 and len(a[1].patches) == 3 and len(a[2].patches) >= 5 and len(a[3].collections) >= 1, 'line, bar, histogram and scatter are in the right places', 'axes[0,0] line, [0,1] bar, [1,0] hist, [1,1] scatter')
check(all(x.get_title() for x in a), 'every chart has a title', 'set_title on each axes')
check(fig._suptitle is not None and fig._suptitle.get_text() == 'Dashboard', 'the figure title is "Dashboard"', 'fig.suptitle("Dashboard")')`,
      }),
      QZ('matplotlib', [
        { q: 'Which draws a horizontal reference line at y = 10?', o: ['ax.axhline(10)', 'ax.hline(10)', 'ax.plot(10)', 'ax.yline(10)'], a: 0, why: 'axhline = horizontal line across the axes; axvline is the vertical version.' },
        { q: 'When is a log scale a good idea?', o: ['When values span several orders of magnitude', 'Always, it looks fancier', 'Only for pie charts', 'When data has negative numbers'], a: 0, why: 'Log scales make 1, 10, 100, 1000 equally spaced - good for incomes, populations, learning rates.' },
        { q: 'What does `fig.colorbar(im, ax=ax)` add?', o: ['A legend mapping colours to values', 'A new subplot of bars', 'A title', 'A grid'], a: 0, why: 'A heatmap without a colour bar cannot be read.' },
      ], 'Quick check'),
      TY({ id: 'mp-t3', title: 'Typing sprint: polish', goal: 28, code: `ax.axhline(y.mean(), ls="--", color="gray")
ax.annotate("peak", xy=(x[i], y[i]), arrowprops=dict(arrowstyle="->"))
im = ax.imshow(grid, cmap="viridis")
fig.colorbar(im, ax=ax, label="visits")
fig.suptitle("Dashboard")
fig.tight_layout()` }),
    ],
    recap: ['subplots(r, c) + tight_layout + suptitle = dashboards.', 'Annotate the message; add reference lines for context.', 'imshow + colorbar turns a matrix into a picture.'],
  });

  /* ===================== L4 ===================== */
  M.lessons.push({
    id: 'three-d', title: 'Seeing in 3D', minutes: 30, blurb: '3-D scatter and surface plots, and what a loss surface looks like.',
    pages: [
      RD('When a third dimension helps', `<p>3-D plots are for <b>surfaces</b> (a function of two inputs, like a loss landscape or a regression plane) and for <b>seeing clusters</b> in three features. They are poor for exact comparison - use 2-D charts for that.</p>
        <pre class="codeblock">ax = fig.add_subplot(projection="3d")
ax.plot_surface(X, Y, Z, cmap="viridis")      # a surface
ax.scatter(x, y, z, c=labels)                  # a 3-D scatter
ax.set_xlabel("x"); ax.set_ylabel("y"); ax.set_zlabel("z")
ax.view_init(elev=25, azim=-60)                # camera angle</pre>`),
      VZ('Drag to rotate a surface', 'surface3d', { expr: 'sin(sqrt(x^2 + y^2)) * 2', r: 4 }, 'Change the formula (<code>x^2 - y^2</code> is a saddle; <code>sin(x) * cos(y)</code> is an egg-box). Gradient descent explores surfaces exactly like this one in machine learning.'),
      DM('The same surface in matplotlib', `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(-3, 3, 40)
y = np.linspace(-3, 3, 40)
X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2)) * 2

fig = plt.figure(figsize=(6, 4.6))
ax = fig.add_subplot(projection="3d")
ax.plot_surface(X, Y, Z, cmap="viridis")
ax.set_xlabel("x"); ax.set_ylabel("y"); ax.set_zlabel("z")
ax.view_init(elev=30, azim=-55)
ax.set_title("A surface")`, '<code>np.meshgrid</code> builds the grid of (x, y) pairs - the same broadcasting idea you met in NumPy.'),
      EX({
        id: 'mp-4-1', title: 'A 3-D scatter', est: 300, xp: 30, livePlot: true,
        prompt: `<p>Plot the points in 3-D with a 3-D axes: x vs y vs z, colour them by <code>z</code> using <code>c=z</code>, and label all three axes.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(4)
x, y = rng.normal(size=60), rng.normal(size=60)
z = x * 0.8 + y * 0.5 + rng.normal(0, 0.2, 60)

fig = plt.figure(figsize=(6, 4.6))
ax = fig.add_subplot(projection="___")
ax.scatter(x, y, ___, c=z, cmap="viridis")
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.set_zlabel("___")`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(4)
x, y = rng.normal(size=60), rng.normal(size=60)
z = x * 0.8 + y * 0.5 + rng.normal(0, 0.2, 60)

fig = plt.figure(figsize=(6, 4.6))
ax = fig.add_subplot(projection="3d")
ax.scatter(x, y, z, c=z, cmap="viridis")
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.set_zlabel("z")`,
        bank: ['3d', '2d', 'z', 'y', 'x'], hints: ['projection="3d" makes a 3-D axes.', 'scatter takes three coordinate arrays.'],
        tests: `ax = plt.gcf().axes[0]
check(getattr(ax, 'name', '') == '3d', 'the axes is 3-D', 'add_subplot(projection="3d")')
check(len(ax.collections) == 1 and len(ax.collections[0]._offsets3d[0]) == 60, 'the 60 points are plotted in 3-D', 'ax.scatter(x, y, z, ...)')
check(ax.get_xlabel() and ax.get_ylabel() and ax.get_zlabel(), 'all three axes are labelled', 'set_xlabel / set_ylabel / set_zlabel')`,
      }),
      QZ('matplotlib', [
        { q: 'What does `np.meshgrid(x, y)` return?', o: ['Two 2-D arrays with every (x, y) combination', 'A single list of pairs', 'The product x * y', 'A 3-D array'], a: 0, why: 'X and Y are grids you can feed into a formula to get a surface Z.' },
        { q: 'Which is a good use of a 3-D plot?', o: ['A loss surface over two parameters', 'Comparing 5 category totals', 'Showing a monthly trend', 'Showing percentages of a whole'], a: 0, why: 'Surfaces of two inputs need the third dimension; comparisons are clearer in 2-D.' },
      ], 'Quick check'),
      TY({ id: 'mp-t4', title: 'Typing sprint: 3-D', goal: 26, code: `X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2))
ax = fig.add_subplot(projection="3d")
ax.plot_surface(X, Y, Z, cmap="viridis")
ax.view_init(elev=30, azim=-55)` }),
    ],
    recap: ['Surfaces and 3-D clusters are the legitimate uses of 3-D.', 'meshgrid + a formula = a surface; add_subplot(projection="3d") draws it.', 'view_init changes the camera.'],
  });

  /* ===================== L5 ===================== */
  M.lessons.push({
    id: 'story', title: 'Seaborn and telling a story', minutes: 35, blurb: 'Statistical plots in one line, choosing the right chart and fixing a bad one.',
    pages: [
      RD('Seaborn: statistics in one line', `<p>Seaborn sits on matplotlib and works directly with DataFrames: <code>sns.histplot(df, x="age", hue="gender")</code>, <code>sns.boxplot(df, x="dept", y="wait")</code>, <code>sns.scatterplot(df, x=, y=, hue=)</code>, <code>sns.heatmap(df.corr(numeric_only=True), annot=True)</code>, <code>sns.pairplot(df)</code>. They return normal matplotlib Axes, so everything from the previous lessons still applies.</p>
        ${NOTE('', 'First run:', 'Seaborn is downloaded into your browser the first time you use it here (a few seconds, needs internet).')}`),
      DM('A correlation heatmap', `import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

rng = np.random.default_rng(0)
n = 200
age = rng.normal(40, 12, n)
df = pd.DataFrame({"age": age,
                   "income": age * 1200 + rng.normal(0, 9000, n),
                   "spend": age * -15 + rng.normal(400, 120, n),
                   "visits": rng.poisson(5, n)})
fig, ax = plt.subplots(figsize=(5.2, 4.2))
sns.heatmap(df.corr(), annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1, ax=ax)
ax.set_title("Which columns move together?")`, 'Correlation runs from -1 (opposite) to +1 (together). Seaborn did the colour scale, the numbers and the layout.'),
      RD('A chart is an argument', `<p>Before you draw, answer: <b>what do I want the reader to conclude?</b> Then:</p>${UL(['Title says the conclusion ("Weekends add 40% more trips"), not the topic ("Trips by day")', 'Sort bars by value (unless the categories have a natural order)', 'Use <code>barh</code> for long labels; avoid pies with more than 4 slices', 'Start bar charts at zero; lines may start elsewhere', 'Direct labels beat legends; highlight the one thing that matters in colour and grey out the rest', 'Always show units and the data source'])}`),
      EX({
        id: 'mp-5-1', title: 'Fix the bad chart', est: 360, xp: 40, kind: 'debug', livePlot: true,
        prompt: `<p>This chart of sales per product has problems: the bars are in random order, there is no title or axis label, and the labels are cramped. Rewrite it so that it is a <b>horizontal bar chart</b> (<code>barh</code>), sorted so the <b>largest bar is at the top</b>, with a title, an x label <code>"units sold"</code>, and the value written at the end of each bar (<code>ax.bar_label</code>).</p>`,
        starter: `import matplotlib.pyplot as plt

products = ["Kettle", "Lamp", "Desk", "Chair", "Shelf", "Mat"]
sold = [140, 95, 60, 210, 75, 120]

fig, ax = plt.subplots(figsize=(6, 3.8))
ax.bar(products, sold)`,
        solution: `import matplotlib.pyplot as plt

products = ["Kettle", "Lamp", "Desk", "Chair", "Shelf", "Mat"]
sold = [140, 95, 60, 210, 75, 120]

pairs = sorted(zip(sold, products))          # smallest first, so the largest ends up at the top of a barh
vals = [p[0] for p in pairs]
names = [p[1] for p in pairs]

fig, ax = plt.subplots(figsize=(6, 3.8))
bars = ax.barh(names, vals, color="#2F6FE0")
ax.bar_label(bars, padding=3)
ax.set_title("Chair is our best seller")
ax.set_xlabel("units sold")`,
        hints: ['In a barh chart the FIRST bar is drawn at the bottom, so feed the values sorted from smallest to largest.', 'sorted(zip(values, names)) sorts the pairs by value.', 'bars = ax.barh(...) returns the bars; ax.bar_label(bars) writes the numbers.'],
        tests: `ax = plt.gcf().axes[0]
w = [p.get_width() for p in ax.patches]
check(len(ax.patches) == 6 and sorted(w) == [60, 75, 95, 120, 140, 210], 'six horizontal bars with the right values', 'ax.barh(names, vals)')
check(w == sorted(w), 'the largest bar is at the top (values ascend in drawing order)', 'sort smallest to largest before barh')
check(len(ax.get_title()) > 3 and ax.get_xlabel() == 'units sold', 'there is a title and the x label is "units sold"', 'set_title and set_xlabel')
check(len(ax.texts) >= 6, 'each bar has its value written on it', 'ax.bar_label(bars)')`,
      }),
      EX({
        id: 'mp-5-2', title: 'Seaborn in one line', est: 240, xp: 25, livePlot: true,
        prompt: `<p>Draw a seaborn <b>boxplot</b> of <code>wait</code> by <code>dept</code> from the DataFrame (x = dept, y = wait) on the axes <code>ax</code>, and set the title to "Waiting time by department".</p>`,
        starter: `import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

rng = np.random.default_rng(1)
df = pd.DataFrame({"dept": np.repeat(["ENT", "General", "Cardio"], 60),
                   "wait": np.concatenate([rng.normal(15, 4, 60), rng.normal(30, 9, 60), rng.normal(22, 6, 60)])})
fig, ax = plt.subplots(figsize=(6, 3.8))
sns.___(data=df, x="dept", y="___", ax=ax)
ax.set_title("___")`,
        solution: `import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

rng = np.random.default_rng(1)
df = pd.DataFrame({"dept": np.repeat(["ENT", "General", "Cardio"], 60),
                   "wait": np.concatenate([rng.normal(15, 4, 60), rng.normal(30, 9, 60), rng.normal(22, 6, 60)])})
fig, ax = plt.subplots(figsize=(6, 3.8))
sns.boxplot(data=df, x="dept", y="wait", ax=ax)
ax.set_title("Waiting time by department")`,
        bank: ['boxplot', 'barplot', 'histplot', 'wait', 'dept', 'Waiting time by department'], hints: ['sns.boxplot(data=df, x=..., y=..., ax=ax)'],
        tests: `ax = plt.gcf().axes[0]
check(len(ax.patches) >= 3, 'three boxes are drawn', 'sns.boxplot(...)')
check(ax.get_title() == 'Waiting time by department', 'the title is right', 'ax.set_title("Waiting time by department")')
check(ax.get_ylabel() == 'wait' and ax.get_xlabel() == 'dept', 'seaborn labelled the axes from the column names', 'x="dept", y="wait"')`,
      }),
      QZ('matplotlib', [
        { q: 'Which title is best for a chart of weekend vs weekday trips?', o: ['"Weekends add 40% more trips"', '"Trips by day type"', '"Chart 1"', '"Bar chart of trips"'], a: 0, why: 'A good title states the takeaway.' },
        { q: 'A pie chart has 11 slices. What is the best fix?', o: ['A sorted horizontal bar chart', 'Add more colours', 'Make the pie bigger', 'Use 3-D slices'], a: 0, why: 'Humans compare lengths far better than angles.' },
        { q: 'Seaborn functions return...', o: ['Matplotlib Axes you can keep customising', 'A PNG file', 'A new kind of figure that matplotlib cannot touch', 'A DataFrame'], a: 0, why: 'So set_title, annotate, etc. all still work.' },
      ], 'Quick check'),
      TY({ id: 'mp-t5', title: 'Typing sprint: seaborn', goal: 28, code: `sns.histplot(data=df, x="age", hue="gender", bins=20, ax=ax)
sns.boxplot(data=df, x="dept", y="wait", ax=ax)
sns.heatmap(df.corr(numeric_only=True), annot=True, cmap="coolwarm", ax=ax)
ax.bar_label(bars, padding=3)` }),
    ],
    recap: ['Seaborn = DataFrame in, statistical chart out; returns normal Axes.', 'Title = the conclusion; sort bars; direct labels.', 'Choose pie only for a few parts of a whole.'],
  });

  /* ===================== boss ===================== */
  M.boss = [
    { q: 'What does `fig, ax = plt.subplots(2, 3)` give you for `ax`?', o: ['A 2x3 array of Axes', 'One Axes', 'A list of 3 figures', 'A dictionary'], a: 0, why: 'Index with ax[row, col].' },
    { q: 'Which statement draws a scatter coloured by a numeric array `c`?', o: ['ax.scatter(x, y, c=c, cmap="viridis")', 'ax.plot(x, y, color=c)', 'ax.bar(x, y, c=c)', 'ax.color(c)'], a: 0, why: 'scatter accepts c= (colours or numbers mapped through cmap).' },
    { q: 'Where is the first bar of `ax.barh(names, values)` drawn?', o: ['At the bottom', 'At the top', 'In the middle', 'It depends on the colour'], a: 0, why: 'So sort ascending (or call ax.invert_yaxis()) to put the largest at the top.' },
    { q: 'How do you save a high-resolution image?', o: ['fig.savefig("a.png", dpi=200, bbox_inches="tight")', 'plt.save("a.png")', 'fig.write("a.png")', 'ax.export("a.png")'], a: 0, why: 'savefig with dpi and tight bounding box.' },
    { q: 'You see: line chart, two series, no legend. What is missing?', o: ['label= on each plot call and ax.legend()', 'a pie chart', 'a bigger figure', 'nothing'], a: 0, why: 'Readers cannot tell the lines apart otherwise.' },
    { gen: r => { const n = r.int(3, 12); return { q: `\`ax.hist(data, bins=${n})\` creates how many patches (bars)?`, correct: n, wrong: distract(n, [n + 1, n - 1, 2 * n, 10]), why: 'One rectangle per bin.' }; } },
    { q: 'Which is the right tool for showing the shape of one numeric variable?', o: ['Histogram', 'Pie', 'Stacked bar', 'Line chart of row order'], a: 0, why: 'Histograms (or KDE/box plots) show distribution.' },
    { q: 'What does `ax.axvline(5)` draw?', o: ['A vertical line at x = 5', 'A horizontal line at y = 5', 'A box of width 5', 'A 5-point grid'], a: 0, why: 'axvline = vertical line; axhline = horizontal.' },
    { q: 'Why add `fig.colorbar(im, ax=ax)` to an imshow heatmap?', o: ['To explain which colour means which value', 'To change the colours', 'To rotate it', 'To save space'], a: 0, why: 'Without it the colours are meaningless.' },
    { q: 'For 3-D plots you create the axes with...', o: ['fig.add_subplot(projection="3d")', 'plt.plot3d()', 'ax.set_3d(True)', 'plt.figure(dim=3)'], a: 0, why: 'projection="3d" returns an Axes3D that has plot_surface, scatter(x, y, z), ...' },
  ];
})();
