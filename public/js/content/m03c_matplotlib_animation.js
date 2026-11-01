'use strict';
/* Matplotlib / seaborn extension: heatmaps and frame-by-frame animation. */
(function () {
  const M = DSQ.modules.find(m => m.id === 'matplotlib');
  M.lessons.push({
    id: 'heat', title: 'Heatmaps and animated curves', minutes: 35, blurb: 'Correlation heatmaps, colormaps, and how an animation is just frames.',
    pages: [
      RD('A heatmap turns a table of numbers into colour', `<p>A <b>heatmap</b> colours each cell of a matrix by its value. Its classic job is the <b>correlation matrix</b>: <code>df.corr()</code> gives every pair of columns a number from -1 to +1, and colour lets you see the pattern in a second. Rules that separate a good heatmap from a misleading one:</p>
        ${UL(['<b>Diverging colormap</b> (<code>coolwarm</code>, <code>RdBu</code>) for values with a meaningful centre like correlation; <b>sequential</b> (<code>viridis</code>, <code>magma</code>) for counts and amounts', 'fix the scale with <code>vmin=-1, vmax=1</code> so a colour means the same thing in every chart', '<code>annot=True</code> prints the numbers; a symmetric matrix repeats itself, so <code>mask</code> the upper triangle', 'matplotlib: <code>ax.imshow(matrix, cmap=..., vmin=..., vmax=...)</code> + <code>fig.colorbar(im)</code>; seaborn: <code>sns.heatmap(corr, annot=True, cmap="coolwarm")</code>'])}`),
      VZ('Build a correlation heatmap cell by cell', 'heatmapLab', {}, 'Watch the cells fill in, hover for the exact pair, switch between a diverging and a sequential map, hide the repeated triangle, and regroup the variables so related ones sit together. The code underneath is the seaborn call that draws the same picture.'),
      DM('The same heatmap in matplotlib', `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

rng = np.random.default_rng(0)
a = rng.normal(size=200)
df = pd.DataFrame({"a": a, "b": 0.8 * a + rng.normal(0, 0.5, 200), "c": rng.normal(size=200), "d": -0.6 * a + rng.normal(0, 0.7, 200)})
corr = df.corr()

fig, ax = plt.subplots(figsize=(5, 4.2))
im = ax.imshow(corr.values, cmap="coolwarm", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr)))
ax.set_xticklabels(corr.columns)
ax.set_yticks(range(len(corr)))
ax.set_yticklabels(corr.columns)
for i in range(len(corr)):
    for j in range(len(corr)):
        ax.text(j, i, f"{corr.values[i, j]:.2f}", ha="center", va="center", fontsize=9)
fig.colorbar(im, label="correlation")
ax.set_title("Correlation heatmap")
fig.tight_layout()`, 'b follows a closely (red), d goes the opposite way (blue), c is unrelated (white). The loop writes each number into its cell - exactly what <code>annot=True</code> does for you.'),
      VZ('An animation is a stack of frames', 'plotAnim', {}, 'Drag the <b>frame</b> slider: every frame is an ordinary plot that shows the first k points. <b>FuncAnimation</b> just calls your <code>update(frame)</code> function 100-200 times and shows the results one after another. The panel below shows the real code.'),
      DM('Three frames of an animation, side by side', `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 12, 180)
y = np.exp(-0.3 * x) * np.cos(3 * x)

fig, axes = plt.subplots(1, 3, figsize=(10, 2.8), sharey=True)
for ax, frame in zip(axes, [30, 90, 180]):
    ax.plot(x[:frame], y[:frame])
    ax.set_xlim(0, 12)
    ax.set_title(f"frame {frame}")
    ax.grid(alpha=0.3)
fig.tight_layout()`, 'Each panel is what <code>update(frame)</code> would draw at that moment. In a Jupyter notebook you would write <code>ani = FuncAnimation(fig, update, frames=180, interval=30)</code> and show it with <code>HTML(ani.to_jshtml())</code>.'),
      EX({
        id: 'mp-6-1', title: 'Draw a correlation heatmap', est: 360, xp: 40,
        prompt: `<p>Draw the correlation matrix of <code>df</code> with <code>imshow</code>: colormap <code>coolwarm</code>, scale -1 to 1, the column names as tick labels on the x axis, and a colorbar. Name the image <code>im</code>.</p>`,
        starter: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

rng = np.random.default_rng(0)
a = rng.normal(size=100)
df = pd.DataFrame({"a": a, "b": a * 0.8 + rng.normal(0, 0.5, 100), "c": rng.normal(size=100)})
corr = df.corr()
fig, ax = plt.subplots()
im = ax.imshow(corr.values, cmap="___", vmin=___, vmax=___)
ax.set_xticks(range(3))
ax.set_xticklabels(corr.columns)
fig.colorbar(im)`,
        solution: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

rng = np.random.default_rng(0)
a = rng.normal(size=100)
df = pd.DataFrame({"a": a, "b": a * 0.8 + rng.normal(0, 0.5, 100), "c": rng.normal(size=100)})
corr = df.corr()
fig, ax = plt.subplots()
im = ax.imshow(corr.values, cmap="coolwarm", vmin=-1, vmax=1)
ax.set_xticks(range(3))
ax.set_xticklabels(corr.columns)
fig.colorbar(im)`,
        bank: ['coolwarm', 'viridis', '-1', '1', '0'], hints: ['A correlation lives between -1 and 1; a diverging colormap is coolwarm.'],
        tests: `fig = plt.gcf(); ax = fig.axes[0]
check(im.get_cmap().name == 'coolwarm', 'diverging colormap coolwarm', 'cmap="coolwarm"')
check(tuple(im.get_clim()) == (-1, 1), 'the colour scale is fixed from -1 to 1', 'vmin=-1, vmax=1')
check(np.allclose(np.asarray(im.get_array()), corr.values), 'the image shows the correlation matrix', 'ax.imshow(corr.values, ...)')
check([t.get_text() for t in ax.get_xticklabels()] == ['a', 'b', 'c'] and len(fig.axes) == 2, 'x labels a, b, c and a colorbar axis exist', 'set_xticklabels, fig.colorbar(im)')`,
      }),
      EX({
        id: 'mp-6-2', title: 'Frames of an animation', est: 300, xp: 35,
        prompt: `<p>Draw the first 30, 60, 90 and 120 points of the curve in four side-by-side axes (<code>axes[i]</code>), each titled <code>frame N</code>. This is what <code>update(frame)</code> shows at those moments.</p>`,
        starter: `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 6.28, 120)
y = np.sin(x)
fig, axes = plt.subplots(1, 4, figsize=(10, 2.5), sharey=True)
for ax, frame in zip(axes, [30, 60, 90, 120]):
    ax.plot(x[:___], y[:___])
    ax.set_title(f"frame {___}")
    ax.set_xlim(0, 6.28)`,
        solution: `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 6.28, 120)
y = np.sin(x)
fig, axes = plt.subplots(1, 4, figsize=(10, 2.5), sharey=True)
for ax, frame in zip(axes, [30, 60, 90, 120]):
    ax.plot(x[:frame], y[:frame])
    ax.set_title(f"frame {frame}")
    ax.set_xlim(0, 6.28)`,
        bank: ['frame'], hints: ['Inside the loop the variable is called frame.'],
        tests: `fig = plt.gcf()
check(len(fig.axes) == 4, 'four axes', 'plt.subplots(1, 4)')
check([len(a_.lines[0].get_xdata()) for a_ in fig.axes] == [30, 60, 90, 120], 'the axes show 30, 60, 90 and 120 points', 'x[:frame]')
check([a_.get_title() for a_ in fig.axes] == ['frame 30', 'frame 60', 'frame 90', 'frame 120'], 'titles frame 30 ... frame 120', 'f"frame {frame}"')`,
      }),
      QZ('matplotlib', [
        { q: 'A correlation heatmap should normally use...', o: ['A diverging colormap with vmin=-1, vmax=1', 'A random colormap', 'A colormap with no fixed scale', 'Only grey'], a: 0, why: 'The centre (0 = no correlation) must be a neutral colour.' },
        { q: 'Why mask the upper triangle of a correlation heatmap?', o: ['The matrix is symmetric, so it repeats itself', 'The upper values are wrong', 'It runs faster', 'seaborn requires it'], a: 0, why: 'corr(a, b) = corr(b, a).' },
        { q: 'In FuncAnimation, what does update(frame) do?', o: ['Redraws the artists for one moment in time', 'Saves the file', 'Sets the title', 'Loads the data'], a: 0, why: 'It is called once per frame.' },
        { q: 'You want the same colour to mean the same value in two heatmaps. Set...', o: ['The same vmin and vmax in both', 'Different cmaps', 'annot=True', 'figsize'], a: 0, why: 'A shared scale makes them comparable.' },
      ], 'Quick check'),
      TY({ id: 'mp-t6', title: 'Typing sprint: heatmap', goal: 30, code: `im = ax.imshow(corr.values, cmap="coolwarm", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr)))
ax.set_xticklabels(corr.columns)
fig.colorbar(im, label="correlation")` }),
    ],
    recap: ['Heatmap = a matrix in colour; correlation uses a diverging map fixed to -1..1.', 'imshow + colorbar in matplotlib; sns.heatmap(annot=True, cmap=..., mask=...) in seaborn.', 'An animation is frames: update(frame) redraws, FuncAnimation plays them.'],
  });
  M.boss.push({ q: 'Which colormap type suits a correlation matrix?', o: ['Diverging', 'Sequential only', 'Cyclic', 'Qualitative'], a: 0, why: 'There is a meaningful midpoint at 0.' });
})();
