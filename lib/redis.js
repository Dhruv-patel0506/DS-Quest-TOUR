'use strict';
/* Redis over REST (Upstash / Vercel Marketplace). Returns null when no storage is configured. */
function redis(env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL, token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cmd = async a => {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(a.map(String)), signal: AbortSignal.timeout(15000) });
    const j = await r.json(); if (j.error) throw new Error('redis: ' + j.error); return j.result;
  };
  return {
    get: k => cmd(['GET', k]), set: (k, v, ex) => (ex ? cmd(['SET', k, v, 'EX', ex]) : cmd(['SET', k, v])), del: k => cmd(['DEL', k]),
    incr: k => cmd(['INCR', k]).then(Number), expire: (k, s) => cmd(['EXPIRE', k, s]), zadd: (k, score, m) => cmd(['ZADD', k, score, m]),
    zrevrange: (k, a, b) => cmd(['ZREVRANGE', k, a, b, 'WITHSCORES']),
  };
}
module.exports = { redis };
