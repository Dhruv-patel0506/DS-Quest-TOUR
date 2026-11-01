'use strict';
/* =====================================================================
   Module: Responsible AI: Fairness, Privacy and Governance (4 lessons, 12 exercises)
   Group fairness metrics, mitigation (group thresholds, reweighing) and why fairness definitions conflict, privacy (k-anonymity, Laplace noise, randomised response),
   governance (risk tiers, model-card completeness, red-team attack success rates). View: Explorer diagram #/explore/respai.
   ===================================================================== */
DSQ.defModule({
  id: 'respai', boss: [], lessons: [],
  outcomes: ['Measure selection-rate, true-positive-rate and calibration gaps between groups', 'Apply group thresholds and reweighing, and explain why fairness criteria cannot all hold at once', 'Check k-anonymity and add differential-privacy noise; use randomised response and correct for it', 'Classify a system by risk tier, check a model card for completeness and summarise red-team results'],
});
(function () {
  const M = DSQ.modules.find(m => m.id === 'respai');

  M.lessons.push({
    id: 'fair', title: 'Measuring fairness between groups', minutes: 45, blurb: 'Accurate on average is not the same as fair to everyone.',
    pages: [
      RD('Break the numbers down by group', `<p>A model with 90% accuracy overall can be 95% accurate for one group and 70% for another. Responsible AI starts with <b>disaggregated metrics</b>: the same measurement, per group. Three common ones:</p>
        ${TABLE(['metric', 'asks', 'gap to watch'], [['<b>Selection rate</b>', 'what share of each group gets a "yes"?', 'demographic parity gap; the <b>four-fifths rule</b>: the lowest rate should be at least 80% of the highest'], ['<b>True-positive rate</b>', 'of the people who deserve a "yes", how many get it?', 'equal opportunity gap'], ['<b>Calibration</b>', 'when the model says 70%, is it right 70% of the time, for each group?', 'a group with a lower hit rate at the same score']])}
        <p>Groups come from data you may legally or ethically be unable to collect; when you cannot measure, you cannot see the problem, so decide early how you will evaluate.</p>`),
      VZ('Responsible AI, as a diagram and a hologram', 'explorer', { id: 'respai' }, 'Risk, fairness measurement, mitigation, privacy, red-teaming and monitoring.', '<p class="muted"><a href="#/explore/respai">Open full screen</a></p>'),
      EX({
        id: 'ra-1-1', title: 'Selection rates and the four-fifths rule', est: 540, xp: 60,
        prompt: `<p>Write <code>selection_rates(preds, groups)</code> returning a dict <code>group -&gt; share of that group with prediction 1</code>, then <code>dp_gap(rates)</code> = highest minus lowest rate, and <code>impact_ratio(rates)</code> = lowest / highest (1.0 if the highest is 0). A system passes the four-fifths rule when the ratio is at least 0.8.</p>`,
        starter: `def selection_rates(preds, groups):
    ...

def dp_gap(rates):
    ...

def impact_ratio(rates):
    ...

p = [1, 1, 1, 0, 1, 0, 0, 0]
g = ["a", "a", "a", "a", "b", "b", "b", "b"]
r = selection_rates(p, g)
print(r, dp_gap(r), impact_ratio(r))`,
        solution: `def selection_rates(preds, groups):
    tot, pos = {}, {}
    for p, g in zip(preds, groups):
        tot[g] = tot.get(g, 0) + 1
        pos[g] = pos.get(g, 0) + p
    return {g: pos[g] / tot[g] for g in tot}

def dp_gap(rates):
    return max(rates.values()) - min(rates.values())

def impact_ratio(rates):
    hi = max(rates.values())
    return 1.0 if hi == 0 else min(rates.values()) / hi

p = [1, 1, 1, 0, 1, 0, 0, 0]
g = ["a", "a", "a", "a", "b", "b", "b", "b"]
r = selection_rates(p, g)
print(r, dp_gap(r), impact_ratio(r))`,
        hints: ['Count members and positives per group.'],
        tests: `p = [1, 1, 1, 0, 1, 0, 0, 0]; g = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']
r = selection_rates(p, g)
check(r == {'a': 0.75, 'b': 0.25}, 'group a is selected 75% of the time, group b 25%', 'positives / members per group')
check(abs(dp_gap(r) - 0.5) < 1e-12 and abs(impact_ratio(r) - 1/3) < 1e-12, 'a gap of 0.5; the lower rate is a third of the higher, far below 0.8', 'max - min and min / max')
check(impact_ratio({'a': 0.0, 'b': 0.0}) == 1.0 and impact_ratio({'a': 0.5, 'b': 0.45}) >= 0.8, 'nobody selected is 1.0; 0.45 vs 0.5 passes the four-fifths rule', 'guard max = 0')`,
      }),
      EX({
        id: 'ra-1-2', title: 'Equal opportunity', est: 540, xp: 60,
        prompt: `<p>Write <code>tpr_by_group(y_true, y_pred, groups)</code>: for each group the share of its <b>truly positive</b> members that were predicted positive (skip groups with no positives). Then <code>eo_gap(tprs)</code> = highest minus lowest.</p>`,
        starter: `def tpr_by_group(y_true, y_pred, groups):
    ...

def eo_gap(tprs):
    ...

yt = [1, 1, 1, 1, 0, 1, 1, 1, 1, 0]
yp = [1, 1, 1, 0, 0, 1, 0, 0, 0, 0]
g = ["a"] * 5 + ["b"] * 5
t = tpr_by_group(yt, yp, g)
print(t, eo_gap(t))`,
        solution: `def tpr_by_group(y_true, y_pred, groups):
    pos, hit = {}, {}
    for yt, yp, g in zip(y_true, y_pred, groups):
        if yt == 1:
            pos[g] = pos.get(g, 0) + 1
            hit[g] = hit.get(g, 0) + (1 if yp == 1 else 0)
    return {g: hit[g] / pos[g] for g in pos}

def eo_gap(tprs):
    return max(tprs.values()) - min(tprs.values())

yt = [1, 1, 1, 1, 0, 1, 1, 1, 1, 0]
yp = [1, 1, 1, 0, 0, 1, 0, 0, 0, 0]
g = ["a"] * 5 + ["b"] * 5
t = tpr_by_group(yt, yp, g)
print(t, eo_gap(t))`,
        hints: ['Only look at rows where the truth is 1.'],
        tests: `yt = [1, 1, 1, 1, 0, 1, 1, 1, 1, 0]; yp = [1, 1, 1, 0, 0, 1, 0, 0, 0, 0]; g = ['a'] * 5 + ['b'] * 5
t = tpr_by_group(yt, yp, g)
check(t == {'a': 0.75, 'b': 0.25}, 'group a: 3 of 4 qualified people found; group b: 1 of 4', 'hits / positives per group')
check(abs(eo_gap(t) - 0.5) < 1e-12, 'a 50-point equal-opportunity gap', 'max - min')
check(tpr_by_group([0, 0], [1, 0], ['a', 'a']) == {}, 'a group with no qualified members has no TPR', 'skip groups without positives')`,
      }),
      EX({
        id: 'ra-1-3', title: 'Calibration by group', est: 600, xp: 70,
        prompt: `<p>Write <code>calibration_by_group(scores, y_true, groups, lo, hi)</code>: for each group take only the rows with <code>lo &lt;= score &lt; hi</code> and return the share of those rows with <code>y_true == 1</code>. A group with no rows in the band gets <code>None</code>.</p>`,
        starter: `def calibration_by_group(scores, y_true, groups, lo, hi):
    ...

s = [0.72, 0.75, 0.71, 0.74, 0.73, 0.70, 0.76, 0.72]
y = [1, 1, 1, 0, 1, 0, 0, 0]
g = ["a"] * 4 + ["b"] * 4
print(calibration_by_group(s, y, g, 0.7, 0.8))`,
        solution: `def calibration_by_group(scores, y_true, groups, lo, hi):
    n, pos = {}, {}
    for s, y, g in zip(scores, y_true, groups):
        n.setdefault(g, 0); pos.setdefault(g, 0)
        if lo <= s < hi:
            n[g] += 1
            pos[g] += y
    return {g: (pos[g] / n[g] if n[g] else None) for g in n}

s = [0.72, 0.75, 0.71, 0.74, 0.73, 0.70, 0.76, 0.72]
y = [1, 1, 1, 0, 1, 0, 0, 0]
g = ["a"] * 4 + ["b"] * 4
print(calibration_by_group(s, y, g, 0.7, 0.8))`,
        hints: ['Register every group first so empty bands give None.'],
        tests: `s = [0.72, 0.75, 0.71, 0.74, 0.73, 0.70, 0.76, 0.72]; y = [1, 1, 1, 0, 1, 0, 0, 0]; g = ['a'] * 4 + ['b'] * 4
out = calibration_by_group(s, y, g, 0.7, 0.8)
check(out == {'a': 0.75, 'b': 0.25}, 'at the same score of about 0.73, group a is right 75% of the time and group b only 25%', 'the hit rate inside the band')
check(calibration_by_group(s, y, g, 0.9, 1.0) == {'a': None, 'b': None}, 'nobody has a score that high: None for every group', 'empty bands give None')
check(calibration_by_group([0.5, 0.5], [1, 0], ['a', 'b'], 0.5, 0.6) == {'a': 1.0, 'b': 0.0}, 'the lower edge is included', 'lo <= score < hi')`,
      }),
      QZ('respai', [
        { q: 'Overall accuracy is 92%. Why is that not enough?', o: ['It can hide a much worse result for one group', 'It is too low', 'It is a training metric', 'Accuracy cannot be computed by group'], a: 0, why: 'Always disaggregate.' },
        { q: 'Equal opportunity compares...', o: ['True-positive rates between groups', 'Accuracy between groups', 'Group sizes', 'Prediction counts'], a: 0, why: 'Of the people who qualify, who gets found?' },
        { q: 'Selection rates of 0.30 and 0.50. Four-fifths rule check?', o: ['0.6, fails (below 0.8)', '0.8, passes', '0.2, passes', '1.67, fails'], a: 0, why: '0.30 / 0.50 = 0.6.' },
      ], 'Quick check'),
    ],
    recap: ['Disaggregate every metric by group.', 'Selection rate, TPR and calibration are different questions.', 'The four-fifths rule is a screening check, not a verdict.'],
  });

  M.lessons.push({
    id: 'mitigate', title: 'Mitigation and the limits of fairness', minutes: 45, blurb: 'Fixing a gap has a cost, and some fairness goals conflict.',
    pages: [
      RD('Three places to intervene', `<p>You can reduce a gap before, during or after training:</p>
        ${UL(['<b>Data</b>: collect more from under-represented groups; <b>reweigh</b> examples so that group and label are statistically independent (weight = P(group) &times; P(label) / P(group, label)).', '<b>Model</b>: add a fairness constraint or penalty to the training objective.', '<b>Decision rule</b>: use a different score threshold per group so that selection rates (or true-positive rates) match. Simple and transparent, but legally sensitive in some places because it treats groups differently.'])}
        <p>And there is a hard limit: when two groups have different base rates, a classifier that has the same true-positive and false-positive rates for both groups <b>cannot</b> also have the same precision. You must choose which fairness you need, with the people affected, and record the trade-off. The last exercise shows the arithmetic.</p>`),
      EX({
        id: 'ra-2-1', title: 'A threshold per group', est: 600, xp: 70,
        prompt: `<p>Write <code>threshold_for_rate(scores, rate)</code>: sort the scores from high to low, let <code>k = round(rate * len(scores))</code> and return the k-th highest score (so that <code>score &gt;= threshold</code> selects k people); return <code>float("inf")</code> if <code>k == 0</code>. Then <code>apply_thresholds(scores, groups, th)</code> where <code>th</code> is a dict <code>group -&gt; threshold</code> returns a list of 0/1 decisions.</p>`,
        starter: `def threshold_for_rate(scores, rate):
    ...

def apply_thresholds(scores, groups, th):
    ...

a = [0.9, 0.8, 0.6, 0.4, 0.2]
print(threshold_for_rate(a, 0.4), apply_thresholds([0.7, 0.7], ["a", "b"], {"a": 0.75, "b": 0.6}))`,
        solution: `def threshold_for_rate(scores, rate):
    k = round(rate * len(scores))
    if k == 0:
        return float("inf")
    return sorted(scores, reverse=True)[k - 1]

def apply_thresholds(scores, groups, th):
    return [1 if s >= th[g] else 0 for s, g in zip(scores, groups)]

a = [0.9, 0.8, 0.6, 0.4, 0.2]
print(threshold_for_rate(a, 0.4), apply_thresholds([0.7, 0.7], ["a", "b"], {"a": 0.75, "b": 0.6}))`,
        hints: ['sorted(scores, reverse=True)[k - 1] is the k-th highest.'],
        tests: `a = [0.9, 0.8, 0.6, 0.4, 0.2]
check(threshold_for_rate(a, 0.4) == 0.8, 'to select the top 40% (2 of 5) the threshold is the second-highest score', 'k = round(rate * n)')
check(threshold_for_rate(a, 0.0) == float('inf') and threshold_for_rate(a, 1.0) == 0.2, 'rate 0 selects nobody; rate 1 selects everybody', 'edge cases')
check(apply_thresholds([0.7, 0.7], ['a', 'b'], {'a': 0.75, 'b': 0.6}) == [0, 1], 'the same score is a no for group a and a yes for group b', 'compare with the group\\'s own threshold')`,
      }),
      EX({
        id: 'ra-2-2', title: 'Reweighing', est: 600, xp: 70,
        prompt: `<p>Write <code>reweigh(groups, labels)</code> returning a dict <code>(group, label) -&gt; weight</code> with <code>weight = P(group) * P(label) / P(group, label)</code>, where the probabilities are shares of the whole data set. Only combinations that occur appear in the dict.</p>`,
        starter: `def reweigh(groups, labels):
    ...

g = ["a", "a", "a", "a", "b", "b", "b", "b"]
y = [1, 1, 1, 0, 1, 0, 0, 0]
print(reweigh(g, y))`,
        solution: `def reweigh(groups, labels):
    n = len(groups)
    pg, pl, pj = {}, {}, {}
    for g, y in zip(groups, labels):
        pg[g] = pg.get(g, 0) + 1
        pl[y] = pl.get(y, 0) + 1
        pj[(g, y)] = pj.get((g, y), 0) + 1
    return {(g, y): (pg[g] / n) * (pl[y] / n) / (c / n) for (g, y), c in pj.items()}

g = ["a", "a", "a", "a", "b", "b", "b", "b"]
y = [1, 1, 1, 0, 1, 0, 0, 0]
print(reweigh(g, y))`,
        hints: ['Count groups, labels and (group, label) pairs, then divide by n.'],
        tests: `g = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']; y = [1, 1, 1, 0, 1, 0, 0, 0]
w = reweigh(g, y)
check(abs(w[('a', 1)] - (0.5 * 0.5 / 0.375)) < 1e-9, 'group a with a positive label is common: weight 2/3', 'P(g) P(y) / P(g, y)')
check(abs(w[('b', 1)] - 2.0) < 1e-9, 'group b with a positive label is rare: weight 2', 'rare combinations count more')
check(abs(sum(w[k] * sum(1 for gg, yy in zip(g, y) if (gg, yy) == k) for k in w) - 8) < 1e-9, 'the weights keep the total data size', 'weights sum to n')`,
      }),
      EX({
        id: 'ra-2-3', title: 'Why you cannot have everything', est: 540, xp: 60,
        prompt: `<p>Write <code>precision_from(base_rate, tpr, fpr)</code> = <code>tpr * b / (tpr * b + fpr * (1 - b))</code>. Then <code>precision_gap(b1, b2, tpr, fpr)</code> = the absolute difference between the precision of the two groups when both have the <b>same</b> TPR and FPR but base rates <code>b1</code> and <code>b2</code>.</p>`,
        starter: `def precision_from(base_rate, tpr, fpr):
    ...

def precision_gap(b1, b2, tpr, fpr):
    ...

print(precision_from(0.5, 0.8, 0.2), precision_from(0.2, 0.8, 0.2), precision_gap(0.5, 0.2, 0.8, 0.2))`,
        solution: `def precision_from(base_rate, tpr, fpr):
    b = base_rate
    return tpr * b / (tpr * b + fpr * (1 - b))

def precision_gap(b1, b2, tpr, fpr):
    return abs(precision_from(b1, tpr, fpr) - precision_from(b2, tpr, fpr))

print(precision_from(0.5, 0.8, 0.2), precision_from(0.2, 0.8, 0.2), precision_gap(0.5, 0.2, 0.8, 0.2))`,
        hints: ['Precision = true positives / all predicted positives.'],
        tests: `check(abs(precision_from(0.5, 0.8, 0.2) - 0.8) < 1e-12 and abs(precision_from(0.2, 0.8, 0.2) - 0.5) < 1e-12, 'same error rates, different base rates: 80% precision versus 50%', 'tp / (tp + fp)')
check(abs(precision_gap(0.5, 0.2, 0.8, 0.2) - 0.3) < 1e-12, 'a 30-point precision gap although TPR and FPR are identical', 'difference of the two precisions')
check(precision_gap(0.3, 0.3, 0.9, 0.1) == 0.0, 'equal base rates give no conflict', 'the gap needs different base rates')`,
      }),
      QZ('respai', [
        { q: 'Two groups have different base rates. A classifier with equal TPR and FPR for both will have...', o: ['Different precision', 'Equal precision', 'Perfect accuracy', 'No errors'], a: 0, why: 'The fairness criteria cannot all hold.' },
        { q: 'Reweighing makes group and label...', o: ['Statistically independent in the weighted data', 'Identical', 'Unrelated to the features', 'Deterministic'], a: 0, why: 'Weight = P(g) P(y) / P(g, y).' },
        { q: 'Why record the fairness trade-off you chose?', o: ['So reviewers can see what was prioritised and why', 'To make it harder to change', 'Because regulators dislike numbers', 'It is not needed'], a: 0, why: 'Transparency and accountability.' },
      ], 'Quick check'),
    ],
    recap: ['Intervene on data, model or decision rule.', 'Group thresholds match rates but treat groups differently.', 'Fairness definitions conflict when base rates differ.'],
  });

  M.lessons.push({
    id: 'privacy', title: 'Privacy: k-anonymity, noise and randomised response', minutes: 50, blurb: 'Share what is useful without exposing any one person.',
    pages: [
      RD('Removing names is not enough', `<p>Postcode, birth date and gender together identify most people, even with the name removed. These are <b>quasi-identifiers</b>.</p>
        ${UL(['<b>k-anonymity</b>: every combination of quasi-identifiers appears in at least k rows, so you are hidden among at least k-1 others. Generalise (age 34 &rarr; 30-39) or suppress rows until it holds.', '<b>Differential privacy</b>: release an answer plus random noise sized so that adding or removing any single person barely changes the output distribution. For a count (sensitivity 1) add <b>Laplace noise with scale 1/&epsilon;</b>; smaller &epsilon; means more privacy and more noise.', '<b>Randomised response</b>: each person answers truthfully with probability p and lies otherwise; no single answer is trustworthy, yet the population rate can be recovered: <code>(observed - (1 - p)) / (2p - 1)</code>.'])}`),
      EX({
        id: 'ra-3-1', title: 'How anonymous is this table?', est: 540, xp: 60,
        prompt: `<p><code>rows</code> is a list of dicts. Write <code>k_anonymity(rows, quasi)</code>: the size of the <b>smallest</b> group of rows sharing the same values of the columns in <code>quasi</code> (a list of column names). Then <code>violations(rows, quasi, k)</code>: the sorted list of value-tuples whose group has fewer than <code>k</code> rows.</p>`,
        starter: `def k_anonymity(rows, quasi):
    ...

def violations(rows, quasi, k):
    ...

rows = [{"zip": "380", "age": "30-39"}] * 3 + [{"zip": "390", "age": "40-49"}] * 2 + [{"zip": "390", "age": "30-39"}]
print(k_anonymity(rows, ["zip", "age"]), violations(rows, ["zip", "age"], 2))`,
        solution: `def k_anonymity(rows, quasi):
    counts = {}
    for r in rows:
        key = tuple(r[c] for c in quasi)
        counts[key] = counts.get(key, 0) + 1
    return min(counts.values())

def violations(rows, quasi, k):
    counts = {}
    for r in rows:
        key = tuple(r[c] for c in quasi)
        counts[key] = counts.get(key, 0) + 1
    return sorted(key for key, n in counts.items() if n < k)

rows = [{"zip": "380", "age": "30-39"}] * 3 + [{"zip": "390", "age": "40-49"}] * 2 + [{"zip": "390", "age": "30-39"}]
print(k_anonymity(rows, ["zip", "age"]), violations(rows, ["zip", "age"], 2))`,
        hints: ['Use a tuple of the quasi-identifier values as the dictionary key.'],
        tests: `rows = [{'zip': '380', 'age': '30-39'}] * 3 + [{'zip': '390', 'age': '40-49'}] * 2 + [{'zip': '390', 'age': '30-39'}]
check(k_anonymity(rows, ['zip', 'age']) == 1, 'one person is unique on (zip, age): the table is only 1-anonymous', 'the smallest group')
check(violations(rows, ['zip', 'age'], 2) == [('390', '30-39')], 'that one combination breaks 2-anonymity', 'groups smaller than k')
check(k_anonymity(rows, ['zip']) == 3 and violations(rows, ['zip'], 3) == [], 'using only the zip column, everyone hides in a group of 3 or more', 'fewer quasi-identifiers, bigger groups')`,
      }),
      EX({
        id: 'ra-3-2', title: 'A differentially private count', est: 660, xp: 80,
        prompt: `<p>Write <code>laplace_noise(scale, rng)</code>: with <code>u = rng.random() - 0.5</code>, return <code>-scale * sign(u) * ln(1 - 2*|u|)</code> (guard the logarithm with <code>max(1 - 2*abs(u), 1e-12)</code>; treat <code>u == 0</code> as sign 1). Then <code>dp_count(true_count, epsilon, seed)</code>: with <code>rng = random.Random(seed)</code> return <code>true_count + laplace_noise(1 / epsilon, rng)</code>.</p>`,
        starter: `import math, random

def laplace_noise(scale, rng):
    ...

def dp_count(true_count, epsilon, seed):
    ...

print(dp_count(100, 1.0, 0))`,
        solution: `import math, random

def laplace_noise(scale, rng):
    u = rng.random() - 0.5
    sign = 1 if u >= 0 else -1
    return -scale * sign * math.log(max(1 - 2 * abs(u), 1e-12))

def dp_count(true_count, epsilon, seed):
    rng = random.Random(seed)
    return true_count + laplace_noise(1 / epsilon, rng)

print(dp_count(100, 1.0, 0))`,
        hints: ['This is the inverse-CDF way to draw a Laplace sample.'],
        tests: `import random, statistics
rng = random.Random(1)
xs = [laplace_noise(2.0, rng) for _ in range(20000)]
check(abs(statistics.mean(xs)) < 0.1 and abs(statistics.pstdev(xs) - 2.0 * 2 ** 0.5) < 0.15, 'noise is centred on 0 with standard deviation scale x sqrt(2)', 'a Laplace distribution')
err_small = statistics.mean(abs(dp_count(100, 0.1, s) - 100) for s in range(500))
err_big = statistics.mean(abs(dp_count(100, 2.0, s) - 100) for s in range(500))
check(err_small > 5 * err_big and abs(err_small - 10) < 2, 'epsilon = 0.1 means about 10 counts of noise; epsilon = 2 about 0.5', 'scale = 1 / epsilon')
check(dp_count(100, 1.0, 3) == dp_count(100, 1.0, 3), 'the same seed gives the same answer (reproducible)', 'build the generator inside')`,
      }),
      EX({
        id: 'ra-3-3', title: 'Randomised response', est: 660, xp: 80,
        prompt: `<p>Write <code>randomized_response(bits, p, seed)</code>: with <code>rng = random.Random(seed)</code>, keep each bit with probability <code>p</code> (<code>rng.random() &lt; p</code>) and flip it otherwise; return the list of reported bits. Then <code>estimate_rate(reports, p)</code> = <code>(mean(reports) - (1 - p)) / (2p - 1)</code>.</p>`,
        starter: `import random

def randomized_response(bits, p, seed):
    ...

def estimate_rate(reports, p):
    ...

rng = random.Random(0)
truth = [1 if rng.random() < 0.3 else 0 for _ in range(20000)]
rep = randomized_response(truth, 0.75, 1)
print(sum(rep) / len(rep), estimate_rate(rep, 0.75))`,
        solution: `import random

def randomized_response(bits, p, seed):
    rng = random.Random(seed)
    return [b if rng.random() < p else 1 - b for b in bits]

def estimate_rate(reports, p):
    return (sum(reports) / len(reports) - (1 - p)) / (2 * p - 1)

rng = random.Random(0)
truth = [1 if rng.random() < 0.3 else 0 for _ in range(20000)]
rep = randomized_response(truth, 0.75, 1)
print(sum(rep) / len(rep), estimate_rate(rep, 0.75))`,
        hints: ['A flipped bit is 1 - b.'],
        tests: `import random
rng = random.Random(0)
truth = [1 if rng.random() < 0.3 else 0 for _ in range(20000)]
rep = randomized_response(truth, 0.75, 1)
check(len(rep) == len(truth) and set(rep) <= {0, 1}, 'one reported bit per person', 'keep or flip')
check(abs(sum(rep) / len(rep) - (0.3 * 0.75 + 0.7 * 0.25)) < 0.02, 'the raw reports are distorted: about 40% say yes, not 30%', 'observed = true p + (1 - true)(1 - p)')
check(abs(estimate_rate(rep, 0.75) - sum(truth) / len(truth)) < 0.03, 'but the corrected estimate recovers the true rate (about 30%)', '(observed - (1 - p)) / (2p - 1)')`,
      }),
      QZ('respai', [
        { q: 'A table has been stripped of names but still has zip, birth date and gender. Why is it risky?', o: ['Those quasi-identifiers can single people out', 'It is too small', 'Names are optional', 'Dates are encrypted'], a: 0, why: 'Linkage with other data sets re-identifies people.' },
        { q: 'Differential privacy with a smaller epsilon means...', o: ['More noise and stronger privacy', 'Less noise', 'No privacy', 'More accuracy'], a: 0, why: 'Scale = sensitivity / epsilon.' },
        { q: 'In randomised response, why can the analyst still learn the rate?', o: ['The known amount of lying can be subtracted out on average', 'People tell the truth', 'The data are encrypted', 'The sample is small'], a: 0, why: 'Unbiased estimator.' },
      ], 'Quick check'),
    ],
    recap: ['k-anonymity: every quasi-identifier combination appears at least k times.', 'DP counts add Laplace noise of scale 1 / epsilon.', 'Randomised response hides individuals but not the rate.'],
  });

  M.lessons.push({
    id: 'govern', title: 'Governance, risk tiers and red-teaming', minutes: 45, blurb: 'The process around the model: classify, document, attack, monitor.',
    pages: [
      RD('From principles to checks', `<p>Rules such as the EU AI Act sort AI systems by risk and attach duties to each tier:</p>
        ${TABLE(['tier', 'examples', 'duties'], [['<b>Unacceptable</b>', 'government social scoring, real-time biometric identification in public spaces (with narrow exceptions)', 'prohibited'], ['<b>High</b>', 'hiring, credit, education, health, law enforcement, critical infrastructure', 'risk management, quality data, logging, human oversight, documentation'], ['<b>Limited</b>', 'chatbots, generated content', 'tell users it is AI; label generated media'], ['<b>Minimal</b>', 'spam filters, game AI', 'voluntary codes']])}
        <p>Whatever the law says, good teams keep a <b>model card</b> (intended use, training data, metrics by group, known limits, owner) and <b>red-team</b> the system: try to make it fail with jailbreaks, injection and bias probes, and report the <b>attack success rate</b> per category. (This is a teaching simplification; real classification needs legal advice.)</p>`),
      EX({
        id: 'ra-4-1', title: 'Classify the risk tier', est: 540, xp: 60,
        prompt: `<p>Write <code>risk_tier(system)</code> where <code>system</code> is a dict with optional keys: <code>social_scoring</code> and <code>realtime_public_biometrics</code> (booleans), <code>domain</code> (a string), <code>interacts_with_people</code> and <code>generates_content</code> (booleans). Return <code>"unacceptable"</code> if either of the first two is true; else <code>"high"</code> if <code>domain</code> is one of <code>HIGH_DOMAINS</code>; else <code>"limited"</code> if it interacts with people or generates content; else <code>"minimal"</code>.</p>`,
        starter: `HIGH_DOMAINS = {"hiring", "credit", "education", "health", "law_enforcement", "critical_infrastructure"}

def risk_tier(system):
    ...

print(risk_tier({"domain": "hiring"}), risk_tier({"interacts_with_people": True}))`,
        solution: `HIGH_DOMAINS = {"hiring", "credit", "education", "health", "law_enforcement", "critical_infrastructure"}

def risk_tier(system):
    if system.get("social_scoring") or system.get("realtime_public_biometrics"):
        return "unacceptable"
    if system.get("domain") in HIGH_DOMAINS:
        return "high"
    if system.get("interacts_with_people") or system.get("generates_content"):
        return "limited"
    return "minimal"

print(risk_tier({"domain": "hiring"}), risk_tier({"interacts_with_people": True}))`,
        hints: ['Check from the most serious tier down.'],
        tests: `check(risk_tier({'social_scoring': True, 'domain': 'hiring'}) == 'unacceptable', 'a prohibited practice wins over everything else', 'check the top tier first')
check(risk_tier({'domain': 'credit', 'interacts_with_people': True}) == 'high' and risk_tier({'domain': 'health'}) == 'high', 'a high-risk domain is high even if it also chats with people', 'domain before interaction')
check(risk_tier({'generates_content': True}) == 'limited' and risk_tier({'domain': 'games'}) == 'minimal' and risk_tier({}) == 'minimal', 'chatbots are limited; a game AI is minimal', 'the defaults')`,
      }),
      EX({
        id: 'ra-4-2', title: 'Is the model card complete?', est: 420, xp: 40,
        prompt: `<p>Write <code>card_missing(card)</code>: the sorted list of names in <code>REQUIRED</code> that are absent from the dict <code>card</code> or whose value is empty (empty string, empty list/dict, or <code>None</code>). Then <code>completeness(card)</code>: the share of required fields present, between 0 and 1.</p>`,
        starter: `REQUIRED = ["intended_use", "out_of_scope", "training_data", "metrics_by_group", "limitations", "owner"]

def card_missing(card):
    ...

def completeness(card):
    ...

print(card_missing({"intended_use": "triage", "owner": "ml-team", "limitations": ""}))`,
        solution: `REQUIRED = ["intended_use", "out_of_scope", "training_data", "metrics_by_group", "limitations", "owner"]

def card_missing(card):
    return sorted(f for f in REQUIRED if not card.get(f))

def completeness(card):
    return 1 - len(card_missing(card)) / len(REQUIRED)

print(card_missing({"intended_use": "triage", "owner": "ml-team", "limitations": ""}))`,
        hints: ['not card.get(field) is True for missing, None and empty values.'],
        tests: `c = {'intended_use': 'triage', 'owner': 'ml-team', 'limitations': ''}
check(card_missing(c) == ['limitations', 'metrics_by_group', 'out_of_scope', 'training_data'], 'an empty limitations field counts as missing', 'missing or empty')
check(abs(completeness(c) - 2/6) < 1e-12, 'two of six required fields are filled in', '1 - missing / required')
full = {f: 'x' for f in REQUIRED}
check(card_missing(full) == [] and completeness(full) == 1.0, 'a full card is 100% complete', 'nothing missing')`,
      }),
      EX({
        id: 'ra-4-3', title: 'Red-team results', est: 540, xp: 60,
        prompt: `<p><code>results</code> is a list of <code>(category, success)</code> pairs: one entry per attack attempt, <code>success</code> True if the attack worked. Write <code>asr_report(results)</code> returning <code>(overall_rate, by_category)</code> where <code>by_category</code> maps each category to its attack success rate, and <code>worst(results)</code>: the category with the highest rate (the alphabetically first on ties).</p>`,
        starter: `def asr_report(results):
    ...

def worst(results):
    ...

res = [("jailbreak", True), ("jailbreak", False), ("injection", True), ("injection", True), ("bias", False), ("bias", False)]
print(asr_report(res), worst(res))`,
        solution: `def asr_report(results):
    tot, ok = {}, {}
    for cat, success in results:
        tot[cat] = tot.get(cat, 0) + 1
        ok[cat] = ok.get(cat, 0) + (1 if success else 0)
    overall = sum(ok.values()) / len(results)
    return overall, {c: ok[c] / tot[c] for c in tot}

def worst(results):
    _, by = asr_report(results)
    return sorted(by, key=lambda c: (-by[c], c))[0]

res = [("jailbreak", True), ("jailbreak", False), ("injection", True), ("injection", True), ("bias", False), ("bias", False)]
print(asr_report(res), worst(res))`,
        hints: ['Sort by (-rate, name) to break ties alphabetically.'],
        tests: `res = [('jailbreak', True), ('jailbreak', False), ('injection', True), ('injection', True), ('bias', False), ('bias', False)]
overall, by = asr_report(res)
check(abs(overall - 0.5) < 1e-12 and by == {'jailbreak': 0.5, 'injection': 1.0, 'bias': 0.0}, 'half of all attacks worked; injection always did', 'successes / attempts, overall and per category')
check(worst(res) == 'injection', 'injection is the weakest area', 'the highest success rate')
check(worst([('b', True), ('a', True)]) == 'a', 'ties go to the alphabetically first category', 'sort key (-rate, name)')`,
      }),
      QZ('respai', [
        { q: 'A CV-screening tool is used to rank job applicants. Which risk tier is it, in the EU AI Act style used here?', o: ['High', 'Minimal', 'Limited', 'Prohibited'], a: 0, why: 'Hiring is a high-risk domain.' },
        { q: 'Why report attack success rate by category, not just overall?', o: ['An average can hide one category that fails almost always', 'It is shorter', 'It is required by Python', 'Categories are unimportant'], a: 0, why: 'You fix the worst category first.' },
        { q: 'Which belongs in a model card?', o: ['Intended use, out-of-scope uses, metrics by group, limits, owner', 'The source code', 'API keys', 'Only the accuracy'], a: 0, why: 'Documentation for the people who rely on it.' },
      ], 'Quick check'),
      TY({ id: 'ra-t1', title: 'Typing sprint: selection rates', goal: 30, code: `tot, pos = {}, {}
for p, g in zip(preds, groups):
    tot[g] = tot.get(g, 0) + 1
    pos[g] = pos.get(g, 0) + p
return {g: pos[g] / tot[g] for g in tot}` }),
    ],
    recap: ['Classify the risk tier first; it sets the duties.', 'A model card records use, data, group metrics and limits.', 'Red-team results by category show where to fix first.'],
  });

  M.boss = [
    { q: 'Which statement about fairness metrics is true?', o: ['With different base rates, equal error rates and equal precision cannot both hold', 'Any model can satisfy all of them', 'They are all identical', 'They only apply to images'], a: 0, why: 'The impossibility results.' },
    { gen: r => { const lo = r.pick([0.2, 0.3, 0.4]), hi = r.pick([0.5, 0.6]); return { q: `Selection rates are ${lo} and ${hi}. What is the impact ratio (lowest / highest)?`, correct: (lo / hi).toFixed(2), wrong: distract((lo / hi).toFixed(2), [(hi - lo).toFixed(2), (hi / lo).toFixed(2), '1.00']), why: `${lo} / ${hi}.` }; } },
    { q: 'A 3-anonymous table means...', o: ['Every quasi-identifier combination appears at least 3 times', 'Three columns were removed', 'Three people can see the data', 'The data are encrypted three times'], a: 0, why: 'Each person hides among at least 3.' },
    { q: 'A count of 4,210 is released with epsilon = 0.5. The Laplace noise scale is...', o: ['2', '0.5', '4,210', '1'], a: 0, why: '1 / 0.5.' },
    { q: 'In randomised response with p = 0.75, 40% of reports say "yes". The estimated true rate is...', o: ['30%', '40%', '25%', '75%'], a: 0, why: '(0.40 - 0.25) / 0.5.' },
    { q: 'A chatbot that answers customer questions but makes no consequential decisions is usually...', o: ['Limited risk: tell users it is AI', 'Prohibited', 'High risk', 'Exempt from everything'], a: 0, why: 'Transparency duties.' },
    { q: 'You mitigate a gap by using lower thresholds for one group. A fair summary of the risk is...', o: ['It treats groups differently and may be restricted; document the trade-off', 'It has no downside', 'It is always illegal', 'It cannot change selection rates'], a: 0, why: 'Transparent, but legally sensitive in some contexts.' },
    { q: 'Red-team results: jailbreaks 5%, injection 40%, bias probes 10%. What should be fixed first?', o: ['Injection', 'Jailbreaks', 'Bias probes', 'Nothing'], a: 0, why: 'The highest success rate.' },
  ];
})();
