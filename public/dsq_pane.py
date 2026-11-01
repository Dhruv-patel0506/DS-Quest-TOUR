"""Bridge between a DataFrame in the notebook and the 3-D pane.

The pane asks for a sample of rows (x, y, z and an optional colour column), shows them in 3-D, lets the learner move points by hand,
and writes those edits back into the DataFrame. It also re-reads the same rows after your code changes the table (cleaning, scaling,
filtering), so you can watch what the code did.
"""
import json

import numpy as np
import pandas as pd


def _num_cols(df):
    return [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]


def info(df):
    """Columns the pane can use: numeric ones for axes, small categorical ones (and numeric) for colour."""
    nums = _num_cols(df)
    cats = [str(c) for c in df.columns if str(c) not in nums or df[c].nunique() <= 12]
    cats = [c for c in cats if df[c].nunique() <= 12]
    return json.dumps({'numeric': nums, 'color': cats + [c for c in nums if c not in cats], 'rows': int(len(df)), 'unique_index': bool(df.index.is_unique)})


def _r(series):
    return [float('%.6g' % v) for v in series.astype(float)]


def _clean(v):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else v


def sample(df, xc, yc, zc, color=None, n=1500, ids=None, seed=0):
    """A sample of rows (or exactly the rows `ids`, to compare before and after your code ran)."""
    if ids is None:
        part = df.sample(min(int(n), len(df)), random_state=seed)
        missing = []
    else:
        idx = pd.Index(ids)
        part = df.loc[df.index.intersection(idx)]
        missing = [i for i in idx.difference(df.index).tolist()]
    part = part[[xc, yc, zc] + ([color] if color else [])]
    ok = part[[xc, yc, zc]].notna().all(axis=1)
    shown = part[ok]
    out = {'ids': [(_clean(i.item()) if hasattr(i, 'item') else i) for i in shown.index],
           'x': _r(shown[xc]), 'y': _r(shown[yc]), 'z': _r(shown[zc]),
           'total': int(len(df)), 'missing': [(_clean(i.item()) if hasattr(i, 'item') else i) for i in missing], 'hidden_nan': int((~ok).sum())}
    if color:
        col = shown[color]
        out['c'] = [None if pd.isna(v) else (float(v) if pd.api.types.is_numeric_dtype(col) and col.nunique() > 12 else str(v)) for v in col]
        out['c_numeric'] = bool(pd.api.types.is_numeric_dtype(col) and col.nunique() > 12)
    return json.dumps(out)


def apply(df, xc, yc, zc, edits):
    """Write the hand-made edits {row id: [x, y, z]} into the DataFrame (integers are rounded)."""
    n = 0
    for rid, vals in edits.items():
        key = rid
        if key not in df.index:
            try:
                key = type(df.index[0])(rid)
            except Exception:
                continue
            if key not in df.index:
                continue
        for col, v in zip((xc, yc, zc), vals):
            if pd.api.types.is_integer_dtype(df[col]):
                v = int(round(v))
            df.loc[key, col] = v
        n += 1
    return n


def overlay(df, cols, kind='kmeans', k=3, ids=None):
    """Algorithms run on the three chosen columns of (a sample of) your DataFrame; returns what to draw."""
    X = df[list(cols)].dropna()
    if len(X) > 20000:
        X = X.sample(20000, random_state=0)
    if len(X) < 4:
        return json.dumps({'error': 'not enough rows'})
    A = X.values.astype(float)
    if kind == 'kmeans':
        from sklearn.cluster import KMeans
        km = KMeans(n_clusters=int(k), n_init=3, random_state=0).fit(A)
        return json.dumps({'kind': kind, 'centers': km.cluster_centers_.tolist(), 'sizes': np.bincount(km.labels_).tolist(), 'inertia': float(km.inertia_)})
    if kind == 'plane':
        from sklearn.linear_model import LinearRegression
        lr = LinearRegression().fit(A[:, :2], A[:, 2])
        return json.dumps({'kind': kind, 'w': [float(lr.coef_[0]), float(lr.coef_[1]), float(lr.intercept_)], 'r2': float(lr.score(A[:, :2], A[:, 2]))})
    if kind == 'pca':
        mu = A.mean(axis=0)
        vals, vecs = np.linalg.eigh(np.cov((A - mu).T))
        order = np.argsort(vals)[::-1]
        return json.dumps({'kind': kind, 'mu': mu.tolist(), 'vals': vals[order].tolist(), 'vecs': vecs[:, order].T.tolist()})
    return json.dumps({'error': 'unknown overlay'})


def table(name, n=800, seed=0):
    """A sample of one of the big tables for the Graph Studio: numeric columns, one small category, stable row ids."""
    import dsq_data
    df = dsq_data.load(name)
    part = df.sample(min(int(n), len(df)), random_state=int(seed))
    skip = lambda c: c.lower() in ('id', 'index') or c.lower().endswith('_id') or c.lower().startswith('id_')
    nums = [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c]) and not skip(str(c)) and df[c].nunique() > 2 and df[c].notna().mean() > .9][:5]
    cat = next((str(c) for c in df.columns if df[c].dtype == object and 1 < df[c].nunique() <= 8), None)
    cols = nums + ([cat] if cat else [])
    sub = part[cols]
    rows = []
    for idx, rec in zip(sub.index, sub.to_dict('records')):
        row = {'id': int(idx)}
        for c in cols:
            v = rec[c]
            row[c] = (None if pd.isna(v) else float('%.6g' % v)) if c in nums else str(v)
        rows.append(row)
    rows = [r for r in rows if all(r[c] is not None for c in nums)]
    return json.dumps({'cols': cols, 'nums': nums, 'cat': cat, 'pycols': cols, 'rows': rows})
