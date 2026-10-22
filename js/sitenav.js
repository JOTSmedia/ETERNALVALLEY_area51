// [nav-EVR-04] Shared site bar for secondary pages: same links + labels everywhere,
// aria-current on the active page, Home/back always available, mobile menu toggle.
(() => {
  if (document.getElementById('evSiteNav')) return;
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const parent = { 'partner-materials.html': 'partners.html', 'training-guide.html': 'partners.html', 'waiting-room-poster.html': 'partners.html' };
  const cur = parent[here] || here;
  const links = [
    ['index.html', 'Sanctuary Home'], ['campaign.html', 'Campaign'],
    ['memorial.html', 'Memorials'], ['partners.html', 'Partners'], ['credits.html', 'Credits'],
  ];
  const css = document.createElement('style');
  css.textContent = `#evSiteNav{position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:12px;padding:8px 14px;background:rgba(14,18,28,.92);font:14px system-ui,sans-serif}
#evSiteNav a{color:#f4efe2;text-decoration:none;padding:8px 10px;border-radius:6px}#evSiteNav a:hover,#evSiteNav a[aria-current=page]{background:rgba(229,193,88,.25)}
#evSiteNav .brand{font-weight:700;letter-spacing:.08em}#evSiteNav ul{display:flex;gap:4px;list-style:none;margin:0 0 0 auto;padding:0}
#evSiteNav button{display:none;margin-left:auto;background:none;border:1px solid #f4efe2;color:#f4efe2;border-radius:6px;padding:6px 10px;font-size:16px}
@media (max-width:700px){#evSiteNav{flex-wrap:wrap}#evSiteNav button{display:block}#evSiteNav ul{display:none;flex-direction:column;width:100%;margin:0}#evSiteNav.open ul{display:flex}}
@media print{#evSiteNav{display:none}}`;
  document.head.appendChild(css);
  const nav = document.createElement('nav');
  nav.id = 'evSiteNav'; nav.setAttribute('aria-label', 'Site');
  nav.innerHTML = `<a class="brand" href="index.html">✦ Eternal Valley</a><button aria-expanded="false" aria-controls="evSiteNavList" aria-label="Menu">☰</button><ul id="evSiteNavList">${
    links.map(([h, t]) => `<li><a href="${h}"${h === cur ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul>`;
  const btn = nav.querySelector('button');
  btn.onclick = () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); };
  document.body.prepend(nav);
})();
