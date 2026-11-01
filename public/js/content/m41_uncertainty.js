'use strict';
/* =====================================================================
   Module: Uncertainty: Bayes, Calibration and Conformal Prediction (4 lessons, 12 exercises)
   Beta-Binomial updating and credible intervals, Thompson sampling, bootstrap for any statistic, interval coverage and sample size, calibration (ECE, reliability, temperature scaling),
   split conformal prediction. Standard library and NumPy. View: Explorer diagram #/explore/uncertainty.
   ===================================================================== */
DSQ.defModule({
  id: 'uncertainty', boss: [], lessons: [],
  outcomes: ['Update a Beta prior with data, read a credible interval and use Thompson sampling', 'Bootstrap an interval for any statistic and check coverage by simulation', 'Measure calibration (ECE, reliability table) and fix over-confidence with temperature scaling', 'Build split conformal prediction intervals and verify their coverage'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'uncertainty');

  M.lessons.push({
    id: 'bayes', title: 'Bayesian updating', minutes: 45, blurb: 'Start with a belief, let data move it, and keep the spread.',
    pages: [
      RD('A rate you are not sure about', `<p>You launch a feature and 7 of the first 10 users click. Is the true click rate 70%? Probably not exactly. A <b>Beta(a, b)</b> distribution describes your belief about a rate between 0 and 1. <b>a</b> and <b>b</b> act like imaginary earlier successes and failures:</p>
        ${UL(['<b>Prior</b>: Beta(1, 1) is flat ("no idea"); Beta(20, 80) says "probably around 20%, and I am fairly sure".', '<b>Update</b> with k successes in n tries: Beta(a + k, b + n - k). No integrals needed.', 'The <b>posterior mean</b> is a / (a + b): a blend of the prior and the data, and a strong prior needs a lot of data to move.', 'A <b>credible interval</b> holds 95% of the posterior probability: "given the model and the data, the rate is in this range with 95% probability".', '<b>Thompson sampling</b>: to choose between options, draw one sample from each posterior and pick the highest. Uncertain options get explored automatically.'])}`),
      VZ('Knowing what you do not know, as a diagram and a hologram', 'explorer', { id: 'uncertainty' }, 'Bayes, bootstrap, calibration and conformal prediction.', '<p class="muted"><a href="#/explore/uncertainty">Open full screen</a></p>'),
      EX({
        id: 'un-1-1', title: 'Update a Beta prior', est: 420, xp: 40,
        prompt: `<p>Write <code>beta_update(a, b, k, n)</code> returning <code>(a + k, b + n - k)</code>, <code>beta_mean(a, b)</code> = <code>a / (a + b)</code>, and <code>shrunk_rate(k, n, prior_mean, prior_n)</code>: the posterior mean when the prior is worth <code>prior_n</code> imaginary tries with success rate <code>prior_mean</code>, i.e. <code>(k + prior_mean * prior_n) / (n + prior_n)</code>.</p>`,
        starter: `def beta_update(a, b, k, n):
    ...

def beta_mean(a, b):
    ...

def shrunk_rate(k, n, prior_mean, prior_n):
    ...

print(beta_update(1, 1, 7, 10), beta_mean(8, 4), shrunk_rate(1, 1, 0.2, 20))`,
        solution: `def beta_update(a, b, k, n):
    return a + k, b + n - k

def beta_mean(a, b):
    return a / (a + b)

def shrunk_rate(k, n, prior_mean, prior_n):
    return (k + prior_mean * prior_n) / (n + prior_n)

print(beta_update(1, 1, 7, 10), beta_mean(8, 4), shrunk_rate(1, 1, 0.2, 20))`,
        hints: ['Successes add to a, failures add to b.'],
        tests: `check(beta_update(1, 1, 7, 10) == (8, 4), '7 clicks, 3 non-clicks added to a flat prior', 'a + k, b + n - k')
check(abs(beta_mean(8, 4) - 2/3) < 1e-12, 'the posterior mean is 0.667, not the raw 0.70: the flat prior pulls slightly', 'a / (a + b)')
check(abs(shrunk_rate(1, 1, 0.2, 20) - 5/21) < 1e-12 and shrunk_rate(1, 1, 0.2, 20) < 0.25, 'one success in one try does not mean 100%: with a strong prior it stays near 24%', 'prior pseudo-counts')`,
      }),
      EX({
        id: 'un-1-2', title: 'A credible interval from a grid', est: 780, xp: 90,
        prompt: `<p>Write <code>credible_interval(a, b, level=0.95, grid=2001)</code>. Evaluate the Beta density on <code>grid</code> evenly spaced points strictly inside (0, 1) (<code>x = (i + 0.5) / grid</code>) using <code>exp((a-1) log x + (b-1) log(1-x))</code> (the constant cancels once you normalise), normalise the values to sum to 1, accumulate them, and return the first <code>x</code> whose cumulative sum reaches <code>(1 - level)/2</code> and the first whose cumulative sum reaches <code>1 - (1 - level)/2</code>.</p>`,
        starter: `import math

def credible_interval(a, b, level=0.95, grid=2001):
    ...

print(credible_interval(1, 1), credible_interval(8, 4))`,
        solution: `import math

def credible_interval(a, b, level=0.95, grid=2001):
    xs = [(i + 0.5) / grid for i in range(grid)]
    w = [math.exp((a - 1) * math.log(x) + (b - 1) * math.log(1 - x)) for x in xs]
    s = sum(w)
    lo_t, hi_t = (1 - level) / 2, 1 - (1 - level) / 2
    acc, lo, hi = 0.0, None, None
    for x, wi in zip(xs, w):
        acc += wi / s
        if lo is None and acc >= lo_t:
            lo = x
        if hi is None and acc >= hi_t:
            hi = x
            break
    return lo, hi

print(credible_interval(1, 1), credible_interval(8, 4))`,
        hints: ['Normalise first, then walk along the grid with a running total.'],
        tests: `lo, hi = credible_interval(1, 1)
check(abs(lo - 0.025) < 0.002 and abs(hi - 0.975) < 0.002, 'a flat prior: the middle 95% runs from 0.025 to 0.975', 'cumulative probability 2.5% and 97.5%')
lo, hi = credible_interval(8, 4)
check(lo < 8 / 12 < hi and 0.38 < lo < 0.42 and 0.88 < hi < 0.94, 'after 7 of 10 clicks the rate is probably between about 0.4 and 0.9', 'the mean lies inside')
w_small = credible_interval(3, 3)
w_big = credible_interval(30, 30)
check((w_big[1] - w_big[0]) < (w_small[1] - w_small[0]) / 2, 'ten times more data gives a much narrower interval', 'uncertainty shrinks with data')`,
      }),
      EX({
        id: 'un-1-3', title: 'Thompson sampling', est: 600, xp: 70,
        prompt: `<p>Write <code>thompson_pick(arms, seed)</code>: <code>arms</code> is a list of <code>(a, b)</code> Beta parameters. With <code>rng = random.Random(seed)</code> draw one <code>rng.betavariate(a, b)</code> per arm and return the index of the largest draw (the first on ties).</p>`,
        starter: `import random

def thompson_pick(arms, seed):
    ...

print(thompson_pick([(100, 1), (1, 100)], 0))`,
        solution: `import random

def thompson_pick(arms, seed):
    rng = random.Random(seed)
    draws = [rng.betavariate(a, b) for a, b in arms]
    return draws.index(max(draws))

print(thompson_pick([(100, 1), (1, 100)], 0))`,
        hints: ['One draw per arm, then argmax.'],
        tests: `check(all(thompson_pick([(100, 1), (1, 100)], s) == 0 for s in range(50)), 'a clearly better arm is always chosen', 'draws from Beta(100, 1) are near 1')
picks = [thompson_pick([(1, 1), (1, 1)], s) for s in range(400)]
check(150 < picks.count(0) < 250, 'two equally unknown arms are picked about equally often', 'exploration when uncertain')
picks = [thompson_pick([(30, 70), (2, 1)], s) for s in range(400)]
check(picks.count(1) > 100, 'an arm with a good but very uncertain record still gets tried a lot', 'wide posterior = frequent exploration')`,
      }),
      QZ('uncertainty', [
        { q: 'You observe 1 success in 1 try. With a flat prior the posterior mean is...', o: ['2/3', '1', '0.5', '0'], a: 0, why: 'Beta(2, 1): 2 / 3.' },
        { q: 'What does a stronger prior do?', o: ['Needs more data to move the posterior', 'Makes data irrelevant forever', 'Speeds up learning', 'Removes uncertainty'], a: 0, why: 'It acts as many imaginary observations.' },
        { q: 'Thompson sampling explores because...', o: ['Uncertain options sometimes produce high draws', 'It picks randomly', 'It ignores data', 'It uses epsilon'], a: 0, why: 'A wide posterior has a high upper tail.' },
      ], 'Quick check'),
    ],
    recap: ['Beta(a + k, b + n - k) is the whole update.', 'Credible intervals read straight off the posterior.', 'Thompson sampling draws once from each posterior.'],
  });

  M.lessons.push({
    id: 'boot', title: 'Bootstrap and coverage', minutes: 45, blurb: 'Intervals for any statistic, and a way to check they are honest.',
    pages: [
      RD('Resample, recompute, read the spread', `<p>For a mean there is a textbook formula. For a median, a ratio, a 90th percentile or an F1 score there often is not. The <b>bootstrap</b> replaces algebra with computation: resample your data with replacement many times, compute the statistic each time, and take the 2.5th and 97.5th percentiles of the results.</p>
        ${UL(['A "95% interval" should contain the true value in about 95% of repetitions of the whole experiment: its <b>coverage</b>. You can check that by simulation, where the truth is known.', 'The width of an interval for a mean shrinks like 1 / &radic;n: to halve it you need four times the data. The sample size for a desired margin is <code>n = (z &times; sd / margin)&sup2;</code>.'])}`),
      EX({
        id: 'un-2-1', title: 'Bootstrap any statistic', est: 600, xp: 70,
        prompt: `<p>Write <code>bootstrap_ci(x, stat, B=2000, alpha=0.05, seed=0)</code>: with <code>rng = random.Random(seed)</code>, resample <code>x</code> with replacement <code>B</code> times (<code>rng.choices(x, k=len(x))</code>), compute <code>stat(sample)</code> each time, sort the results and return the values at positions <code>int(B * alpha / 2)</code> and <code>int(B * (1 - alpha / 2)) - 1</code>.</p>`,
        starter: `import random, statistics

def bootstrap_ci(x, stat, B=2000, alpha=0.05, seed=0):
    ...

print(bootstrap_ci([3, 5, 4, 10, 6, 5, 4, 7, 5, 30], statistics.median))`,
        solution: `import random, statistics

def bootstrap_ci(x, stat, B=2000, alpha=0.05, seed=0):
    rng = random.Random(seed)
    vals = sorted(stat(rng.choices(x, k=len(x))) for _ in range(B))
    return vals[int(B * alpha / 2)], vals[int(B * (1 - alpha / 2)) - 1]

print(bootstrap_ci([3, 5, 4, 10, 6, 5, 4, 7, 5, 30], statistics.median))`,
        hints: ['stat is any function that takes a list and returns a number.'],
        tests: `import statistics
x = [3, 5, 4, 10, 6, 5, 4, 7, 5, 30]
lo, hi = bootstrap_ci(x, statistics.median)
check(lo <= statistics.median(x) <= hi and lo >= 3 and hi <= 10, 'a median interval stays among the typical values, unaffected by the outlier 30', 'percentiles of resampled medians')
lm, hm = bootstrap_ci(x, statistics.mean)
check((hm - lm) > (hi - lo), 'the mean is far more affected by the outlier, so its interval is wider', 'same method, different statistic')
c = bootstrap_ci([2.0] * 20, max)
check(c == (2.0, 2.0), 'no variation, no uncertainty, for any statistic', 'identical resamples')`,
      }),
      EX({
        id: 'un-2-2', title: 'Does a 95% interval cover 95%?', est: 720, xp: 80,
        prompt: `<p>Write <code>coverage(true_mean, sd, n, trials, seed)</code>: with <code>rng = random.Random(seed)</code>, repeat <code>trials</code> times: draw <code>n</code> values from <code>rng.gauss(true_mean, sd)</code>, compute the sample mean <code>m</code> and the sample standard deviation <code>s</code> (<code>statistics.stdev</code>), form <code>m &plusmn; 1.96 * s / sqrt(n)</code> and check whether it contains <code>true_mean</code>. Return the share of trials that did.</p>`,
        starter: `import random, statistics, math

def coverage(true_mean, sd, n, trials, seed):
    ...

print(coverage(10, 2, 30, 2000, 0))`,
        solution: `import random, statistics, math

def coverage(true_mean, sd, n, trials, seed):
    rng = random.Random(seed)
    hits = 0
    for _ in range(trials):
        xs = [rng.gauss(true_mean, sd) for _ in range(n)]
        m, s = statistics.mean(xs), statistics.stdev(xs)
        half = 1.96 * s / math.sqrt(n)
        if m - half <= true_mean <= m + half:
            hits += 1
    return hits / trials

print(coverage(10, 2, 30, 2000, 0))`,
        hints: ['Count the trials where the interval catches the true mean.'],
        tests: `c = coverage(10, 2, 30, 2000, 0)
check(0.92 < c < 0.97, 'with n = 30 about 94-95% of the intervals contain the truth', 'a well-behaved 95% interval')
c2 = coverage(10, 2, 5, 2000, 0)
check(c2 < c, 'with only 5 observations the 1.96 rule is too optimistic: coverage drops (about 88%)', 'small n needs a t multiplier')
check(coverage(0, 1, 30, 300, 4) == coverage(0, 1, 30, 300, 4), 'the same seed repeats the same experiment', 'the generator is built inside')`,
      }),
      EX({
        id: 'un-2-3', title: 'How many samples do I need?', est: 420, xp: 40,
        prompt: `<p>Write <code>margin(sd, n, z=1.96)</code> = <code>z * sd / sqrt(n)</code> and <code>n_for_margin(sd, target, z=1.96)</code> = the smallest integer <code>n</code> with margin at most <code>target</code>, i.e. <code>ceil((z * sd / target) ** 2)</code>.</p>`,
        starter: `import math

def margin(sd, n, z=1.96):
    ...

def n_for_margin(sd, target, z=1.96):
    ...

print(margin(10, 100), n_for_margin(10, 1))`,
        solution: `import math

def margin(sd, n, z=1.96):
    return z * sd / math.sqrt(n)

def n_for_margin(sd, target, z=1.96):
    return math.ceil((z * sd / target) ** 2)

print(margin(10, 100), n_for_margin(10, 1))`,
        hints: ['Solve margin = z sd / sqrt(n) for n.'],
        tests: `check(abs(margin(10, 100) - 1.96) < 1e-12, 'sd 10 with 100 observations: a margin of 1.96', 'z sd / sqrt(n)')
check(n_for_margin(10, 1) == 385 and n_for_margin(10, 0.5) == 1537, 'to halve the margin you need about four times the data: 385 becomes 1,537', 'ceil((z sd / target)^2)')
check(margin(10, n_for_margin(10, 1)) <= 1.0 < margin(10, n_for_margin(10, 1) - 1), 'n is the smallest value that works', 'one fewer would miss the target')`,
      }),
      QZ('uncertainty', [
        { q: 'Why bootstrap rather than a formula?', o: ['It works for statistics with no simple formula, such as a median or F1', 'It is exact', 'It needs no data', 'It removes outliers'], a: 0, why: 'Computation replaces algebra.' },
        { q: 'To cut a margin of error from 4 to 2 points, the sample size must...', o: ['Quadruple', 'Double', 'Stay the same', 'Halve'], a: 0, why: 'The margin goes as 1 / sqrt(n).' },
        { q: '"95% coverage" means...', o: ['In repeated experiments about 95% of intervals contain the true value', 'The true value is 95% likely in this one interval, always', 'The data are 95% accurate', 'The sample is 95% of the population'], a: 0, why: 'A property of the procedure.' },
      ], 'Quick check'),
    ],
    recap: ['Bootstrap: resample, recompute, take percentiles.', 'Check coverage by simulation.', 'Margin shrinks like 1 / sqrt(n).'],
  });

  M.lessons.push({
    id: 'calib', title: 'Calibration', minutes: 50, blurb: 'When a model says 80%, is it right 80% of the time?',
    pages: [
      RD('Confidence you can bet on', `<p>A classifier outputs probabilities; people use them to set thresholds, rank cases and decide when to ask a human. That only works if the probabilities mean what they say. Modern neural networks tend to be <b>over-confident</b>.</p>
        ${UL(['<b>Reliability table</b>: group predictions into bins by predicted probability; in each bin compare the average prediction with the actual fraction of positives.', '<b>Expected calibration error (ECE)</b>: the weighted average gap: <code>sum over bins of (n_bin / n) &times; |actual - predicted|</code>. Zero means perfectly calibrated.', '<b>Temperature scaling</b>: divide the logits by a single number T before the sigmoid or softmax. T &gt; 1 softens over-confident outputs. Choose T to minimise the negative log-likelihood on held-out data. It never changes which class is predicted, only how confident.'])}`),
      EX({
        id: 'un-3-1', title: 'Expected calibration error', est: 660, xp: 70,
        prompt: `<p>Write <code>ece(probs, labels, bins=10)</code> for binary predictions: bin <code>i</code> holds probabilities in <code>[i/bins, (i+1)/bins)</code> (put a probability of exactly 1.0 into the last bin). For each non-empty bin take <code>|mean(labels) - mean(probs)|</code>, weight it by the bin&rsquo;s share of all samples, and sum.</p>`,
        starter: `def ece(probs, labels, bins=10):
    ...

print(ece([0.9] * 10, [1] * 6 + [0] * 4))`,
        solution: `def ece(probs, labels, bins=10):
    n = len(probs)
    groups = [[] for _ in range(bins)]
    for p, y in zip(probs, labels):
        i = min(int(p * bins), bins - 1)
        groups[i].append((p, y))
    total = 0.0
    for g in groups:
        if g:
            conf = sum(p for p, _ in g) / len(g)
            acc = sum(y for _, y in g) / len(g)
            total += len(g) / n * abs(acc - conf)
    return total

print(ece([0.9] * 10, [1] * 6 + [0] * 4))`,
        hints: ['int(p * bins) gives the bin; clip it with min(..., bins - 1).'],
        tests: `check(abs(ece([0.9] * 10, [1] * 6 + [0] * 4) - 0.3) < 1e-12, 'says 90%, right 60% of the time: ECE 0.3', '|acc - conf| in the single bin')
check(abs(ece([0.5] * 10, [1] * 5 + [0] * 5)) < 1e-12 and ece([1.0, 1.0], [1, 1]) == 0.0, 'perfectly calibrated bins (and a probability of exactly 1.0) give 0', 'last bin includes 1.0')
check(abs(ece([0.1] * 5 + [0.9] * 5, [0] * 4 + [1] + [1] * 4 + [0]) - 0.1) < 1e-12, 'two bins, both off by 0.1', 'weighted average of the gaps')`,
      }),
      EX({
        id: 'un-3-2', title: 'A reliability table', est: 600, xp: 60,
        prompt: `<p>Write <code>reliability(probs, labels, bins=5)</code> returning a list of tuples <code>(lo, hi, n, mean_prob, frac_pos)</code> for every <b>non-empty</b> bin, in order, with <code>lo = i/bins</code> and <code>hi = (i+1)/bins</code> (same binning as before).</p>`,
        starter: `def reliability(probs, labels, bins=5):
    ...

print(reliability([0.1, 0.15, 0.9, 0.95, 0.85], [0, 1, 1, 1, 0]))`,
        solution: `def reliability(probs, labels, bins=5):
    groups = [[] for _ in range(bins)]
    for p, y in zip(probs, labels):
        groups[min(int(p * bins), bins - 1)].append((p, y))
    out = []
    for i, g in enumerate(groups):
        if g:
            out.append((i / bins, (i + 1) / bins, len(g), sum(p for p, _ in g) / len(g), sum(y for _, y in g) / len(g)))
    return out

print(reliability([0.1, 0.15, 0.9, 0.95, 0.85], [0, 1, 1, 1, 0]))`,
        hints: ['Skip empty bins.'],
        tests: `t = reliability([0.1, 0.15, 0.9, 0.95, 0.85], [0, 1, 1, 1, 0])
check(len(t) == 2 and t[0][:3] == (0.0, 0.2, 2) and t[1][2] == 3, 'two non-empty bins holding 2 and 3 predictions', 'only bins with data appear')
check(abs(t[0][3] - 0.125) < 1e-12 and abs(t[0][4] - 0.5) < 1e-12, 'the low bin predicts 12.5% but 50% are positive: under-confident', 'mean prob versus fraction positive')
check(abs(t[1][3] - 0.9) < 1e-12 and abs(t[1][4] - 2/3) < 1e-12, 'the high bin predicts 90% but only 67% are positive: over-confident', 'compare the two numbers')`,
      }),
      EX({
        id: 'un-3-3', title: 'Find the temperature', est: 780, xp: 90,
        prompt: `<p>Write <code>nll(logits, labels, T)</code>: the mean negative log-likelihood of binary labels when the probability is <code>p = 1 / (1 + exp(-z / T))</code> (clip <code>p</code> to <code>[1e-12, 1 - 1e-12]</code>). Then <code>best_temperature(logits, labels, grid)</code>: the value in <code>grid</code> with the lowest NLL (the first on ties).</p>`,
        starter: `import math

def nll(logits, labels, T):
    ...

def best_temperature(logits, labels, grid):
    ...

print(nll([2.0, -2.0], [1, 0], 1.0))`,
        solution: `import math

def nll(logits, labels, T):
    total = 0.0
    for z, y in zip(logits, labels):
        p = 1 / (1 + math.exp(-z / T))
        p = min(max(p, 1e-12), 1 - 1e-12)
        total += -(y * math.log(p) + (1 - y) * math.log(1 - p))
    return total / len(logits)

def best_temperature(logits, labels, grid):
    best, arg = float("inf"), grid[0]
    for T in grid:
        v = nll(logits, labels, T)
        if v < best - 1e-15:
            best, arg = v, T
    return arg

print(nll([2.0, -2.0], [1, 0], 1.0))`,
        hints: ['Loop over the grid and keep the smallest NLL.'],
        tests: `import math, random
check(abs(nll([2.0, -2.0], [1, 0], 1.0) - math.log(1 + math.exp(-2))) < 1e-12, 'the NLL of two confident correct predictions', '-log sigmoid(2)')
rng = random.Random(0)
z = [rng.gauss(0, 3) for _ in range(6000)]
y = [1 if rng.random() < 1 / (1 + math.exp(-v / 2)) else 0 for v in z]
grid = [0.5 + 0.1 * i for i in range(36)]
T = best_temperature(z, y, grid)
check(1.7 <= T <= 2.3, 'the logits are twice too confident: the best temperature is about 2', 'minimise the held-out NLL')
check(nll(z, y, T) < nll(z, y, 1.0), 'scaling by the best T lowers the loss', 'a better-calibrated model')`,
      }),
      QZ('uncertainty', [
        { q: 'Temperature scaling changes...', o: ['The confidence, not the predicted class', 'The predicted class', 'The training data', 'The number of parameters'], a: 0, why: 'Dividing logits by T keeps their order.' },
        { q: 'A model says 90% on 100 cases and is right on 70. It is...', o: ['Over-confident', 'Under-confident', 'Perfectly calibrated', 'Unbiased'], a: 0, why: 'ECE gap 0.2.' },
        { q: 'Why calibrate on held-out data, not the training set?', o: ['Training data make the model look more confident and accurate than it will be', 'It is faster', 'It is a convention', 'Training data have no labels'], a: 0, why: 'The held-out error is honest.' },
      ], 'Quick check'),
    ],
    recap: ['ECE is the weighted gap between confidence and accuracy.', 'A reliability table shows where it goes wrong.', 'Temperature scaling fixes over-confidence with one number.'],
  });

  M.lessons.push({
    id: 'conformal', title: 'Conformal prediction', minutes: 50, blurb: 'Prediction intervals with a guarantee, for any model.',
    pages: [
      RD('Intervals that keep their promise', `<p>A regression model gives one number. How wrong might it be? <b>Split conformal prediction</b> answers with almost no assumptions:</p>
        ${UL(['Train the model on one part of the data. Keep a separate <b>calibration set</b>.', 'On the calibration set compute the <b>nonconformity score</b> of each example: for regression, the absolute error <code>|y - prediction|</code>.', 'Take the <code>ceil((n + 1)(1 - &alpha;))</code>-th smallest score as <b>q</b>. (The "+1" gives the finite-sample guarantee.)', 'For a new input predict <code>[pred - q, pred + q]</code>. It contains the true value with probability at least <b>1 - &alpha;</b>, whatever the model, if new data are exchangeable with the calibration data.'])}
        <p>The guarantee is about the <b>average</b> over inputs; intervals of fixed width can still be too narrow where the model is noisy. Normalising the score by a local noise estimate gives adaptive widths.</p>`),
      EX({
        id: 'un-4-1', title: 'The conformal quantile', est: 540, xp: 60,
        prompt: `<p>Write <code>conformal_q(scores, alpha)</code>: <code>n = len(scores)</code>, <code>k = ceil((n + 1) * (1 - alpha))</code>. If <code>k &gt; n</code> return <code>float("inf")</code> (not enough calibration data for this confidence); otherwise return the k-th smallest score (<code>sorted(scores)[k - 1]</code>).</p>`,
        starter: `import math

def conformal_q(scores, alpha):
    ...

print(conformal_q(list(range(1, 20)), 0.1), conformal_q([1, 2, 3, 4, 5], 0.1))`,
        solution: `import math

def conformal_q(scores, alpha):
    n = len(scores)
    k = math.ceil((n + 1) * (1 - alpha))
    if k > n:
        return float("inf")
    return sorted(scores)[k - 1]

print(conformal_q(list(range(1, 20)), 0.1), conformal_q([1, 2, 3, 4, 5], 0.1))`,
        hints: ['k counts from 1, so use index k - 1.'],
        tests: `check(conformal_q(list(range(1, 20)), 0.1) == 18, '19 scores at alpha = 0.1: the 18th smallest', 'k = ceil(20 x 0.9) = 18')
check(conformal_q([1, 2, 3, 4, 5], 0.1) == float('inf'), 'with 5 calibration points you cannot promise 90% (k = 6 > 5): the interval is infinite', 'k > n')
check(conformal_q([5, 1, 4, 2, 3, 9, 7, 8, 6, 10], 0.2) == 9, 'order does not matter; 10 scores at 0.2 give the 9th smallest', 'sort first')`,
      }),
      EX({
        id: 'un-4-2', title: 'Intervals and their coverage', est: 540, xp: 60,
        prompt: `<p>Write <code>interval(pred, q)</code> returning <code>(pred - q, pred + q)</code>, and <code>empirical_coverage(ys, preds, q)</code>: the share of cases with <code>|y - pred| &lt;= q</code>.</p>`,
        starter: `def interval(pred, q):
    ...

def empirical_coverage(ys, preds, q):
    ...

print(interval(10.0, 2.5), empirical_coverage([1, 5, 9], [2, 5, 4], 1.5))`,
        solution: `def interval(pred, q):
    return pred - q, pred + q

def empirical_coverage(ys, preds, q):
    return sum(1 for y, p in zip(ys, preds) if abs(y - p) <= q) / len(ys)

print(interval(10.0, 2.5), empirical_coverage([1, 5, 9], [2, 5, 4], 1.5))`,
        hints: ['A case is covered when its error is at most q.'],
        tests: `check(interval(10.0, 2.5) == (7.5, 12.5), 'prediction plus or minus q', 'pred - q, pred + q')
check(abs(empirical_coverage([1, 5, 9], [2, 5, 4], 1.5) - 2/3) < 1e-12, 'two of three true values fall inside', '|y - pred| <= q')
check(empirical_coverage([1, 2], [1, 2], 0) == 1.0 and empirical_coverage([0], [5], 4.9) == 0.0, 'a zero-width interval still covers exact predictions; a miss is a miss', 'inclusive comparison')`,
      }),
      EX({
        id: 'un-4-3', title: 'Split conformal end to end', est: 840, xp: 100,
        prompt: `<p>Write <code>split_conformal(xc, yc, xt, yt, alpha, f)</code>: <code>f</code> is the trained model (a function). Calibration scores are <code>abs(y - f(x))</code> over <code>(xc, yc)</code>; <code>q</code> comes from the given <code>conformal_q</code>. Return <code>(q, coverage)</code> where coverage is the share of test cases <code>(xt, yt)</code> with <code>abs(y - f(x)) &lt;= q</code>.</p>`,
        starter: `import math, random

def conformal_q(scores, alpha):
    n = len(scores); k = math.ceil((n + 1) * (1 - alpha))
    return float("inf") if k > n else sorted(scores)[k - 1]

def split_conformal(xc, yc, xt, yt, alpha, f):
    ...

rng = random.Random(0)
f = lambda x: 2 * x
xc = [rng.uniform(0, 10) for _ in range(500)]; yc = [2 * x + rng.gauss(0, 1) for x in xc]
xt = [rng.uniform(0, 10) for _ in range(5000)]; yt = [2 * x + rng.gauss(0, 1) for x in xt]
print(split_conformal(xc, yc, xt, yt, 0.1, f))`,
        solution: `import math, random

def conformal_q(scores, alpha):
    n = len(scores); k = math.ceil((n + 1) * (1 - alpha))
    return float("inf") if k > n else sorted(scores)[k - 1]

def split_conformal(xc, yc, xt, yt, alpha, f):
    scores = [abs(y - f(x)) for x, y in zip(xc, yc)]
    q = conformal_q(scores, alpha)
    cov = sum(1 for x, y in zip(xt, yt) if abs(y - f(x)) <= q) / len(xt)
    return q, cov

rng = random.Random(0)
f = lambda x: 2 * x
xc = [rng.uniform(0, 10) for _ in range(500)]; yc = [2 * x + rng.gauss(0, 1) for x in xc]
xt = [rng.uniform(0, 10) for _ in range(5000)]; yt = [2 * x + rng.gauss(0, 1) for x in xt]
print(split_conformal(xc, yc, xt, yt, 0.1, f))`,
        hints: ['Calibration scores come from the calibration set only; coverage is measured on fresh test data.'],
        tests: `import random
rng = random.Random(0)
f = lambda x: 2 * x
xc = [rng.uniform(0, 10) for _ in range(500)]; yc = [2 * x + rng.gauss(0, 1) for x in xc]
xt = [rng.uniform(0, 10) for _ in range(5000)]; yt = [2 * x + rng.gauss(0, 1) for x in xt]
q, cov = split_conformal(xc, yc, xt, yt, 0.1, f)
check(1.5 < q < 1.8, 'for noise with sd 1 the 90% half-width is about 1.645', 'the (n+1)(1-alpha)-th smallest error')
check(0.87 < cov < 0.93, 'about 90% of fresh test cases fall inside, as promised', 'the coverage guarantee')
q2, cov2 = split_conformal(xc, yc, xt, yt, 0.2, f)
check(q2 < q and 0.74 < cov2 < 0.84, 'asking for only 80% gives a narrower interval and about 80% coverage', 'larger alpha, smaller q')`,
      }),
      QZ('uncertainty', [
        { q: 'What does split conformal prediction require of the model?', o: ['Nothing: any model works; the data must be exchangeable', 'That it is linear', 'That errors are normal', 'That it is calibrated'], a: 0, why: 'The guarantee is distribution-free.' },
        { q: 'Why use the (n + 1) in the quantile index?', o: ['It gives the exact finite-sample coverage guarantee', 'It makes intervals wider for fun', 'Python is 1-indexed', 'It removes outliers'], a: 0, why: 'The new point counts as one more exchangeable example.' },
        { q: 'A fixed-width conformal interval is too narrow in a very noisy region. A fix?', o: ['Normalise scores by a local noise estimate (adaptive intervals)', 'Use fewer calibration points', 'Lower alpha', 'Remove the model'], a: 0, why: 'Coverage holds on average, not everywhere.' },
      ], 'Quick check'),
      TY({ id: 'un-t1', title: 'Typing sprint: conformal quantile', goal: 30, code: `n = len(scores)
k = math.ceil((n + 1) * (1 - alpha))
if k > n:
    return float("inf")
return sorted(scores)[k - 1]` }),
    ],
    recap: ['Scores on a calibration set, the ceil((n+1)(1-alpha))-th smallest, plus or minus.', 'Coverage is guaranteed on average for exchangeable data.', 'Too little calibration data means an infinite interval.'],
  });

  M.boss = [
    { gen: r => { const k = r.pick([3, 6, 8]), n = 10; return { q: `With a flat Beta(1, 1) prior, ${k} successes in ${n} tries gives a posterior mean of...`, correct: ((1 + k) / (2 + n)).toFixed(3), wrong: distract(((1 + k) / (2 + n)).toFixed(3), [(k / n).toFixed(3), ((k) / (n + 1)).toFixed(3), '0.500']), why: `(1 + ${k}) / (2 + ${n}).` }; } },
    { q: 'You want to halve the width of a confidence interval for a mean. You need about...', o: ['4 times the data', '2 times the data', 'The same data', 'Half the data'], a: 0, why: 'Width goes as 1 / sqrt(n).' },
    { q: 'Which is NOT an advantage of the bootstrap?', o: ['It works with no data', 'It works for medians and F1 scores', 'It needs few assumptions', 'It is easy to code'], a: 0, why: 'It resamples your data, so it needs data.' },
    { q: 'A reliability table shows "predicted 0.8, actual 0.6" in the top bin. The model is...', o: ['Over-confident', 'Under-confident', 'Calibrated', 'Perfect'], a: 0, why: 'It says more than it delivers.' },
    { q: 'Temperature T = 2 on logits [4, -2] makes the positive probability...', o: ['Lower than before (sigmoid(2) not sigmoid(4))', 'Higher', 'Unchanged', 'Negative'], a: 0, why: 'Softer.' },
    { q: 'Split conformal prediction at alpha = 0.1 with only 8 calibration points returns...', o: ['An infinite interval: k = ceil(9 x 0.9) = 9 > 8', 'A 90% interval', 'A 95% interval', 'An error'], a: 0, why: 'You cannot promise 90% with so little data.' },
    { q: 'A conformal 90% interval means...', o: ['On average over new cases, at least 90% of true values fall inside', 'Every single interval is correct 90% of the time', 'The model is 90% accurate', 'The data are 90% clean'], a: 0, why: 'Marginal coverage.' },
    { q: 'Thompson sampling picks the option with the...', o: ['Highest random draw from its posterior', 'Highest mean always', 'Lowest variance', 'Newest data'], a: 0, why: 'Exploration comes from posterior spread.' },
  ];
})();
