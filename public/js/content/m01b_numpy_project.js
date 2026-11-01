'use strict';
/* =====================================================================
   NumPy projects: 3 variants. Every learner gets one (hash of username + module);
   the owner account gets the flagship variant with extra milestones and bigger data.
   ===================================================================== */
(function () {
  const M = DSQ.modules.find(m => m.id === 'numpy');
  const HR = `_clean = signal - np.convolve(signal, np.ones(25) / 25, mode='same')
_thr = _clean.mean() + 2 * _clean.std()
_idx = np.where((_clean[1:-1] > _thr) & (_clean[1:-1] > _clean[:-2]) & (_clean[1:-1] >= _clean[2:]))[0] + 1
_rr = np.diff(t[_idx])
`;
  const PLOT_CHECK = (title) => `fig = plt.gcf()
check(len(fig.axes) >= 1, 'a figure with an axes exists', 'create it with plt.subplots()')
ax0 = fig.axes[0]
check(${title}, 'the chart has the right title', 'use ax.set_title(...)')
check(ax0.get_xlabel() != '' and ax0.get_ylabel() != '', 'both axes have labels', 'ax.set_xlabel(...) and ax.set_ylabel(...)')`;

  M.project = {
    variants: [
      /* ============================================================ heart */
      {
        id: 'heart', flagship: true, hours: 4, title: 'Heartbeat Lab: turn a raw wearable signal into BPM and HRV',
        pitch: 'Your smartwatch records a noisy voltage signal 50 times a second. Using only NumPy you will remove the slow drift, detect every heartbeat, compute beats per minute and heart-rate variability, and publish a clean report.',
        real: 'The pipeline inside fitness trackers and ECG/PPG wearables (Fitbit, Apple Watch, Garmin): filter, peak-detect, derive BPM and HRV.',
        flagship_note: 'two minutes of signal (instead of one) that contains a <b>motion-artefact burst</b>, plus two extra analysis milestones (artefact detection and rhythm irregularity) and a case-study report.',
        dataset: { file: 'heart.csv', desc: 'Synthetic wearable signal: one row per sample at 50 Hz (a clean heartbeat shape plus slow baseline drift and sensor noise). Generated from your seed, so your resting heart rate differs from other learners.', columns: [['t', 'time in seconds since the recording started'], ['signal', 'sensor reading (arbitrary units)']],
          gen: DS.sensor },
        refs: ['PhysioNet (physionet.org) hosts real ECG recordings such as the MIT-BIH Arrhythmia Database - try your pipeline on them afterwards.', '`scipy.signal.find_peaks` is the production version of the peak detector you build here.'],
        milestones: [
          { id: 'load', title: 'Load the recording', xp: 20, est: 150,
            prompt: `<p>The file has a header row, then <code>t,signal</code> pairs. Load it with <code>np.genfromtxt</code> and split the two columns.</p><p><code>fs</code> is the <b>sampling rate</b>: how many samples are recorded per second. Work it out from the gap between the first two time stamps.</p>`,
            starter: `import numpy as np

data = np.genfromtxt('data/heart.csv', delimiter=',', skip_header=1)
t = data[:, ___]
signal = data[:, ___]
fs = int(round(1 / (t[___] - t[0])))
duration = t[-1]
print(data.shape, fs, duration)`,
            solution: `import numpy as np

data = np.genfromtxt('data/heart.csv', delimiter=',', skip_header=1)
t = data[:, 0]
signal = data[:, 1]
fs = int(round(1 / (t[1] - t[0])))
duration = t[-1]
print(data.shape, fs, duration)`,
            bank: ['0', '1', '2', ':', '-1'], hints: ['Column 0 is time, column 1 is the signal.', 'The gap between neighbouring time stamps is t[1] - t[0]; its inverse is the rate.'],
            tests: `raw = np.genfromtxt('data/heart.csv', delimiter=',', skip_header=1)
check(np.allclose(t, raw[:, 0]), 't is the time column', 'column 0')
check(np.allclose(signal, raw[:, 1]), 'signal is the sensor column', 'column 1')
check(fs == 50, 'fs = 50 samples per second', 'use t[1] - t[0]')
check(abs(duration - raw[-1, 0]) < 1e-9, 'duration is the last time stamp', 't[-1]')` },
          { id: 'baseline', title: 'Remove the slow drift', xp: 25, est: 240,
            prompt: `<p>The raw signal wobbles slowly up and down (breathing, sensor drift). Estimate that baseline with a <b>moving average</b> over <code>w = 25</code> samples (half a second) and subtract it.</p>${UL(['<code>kernel</code>: 25 equal weights that add to 1', '<code>baseline</code>: <code>np.convolve(signal, kernel, mode="same")</code>', '<code>clean</code>: signal minus baseline'])}`,
            starter: `w = 25
kernel = np.___(w) / ___
baseline = np.convolve(signal, kernel, mode='___')
clean = signal ___ baseline
print(clean[:5].round(3))`,
            solution: `w = 25
kernel = np.ones(w) / w
baseline = np.convolve(signal, kernel, mode='same')
clean = signal - baseline
print(clean[:5].round(3))`,
            bank: ['ones', 'zeros', 'w', '2', 'same', 'valid', 'full', '-', '+'], hints: ['Equal weights that sum to 1: np.ones(w) / w.', "mode='same' keeps the output the same length as the input."],
            tests: `_k = np.ones(25) / 25
check(np.allclose(kernel, _k), 'kernel = 25 equal weights of 1/25', 'np.ones(w) / w')
check(baseline.shape == signal.shape and np.allclose(baseline, np.convolve(signal, _k, mode='same')), 'baseline has the same length as the signal', "mode='same'")
check(np.allclose(clean, signal - np.convolve(signal, _k, mode='same')), 'clean = signal - baseline', 'subtract the baseline')` },
          { id: 'peaks', title: 'Detect every heartbeat', xp: 40, est: 420, star: true,
            prompt: `<p>A heartbeat is a <b>peak</b>: a sample that is (1) clearly higher than normal, and (2) higher than its neighbours. Use only NumPy masks.</p><p>Define <code>thr = mean + 2 * std</code> of <code>clean</code>. A sample (not the first or last) is a beat if it is above <code>thr</code>, <b>greater than</b> the sample before it and <b>greater or equal</b> to the sample after it.</p><p>Store the sample <b>positions</b> of the beats in <code>peak_idx</code>. Tip: explain your plan in the Logic Lab and I will write the first version of the code with you.</p>`,
            starter: `thr = ...
peak_idx = ...
print(len(peak_idx), peak_idx[:5])`,
            solution: `thr = clean.mean() + 2 * clean.std()
above = clean[1:-1] > thr
local_max = (clean[1:-1] > clean[:-2]) & (clean[1:-1] >= clean[2:])
peak_idx = np.where(above & local_max)[0] + 1
print(len(peak_idx), peak_idx[:5])`,
            hints: ['clean[1:-1] are the middle samples; clean[:-2] the sample before each; clean[2:] the sample after each.', 'np.where(mask)[0] gives positions - but the mask starts at sample 1, so add 1.'],
            logic: { task: 'Describe how you would find the heartbeat positions in the cleaned signal. Mention how you decide a sample is high enough, how you avoid counting the same beat twice, and how you end up with positions.', xp: 25, minWords: 14, ordered: false,
              rubric: [
                { id: 'thr', label: 'a "high enough" cut-off', any: ['threshold', 'cut-?off', 'mean', 'average', 'standard deviation', '\\bstd\\b', 'higher than normal', 'limit'], hint: 'How do you decide a sample is high enough to be a beat? Think of a cut-off built from the signal\'s typical level and spread.', code: 'thr = clean.mean() + 2 * clean.std()\nabove = clean[1:-1] > thr' },
                { id: 'nb', label: 'compare with neighbours', any: ['neighbou?r', 'left', 'right', 'previous', 'next', 'before', 'after', 'adjacent', 'local max', 'peak'], hint: 'A beat is the top of a small hill. What do you compare each sample with so you only count the top?', code: 'local_max = (clean[1:-1] > clean[:-2]) & (clean[1:-1] >= clean[2:])' },
                { id: 'both', label: 'both conditions together', any: ['both', 'and also', 'at the same time', '&', 'together', 'combine', 'all of', 'must also', 'as well as'], hint: 'You have two yes/no tests per sample. How do you keep only the samples where BOTH are true?', code: '' },
                { id: 'pos', label: 'turn the mask into positions', any: ['index', 'indices', 'position', 'np\\.where', 'where', 'locat', 'argwhere', 'which samples', 'sample number'], hint: 'In the end you need WHERE the beats are, not a True/False list. Which NumPy idea turns a mask into positions?', code: 'peak_idx = np.where(above & local_max)[0] + 1' },
              ] },
            tests: `${HR}
check(abs(thr - _thr) < 1e-9, 'thr = mean + 2 * std of clean', 'clean.mean() + 2 * clean.std()')
check(np.array_equal(np.asarray(peak_idx), _idx), 'peak_idx holds exactly the beat positions', 'above thr AND > previous AND >= next, then np.where(...)[0] + 1')
check(len(peak_idx) > 20, 'a believable number of beats was found', 'check the threshold and the neighbour tests')` },
          { id: 'bpm', title: 'Beats per minute', xp: 30, est: 240,
            prompt: `<p>Convert beat positions to times, measure the gaps between beats (<b>RR intervals</b>, in seconds) and turn the average gap into beats per minute.</p>`,
            starter: `peak_times = t[___]
rr = np.___(peak_times)
bpm = ___ / rr.mean()
print(round(bpm, 1))`,
            solution: `peak_times = t[peak_idx]
rr = np.diff(peak_times)
bpm = 60 / rr.mean()
print(round(bpm, 1))`,
            bank: ['peak_idx', 'signal', 'diff', 'cumsum', 'sort', '60', '1', '100'], hints: ['t[peak_idx] gives the time of each beat.', 'np.diff gives differences between neighbours. 60 seconds / seconds-per-beat = beats per minute.'],
            tests: `${HR}
check(np.allclose(peak_times, t[_idx]), 'peak_times are the times of the beats', 't[peak_idx]')
check(np.allclose(rr, _rr), 'rr holds the gaps between beats', 'np.diff(peak_times)')
check(abs(bpm - 60 / _rr.mean()) < 1e-6 and 40 < bpm < 140, 'bpm is a believable heart rate', '60 / rr.mean()')` },
          { id: 'hrv', title: 'Windows and variability', xp: 40, est: 420,
            prompt: `<ol><li><code>rmssd_ms</code>: heart-rate variability. Take the successive differences of <code>rr</code>, square them, average, take the square root, and convert to <b>milliseconds</b>.</li><li><code>counts</code>: beats per 10-second window: <code>np.histogram(peak_times, bins=edges)</code> with <code>edges = np.arange(0, duration + 10, 10)</code> (keep only the counts).</li><li><code>bpm_windows</code>: <code>counts * 6</code>.</li><li><code>zone</code>: <code>"low"</code> if below 60, <code>"normal"</code> if 60 to 100, else <code>"high"</code> (nested <code>np.where</code>).</li></ol>`,
            starter: `rmssd_ms = ...
edges = np.arange(0, duration + 10, 10)
counts = ...
bpm_windows = ...
zone = ...
print(round(rmssd_ms, 1), bpm_windows, zone)`,
            solution: `rmssd_ms = np.sqrt(np.mean(np.diff(rr) ** 2)) * 1000
edges = np.arange(0, duration + 10, 10)
counts, _ = np.histogram(peak_times, bins=edges)
bpm_windows = counts * 6
zone = np.where(bpm_windows < 60, 'low', np.where(bpm_windows <= 100, 'normal', 'high'))
print(round(rmssd_ms, 1), bpm_windows, zone)`,
            hints: ['np.histogram returns (counts, edges); take the first.', 'np.where(a < 60, "low", np.where(a <= 100, "normal", "high"))'],
            tests: `${HR}
_pt = t[_idx]
_rm = np.sqrt(np.mean(np.diff(_rr) ** 2)) * 1000
_e = np.arange(0, duration + 10, 10)
_c, _ = np.histogram(_pt, bins=_e)
_bw = _c * 6
check(abs(rmssd_ms - _rm) < 1e-6, 'rmssd_ms is correct (in milliseconds)', 'sqrt(mean(diff(rr)**2)) * 1000')
check(np.array_equal(counts, _c), 'counts = beats per 10-second window', 'np.histogram(peak_times, bins=edges)[0]')
check(np.array_equal(bpm_windows, _bw), 'bpm_windows = counts * 6', 'beats in 10 s times 6')
check(list(zone) == list(np.where(_bw < 60, 'low', np.where(_bw <= 100, 'normal', 'high'))), 'zone labels each window', 'low < 60, normal 60-100, else high')` },
          { id: 'report', title: 'Publish the report chart', xp: 30, est: 240,
            prompt: `<p>Draw the final chart: the clean signal as a line, the detected beats as red dots, a title containing the BPM, and labelled axes. Matplotlib is covered in its own module; fill the blanks to get your first plot.</p>`,
            starter: `import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(9, 3.5))
ax.plot(t, clean, lw=1, label='clean signal')
ax.plot(t[___], clean[___], 'ro', label='beats')
ax.set_title(f'Heart-rate report: {bpm:.0f} BPM, HRV {rmssd_ms:.0f} ms')
ax.set_xlabel('___')
ax.set_ylabel('signal')
ax.legend()
plt.tight_layout()
print(f'BPM = {bpm:.1f}')`,
            solution: `import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(9, 3.5))
ax.plot(t, clean, lw=1, label='clean signal')
ax.plot(t[peak_idx], clean[peak_idx], 'ro', label='beats')
ax.set_title(f'Heart-rate report: {bpm:.0f} BPM, HRV {rmssd_ms:.0f} ms')
ax.set_xlabel('time (s)')
ax.set_ylabel('signal')
ax.legend()
plt.tight_layout()
print(f'BPM = {bpm:.1f}')`,
            bank: ['peak_idx', 'time (s)', 'seconds', 'bpm', 'signal'], hints: ['Index both t and clean with the beat positions.'],
            tests: `${PLOT_CHECK("'BPM' in ax0.get_title()")}
check(len(ax0.lines) >= 2, 'the chart has the signal line and the beat markers', 'two ax.plot(...) calls')` },
        ],
        flagship_ms: [
          { id: 'artefact', title: 'Flagship: find motion artefacts', xp: 45, est: 420, star: true,
            prompt: `<p>Your two-minute recording contains a burst where the wearer moved. Detect it automatically:</p><ol><li><code>roll_std</code>: standard deviation of every 1-second window (50 samples) of <code>clean</code>, using <code>sliding_window_view</code>.</li><li><code>artefact</code>: True where <code>roll_std</code> is more than <b>1.5 times</b> its median.</li><li><code>artefact_seconds</code>: how many seconds of data are flagged (number of True windows divided by <code>fs</code>).</li></ol>`,
            starter: `from numpy.lib.stride_tricks import sliding_window_view

windows = sliding_window_view(clean, ___)
roll_std = windows.std(axis=___)
artefact = roll_std > ___ * np.median(roll_std)
artefact_seconds = artefact.sum() / fs
print(windows.shape, round(artefact_seconds, 2))`,
            solution: `from numpy.lib.stride_tricks import sliding_window_view

windows = sliding_window_view(clean, 50)
roll_std = windows.std(axis=1)
artefact = roll_std > 1.5 * np.median(roll_std)
artefact_seconds = artefact.sum() / fs
print(windows.shape, round(artefact_seconds, 2))`,
            bank: ['50', '25', '0', '1', '1.5', '3', 'fs'], hints: ['One second of data = fs samples = 50.', 'Each row of windows is one window, so take the std along axis=1.'],
            tests: `${HR}
from numpy.lib.stride_tricks import sliding_window_view as _swv
_rs = _swv(_clean, 50).std(axis=1)
_art = _rs > 1.5 * np.median(_rs)
check(np.allclose(roll_std, _rs), 'roll_std is the std of each 1-second window', 'sliding_window_view(clean, 50).std(axis=1)')
check(np.array_equal(artefact, _art), 'artefact flags windows above 1.5 x the median', 'roll_std > 1.5 * np.median(roll_std)')
check(abs(artefact_seconds - _art.sum() / 50) < 1e-9, 'artefact_seconds is correct', 'artefact.sum() / fs')` },
          { id: 'irregular', title: 'Flagship: rhythm irregularity', xp: 35, est: 300,
            prompt: `<p>A steady heart has similar gaps between beats. Flag a gap as <b>irregular</b> when it differs from the median gap by more than 20% of the median.</p><ul><li><code>irregular</code>: boolean array, one per RR gap</li><li><code>irregular_pct</code>: the percentage of irregular gaps (0-100)</li></ul>`,
            starter: `med = np.median(rr)
irregular = ...
irregular_pct = ...
print(round(irregular_pct, 1))`,
            solution: `med = np.median(rr)
irregular = np.abs(rr - med) > 0.2 * med
irregular_pct = irregular.mean() * 100
print(round(irregular_pct, 1))`,
            hints: ['np.abs(rr - med) is the distance from the typical gap.', 'The mean of a boolean array is the fraction of Trues.'],
            tests: `${HR}
_med = np.median(_rr)
_irr = np.abs(_rr - _med) > 0.2 * _med
check(np.array_equal(irregular, _irr), 'irregular marks gaps > 20% away from the median', 'np.abs(rr - med) > 0.2 * med')
check(abs(irregular_pct - _irr.mean() * 100) < 1e-9, 'irregular_pct is a percentage', 'irregular.mean() * 100')` },
        ],
      },

      /* ============================================================ photo */
      {
        id: 'pixel', hours: 4, title: 'PixelSmith: a photo-filter engine from scratch',
        pitch: 'A photo is just a 2-D array of brightness values. Build the core of a photo editor - brightness, contrast, flips, crop, thumbnail, object detection by masking, blur and edge detection - using only array operations. No image library.',
        real: 'The filters behind Instagram / Lightroom / phone-camera apps and the pre-processing step of every computer-vision model.',
        flagship_note: 'a 96 x 96 image (bigger than the standard 64 x 64) and two extra milestones: histogram equalisation and a sepia colour image built as a 3-D array.',
        dataset: { file: 'photo.csv', header: false, desc: 'A synthetic greyscale photo: a bright disc, a dark rectangle and a gradient background with sensor noise. Each pixel is a number from 0 (black) to 255 (white); one CSV row = one image row. Disc and rectangle positions are unique to you.', columns: [['cell (row i, column j)', 'brightness of the pixel in row i, column j (0-255)']], gen: DS.photo },
        refs: ['The scikit-image gallery (scikit-image.org) shows these filters with real photos.', 'NumPy "Image processing" tutorials treat images as arrays exactly as you do here.'],
        milestones: [
          { id: 'load', title: 'Load the image', xp: 20, est: 120,
            prompt: `<p>Load the pixel grid with <code>np.loadtxt</code>. Then read its height and width from the shape and compute the average brightness.</p>`,
            starter: `import numpy as np

img = np.loadtxt('data/photo.csv', delimiter=',')
h, w = img.___
mean_brightness = img.___()
print(img.shape, round(mean_brightness, 1))`,
            solution: `import numpy as np

img = np.loadtxt('data/photo.csv', delimiter=',')
h, w = img.shape
mean_brightness = img.mean()
print(img.shape, round(mean_brightness, 1))`,
            bank: ['shape', 'size', 'ndim', 'mean', 'sum', 'max'], hints: ['shape is a tuple (rows, columns) - unpack it into h and w.'],
            tests: `raw = np.loadtxt('data/photo.csv', delimiter=',')
check(np.array_equal(img, raw), 'img holds the pixel grid', 'np.loadtxt(path, delimiter=",")')
check((h, w) == raw.shape, 'h and w are the image height and width', 'img.shape')
check(abs(mean_brightness - raw.mean()) < 1e-9, 'mean_brightness is the average pixel value', 'img.mean()')` },
          { id: 'tone', title: 'Brightness, contrast, negative', xp: 30, est: 240,
            prompt: `<p>Pixel values must stay between 0 and 255, so use <code>np.clip</code>.</p>${UL(['<code>brighter</code>: add 40 to every pixel (clipped)', '<code>contrast</code>: stretch around mid-grey: <code>(img - 128) * 1.5 + 128</code> (clipped)', '<code>negative</code>: <code>255 - img</code>'])}`,
            starter: `brighter = np.___(img + 40, 0, ___)
contrast = np.clip((img - ___) * 1.5 + 128, 0, 255)
negative = ___ - img
print(brighter.max(), contrast.min(), negative[0, 0])`,
            solution: `brighter = np.clip(img + 40, 0, 255)
contrast = np.clip((img - 128) * 1.5 + 128, 0, 255)
negative = 255 - img
print(brighter.max(), contrast.min(), negative[0, 0])`,
            bank: ['clip', 'minimum', '255', '128', '0', '256', '40'], hints: ['np.clip(a, low, high) forces values into [low, high].'],
            tests: `check(np.array_equal(brighter, np.clip(img + 40, 0, 255)), 'brighter = clip(img + 40, 0, 255)', 'np.clip(img + 40, 0, 255)')
check(np.allclose(contrast, np.clip((img - 128) * 1.5 + 128, 0, 255)), 'contrast stretches around 128', '(img - 128) * 1.5 + 128, clipped')
check(np.array_equal(negative, 255 - img), 'negative = 255 - img', '255 - img')` },
          { id: 'geometry', title: 'Flip, crop, thumbnail', xp: 30, est: 240,
            prompt: `<p>Geometry is pure slicing:</p>${UL(['<code>flipped_lr</code>: mirror left-right', '<code>flipped_ud</code>: flip upside down', '<code>crop</code>: the centre half: rows from <code>h//4</code> to <code>3*h//4</code> and the same for columns', '<code>thumb</code>: every 2nd row and 2nd column'])}`,
            starter: `flipped_lr = img[:, ___]
flipped_ud = img[___]
crop = img[h // 4: 3 * h // 4, w // 4: ___ * w // 4]
thumb = img[::___, ::2]
print(flipped_lr.shape, crop.shape, thumb.shape)`,
            solution: `flipped_lr = img[:, ::-1]
flipped_ud = img[::-1]
crop = img[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
thumb = img[::2, ::2]
print(flipped_lr.shape, crop.shape, thumb.shape)`,
            bank: ['::-1', '::2', '3', '2', '1', ':-1'], hints: ['A step of -1 reverses an axis.', 'Slice the columns for left-right, the rows for up-down.'],
            tests: `check(np.array_equal(flipped_lr, img[:, ::-1]), 'flipped_lr mirrors the columns', 'img[:, ::-1]')
check(np.array_equal(flipped_ud, img[::-1]), 'flipped_ud reverses the rows', 'img[::-1]')
check(np.array_equal(crop, img[h // 4: 3 * h // 4, w // 4: 3 * w // 4]), 'crop is the centre half', 'img[h//4: 3*h//4, w//4: 3*w//4]')
check(np.array_equal(thumb, img[::2, ::2]), 'thumb keeps every 2nd pixel in both directions', 'img[::2, ::2]')` },
          { id: 'mask', title: 'Find the bright object', xp: 40, est: 420, star: true,
            prompt: `<p>The bright disc is much lighter than the background. Find it:</p>${UL(['<code>mask</code>: True where a pixel is brighter than <b>180</b>', '<code>bright_fraction</code>: the fraction of pixels in the mask', '<code>top, bottom, left, right</code>: the first/last row and first/last column that contain a bright pixel (its <b>bounding box</b>)'])}<p>Tip: use the Logic Lab to plan how rows/columns that "contain a bright pixel" can be found without loops.</p>`,
            starter: `mask = ...
bright_fraction = ...
top, bottom, left, right = ..., ..., ..., ...
print(round(bright_fraction, 4), (top, bottom, left, right))`,
            solution: `mask = img > 180
bright_fraction = mask.mean()
rows = np.where(mask.any(axis=1))[0]
cols = np.where(mask.any(axis=0))[0]
top, bottom = rows[0], rows[-1]
left, right = cols[0], cols[-1]
print(round(bright_fraction, 4), (int(top), int(bottom), int(left), int(right)))`,
            hints: ['mask.any(axis=1) is True for every ROW that has at least one True.', 'np.where(...)[0] gives positions; the first and last are the box edges.'],
            logic: { task: 'Describe how to find the smallest rectangle that contains the bright disc, using the brightness numbers.', xp: 25, minWords: 14,
              rubric: [
                { id: 'mask', label: 'mark the bright pixels', any: ['threshold', 'brighter than', 'above 180', '> ?180', 'greater than 180', 'mask', 'bright pixels', 'cut-?off'], hint: 'First decide which pixels count as "bright". How do you turn that decision into a True/False grid?', code: 'mask = img > 180\nbright_fraction = mask.mean()' },
                { id: 'any', label: 'which rows / columns contain one', any: ['any', 'at least one', 'contains? a', 'row.*(has|have|contain)', 'column.*(has|have|contain)', 'each row', 'each column', 'along'], hint: 'You do not need every bright pixel, only the ROWS and COLUMNS that touch one. Which question can you ask of each row and each column?', code: 'rows = np.where(mask.any(axis=1))[0]\ncols = np.where(mask.any(axis=0))[0]' },
                { id: 'edge', label: 'first and last of them', any: ['first', 'last', 'smallest', 'largest', 'min', 'max', 'top', 'bottom', 'edge', 'extreme', 'corner'], hint: 'Once you know which rows (and columns) contain bright pixels, which two of them define the box edges?', code: 'top, bottom = rows[0], rows[-1]\nleft, right = cols[0], cols[-1]' },
              ] },
            tests: `_m = img > 180
_r = np.where(_m.any(axis=1))[0]; _c = np.where(_m.any(axis=0))[0]
check(np.array_equal(mask, _m), 'mask marks pixels brighter than 180', 'img > 180')
check(abs(bright_fraction - _m.mean()) < 1e-12, 'bright_fraction = mask.mean()', 'the mean of a boolean mask is a fraction')
check((int(top), int(bottom), int(left), int(right)) == (int(_r[0]), int(_r[-1]), int(_c[0]), int(_c[-1])), 'the bounding box is right', 'mask.any(axis=1) / axis=0, then np.where, then first and last')` },
          { id: 'filters', title: 'Blur and edge detection', xp: 45, est: 480,
            prompt: `<p>Both filters shift the image a pixel in each direction and combine the shifted copies (all output arrays have shape <code>(h-2, w-2)</code>).</p>${UL(['<code>blurred</code>: the average of the 9 neighbours: sum <code>img[i:h-2+i, j:w-2+j]</code> over i, j in 0..2, divided by 9', '<code>gx</code>: horizontal change: <code>img[1:-1, 2:] - img[1:-1, :-2]</code>', '<code>gy</code>: vertical change: <code>img[2:, 1:-1] - img[:-2, 1:-1]</code>', '<code>edges</code>: the length of (gx, gy) per pixel: <code>np.hypot</code>'])}`,
            starter: `blurred = sum(img[i:h - 2 + i, j:___ + j] for i in range(3) for j in range(3)) / 9
gx = img[1:-1, ___:] - img[1:-1, :-2]
gy = img[2:, 1:-1] - img[:-2, 1:-1]
edges = np.___(gx, gy)
print(blurred.shape, gx.shape, round(edges.max(), 1))`,
            solution: `blurred = sum(img[i:h - 2 + i, j:w - 2 + j] for i in range(3) for j in range(3)) / 9
gx = img[1:-1, 2:] - img[1:-1, :-2]
gy = img[2:, 1:-1] - img[:-2, 1:-1]
edges = np.hypot(gx, gy)
print(blurred.shape, gx.shape, round(edges.max(), 1))`,
            bank: ['w - 2', 'w', '2', '1', 'hypot', 'sqrt', 'add'], hints: ['The blur window slides over columns exactly as over rows: w - 2 + j.', 'np.hypot(a, b) = sqrt(a**2 + b**2), element-wise.'],
            tests: `_bl = sum(img[i:h - 2 + i, j:w - 2 + j] for i in range(3) for j in range(3)) / 9
_gx = img[1:-1, 2:] - img[1:-1, :-2]; _gy = img[2:, 1:-1] - img[:-2, 1:-1]
check(blurred.shape == (h - 2, w - 2) and np.allclose(blurred, _bl), 'blurred is the 3x3 average', 'sum the nine shifted copies and divide by 9')
check(np.allclose(gx, _gx) and np.allclose(gy, _gy), 'gx and gy are the horizontal and vertical changes', 'shifted slices subtracted')
check(np.allclose(edges, np.hypot(_gx, _gy)), 'edges = hypot(gx, gy)', 'np.hypot(gx, gy)')` },
          { id: 'report', title: 'Publish the before / after sheet', xp: 30, est: 240,
            prompt: `<p>Make a contact sheet with three panels: the original, the brighter image and the edge map. Give each a title.</p>`,
            starter: `import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 3, figsize=(10, 3.6))
axes[0].imshow(img, cmap='gray')
axes[0].set_title('original')
axes[1].imshow(___, cmap='gray', vmin=0, vmax=255)
axes[1].set_title('brighter')
axes[2].imshow(edges, cmap='magma')
axes[2].set_title('edges')
for a in axes:
    a.axis('off')
plt.tight_layout()
print('sheet ready')`,
            solution: `import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 3, figsize=(10, 3.6))
axes[0].imshow(img, cmap='gray')
axes[0].set_title('original')
axes[1].imshow(brighter, cmap='gray', vmin=0, vmax=255)
axes[1].set_title('brighter')
axes[2].imshow(edges, cmap='magma')
axes[2].set_title('edges')
for a in axes:
    a.axis('off')
plt.tight_layout()
print('sheet ready')`,
            bank: ['brighter', 'negative', 'contrast', 'thumb'], hints: ['Show the brightened image in the middle panel.'],
            tests: `fig = plt.gcf()
check(len(fig.axes) == 3, 'the figure has 3 panels', 'plt.subplots(1, 3)')
check(all(a.get_title() for a in fig.axes), 'every panel has a title', 'axes[i].set_title(...)')
check(len(fig.axes[1].images) == 1 and np.allclose(fig.axes[1].images[0].get_array(), brighter), 'the middle panel shows the brighter image', 'imshow(brighter, ...)')` },
        ],
        flagship_ms: [
          { id: 'equalise', title: 'Flagship: histogram equalisation', xp: 50, est: 480, star: true,
            prompt: `<p>Auto-contrast, the way photo editors do it:</p><ol><li><code>hist</code>: how many pixels have each value 0..255 (<code>np.bincount</code> of the integer, flattened image, <code>minlength=256</code>)</li><li><code>cdf</code>: running total of <code>hist</code></li><li><code>lut</code>: a look-up table of 256 values: <code>round(255 * (cdf - cdf.min()) / (cdf.max() - cdf.min()))</code></li><li><code>equalised</code>: look every pixel up in <code>lut</code> (indexing an array with an array!)</li></ol>`,
            starter: `pix = img.astype(int)
hist = np.bincount(pix.___(), minlength=256)
cdf = hist.___()
lut = np.round(255 * (cdf - cdf.min()) / (cdf.max() - cdf.min()))
equalised = lut[___]
print(hist.shape, equalised.shape, equalised.min(), equalised.max())`,
            solution: `pix = img.astype(int)
hist = np.bincount(pix.ravel(), minlength=256)
cdf = hist.cumsum()
lut = np.round(255 * (cdf - cdf.min()) / (cdf.max() - cdf.min()))
equalised = lut[pix]
print(hist.shape, equalised.shape, equalised.min(), equalised.max())`,
            bank: ['ravel', 'cumsum', 'pix', 'img', 'flatten', 'sum', 'sort'], hints: ['bincount needs a flat 1-D array of non-negative ints.', 'lut[pix] replaces each pixel value by lut[value].'],
            tests: `_p = img.astype(int); _h = np.bincount(_p.ravel(), minlength=256); _cd = _h.cumsum()
_l = np.round(255 * (_cd - _cd.min()) / (_cd.max() - _cd.min()))
check(np.array_equal(hist, _h), 'hist counts the pixels of each value', 'np.bincount(pix.ravel(), minlength=256)')
check(np.array_equal(cdf, _cd), 'cdf is the running total', 'hist.cumsum()')
check(np.array_equal(equalised, _l[_p]), 'equalised = lut[pix]', 'index the table with the image')` },
          { id: 'sepia', title: 'Flagship: a colour image', xp: 40, est: 300,
            prompt: `<p>Colour images are 3-D arrays (height, width, 3). Build a warm "sepia-like" tint from the grey image:</p><ul><li><code>rgb</code>: stack three layers along a new LAST axis: red = img, green = img * 0.8, blue = img * 0.6</li><li>clip to 0..255 and convert to <code>uint8</code></li></ul>`,
            starter: `rgb = np.stack([img, img * 0.8, img * 0.6], axis=___)
rgb = np.clip(rgb, 0, 255).astype(np.___)
print(rgb.shape, rgb.dtype)`,
            solution: `rgb = np.stack([img, img * 0.8, img * 0.6], axis=-1)
rgb = np.clip(rgb, 0, 255).astype(np.uint8)
print(rgb.shape, rgb.dtype)`,
            bank: ['-1', '0', '2', 'uint8', 'int8', 'float32'], hints: ['axis=-1 (or 2) puts the colour channels last.', 'uint8 holds 0..255.'],
            tests: `check(rgb.shape == img.shape + (3,), 'rgb has shape (h, w, 3)', 'stack along the last axis')
check(rgb.dtype == np.uint8, 'rgb is uint8', 'astype(np.uint8)')
check(np.array_equal(rgb[..., 0], np.clip(img, 0, 255).astype(np.uint8)), 'the red layer is the original image', 'img is the first layer')` },
        ],
      },

      /* ============================================================ cricket */
      {
        id: 'cricket', hours: 4, title: 'Match-Day Analytics: rank players, track form, pick a fantasy XI',
        pitch: 'You get every innings of a squad over a season: runs and balls faced, match by match. With NumPy only you will compute averages, strike rates and consistency, rank the squad, track recent form with rolling windows, and pick the best five for a fantasy team.',
        real: 'The engine behind fantasy-sports apps (Dream11) and broadcast graphics (Cricbuzz / ESPNcricinfo player stats).',
        flagship_note: 'a bigger squad (14 players, 24 matches) and two extra milestones: team-relative impact scores and a player-similarity search with a correlation matrix.',
        dataset: { file: 'cricket.csv', desc: 'Synthetic season data: one row per player per match with runs scored and balls faced. Players have different skill, strike rate and form trends; they are different for every learner.', columns: [['player_id', 'player number, starting at 1'], ['match_no', 'match number, starting at 1'], ['runs', 'runs scored in that match'], ['balls', 'balls faced in that match']], gen: DS.cricket },
        refs: ['Cricsheet (cricsheet.org) publishes free ball-by-ball data for international and T20 leagues - repeat this project with a real squad.', 'Strike rate = runs per 100 balls; average here means mean runs per match.'],
        milestones: [
          { id: 'load', title: 'Load and reshape', xp: 25, est: 240,
            prompt: `<p>The file is in "long" format (one row per player per match, sorted by player then match). Turn the <code>runs</code> and <code>balls</code> columns into <b>matrices</b> with one row per player and one column per match.</p>`,
            starter: `import numpy as np

raw = np.genfromtxt('data/cricket.csv', delimiter=',', skip_header=1)
P = int(raw[:, 0].___())
M = int(raw[:, 1].___())
runs = raw[:, 2].reshape(___, M)
balls = raw[:, 3].reshape(P, ___)
print(P, M, runs.shape)`,
            solution: `import numpy as np

raw = np.genfromtxt('data/cricket.csv', delimiter=',', skip_header=1)
P = int(raw[:, 0].max())
M = int(raw[:, 1].max())
runs = raw[:, 2].reshape(P, M)
balls = raw[:, 3].reshape(P, M)
print(P, M, runs.shape)`,
            bank: ['max', 'min', 'sum', 'P', 'M', '-1'], hints: ['The biggest player_id equals the number of players.', 'reshape(players, matches) puts one player per row because the file is sorted by player.'],
            tests: `_r = np.genfromtxt('data/cricket.csv', delimiter=',', skip_header=1)
check(P == int(_r[:, 0].max()) and M == int(_r[:, 1].max()), 'P and M are the number of players and matches', 'max of the id columns')
check(runs.shape == (P, M) and runs[0, 0] == _r[0, 2] and runs[1, 0] == _r[M, 2], 'runs is a players x matches matrix', 'reshape(P, M)')
check(balls.shape == (P, M) and balls[-1, -1] == _r[-1, 3], 'balls is a players x matches matrix', 'reshape(P, M)')` },
          { id: 'stats', title: 'Player statistics', xp: 30, est: 300,
            prompt: `<p>One value per player (use the right <code>axis</code>):</p>${UL(['<code>total</code>: total runs', '<code>average</code>: mean runs per match', '<code>strike_rate</code>: <code>100 * total runs / total balls</code>', '<code>consistency</code>: standard deviation of runs (lower = steadier)'])}`,
            starter: `total = runs.sum(axis=___)
average = runs.mean(axis=1)
strike_rate = 100 * runs.sum(axis=1) / balls.sum(axis=___)
consistency = runs.___(axis=1)
print(total, strike_rate.round(1), sep=" | ")`,
            solution: `total = runs.sum(axis=1)
average = runs.mean(axis=1)
strike_rate = 100 * runs.sum(axis=1) / balls.sum(axis=1)
consistency = runs.std(axis=1)
print(total, strike_rate.round(1), sep=" | ")`,
            bank: ['0', '1', 'std', 'var', 'max'], hints: ['One value per player means one value per ROW: collapse the columns (axis=1).'],
            tests: `check(np.array_equal(total, runs.sum(axis=1)), 'total = runs per player', 'runs.sum(axis=1)')
check(np.allclose(average, runs.mean(axis=1)), 'average = mean runs per match', 'runs.mean(axis=1)')
check(np.allclose(strike_rate, 100 * runs.sum(axis=1) / balls.sum(axis=1)), 'strike_rate = 100 x runs / balls', '100 * runs.sum(axis=1) / balls.sum(axis=1)')
check(np.allclose(consistency, runs.std(axis=1)), 'consistency = std of runs', 'runs.std(axis=1)')` },
          { id: 'rank', title: 'Rankings and milestones', xp: 35, est: 300,
            prompt: `<ul><li><code>order</code>: player positions from highest total to lowest</li><li><code>top3</code>: the <b>player ids</b> (1-based) of the three best run-scorers, best first</li><li><code>fifties</code>: for each player, the number of matches with 50 or more runs</li><li><code>most_fifties</code>: id of the player with the most fifties</li><li><code>best_sr</code>: id of the player with the best strike rate</li></ul>`,
            starter: `order = ...
top3 = ...
fifties = ...
most_fifties = ...
best_sr = ...
print(top3, fifties, most_fifties, best_sr)`,
            solution: `order = np.argsort(-total)
top3 = order[:3] + 1
fifties = (runs >= 50).sum(axis=1)
most_fifties = fifties.argmax() + 1
best_sr = strike_rate.argmax() + 1
print(top3, fifties, most_fifties, best_sr)`,
            hints: ['Positions start at 0 but player ids start at 1: add 1.', 'A boolean matrix summed along axis=1 counts matches per player.'],
            tests: `_t = runs.sum(axis=1)
check(set(np.asarray(top3).tolist()) == set((np.argsort(-_t)[:3] + 1).tolist()) and all(_t[top3[i] - 1] >= _t[top3[i + 1] - 1] for i in range(2)), 'top3 = the three best run-scorers, best first', 'np.argsort(-total)[:3] + 1')
check(np.array_equal(fifties, (runs >= 50).sum(axis=1)), 'fifties counts matches with 50+ runs', '(runs >= 50).sum(axis=1)')
check(int(most_fifties) == int((runs >= 50).sum(axis=1).argmax() + 1), 'most_fifties is the right id', 'argmax + 1')
check(int(best_sr) == int((100 * runs.sum(axis=1) / balls.sum(axis=1)).argmax() + 1), 'best_sr is the right id', 'strike_rate.argmax() + 1')` },
          { id: 'form', title: 'Who is in form?', xp: 45, est: 480, star: true,
            prompt: `<p>Recent form matters more than season totals. Compute each player's <b>rolling average of the last 5 matches</b>, then see who improved the most.</p>${UL(['<code>rolling5</code>: shape <code>(P, M-4)</code>; column k = mean of matches k..k+4', '<code>form_gain</code>: last rolling value minus the first rolling value, per player', '<code>in_form</code>: id (1-based) of the player with the biggest gain'])}<p>Tip: describe the plan in the Logic Lab - overlapping windows and <code>sliding_window_view</code> do the work.</p>`,
            starter: `rolling5 = ...
form_gain = ...
in_form = ...
print(rolling5.shape, in_form)`,
            solution: `from numpy.lib.stride_tricks import sliding_window_view
windows = sliding_window_view(runs, 5, axis=1)
rolling5 = windows.mean(axis=-1)
form_gain = rolling5[:, -1] - rolling5[:, 0]
in_form = form_gain.argmax() + 1
print(rolling5.shape, in_form)`,
            hints: ['sliding_window_view(runs, 5, axis=1) has shape (P, M-4, 5).', 'Average over the last axis (the window).'],
            logic: { task: 'Explain how to measure each player\'s recent form and decide who improved the most.', xp: 25, minWords: 14,
              rubric: [
                { id: 'win', label: 'overlapping windows of 5 matches', any: ['window', 'rolling', 'moving', 'last (5|five)', 'consecutive', 'overlap', 'groups? of (5|five)', 'every (5|five)'], hint: 'Form means "the last few matches". How do you cut each player\'s season into overlapping runs of 5 matches?', code: 'from numpy.lib.stride_tricks import sliding_window_view\nwindows = sliding_window_view(runs, 5, axis=1)' },
                { id: 'avg', label: 'average each window', any: ['average', 'mean', 'avg'], hint: 'What single number summarises a window of 5 scores?', code: 'rolling5 = windows.mean(axis=-1)' },
                { id: 'cmp', label: 'compare latest with the first window', any: ['last', 'latest', 'recent', 'first', 'difference', 'compare', 'gain', 'improv', 'minus', 'subtract', 'change', 'end'], hint: 'To see improvement you need two moments to compare. Which two windows would you compare?', code: 'form_gain = rolling5[:, -1] - rolling5[:, 0]' },
                { id: 'best', label: 'pick the biggest improvement', any: ['biggest', 'largest', 'highest', 'most', 'best', 'max', 'argmax', 'top'], hint: 'Finally, which player do you pick, and how do you get their position?', code: 'in_form = form_gain.argmax() + 1' },
              ] },
            tests: `from numpy.lib.stride_tricks import sliding_window_view as _swv
_ro = _swv(runs, 5, axis=1).mean(axis=-1)
_g = _ro[:, -1] - _ro[:, 0]
check(rolling5.shape == (P, M - 4) and np.allclose(rolling5, _ro), 'rolling5 is the mean of every 5-match window', 'sliding_window_view(runs, 5, axis=1).mean(axis=-1)')
check(np.allclose(form_gain, _g), 'form_gain = last rolling value - first', 'rolling5[:, -1] - rolling5[:, 0]')
check(int(in_form) == int(_g.argmax() + 1), 'in_form is the player with the biggest gain', 'form_gain.argmax() + 1')` },
          { id: 'fantasy', title: 'Pick the fantasy XI', xp: 35, est: 360,
            prompt: `<p>Fantasy scoring per innings: <b>runs</b>, plus <b>25 bonus</b> for a fifty (50+), minus <b>5</b> for a duck (0 runs).</p>${UL(['<code>points</code>: that score for every player and match (matrix)', '<code>fantasy</code>: season fantasy total per player', '<code>xi</code>: ids (1-based) of the 5 best fantasy players, best first'])}`,
            starter: `points = runs + 25 * (runs >= ___) - ___ * (runs == 0)
fantasy = points.sum(axis=___)
xi = np.argsort(-fantasy)[:___] + 1
print(xi, fantasy[xi - 1])`,
            solution: `points = runs + 25 * (runs >= 50) - 5 * (runs == 0)
fantasy = points.sum(axis=1)
xi = np.argsort(-fantasy)[:5] + 1
print(xi, fantasy[xi - 1])`,
            bank: ['50', '5', '0', '1', '25'], hints: ['Booleans behave like 0/1 in arithmetic, so 25 * (runs >= 50) is the fifty bonus.'],
            tests: `_p = runs + 25 * (runs >= 50) - 5 * (runs == 0); _f = _p.sum(axis=1)
check(np.array_equal(points, _p), 'points = runs + 25 x fifties - 5 x ducks', 'runs + 25 * (runs >= 50) - 5 * (runs == 0)')
check(np.array_equal(fantasy, _f), 'fantasy = season total per player', 'points.sum(axis=1)')
check(len(xi) == 5 and set(np.asarray(xi).tolist()) == set((np.argsort(-_f)[:5] + 1).tolist()) and all(_f[xi[i] - 1] >= _f[xi[i + 1] - 1] for i in range(4)), 'xi = the five best, best first', 'np.argsort(-fantasy)[:5] + 1')` },
          { id: 'report', title: 'Publish the season chart', xp: 30, est: 240,
            prompt: `<p>A bar chart of total runs per player, with a title and labelled axes.</p>`,
            starter: `import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 3.8))
ax.bar(np.arange(1, P + 1), ___)
ax.set_title('Season runs by player')
ax.set_xlabel('player id')
ax.set_ylabel('total runs')
plt.tight_layout()
print('chart ready')`,
            solution: `import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 3.8))
ax.bar(np.arange(1, P + 1), total)
ax.set_title('Season runs by player')
ax.set_xlabel('player id')
ax.set_ylabel('total runs')
plt.tight_layout()
print('chart ready')`,
            bank: ['total', 'average', 'fantasy', 'strike_rate'], hints: ['One bar per player: use the totals.'],
            tests: `${PLOT_CHECK("ax0.get_title() != ''")}
check(len(ax0.patches) == P, 'there is one bar per player', 'ax.bar(ids, total)')` },
        ],
        flagship_ms: [
          { id: 'impact', title: 'Flagship: team-relative impact', xp: 45, est: 360, star: true,
            prompt: `<p>Some matches are high-scoring for everyone. Measure each player against the <b>team average of that match</b>:</p><ul><li><code>team_mean</code>: average runs per match (shape <code>(M,)</code>)</li><li><code>relative</code>: runs minus the team mean (broadcast!)</li><li><code>impact</code>: season sum of <code>relative</code> per player</li><li><code>mvp</code>: id (1-based) of the highest impact</li></ul>`,
            starter: `team_mean = runs.mean(axis=___)
relative = runs - ___
impact = relative.sum(axis=1)
mvp = impact.argmax() + 1
print(team_mean.shape, mvp)`,
            solution: `team_mean = runs.mean(axis=0)
relative = runs - team_mean
impact = relative.sum(axis=1)
mvp = impact.argmax() + 1
print(team_mean.shape, mvp)`,
            bank: ['0', '1', 'team_mean', 'runs', 'average'], hints: ['One average per MATCH = one per column = collapse the rows (axis=0).', '(P, M) minus (M,) broadcasts.'],
            tests: `_tm = runs.mean(axis=0); _rel = runs - _tm; _im = _rel.sum(axis=1)
check(np.shape(team_mean) == (M,) and np.allclose(team_mean, _tm), 'team_mean is the average per match', 'runs.mean(axis=0)')
check(np.allclose(relative, _rel), 'relative = runs - team_mean', 'broadcasting')
check(np.allclose(impact, _im) and int(mvp) == int(_im.argmax() + 1), 'impact and mvp are correct', 'relative.sum(axis=1); argmax + 1')` },
          { id: 'similar', title: 'Flagship: find the twin', xp: 50, est: 480,
            prompt: `<p>Which two players have the most similar match-by-match pattern? Use the correlation matrix.</p><ul><li><code>corr</code>: <code>np.corrcoef(runs)</code> (shape P x P)</li><li>Set the diagonal to -1 so a player is not their own twin (<code>np.fill_diagonal</code>)</li><li><code>i, j</code>: row and column of the largest value (<code>np.unravel_index</code> of <code>argmax</code>)</li><li><code>twins</code>: the tuple of 1-based ids <code>(i + 1, j + 1)</code></li></ul>`,
            starter: `corr = np.corrcoef(runs)
np.fill_diagonal(corr, ___)
i, j = np.unravel_index(corr.___(), corr.shape)
twins = (int(i) + 1, int(j) + 1)
print(twins, round(corr[i, j], 3))`,
            solution: `corr = np.corrcoef(runs)
np.fill_diagonal(corr, -1)
i, j = np.unravel_index(corr.argmax(), corr.shape)
twins = (int(i) + 1, int(j) + 1)
print(twins, round(corr[i, j], 3))`,
            bank: ['-1', '0', '1', 'argmax', 'max', 'argmin'], hints: ['Correlation is between -1 and 1, so -1 can never win the argmax.', 'unravel_index turns a flat position into (row, column).'],
            tests: `_c = np.corrcoef(runs); np.fill_diagonal(_c, -1)
_i, _j = np.unravel_index(_c.argmax(), _c.shape)
check(corr.shape == (P, P) and np.allclose(np.diag(corr), -1), 'corr is P x P with the diagonal set to -1', 'np.fill_diagonal(corr, -1)')
check(set(twins) == {int(_i) + 1, int(_j) + 1}, 'twins are the two most similar players', 'argmax of corr, then unravel_index')` },
        ],
      },
    ],
  };
})();
