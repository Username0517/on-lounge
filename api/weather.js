// ON-Lounge: today's weather in Beijing, fetched on the server (Vercel) so every visitor only talks to our own site.
// Two free sources without keys: Open-Meteo first, wttr.in as a fallback. The answer is cached for 30 minutes.
const LAT = 39.9042, LON = 116.4074;

function kindFromWmo(c) {
  if (c >= 95) return 'storm';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if (c === 45 || c === 48) return 'fog';
  if (c === 3) return 'cloudy';
  if (c === 1 || c === 2) return 'partly';
  return 'clear';
}
function kindFromWwo(c) {
  if ([200, 386, 389, 392, 395].includes(c)) return 'storm';
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(c)) return 'snow';
  if ([176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(c)) return 'rain';
  if ([143, 248, 260].includes(c)) return 'fog';
  if ([119, 122].includes(c)) return 'cloudy';
  if (c === 116) return 'partly';
  return 'clear';
}
async function getJSON(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'on-lounge-weather' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function fromOpenMeteo() {
  const d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1`);
  const c = d.current || {}, dl = d.daily || {};
  if (c.temperature_2m == null) throw new Error('no data');
  let aqi = null;
  try { const a = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi`); aqi = a.current && a.current.us_aqi != null ? Math.round(a.current.us_aqi) : null; } catch (e) {}
  return { kind: kindFromWmo(+c.weather_code || 0), temp: c.temperature_2m, hi: dl.temperature_2m_max && dl.temperature_2m_max[0], lo: dl.temperature_2m_min && dl.temperature_2m_min[0],
    isDay: c.is_day === 0 ? 0 : 1, wind: c.wind_speed_10m, aqi, src: 'Open-Meteo' };
}
async function fromWttr() {
  const d = await getJSON('https://wttr.in/Beijing?format=j1');
  const c = (d.current_condition || [])[0] || {}, day = (d.weather || [])[0] || {};
  if (c.temp_C == null) throw new Error('no data');
  const hour = +new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hour12: false });
  return { kind: kindFromWwo(+c.weatherCode || 113), temp: +c.temp_C, hi: +day.maxtempC, lo: +day.mintempC, isDay: hour >= 6 && hour < 18 ? 1 : 0, wind: +c.windspeedKmph, aqi: null, src: 'wttr.in' };
}

module.exports = async (req, res) => {
  let data = null;
  for (const src of [fromOpenMeteo, fromWttr]) { try { data = await src(); break; } catch (e) { /* try the next source */ } }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!data) { res.setHeader('Cache-Control', 's-maxage=120'); res.statusCode = 503; res.end(JSON.stringify({ ok: false })); return; }
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.statusCode = 200;
  res.end(JSON.stringify(Object.assign({ ok: true, at: Date.now() }, data)));
};
