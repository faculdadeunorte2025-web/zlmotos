// ── SPLASH CONTROLLER ──────────────────────────────────
(function() {
  const splash  = document.getElementById('intro-zl');
  const skipBtn = document.getElementById('zlSkipBtn');
  if (!splash) return;

  let done = false;

  function enterApp() {
    if (done) return;
    done = true;
    splash.classList.add('hidden');
    setTimeout(() => { if (splash.parentNode) splash.style.display = 'none'; }, 1600);
  }

  // Sai após animação CSS
  setTimeout(enterApp, 4500);

  // Skip por toque/clique
  splash.addEventListener('click',      enterApp);
  splash.addEventListener('touchstart', enterApp, { passive: true });
  if (skipBtn) skipBtn.addEventListener('click', (e) => { e.stopPropagation(); enterApp(); });

  // Teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') enterApp();
  }, { once: true });

  // Fallback máximo
  setTimeout(enterApp, 11000);
})();
// splash duplicado removido em v5.5.9.39

// ── PWA: SERVICE WORKER ────────────────────────────────
if ('serviceWorker' in navigator) {
  const swCode = `
    const CACHE = 'zlmotos-v5-5-9-1';
    const ASSETS = [
      'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    ];

    self.addEventListener('install', e => {
      e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
      );
      self.skipWaiting();
    });

    self.addEventListener('activate', e => {
      e.waitUntil(
        caches.keys().then(keys =>
          Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
      );
      self.clients.claim();
    });

    self.addEventListener('fetch', e => {
      // Firebase e APIs externas: sempre rede
      if (e.request.url.includes('firebaseapp') ||
          e.request.url.includes('googleapis.com/identitytoolkit') ||
          e.request.url.includes('firestore.googleapis.com')) {
        return;
      }
      e.respondWith(
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
          }).catch(() => cached);
        })
      );
    });
  `;

  const blob = new Blob([swCode], { type: 'application/javascript' });
  const swUrl = URL.createObjectURL(blob);
  navigator.serviceWorker.register(swUrl).catch(() => {});
}

// ── PWA: BANNER "ADICIONAR À TELA INICIAL" ────────────
let _pwaPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;

  // Mostra banner discreto após 3s se não estiver instalado
  setTimeout(() => {
    if (_pwaPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
      const banner = document.createElement('div');
      banner.id = 'pwa-banner';
      banner.innerHTML = `
        <div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
          background:#1a1a1d;border:1px solid rgba(255,255,255,0.2);border-radius:14px;
          padding:12px 18px;display:flex;align-items:center;gap:12px;
          box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:99999;
          max-width:340px;width:calc(100% - 32px);animation:fadeIn .3s ease">
          <span style="font-size:1.4rem"></span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.82rem;font-weight:700;color:#f0f0f0">Instalar ZL Motos</div>
            <div style="font-size:.7rem;color:#a2a2a5">Acesso rápido na tela inicial</div>
          </div>
          <button onclick="instalarPWA()" style="background:#e4e4e7;border:none;color:#fff;
            border-radius:8px;padding:7px 14px;font-size:.78rem;font-weight:700;
            cursor:pointer;white-space:nowrap">Instalar</button>
          <button onclick="document.getElementById('pwa-banner').remove()"
            style="background:transparent;border:none;color:#707073;font-size:1rem;
            cursor:pointer;padding:4px;line-height:1">✕</button>
        </div>`;
      document.body.appendChild(banner);
    }
  }, 3000);
});

function instalarPWA() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(() => {
    _pwaPrompt = null;
    const b = document.getElementById('pwa-banner');
    if (b) b.remove();
  });
}

window.addEventListener('appinstalled', () => {
  const b = document.getElementById('pwa-banner');
  if (b) b.remove();
  _pwaPrompt = null;
});
