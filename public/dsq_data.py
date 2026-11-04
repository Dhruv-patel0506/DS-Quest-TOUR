"""Dhruv Patel Academy datasets.

Six realistic tables of 50,000 to 500,000 rows, generated on demand from a seed.
The generator is the pristine copy: every call to load() rebuilds the table from scratch, so nothing you do to a
DataFrame can damage the original. Different learners get different seeds, so everyone works on different numbers.

    from dsq_data import load
    df = load('retail')                      # clean-ish table (some natural gaps, such as unreviewed orders)
    df = load('retail', messy=True)          # the same table with duplicates, blanks, sentinels, bad casing
    df = load('retail', n=500_000)           # bigger
"""
import zlib
import numpy as np
import pandas as pd

SEED, DEFAULT_N = 0, 100_000   # overridden by the file dsq_cfg.py that the app writes next to this module


def _cfg():
    """(seed, rows) for this learner. Read from the file every call so a change of size takes effect at once."""
    try:
        g = {}
        exec(open('dsq_cfg.py').read(), g)
        return int(g.get('SEED', SEED)), int(g.get('DEFAULT_N', DEFAULT_N))
    except Exception:
        return SEED, DEFAULT_N

_CACHE = {}


def _rng(name, seed, salt=0):
    return np.random.default_rng([int(seed) & 0x7FFFFFFF, zlib.crc32(name.encode()), salt])


def _pick(r, items, n, p=None):
    items = np.array(items, dtype=object)
    return items[r.choice(len(items), n, p=None if p is None else np.asarray(p) / np.sum(p))]


def _when(r, n, start, days, hour_w=None, season=0.0, weekend=0.0):
    """Timestamps over `days` days from `start`; optional yearly season, weekend lift and hour-of-day profile."""
    d = np.arange(days)
    dt = pd.Timestamp(start) + pd.to_timedelta(d, unit='D')
    w = 1 + season * np.sin(2 * np.pi * (dt.dayofyear.values - 80) / 365.25) + weekend * (dt.dayofweek.values >= 5)
    di = r.choice(days, n, p=w / w.sum())
    hw = np.ones(24) if hour_w is None else np.asarray(hour_w, float)
    hr = r.choice(24, n, p=hw / hw.sum())
    sec = hr * 3600 + r.integers(0, 3600, n)
    return pd.Timestamp(start) + pd.to_timedelta(di, unit='D') + pd.to_timedelta(sec, unit='s')


_HOURS_DAY = [1, .6, .4, .3, .3, .5, 1, 2, 3, 3.5, 3.5, 3.6, 3.8, 3.5, 3.4, 3.4, 3.6, 4, 4.2, 4, 3.2, 2.4, 1.8, 1.3]


# ------------------------------------------------------------------ retail
def _retail(r, n):
    cats = ['Electronics', 'Home', 'Fashion', 'Grocery', 'Sports', 'Books', 'Beauty']
    base = np.array([190, 65, 48, 14, 75, 19, 30.0])
    ci = r.choice(7, n, p=np.array([.13, .17, .2, .23, .1, .09, .08]))
    region = _pick(r, ['North', 'South', 'East', 'West', 'Central'], n, [.22, .2, .2, .23, .15])
    reg_mult = pd.Series({'North': 1.0, 'South': .96, 'East': 1.03, 'West': 1.08, 'Central': .92})
    price = np.round(base[ci] * r.lognormal(0, .28, n) * reg_mult[region].values, 2)
    qty = 1 + r.poisson(np.where(ci == 3, 2.2, .7), n)
    disc = r.choice([0, .05, .1, .15, .2, .3], n, p=[.45, .15, .17, .1, .09, .04])
    ts = _when(r, n, '2023-01-01', 731, _HOURS_DAY, season=.35, weekend=.25)
    month = ts.month.values
    qty = np.where(np.isin(month, [11, 12]), qty + r.binomial(1, .35, n), qty)
    revenue = np.round(qty * price * (1 - disc), 2)
    p_ret = np.clip(.035 + .06 * (ci == 2) + .03 * (ci == 0) + .25 * disc, 0, .6)
    returned = r.binomial(1, p_ret)
    rating = np.clip(np.round(r.normal(4.25 - 1.5 * returned - 2 * disc, .75)), 1, 5)
    rating = np.where(r.random(n) < .27, np.nan, rating)
    df = pd.DataFrame({
        'order_id': np.arange(n) + 100000, 'order_time': ts, 'customer_id': (r.pareto(1.4, n) * 900).astype(int) % max(n // 7, 50) + 1,
        'region': region, 'category': np.array(cats, dtype=object)[ci], 'qty': qty, 'unit_price': price, 'discount': disc,
        'revenue': revenue, 'payment': _pick(r, ['card', 'upi', 'cod', 'wallet'], n, [.46, .32, .14, .08]),
        'returned': returned, 'rating': rating})
    return df.sort_values('order_time', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ rides
def _rides(r, n):
    city = _pick(r, ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Ahmedabad', 'Chennai'], n, [.24, .23, .2, .12, .09, .12])
    ts = _when(r, n, '2024-01-01', 366, [1.2, .8, .6, .5, .6, 1.2, 2.4, 4.2, 4.6, 3, 2.2, 2.4, 2.8, 2.5, 2.4, 2.8, 3.6, 4.8, 5, 4.2, 3.4, 2.8, 2.2, 1.6], season=.1, weekend=.15)
    hr = ts.hour.values
    rush = np.isin(hr, [8, 9, 18, 19, 20]).astype(float)
    dist = np.clip(r.lognormal(1.6, .6, n), .6, 60)
    rain = r.binomial(1, np.where(np.isin(ts.month.values, [6, 7, 8, 9]), .35, .06))
    speed = np.clip(r.normal(26 - 8 * rush - 4 * rain, 4, n), 7, 55)
    dur = np.round(dist / speed * 60 + r.gamma(2, 1.5, n), 1)
    surge = np.round(np.clip(1 + .35 * rush + .3 * rain + r.choice([0, 0, 0, .25, .5], n), 1, 3), 2)
    fare = np.round((35 + 11.5 * dist + .9 * dur) * surge * r.normal(1, .03, n), 2)
    cancelled = r.binomial(1, np.clip(.05 + .08 * (surge - 1) + .03 * rain, 0, .5))
    df = pd.DataFrame({'trip_id': np.arange(n) + 5_000_000, 'requested_at': ts, 'city': city, 'distance_km': np.round(dist, 2), 'duration_min': dur,
                       'surge': surge, 'rain': rain, 'fare': fare, 'driver_rating': np.clip(np.round(r.normal(4.6 - .15 * rain - .1 * (surge > 1.4), .35, n), 1), 1, 5),
                       'payment': _pick(r, ['cash', 'upi', 'card', 'wallet'], n, [.3, .45, .17, .08]), 'cancelled': cancelled})
    df.loc[df.cancelled == 1, ['duration_min', 'fare']] = np.nan
    return df.sort_values('requested_at', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ bank
def _bank(r, n):
    ts = _when(r, n, '2024-01-01', 366, [2.5, 2, 1.8, 1.6, 1.6, 1.8, 2, 2.6, 3.4, 4, 4.2, 4.4, 4.6, 4.4, 4.2, 4.2, 4.4, 4.6, 4.8, 4.4, 3.8, 3.4, 3.2, 2.9], weekend=.1)
    cats = ['grocery', 'fuel', 'dining', 'travel', 'electronics', 'utilities', 'pharmacy', 'luxury']
    ci = r.choice(8, n, p=np.array([.24, .13, .17, .08, .09, .17, .08, .04]))
    scale = np.array([900, 1800, 700, 6500, 7800, 2200, 500, 14000.0])
    amount = np.round(scale[ci] * r.lognormal(0, .7, n), 2)
    channel = _pick(r, ['pos', 'online', 'atm', 'app'], n, [.4, .32, .08, .2])
    foreign = r.binomial(1, .04, n)
    night = np.isin(ts.hour.values, [0, 1, 2, 3, 4]).astype(int)
    z = -6.2 + 2.4 * foreign + 1.3 * night + .9 * (channel == 'online') + .00009 * amount + .7 * (ci == 7) + .5 * (ci == 4)
    fraud = r.binomial(1, 1 / (1 + np.exp(-z)))
    df = pd.DataFrame({'txn_id': np.arange(n) + 9_000_000, 'ts': ts, 'account_id': r.integers(1, max(n // 25, 100), n), 'amount': amount,
                       'merchant_category': np.array(cats, dtype=object)[ci], 'channel': channel, 'is_foreign': foreign, 'is_night': night, 'is_fraud': fraud})
    return df.sort_values('ts', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ clicks
def _clicks(r, n):
    ts = _when(r, n, '2024-03-01', 120, _HOURS_DAY, weekend=.2)
    source = _pick(r, ['organic', 'ads', 'email', 'social', 'direct', 'referral'], n, [.3, .22, .1, .14, .16, .08])
    device = _pick(r, ['mobile', 'desktop', 'tablet'], n, [.62, .32, .06])
    page = _pick(r, ['home', 'search', 'product', 'cart', 'checkout', 'blog'], n, [.22, .18, .3, .1, .05, .15])
    pages = 1 + r.poisson(np.where(page == 'blog', 1.2, 3.2), n)
    sess = np.round(np.clip(r.gamma(2.2, 60, n) + pages * 12, 3, 3600), 0)
    sm = pd.Series({'organic': 0, 'ads': -.15, 'email': .6, 'social': -.35, 'direct': .45, 'referral': .2})
    z = -4.2 + sm[source].values + .55 * (device == 'desktop') + .22 * pages + .0016 * sess + 1.3 * np.isin(page, ['cart', 'checkout'])
    conv = r.binomial(1, 1 / (1 + np.exp(-z)))
    df = pd.DataFrame({'event_id': np.arange(n) + 1, 'ts': ts, 'user_id': r.integers(1, max(n // 4, 100), n), 'landing_page': page, 'device': device,
                       'source': source, 'pages_viewed': pages, 'session_sec': sess, 'converted': conv})
    return df.sort_values('ts', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ sensors
def _sensors(r, n):
    machines = max(n // 2000, 25)
    mid = r.integers(1, machines + 1, n)
    mbias = r.normal(0, 3, machines + 1)
    ts = _when(r, n, '2024-05-01', 90)
    age = np.clip(((ts - pd.Timestamp('2024-05-01')).days.values) / 90 + r.normal(0, .1, n), 0, 1.2)
    temp = np.round(68 + mbias[mid] + 7 * age + r.normal(0, 3.2, n), 2)
    vib = np.round(np.clip(2.1 + .9 * age + .08 * (temp - 68) + r.gamma(2, .25, n), .2, 14), 3)
    pres = np.round(r.normal(101, 4.2, n) - .5 * age, 2)
    rpm = np.round(r.normal(1480, 30, n) - 40 * age + r.normal(0, 8, n), 0)
    z = -7.2 + .12 * (temp - 68) + .85 * (vib - 2.1) + .45 * age
    fail = r.binomial(1, 1 / (1 + np.exp(-z)))
    status = np.where(vib > 4.6, 'fault', np.where((vib > 3.4) | (temp > 82), 'warning', 'ok'))
    df = pd.DataFrame({'ts': ts, 'machine_id': mid, 'temperature_c': temp, 'vibration_mm_s': vib, 'pressure_kpa': pres, 'rpm': rpm, 'status': status, 'failure_within_24h': fail})
    return df.sort_values('ts', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ social
def _social(r, n):
    plat = _pick(r, ['Instagram', 'LinkedIn', 'YouTube', 'X', 'TikTok'], n, [.3, .22, .12, .14, .22])
    fmt_all = {'Instagram': ['reel', 'carousel', 'image', 'story'], 'LinkedIn': ['text', 'carousel', 'image', 'video'], 'YouTube': ['short', 'long_video', 'community'],
               'X': ['text', 'thread', 'image'], 'TikTok': ['video', 'photo_mode']}
    fmt = np.empty(n, dtype=object)
    for p, opts in fmt_all.items():
        m = plat == p
        fmt[m] = _pick(r, opts, int(m.sum()))
    ts = _when(r, n, '2024-01-01', 366, [.4, .3, .2, .2, .3, .6, 1.4, 2.6, 3, 2.4, 2, 2.2, 3, 2.4, 2, 2.2, 2.6, 3, 3.6, 4.2, 4.4, 3.6, 2.2, 1], weekend=-.1)
    hr = ts.hour.values
    followers = np.round(np.exp(r.normal(8.6, 1.3, n))).astype(int)
    hook = np.clip(np.round(r.normal(62, 24, n)), 8, 180).astype(int)
    cap = np.clip(np.round(r.lognormal(5, .7, n)), 10, 2200).astype(int)
    tags = np.clip(r.poisson(np.where(plat == 'Instagram', 8, np.where(plat == 'LinkedIn', 3, 4)), n), 0, 30)
    cta = r.binomial(1, .45, n)
    collab = r.binomial(1, .08, n)
    fmt_lift = pd.Series({'reel': .55, 'carousel': .45, 'image': .0, 'story': -.4, 'text': -.1, 'video': .3, 'short': .5, 'long_video': .1, 'community': -.5, 'thread': .25, 'photo_mode': -.1})
    plat_base = pd.Series({'Instagram': .028, 'LinkedIn': .022, 'YouTube': .02, 'X': .012, 'TikTok': .045})
    peak = np.exp(-((hr - 19.5) ** 2) / 18)
    hook_fx = np.exp(-((hook - 62) ** 2) / (2 * 28 ** 2))
    tag_fx = 1 - ((np.minimum(tags, 12) - 7) ** 2) / 120
    lift = np.exp(fmt_lift[fmt].values + .5 * peak + .35 * hook_fx + .25 * tag_fx + .3 * cta + .4 * collab)
    reach = np.clip(followers * r.lognormal(-.2, .75, n) * (.4 + .9 * peak) * (1 + .6 * (fmt_lift[fmt].values > .3)), 20, None)
    impressions = np.round(reach).astype(int)
    er = np.clip(plat_base[plat].values * lift * r.lognormal(0, .35, n), 0, .4)
    interactions = r.binomial(impressions, er)
    likes = np.round(interactions * .74).astype(int)
    comments = np.round(interactions * .08).astype(int)
    shares = np.round(interactions * .08).astype(int)
    saves = np.maximum(interactions - likes - comments - shares, 0)
    df = pd.DataFrame({'post_id': np.arange(n) + 1, 'platform': plat, 'posted_at': ts, 'format': fmt, 'hook_chars': hook, 'caption_chars': cap, 'hashtags': tags,
                       'has_cta': cta, 'is_collab': collab, 'followers': followers, 'impressions': impressions, 'likes': likes, 'comments': comments, 'shares': shares, 'saves': saves})
    df['engagement_rate'] = np.round((likes + comments + shares + saves) / np.maximum(impressions, 1) * 100, 3)
    return df.sort_values('posted_at', kind='stable').reset_index(drop=True)


# ------------------------------------------------------------------ catalogue
META = {
    'retail': dict(fn=_retail, title='Online retail orders', domain='Retail analytics', blurb='Two years of orders from a multi-category online shop: price, quantity, discount, region, payment, returns and reviews.',
                   cols={'order_id': 'unique order number', 'order_time': 'when the order was placed', 'customer_id': 'who ordered (repeat customers exist)', 'region': 'sales region', 'category': 'product category',
                         'qty': 'units in the order', 'unit_price': 'price per unit', 'discount': 'discount fraction, 0 to 0.3', 'revenue': 'qty x unit_price x (1 - discount)', 'payment': 'payment method',
                         'returned': '1 if the order was returned', 'rating': 'review stars 1-5 (blank when the customer did not review)'},
                   metric='revenue', metric2='unit_price', cats=['region', 'category', 'payment'], date='order_time', target='returned', idcol='order_id', numeric=['revenue', 'unit_price', 'qty', 'discount'],
                   mess=dict(nan=['rating', 'unit_price'], sentinel=('qty', -999), case=['region'], dup=.004), nulls_col='rating'),
    'rides': dict(fn=_rides, title='Ride-hailing trips', domain='Operations / mobility', blurb='A year of trips in six cities: distance, duration, surge pricing, rain, fares, ratings and cancellations.',
                  cols={'trip_id': 'unique trip number', 'requested_at': 'request time', 'city': 'city', 'distance_km': 'trip distance', 'duration_min': 'trip time (blank if cancelled)', 'surge': 'price multiplier 1.0-3.0',
                        'rain': '1 if it was raining', 'fare': 'amount charged (blank if cancelled)', 'driver_rating': 'driver rating 1-5', 'payment': 'payment method', 'cancelled': '1 if the ride was cancelled'},
                  metric='fare', metric2='distance_km', cats=['city', 'payment'], date='requested_at', target='cancelled', idcol='trip_id', numeric=['fare', 'distance_km', 'duration_min', 'surge'],
                  mess=dict(nan=['driver_rating', 'distance_km'], sentinel=('driver_rating', -1), case=['city'], dup=.003), nulls_col='fare'),
    'bank': dict(fn=_bank, title='Card transactions and fraud', domain='Finance / risk', blurb='A year of card transactions where about 1% are fraud: a classic imbalanced classification problem.',
                 cols={'txn_id': 'unique transaction id', 'ts': 'time of the transaction', 'account_id': 'account', 'amount': 'amount in rupees', 'merchant_category': 'merchant type', 'channel': 'pos / online / atm / app',
                       'is_foreign': '1 if the card was used abroad', 'is_night': '1 if between 00:00 and 05:00', 'is_fraud': '1 if confirmed fraud'},
                 metric='amount', metric2='amount', cats=['merchant_category', 'channel'], date='ts', target='is_fraud', idcol='txn_id', numeric=['amount'],
                 mess=dict(nan=['amount'], sentinel=('amount', -999), case=['channel'], dup=.004), nulls_col='amount'),
    'clicks': dict(fn=_clicks, title='Website sessions and conversion', domain='Product / growth', blurb='Four months of web sessions with traffic source, device, landing page, depth and whether the visitor bought.',
                   cols={'event_id': 'unique session id', 'ts': 'session start', 'user_id': 'visitor', 'landing_page': 'first page', 'device': 'device type', 'source': 'traffic source', 'pages_viewed': 'pages seen',
                         'session_sec': 'time on site (seconds)', 'converted': '1 if the visitor purchased'},
                   metric='session_sec', metric2='pages_viewed', cats=['source', 'device', 'landing_page'], date='ts', target='converted', idcol='event_id', numeric=['session_sec', 'pages_viewed'],
                   mess=dict(nan=['session_sec'], sentinel=('pages_viewed', -999), case=['device'], dup=.004), nulls_col='session_sec'),
    'sensors': dict(fn=_sensors, title='Factory machine telemetry', domain='IoT / predictive maintenance', blurb='Three months of readings from a fleet of machines; the goal is to predict failure in the next 24 hours.',
                    cols={'ts': 'reading time', 'machine_id': 'which machine', 'temperature_c': 'temperature in C', 'vibration_mm_s': 'vibration in mm/s', 'pressure_kpa': 'pressure in kPa', 'rpm': 'rotation speed',
                          'status': 'ok / warning / fault', 'failure_within_24h': '1 if the machine failed within 24 hours'},
                    metric='temperature_c', metric2='vibration_mm_s', cats=['status', 'machine_id'], date='ts', target='failure_within_24h', idcol=None, numeric=['temperature_c', 'vibration_mm_s', 'pressure_kpa', 'rpm'],
                    mess=dict(nan=['pressure_kpa', 'rpm'], sentinel=('temperature_c', -999), case=['status'], dup=.004), nulls_col='pressure_kpa'),
    'social': dict(fn=_social, title='Social media posts and engagement', domain='Content creation / marketing', blurb='A year of posts across five platforms: format, hook length, hashtags, posting hour and the engagement they earned.',
                   cols={'post_id': 'unique post', 'platform': 'platform', 'posted_at': 'publish time', 'format': 'reel, carousel, text ...', 'hook_chars': 'length of the first line', 'caption_chars': 'caption length',
                         'hashtags': 'number of hashtags', 'has_cta': '1 if the post asks for an action', 'is_collab': '1 if posted with a collaborator', 'followers': 'account size at the time',
                         'impressions': 'times shown', 'likes': 'likes', 'comments': 'comments', 'shares': 'shares', 'saves': 'saves', 'engagement_rate': '(likes+comments+shares+saves) / impressions x 100'},
                   metric='engagement_rate', metric2='impressions', cats=['platform', 'format'], date='posted_at', target='has_cta', idcol='post_id', numeric=['engagement_rate', 'impressions', 'likes', 'hook_chars'],
                   mess=dict(nan=['impressions', 'hook_chars'], sentinel=('hashtags', -999), case=['platform'], dup=.004), nulls_col='impressions'),
}


def _messy(df, r, m):
    df = df.copy()
    n = len(df)
    for c in m['nan']:
        k = r.random(n) < .035
        if df[c].dtype.kind in 'iu':
            df[c] = df[c].astype(float)
        df.loc[k, c] = np.nan
    col, val = m['sentinel']
    if df[col].dtype.kind in 'iu':
        df[col] = df[col].astype(float)
    df.loc[r.random(n) < .012, col] = val
    for c in m['case']:
        k = r.random(n) < .06
        df.loc[k, c] = df.loc[k, c].astype(str).str.lower() + ' '
        k2 = r.random(n) < .04
        df.loc[k2, c] = df.loc[k2, c].astype(str).str.upper()
    dups = df.sample(int(n * m['dup']), random_state=int(r.integers(1, 10 ** 6)))
    return pd.concat([df, dups], ignore_index=True).sample(frac=1, random_state=int(r.integers(1, 10 ** 6))).reset_index(drop=True)


def load(name, n=None, seed=None, messy=False):
    """A fresh DataFrame every call (rebuilt from the seed, so the original can never be damaged)."""
    if name not in META:
        raise KeyError("unknown dataset %r - choose one of %s" % (name, sorted(META)))
    cs, cn = _cfg()
    n = int(n or cn)
    seed = cs if seed is None else seed
    key = (name, n, seed)
    if key not in _CACHE:
        _CACHE.clear()
        _CACHE[key] = META[name]['fn'](_rng(name, seed), n)
    df = _CACHE[key]
    if messy:
        df = _messy(df, _rng(name, seed, 7), META[name]['mess'])
    return df.copy()


def datasets():
    return {k: dict(title=v['title'], domain=v['domain'], blurb=v['blurb'], cols=v['cols'], target=v['target']) for k, v in META.items()}


def summary(name, n=None, seed=None):
    """What the Datasets page shows: shape, columns with types and gaps, a few rows."""
    import json
    df = load(name, n, seed)
    m = META[name]
    cols = []
    for c in df.columns:
        s = df[c]
        ex = s.dropna().iloc[0] if s.notna().any() else ''
        cols.append(dict(name=c, dtype=str(s.dtype), nulls=int(s.isna().sum()), example=str(ex)[:24], desc=m['cols'].get(c, '')))
    head = [[str(x)[:19] for x in row] for row in df.head(8).values.tolist()]
    return json.dumps(dict(rows=len(df), cols=cols, head=head, mb=round(df.memory_usage(deep=True).sum() / 1e6, 1), target=m['target']))


# ------------------------------------------------------------------ practice tasks
def _num(x):
    try:
        return float(x)
    except Exception:
        return None


def _tasks_for(name, df, dm, r, level):
    """Candidate task templates for one dataset. Each returns (q, answer, traps, hint, solution) built from the learner's own data."""
    m = META[name]
    metric, m2, cats, date, target = m['metric'], m['metric2'], m['cats'], m['date'], m['target']
    cat = cats[int(r.integers(len(cats)))]
    cat_vals = df[cat].value_counts().index.tolist()
    v = cat_vals[int(r.integers(min(len(cat_vals), 8)))]
    vq = repr(v) if isinstance(v, str) else repr(int(v))
    out = []

    def add(key, lvl, title, q, ans, traps=(), hint='', sol='', kind='number', df_name=name, use_messy=False):
        out.append(dict(key=key, level=lvl, title=title, q=q, answer=ans, traps=list(traps), hint=hint, solution=sol, kind=kind, messy=use_messy))

    sub = df[df[cat] == v]
    add('mean_cat', 1, 'Average for one group', f"What is the average <code>{metric}</code> for rows where <code>{cat}</code> is <code>{vq}</code>? Round to 2 decimals.",
        round(float(sub[metric].mean()), 2),
        [(round(float(sub[metric].median()), 2), 'That is the median. The task asks for the mean.'), (round(float(df[metric].mean()), 2), 'That is the average of ALL rows. Filter to the group first.')],
        'df[df[col] == value][metric].mean()', f"answer = round(df[df['{cat}'] == {vq}]['{metric}'].mean(), 2)")
    thr = round(float(df[metric].quantile(.75)), 2)
    c1 = int(((df[cat] == v) & (df[metric] > thr)).sum())
    add('count_filter', 1, 'Count with two conditions', f"How many rows have <code>{cat}</code> equal to <code>{vq}</code> AND <code>{metric}</code> greater than <code>{thr}</code>?", c1,
        [(int((df[cat] == v).sum()), 'That counts every row in the group; you also need the second condition.'), (int(((df[cat] == v) & (df[metric] >= thr)).sum()), 'You used >= where the task says "greater than".')],
        'combine conditions with & and put each in parentheses', f"answer = int(((df['{cat}'] == {vq}) & (df['{metric}'] > {thr})).sum())")
    g = df.groupby(cat)[metric]
    top = g.sum().idxmax()
    add('top_sum', 1, 'Which group is biggest', f"Which value of <code>{cat}</code> has the highest TOTAL <code>{metric}</code>? Answer with the value as text.", str(top),
        [(str(g.mean().idxmax()), 'That group has the highest AVERAGE, not the highest total.'), (str(df[cat].value_counts().idxmax()), 'That group has the most rows, not the highest total.')],
        'groupby(cat)[metric].sum().idxmax()', f"answer = df.groupby('{cat}')['{metric}'].sum().idxmax()", kind='text')
    rate = float(df[target].mean())
    add('share', 1, 'A percentage', f"What percentage of rows have <code>{target}</code> equal to 1? Give it as a number from 0 to 100, rounded to 2 decimals.", round(rate * 100, 2),
        [(round(rate, 4), 'That is a fraction (0 to 1). Multiply by 100 for a percentage.')], 'the mean of a 0/1 column is the share of ones', f"answer = round(df['{target}'].mean() * 100, 2)")
    nums = [c for c in m['numeric'] if c != metric]
    if nums:
        c2 = nums[int(r.integers(len(nums)))]
        pe = float(df[metric].corr(df[c2])); sp = float(df[metric].rank().corr(df[c2].rank()))
        add('corr', 2, 'Correlation', f"What is the Pearson correlation between <code>{metric}</code> and <code>{c2}</code>? Round to 3 decimals.", round(pe, 3),
            [(round(sp, 3), 'That is the Spearman (rank) correlation. Pearson is the default in pandas.')], 'Series.corr()', f"answer = round(df['{metric}'].corr(df['{c2}']), 3)")
    d = df[date]
    mon = df.groupby(d.dt.month)[metric].sum().idxmax()
    add('month_peak', 2, 'Seasonality', f"Using <code>{date}</code>, which calendar month (1 to 12, summed over all years) has the highest total <code>{metric}</code>?", int(mon),
        [(int(d.dt.month.value_counts().idxmax()), 'That month has the most rows, not the highest total.')], 'df[date].dt.month then groupby', f"answer = int(df.groupby(df['{date}'].dt.month)['{metric}'].sum().idxmax())")
    rt = df.groupby(cat)[target].mean()
    add('best_rate', 2, 'Which group has the highest rate', f"Which value of <code>{cat}</code> has the highest average <code>{target}</code> (the highest rate)? Answer with the value.", str(rt.idxmax()),
        [(str(df.groupby(cat)[target].sum().idxmax()), 'That group has the most positives in total, but a different RATE (mean).')], 'groupby(cat)[target].mean().idxmax()', f"answer = df.groupby('{cat}')['{target}'].mean().idxmax()", kind='text')
    q1, q3 = df[metric].quantile([.25, .75]); iqr = q3 - q1
    hi = int((df[metric] > q3 + 1.5 * iqr).sum()); z3 = int(((df[metric] - df[metric].mean()) / df[metric].std() > 3).sum())
    add('iqr', 2, 'Outliers by the IQR rule', f"How many rows have <code>{metric}</code> ABOVE the upper IQR fence (Q3 + 1.5 x IQR)? Use pandas quantile(0.25) and quantile(0.75).", hi,
        [(z3, 'You used a z-score above 3. The task says the IQR fence.')], 'q1, q3 = ...quantile(.25), quantile(.75)', f"q1, q3 = df['{metric}'].quantile([.25, .75])\nanswer = int((df['{metric}'] > q3 + 1.5 * (q3 - q1)).sum())")
    p90 = round(float(df[metric].quantile(.9)), 2)
    add('p90', 1, 'A percentile', f"What is the 90th percentile of <code>{metric}</code>? Round to 2 decimals.", p90, [(round(float(df[metric].max()), 2), 'That is the maximum, not the 90th percentile.'), (round(float(df[metric].mean()), 2), 'That is the mean.')],
        'quantile(0.9)', f"answer = round(df['{metric}'].quantile(.9), 2)")
    # cleaning tasks (messy copy)
    mm = load(name, len(df), None, messy=True)
    ncol = m['nulls_col']
    add('nulls', 1, 'Count the gaps', f"Load the table with <code>load('{name}', messy=True)</code>. How many values are missing (NaN) in <code>{ncol}</code>?", int(mm[ncol].isna().sum()),
        [(int((mm[ncol] == 0).sum()), 'Those are zeros, not missing values.')], 'isna().sum()', f"answer = int(df['{ncol}'].isna().sum())", use_messy=True)
    add('dups', 2, 'Exact duplicate rows', f"With <code>messy=True</code>, how many rows are exact duplicates of an EARLIER row (keep the first copy)?", int(mm.duplicated().sum()),
        [(int(mm.duplicated(keep=False).sum()), 'keep=False marks every copy, including the first. The task asks for the extra copies only.')], 'df.duplicated().sum()', "answer = int(df.duplicated().sum())", use_messy=True)
    col, val = m['mess']['sentinel']
    clean_mean = round(float(mm[col].replace(val, np.nan).mean()), 3)
    add('sentinel', 2, 'A sentinel value', f"In the messy table, <code>{col}</code> uses <code>{val}</code> to mean 'unknown'. After turning {val} into NaN, what is the mean of <code>{col}</code>? Round to 3 decimals.", clean_mean,
        [(round(float(mm[col].mean()), 3), f'That average still includes the {val} placeholders, which drags it down.')], f"replace({val}, np.nan) then mean()",
        f"import numpy as np\nanswer = round(df['{col}'].replace({val}, np.nan).mean(), 3)", use_messy=True)
    cc = m['mess']['case'][0]
    norm = mm[cc].astype(str).str.strip().str.lower().nunique()
    add('casefix', 2, 'Inconsistent text', f"In the messy table, <code>{cc}</code> has inconsistent spelling (case and spaces). After <code>.str.strip().str.lower()</code>, how many DISTINCT values does it have?", int(norm),
        [(int(mm[cc].nunique()), 'That is the count before cleaning; the variants still count as different values.')], 'str.strip().str.lower().nunique()', f"answer = df['{cc}'].str.strip().str.lower().nunique()", use_messy=True)
    if level >= 3:
        day = df.set_index(date)[metric].resample('D').sum()
        roll = round(float(day.rolling(7).mean().max()), 2)
        add('rolling', 3, 'Rolling window (flagship)', f"Sum <code>{metric}</code> per calendar day (use <code>set_index('{date}').resample('D')</code>), then take the 7-day rolling mean. What is its MAXIMUM? Round to 2 decimals.", roll,
            [(round(float(day.max()), 2), 'That is the best single day. The task asks for the best 7-day rolling average.')], 'resample then rolling(7).mean().max()',
            f"day = df.set_index('{date}')['{metric}'].resample('D').sum()\nanswer = round(day.rolling(7).mean().max(), 2)")
        tot = df.groupby(cat)[metric].sum().sort_values(ascending=False)
        share3 = round(float(tot.head(3).sum() / tot.sum() * 100), 2)
        add('top3share', 3, 'Concentration (flagship)', f"What share (0 to 100, 2 decimals) of total <code>{metric}</code> comes from the THREE biggest values of <code>{cat}</code>?", share3,
            [(round(float(tot.iloc[0] / tot.sum() * 100), 2), 'That is the share of only the single biggest group.')], 'groupby sum, sort, head(3)',
            f"t = df.groupby('{cat}')['{metric}'].sum().sort_values(ascending=False)\nanswer = round(t.head(3).sum() / t.sum() * 100, 2)")
    return out


def _pick_task(name, seed, k, tier='standard', n=None):
    n = int(n or _cfg()[1])
    df = load(name, n, seed)
    r = _rng(name, seed, 1000 + int(k))
    level = 3 if tier == 'flagship' else 2
    cand = [t for t in _tasks_for(name, df, None, r, level) if t['level'] <= level]
    if tier == 'flagship':
        cand = [t for t in cand if t['level'] >= 2] or cand
    return cand[int(r.integers(len(cand)))]


def task_public(name, seed, k, tier='standard', n=None):
    import json
    t = _pick_task(name, seed, k, tier, n)
    starter = "from dsq_data import load\n\ndf = load('%s'%s%s)\n\nanswer = ...   # put your final answer here\nprint(answer)" % (name, ', messy=True' if t['messy'] else '', ', n=%d' % int(n) if n else '')
    return json.dumps(dict(key=t['key'], title=t['title'], q=t['q'], level=t['level'], hint=t['hint'], kind=t['kind'], messy=t['messy'], starter=starter, solution=t['solution']))


def judge(name, seed, k, tier, n, answer, check):
    """Compare the learner's `answer` with the reference and explain a miss."""
    t = _pick_task(name, seed, k, tier, n)
    exp = t['answer']
    if answer is Ellipsis or answer is None:
        return check(False, 'Set the variable answer to your result.', 'Replace the ... after answer = with your calculation.')
    if hasattr(answer, 'item') and getattr(answer, 'ndim', 1) == 0:
        answer = answer.item()
    if hasattr(answer, 'shape') or isinstance(answer, (list, tuple, dict, set)):
        if hasattr(answer, 'shape') and answer.shape == (1,):
            answer = answer.iloc[0] if hasattr(answer, 'iloc') else answer[0]
        else:
            return check(False, 'answer should be a single value, not a table or list.', 'Reduce it to one number or one name, for example with .iloc[0], .idxmax() or .item().')
    if t['kind'] == 'text':
        a, e = str(answer).strip().lower(), str(exp).strip().lower()
        if a == e:
            return check(True, 'correct: ' + str(exp))
        for tv, why in t['traps']:
            if a == str(tv).strip().lower():
                return check(False, 'Not quite - you answered %s.' % answer, why)
        return check(False, 'Not quite - you answered %s.' % answer, 'Print the table you grouped and look at the top rows before choosing.')
    a = _num(answer)
    if a is None:
        return check(False, 'The answer should be a number, you gave %r.' % (answer,), 'Check what your last line produces.')
    tol = max(0.0105, abs(exp) * 0.0006)
    if abs(a - exp) <= tol:
        return check(True, 'correct: %s' % exp)
    for tv, why in t['traps']:
        if abs(a - tv) <= max(0.0105, abs(tv) * 0.0006):
            return check(False, 'Not quite - %s is a plausible but wrong route.' % answer, why)
    if exp and abs(a / exp - 100) < .5 or exp and abs(a / exp - .01) < .0005:
        return check(False, 'Off by a factor of 100.', 'Percentage vs fraction: multiply or divide by 100.')
    if exp and abs(a - exp) / abs(exp) < .05:
        return check(False, 'Close (%s) but not exact.' % answer, 'Check rounding, the filter boundary (> vs >=) and whether blanks are included.')
    return check(False, 'Different from the expected value.', 'Print the intermediate table. Is the filter right? Is the right column used? ' + (t['hint'] or ''))
