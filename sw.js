// ON-Lounge 홈 화면 앱(PWA)용 서비스 워커.
// 규칙: 인터넷이 되면 "항상 서버 것을 먼저" 가져옵니다. 그래야 새로 올린 파일이 바로 반영돼요.
//       인터넷이 끊겼을 때만 마지막으로 받아둔 사본을 보여줍니다. (VPN이 끊길 때 유용)
const CACHE = 'onl-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Supabase 같은 바깥 주소는 절대 건드리지 않아요. 로그인·실시간 통신은 그대로 흘러갑니다.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
