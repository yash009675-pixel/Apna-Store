(() => {
  const icons = {
    orders:'<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M8 3v4M16 3v4M4 9h16M8 13h3M8 16h6"></path>',
    bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
    wallet:'<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H20v14H5.5A2.5 2.5 0 0 1 3 16.5z"></path><path d="M20 9h-5a2 2 0 0 0 0 4h5"></path><path d="M16 11h.01"></path>',
    heart:'<path d="M20.8 8.6c0 5.1-8.8 10-8.8 10S3.2 13.7 3.2 8.6A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.5z"></path>',
    bag:'<path d="M5 8h14l-1 12H6z"></path><path d="M9 8a3 3 0 0 1 6 0"></path>',
    truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle>',
    shield:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"></path><path d="m9 12 2 2 4-4"></path>',
    gift:'<path d="M4 10h16v10H4zM3 7h18v3H3z"></path><path d="M12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5C11 6 12 7 12 7zm0 0h3.5A2.5 2.5 0 1 0 13 4.5C13 6 12 7 12 7z"></path>'
  };
  document.querySelectorAll('[data-icon]').forEach(el => {
    const key = el.dataset.icon;
    if (!icons[key] || el.querySelector('svg')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.classList.add('site-ui-icon');
    svg.innerHTML = icons[key];
    el.prepend(svg);
  });
})();