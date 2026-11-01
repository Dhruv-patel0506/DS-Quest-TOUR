'use strict';
/* Minimal SMTP client (no dependencies): implicit TLS on 465 (Gmail: smtp.gmail.com, an App Password) or plain for local tests.
   sendMail({ host, port, secure, user, pass, from, to, subject, text }) -> Promise */
const net = require('net'), tls = require('tls');
const clean = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const enc = s => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=');

function sendMail(o) {
  return new Promise((resolve, reject) => {
    const host = o.host, port = +o.port || 465, secure = o.secure !== false && port !== 25 && port !== 2525 && o.secure !== 0;
    const to = clean(o.to), from = clean(o.from || o.user);
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return reject(new Error('bad recipient'));
    const body = ['From: ' + enc(from.includes('<') ? from : 'DS Quest') + (from.includes('<') ? '' : ' <' + from + '>'), 'To: ' + to, 'Subject: ' + enc(clean(o.subject)), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', 'Date: ' + new Date().toUTCString(), '', (b64(String(o.text || '')).match(/.{1,76}/g) || []).join('\r\n')].join('\r\n');
    const addr = (from.match(/<([^>]+)>/) || [null, from])[1];
    const sock = (secure ? tls.connect : net.connect)({ host, port, servername: host, timeout: 20000 });
    let buf = '', waiting = null, done = false;
    const fail = e => { if (!done) { done = true; try { sock.destroy(); } catch (x) { } reject(e instanceof Error ? e : new Error(String(e))); } };
    sock.setEncoding('utf8');
    sock.on('error', fail); sock.on('timeout', () => fail(new Error('smtp timeout'))); sock.on('close', () => { if (!done) fail(new Error('smtp closed early')); });
    sock.on('data', d => {
      buf += d;
      for (; ;) { /* one complete reply = lines until one with "NNN " */
        const lines = buf.split('\r\n'); if (lines.length < 2) return; let end = -1; for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i])) { end = i; break; }
        if (end < 0) return; const reply = lines.slice(0, end + 1), code = +reply[end].slice(0, 3); buf = lines.slice(end + 1).join('\r\n'); const w = waiting; waiting = null; if (w) w(code, reply.join('\n'));
      }
    });
    const expect = () => new Promise(res => { waiting = (c, t) => res({ c, t }); });
    const send = async (line, ok) => { sock.write(line + '\r\n'); const r = await expect(); if (!ok.includes(r.c)) throw new Error('smtp ' + r.c + ' after ' + line.split(' ')[0] + ': ' + r.t.slice(0, 120)); return r; };
    (async () => {
      const first = await expect(); if (first.c !== 220) throw new Error('smtp greeting ' + first.c);
      await send('EHLO dsquest.local', [250]);
      if (o.user) { await send('AUTH LOGIN', [334]); await send(b64(o.user), [334]); await send(b64(o.pass || ''), [235]); }
      await send('MAIL FROM:<' + addr + '>', [250]); await send('RCPT TO:<' + to + '>', [250, 251]); await send('DATA', [354]);
      sock.write(body.replace(/^\./gm, '..') + '\r\n.\r\n'); const r = await expect(); if (r.c !== 250) throw new Error('smtp data ' + r.c);
      sock.write('QUIT\r\n'); done = true; sock.end(); resolve(true);
    })().catch(fail);
  });
}
const mailConfig = env => (env.SMTP_HOST && env.SMTP_USER ? { host: env.SMTP_HOST, port: env.SMTP_PORT || 465, secure: env.SMTP_SECURE !== '0', user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.MAIL_FROM || ('DS Quest <' + env.SMTP_USER + '>') } : null);
module.exports = { sendMail, mailConfig };
