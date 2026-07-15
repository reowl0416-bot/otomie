/*
 * sw.js — オフライン用 Service Worker
 *
 * 方針：ネットワーク優先・失敗時キャッシュ。
 *  - オンライン時は常に最新を取りに行く（GitHub Pages の更新がすぐ反映される）
 *  - オフライン時（機内・電波なしのレッスン先など）はキャッシュから起動する
 * 外部送信はしない。キャッシュするのは自分のファイルのみ。
 */
var CACHE = 'otomie-v1';
var ASSETS = [
  './',
  './index.html',
  './engine.js',
  './cv.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      // 成功したらキャッシュを更新しておく（次のオフラインに備える）
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true });
    })
  );
});
