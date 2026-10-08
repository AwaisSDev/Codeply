(function(){
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // logos
  var tpl = document.getElementById('tpl-mark').innerHTML;
  document.querySelectorAll('[data-mark]').forEach(function(el){ el.innerHTML = tpl; });
  var ptpl = document.getElementById('tpl-phone').innerHTML;
  document.querySelectorAll('[data-phone]').forEach(function(el){ el.innerHTML = ptpl; });

  // theme
  var FAV = {
    navy: ['#1D3D7A','#FFFFFF'], dark: ['#0D0D0F','#FFFFFF'], light: ['#FFFFFF','#111113']
  };
  var knotD = document.querySelector('#knot path').getAttribute('d');
  var knotT = document.querySelector('#knot path').getAttribute('transform');
  function favicon(t){
    var c = FAV[t];
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4295 4295"><rect width="4295" height="4295" rx="945" fill="'+c[0]+'"/><path transform="'+knotT+'" fill-rule="evenodd" fill="'+c[1]+'" d="'+knotD+'"/></svg>';
    document.getElementById('favicon').href = 'data:image/svg+xml,' + encodeURIComponent(s);
  }
  function setTheme(t, save){
    root.dataset.theme = t;
    document.querySelectorAll('[data-set-theme]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.setTheme === t ? 'true' : 'false'); });
    favicon(t);
    if (save) { try { localStorage.setItem('codeply-theme', t); } catch (e) {} }
  }
  document.querySelectorAll('[data-set-theme]').forEach(function(b){
    b.addEventListener('click', function(){ setTheme(b.dataset.setTheme, true); });
  });
  setTheme('light', false);

  // nav
  var nav = document.getElementById('nav');
  function onScroll(){ nav.classList.toggle('scrolled', scrollY > 8); }
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  var mb = document.getElementById('menuBtn'), mn = document.getElementById('mnav');
  function setMenu(open){ mn.classList.toggle('open', open); mb.setAttribute('aria-expanded', open ? 'true' : 'false'); mb.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
  mb.addEventListener('click', function(){ setMenu(!mn.classList.contains('open')); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && mn.classList.contains('open')) { setMenu(false); mb.focus(); } });
  mn.addEventListener('click', function(e){ if (e.target.closest('a')) setMenu(false); });
  addEventListener('resize', function(){ if (innerWidth > 980) setMenu(false); });
  try {
  // os label + cli command
  var isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  var isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  document.getElementById('dl-label').textContent = isPhone ? 'Get Codeply' : (isMac ? 'Download for macOS' : 'Download for Windows');
  var CMDS = { win: 'irm https://codeply.online/install.ps1 | iex', nix: 'curl -fsSL https://codeply.online/install.sh | sh' };
  var tabs = document.querySelectorAll('.term [data-os]');
  function pickOs(os){
    tabs.forEach(function(x){ x.setAttribute('aria-selected', x.dataset.os === os ? 'true' : 'false'); });
    document.getElementById('cmd').textContent = CMDS[os];
  }
  tabs.forEach(function(x){ x.addEventListener('click', function(){ pickOs(x.dataset.os); }); x.addEventListener('keydown', function(e){ if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var o = x.dataset.os === 'win' ? 'nix' : 'win'; pickOs(o); document.querySelector('.term [data-os=' + o + ']').focus(); e.preventDefault(); } }); });
  if (isMac) pickOs('nix');
  document.getElementById('copy').addEventListener('click', function(){
    var b = this, txt = document.getElementById('cmd').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ b.textContent = 'Copied'; }, function(){ b.textContent = 'Select it'; });
    setTimeout(function(){ b.textContent = 'Copy'; }, 1600);
  });

  } catch (e) {}
  try {
  // rotating verb
  var rot = document.getElementById('rot').children, ri = 0;
  if (!reduce) setInterval(function(){
    var cur = rot[ri]; cur.classList.remove('on'); cur.classList.add('out');
    setTimeout(function(){ cur.classList.remove('out'); }, 600);
    ri = (ri + 1) % rot.length; rot[ri].classList.add('on');
  }, 2200);

  } catch (e) {}
  // reveal
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.12, rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });

  // window tilt flattens on scroll
  var win = document.getElementById('win');

  // icons used by the Craft chat rows (same shapes as the app)
  var IC = {
    file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
    term: '<svg viewBox="0 0 24 24"><path d="M5 7l5 5-5 5"/><path d="M12 17h7"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chev: '<svg class="cx-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    done: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
  };
  function tool(icon, verb, label, extra, cls){ return '<div class="cx-tool '+(cls||'')+'">'+IC[icon]+'<span>'+verb+'</span><code>'+label+'</code>'+(extra||'')+IC.chev+'</div>'; }
  function role(){ return '<div class="cx-role"><span class="cx-mascot"><img class="ball" src="/assets/site/general.png" alt=""><img class="eyes" src="/assets/site/eyes.png" alt=""></span>Working as <b>General</b></div>'; }
  function check(label, exit){ return '<div class="cx-check"><i>'+IC.tick+'</i><code>'+label+'</code>'+(exit!=null?'<small>exit '+exit+'</small>':'')+'</div>'; }
  function summary(files, checks){
    return '<div class="cx-sum"><div class="h">'+IC.done+'What actually happened</div>' +
      '<div class="l">Files changed</div><div class="cx-files">'+files.map(function(f){return '<span>'+f+'</span>';}).join('')+'</div>' +
      '<div class="l">Checks run</div>'+checks.join('')+'</div>';
  }
  function checkpoint(n){ return '<div class="cx-cp">'+IC.undo+'<span>Changed '+n+' file'+(n===1?'':'s')+'</span><b>Undo</b></div>'; }

  try {
  // hero demo: the real Craft chat, step by step
  var feed = document.getElementById('feed');
  var res = document.getElementById('res'), scan = document.getElementById('scan'), url = document.getElementById('bcUrl');
  var STEPS = [
    {h: role(), wait: 700},
    {h: tool('clock','Thought for 1s',''), wait: 600},
    {h: tool('file','Read','src/components/Pricing.tsx'), wait: 700},
    {h: tool('edit','Edited','src/components/Pricing.tsx',' <span class="cx-add">+1</span> <span class="cx-del">-1</span>') +
        '<div class="cx-detail"><div class="d">-   { plan: "Pro", price: 19, billed: "yearly" },</div><div class="a">+   { plan: "Pro", price: 24, billed: "yearly" },</div></div>', wait: 1500},
    {h: tool('globe','Opened','localhost:5173/pricing'), wait: 1500, open: true},
    {h: '<div class="cx-text">Done. The Pro plan now shows <b>$24</b> a seat, billed yearly. I opened the pricing page to check it, and nothing else moved.</div>', wait: 900},
    {h: summary(['src/components/Pricing.tsx'], [check('Opened localhost:5173/pricing')]), wait: 700},
    {h: checkpoint(1), wait: 0}
  ];
  function reset(){
    [].slice.call(feed.children, 1).forEach(function(n){ n.remove(); });
    res.textContent = '$19.00'; res.className = 'result'; url.textContent = 'No page checked yet';
    feed.scrollTop = 0;
  }
  var running = false, visible = true;
  function add(html){
    var w = document.createElement('div'); w.className = 'cx-in'; w.innerHTML = html;
    feed.appendChild(w);
    requestAnimationFrame(function(){ w.classList.add('on'); feed.scrollTop = feed.scrollHeight; });
  }
  function play(){
    if (running) return; running = true; reset();
    var k = 0;
    (function next(){
      if (k >= STEPS.length) { setTimeout(function(){ running = false; if (visible && !reduce) play(); }, 6000); return; }
      var s = STEPS[k++]; add(s.h);
      if (s.open) {
        url.textContent = 'localhost:5173/pricing';
        scan.classList.remove('go'); void scan.offsetWidth; scan.classList.add('go');
        setTimeout(function(){ res.textContent = '$24.00'; res.className = 'result changed'; }, 700);
      }
      setTimeout(next, reduce ? 0 : s.wait);
    })();
  }
  new IntersectionObserver(function(es){ visible = es[0].isIntersecting; if (visible) play(); }, {threshold:.2}).observe(win);

  } catch (e) {}
  try {
  // proof card: the same Craft rows, catching a broken page
  var pf = document.getElementById('pfeed');
  var PSTEPS = [
    tool('globe','Opened','localhost:5173/checkout','', 'fail') + '<div class="cx-err">Console: TypeError: total is undefined<br>Network: GET /api/cart 404</div>',
    tool('file','Read','src/cart.ts'),
    tool('edit','Edited','src/cart.ts',' <span class="cx-add">+2</span> <span class="cx-del">-1</span>'),
    tool('edit','Edited','server/routes.ts',' <span class="cx-add">+1</span>'),
    tool('globe','Opened','localhost:5173/checkout'),
    summary(['src/cart.ts','server/routes.ts'], [check('Opened localhost:5173/checkout'), check('npm test', 0)]),
    checkpoint(2)
  ];
  var pplay = false;
  function playProof(){
    if (pplay) return; pplay = true; pf.innerHTML = '';
    PSTEPS.forEach(function(h, i){
      setTimeout(function(){ var w = document.createElement('div'); w.className = 'cx-in'; w.innerHTML = h; pf.appendChild(w); requestAnimationFrame(function(){ w.classList.add('on'); }); }, reduce ? 0 : 600 * i);
    });
    setTimeout(function(){ pplay = false; }, 600 * PSTEPS.length + 5000);
  }
  new IntersectionObserver(function(es){ if (es[0].isIntersecting) playProof(); }, {threshold:.35}).observe(document.getElementById('proofCard'));

  } catch (e) {}
  try {
  // Crew bots, drawn by the same avatar code the Crew app uses
  if (window.CraftAvatar) {
    var BOTS = {
      orion: { shape: 'burst9', eyes: 'pills', color: 'graphite' },
      vera: { shape: 'drop', eyes: 'big', color: 'blue' },
      remy: { shape: 'cloud', eyes: 'happy', color: 'pink', cheeks: true },
      quinn: { shape: 'squircle', eyes: 'ovals', color: 'teal', glasses: 'round' },
      wren: { shape: 'star', eyes: 'dots', color: 'orange', accessory: 'sprout' },
      axel: { shape: 'burst7', eyes: 'sleepy', color: 'red', accessory: 'antenna' },
      juno: { shape: 'burst12', eyes: 'sparkle', color: 'purple', accessory: 'halo' },
      cloudy: { shape: 'cloud', eyes: 'happy', color: 'sky', cheeks: true },
      sleepy: { shape: 'cloud', eyes: 'sleepy', color: 'sky', cheeks: true },
      worker: { shape: 'burst9', eyes: 'pills', color: 'blue', accessory: 'antenna' },
      shella: { shape: 'cloud', eyes: 'pills', color: 'graphite', glasses: 'visor' },
      george: { shape: 'star', eyes: 'pills', color: 'teal', glasses: 'visor', accessory: 'antenna' },
      felipe: { shape: 'cloud', eyes: 'happy', color: 'blue', accessory: 'sprout' }
    };
    try { if (CraftAvatar.injectAvatarStyles) CraftAvatar.injectAvatarStyles(); } catch (e) {}
    document.querySelectorAll('[data-avatar]').forEach(function(el){
      var a = BOTS[el.dataset.avatar]; if (!a) return;
      try { el.innerHTML = CraftAvatar.renderAvatar(a, el.offsetWidth || 40, {}); } catch (e) {}
    });
  }

  } catch (e) {}
  try {
  // make your own agent: type a sentence, a bot appears
  var MAKE = [
    {t: 'Check my inbox every morning and draft replies to anything urgent', n: 'Penny', r: 'Inbox helper', a: { shape: 'flower', eyes: 'pills', color: 'yellow', accessory: 'sparkles' }},
    {t: 'Watch our site and call me if checkout breaks', n: 'Rex', r: 'Site watcher', a: { shape: 'burst7', eyes: 'ovals', color: 'red', accessory: 'antenna' }},
    {t: 'Turn my meeting notes into tasks for the team', n: 'Ivy', r: 'Notes to tasks', a: { shape: 'pebble', eyes: 'happy', color: 'green', accessory: 'sprout', cheeks: true }}
  ];
  var mkIn = document.getElementById('mkIn'), mkBot = document.getElementById('mkBot'), mi = 0, mkBusy = false, mkVis = false;
  function makeOne(){
    if (mkBusy || !mkVis) return; mkBusy = true;
    var m = MAKE[mi++ % MAKE.length], i = 0;
    mkBot.classList.remove('on'); mkIn.textContent = '';
    (function type(){
      if (i <= m.t.length && !reduce) { mkIn.textContent = m.t.slice(0, i++); setTimeout(type, 28); return; }
      mkIn.textContent = m.t;
      document.getElementById('mkName').textContent = m.n;
      document.getElementById('mkRole').textContent = m.r;
      try { document.getElementById('mkAv').innerHTML = window.CraftAvatar ? CraftAvatar.renderAvatar(m.a, 64, {}) : ''; } catch (e) {}
      setTimeout(function(){ mkBot.classList.add('on'); }, 350);
      setTimeout(function(){ mkBusy = false; makeOne(); }, reduce ? 99999999 : 4200);
    })();
  }
  new IntersectionObserver(function(es){ mkVis = es[0].isIntersecting; if (mkVis) makeOne(); }, {threshold:.3}).observe(document.getElementById('makeCard'));

  } catch (e) {}
  try {
  // faq
  var FAQ = [
    ['What exactly does Codeply do?','Codeply is an autonomous coding agent. Give it a task in plain English and it reads your codebase, writes and edits files, runs commands, and keeps going on its own until the task is actually done.'],
    ['How is this different from a code-completion tool?','Codeply does not just generate a suggestion and stop. It edits files and runs commands on your project directly. With Codeply Craft it goes a step further: it opens the page it just changed in a real browser panel, reads back console errors and failed requests, and fixes them before it calls the task done.'],
    ['Does Codeply work with my editor?','Codeply is not tied to a specific editor. Use the codeply CLI on any project on disk, or Codeply Craft, the desktop app with chat, project and session management, and a docked browser panel. Studio brings the agent into VS Code.'],
    ['Does it actually see the page, like a screenshot?','No. The self-check reads real signal from the browser: console errors, failed network requests and broken images. Not a picture of the page.'],
    ['Will it change my files without asking?','By default, no. Every write, edit and command asks for your approval first, with a visible diff before anything touches disk. There is an optional bypass mode if you want it to just run.'],
    ['What is the difference between the CLI and Codeply Craft?','The CLI is a terminal-native agent for people who live in a terminal. Craft is the full desktop app with chat, projects, sessions and the browser panel that verifies changes. Both share one account.'],
    ['How does Codeply know which skill to use?','It draws on a library of 280+ specialized skills, from accessibility to security review to test-driven workflows, and reaches for the right one when a task calls for it.'],
    ['Is Codeply a browser extension?','No. Codeply Craft is a desktop app. The browser panel inside it is a real Chromium instance the app controls to verify changes.']
  ];
  var list = document.getElementById('faqList');
  FAQ.forEach(function(f, i){
    var d = document.createElement('div'); d.className = 'q rv';
    d.innerHTML = '<button aria-expanded="false" aria-controls="qa'+i+'"><span>'+f[0]+'</span><span class="pm" aria-hidden="true">+</span></button><div class="a" id="qa'+i+'"><div><p>'+f[1]+'</p></div></div>';
    d.querySelector('button').addEventListener('click', function(){
      var open = d.classList.toggle('open'); this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    list.appendChild(d); io.observe(d);
  });
  } catch (e) {}
  // download buttons: Mac visitors get the Mac build
  if (/Mac/i.test(navigator.platform || navigator.userAgent)) document.querySelectorAll('[data-mac-href]').forEach(function(a){ a.href = a.dataset.macHref; if (a.dataset.macLabel) { var l = a.querySelector('span') || a; l.textContent = a.dataset.macLabel; } });
  document.querySelectorAll('[data-year]').forEach(function(e){ e.textContent = new Date().getFullYear(); });
})();
