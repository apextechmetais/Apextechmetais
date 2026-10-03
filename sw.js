// Service Worker - Passthrough Mode v12
// Não intercepta HTML, JS, CSS ou APIs - apenas pass-through

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Não intercepta nenhuma requisição - tudo vai para a rede diretamente
// Isso evita todos os erros de TypeError e cache corrompido
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ignorar tudo exceto URLs http/https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return; // Não interceptar chrome-extension://, etc.
  }

  // Não interceptar: HTML, JS, CSS, APIs, navegação
  if (
    event.request.mode === 'navigate' ||
    url.includes('.html') ||
    url.includes('.js') ||
    url.includes('.css') ||
    url.includes('/api/')
  ) {
    return; // Browser trata diretamente
  }

  // Para outros assets: tenta rede primeiro, sem cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
