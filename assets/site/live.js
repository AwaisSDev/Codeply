// Live mockups in HTML: the CLI, phone screens and Wisp's specialists. Runs before site.js so the
// avatars it draws get painted along with the rest.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onView(el, fn, t) { new IntersectionObserver(function (es) { fn(es[0].isIntersecting); }, { threshold: t || .3 }).observe(el); }
  function loop(el, steps, every) {
    // run timed steps while the element is on screen, then start over
    var timers = [], on = false;
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function play() {
      clear();
      if (reduce) { steps.forEach(function (s) { s[1](); }); return; }
      steps.forEach(function (s) { timers.push(setTimeout(s[1], s[0])); });
      timers.push(setTimeout(function () { if (on) play(); }, every));
    }
    onView(el, function (v) { on = v; if (v) play(); else clear(); });
  }

  // Wisp's specialists: a coloured ball with eyes, the same art the app uses
  var SPEC = { frontend: 'Frontend', backend: 'Backend', database: 'Database', devops: 'DevOps', docs: 'Docs', security: 'Security', testing: 'Testing', general: 'General' };
  window.specHTML = function (k) { return '<i class="spec spec-' + k + '"><img class="ball" src="/assets/agents/' + k + '.webp" alt=""><img class="eyes" src="/assets/agents/eyes.webp" alt=""></i>'; };
  document.querySelectorAll('[data-spec]').forEach(function (el) { el.innerHTML = specHTML(el.dataset.spec); });

  var I = {
    sig: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M2 20h2M7 20v-4M12 20v-8M17 20V8M22 20V4" stroke-width="2.4"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    cap: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h10"/></svg>',
    spk: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 6l-6 6 6 6"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };
  function frame(inner, cls) {
    return '<div class="pv-dev"><div class="pv ' + (cls || '') + '"><div class="pv-island"></div><div class="pv-status"><span>9:41</span><span class="pv-ind">' + I.sig + I.wifi + '<span class="pv-batt"><i></i></span></span></div>' + inner + '<div class="pv-home"></div></div></div>';
  }

  // the phone: Wisp calls, you answer, captions roll
  document.querySelectorAll('.pv-wrap[data-pv="call"]').forEach(function (w) {
    w.innerHTML = frame(
      '<div class="pvc-in"><span class="pvc-av"><span data-wisp="sm"></span></span><b class="pvc-name">Wisp</b><span class="pvc-sub">Codeply Wisp · calling</span><div class="pvc-cap"></div></div>' +
      '<div class="pvc-acts inc"><span class="no"><i>' + I.x + '</i>Decline</span><span class="yes"><i>' + I.phone + '</i>Accept</span></div>' +
      '<div class="pvc-acts cal"><span><i>' + I.mic + '</i>mute</span><span><i>' + I.cap + '</i>captions</span><span class="sp-on"><i>' + I.spk + '</i>speaker</span><span class="end"><i>' + I.phone + '</i>end</span></div>', 'pvc');
    var pv = w.querySelector('.pv'), sub = w.querySelector('.pvc-sub'), cap = w.querySelector('.pvc-cap'), clock = null;
    var LINES = ['The checkout fix is ready. Testing ran every case and they pass.', 'Want me to merge it into main, or wait until you see it?'];
    function type(text, at) { var k = 0; (function t() { cap.innerHTML = '<span class="w">Wisp</span>' + text.slice(0, ++k); if (k < text.length) setTimeout(t, 28); })(); }
    loop(w, [
      [0, function () { clearInterval(clock); pv.className = 'pv pvc ring'; sub.textContent = 'Codeply Wisp · calling'; cap.innerHTML = ''; }],
      [2600, function () {
        pv.className = 'pv pvc live'; var s = 0; sub.textContent = '0:00';
        clock = setInterval(function () { s++; sub.textContent = '0:' + (s < 10 ? '0' : '') + s; }, 1000);
        type(LINES[0]);
      }],
      [6400, function () { type(LINES[1]); }],
      [10400, function () { clearInterval(clock); sub.textContent = 'Call ended'; pv.className = 'pv pvc'; }]
    ], 12000);
  });

  // the phone app as it really looks: black, round buttons, plain answers, the composer at the bottom.
  // Every chat starts empty, the question gets typed and sent, then the answer comes in.
  var A = {
    menu: '<svg viewBox="0 0 24 24"><path d="M5 8h14M5 12h9M5 16h12"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4Z"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 24 24" class="dn"><path d="M7 10l5 5 5-5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    voice: '<svg viewBox="0 0 24 24"><path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 10v4" stroke-width="2.2"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    design: '<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1.4 3.4c.4.4.4 1.6-.6 2.6Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4Z"/></svg>',
    gt: '<svg viewBox="0 0 24 24" class="gt"><path d="M9 6l6 6-6 6"/></svg>'
  };
  var SCRIPTS = {
    chat: {
      title: 'Haze 2', right: A.edit, chip: '', ph: 'Ask anything',
      ask: 'The checkout total is wrong, fix it',
      did: 'Read 1 file, edited 1 file, ran 1 command',
      answer: 'Fixed. <code>cartTotal</code> was adding the tax twice.',
      list: ['Checked the cart page in the browser, the total is right now.', 'All 24 tests pass.', 'Want me to merge it into main?']
    },
    cloud: {
      title: 'Cloud', right: A.dots + A.edit, chip: '<span class="pa-chip">' + A.folder + 'lumen-site<i></i></span>', ph: 'Ask or tell Codeply what to change',
      ask: "Add dark mode to settings. Keep going in the cloud, I'm heading out",
      did: 'Read 3 files, edited 2 files, ran 2 commands, used 1 tool',
      answer: 'Done in the cloud while your PC was off. Settings has a dark mode switch now and it remembers your choice.',
      list: ['Opened pull request #42 into main.', '24 tests pass.', 'Checked light and dark on phone and desktop sizes.']
    }
  };
  function app(kind) {
    var S = SCRIPTS[kind];
    return '<div class="pa">' +
      '<div class="pa-top"><span class="pa-ib">' + A.menu + '</span><b>' + S.title + A.down + '</b><span class="pa-r">' + S.right.split('</svg>').filter(Boolean).map(function (x) { return '<span class="pa-ib">' + x + '</svg></span>'; }).join('') + '</span></div>' +
      '<div class="pa-body">' +
        '<div class="pa-empty"><h5>Afternoon, what\'s on your mind?</h5></div>' +
        '<div class="pa-feed">' +
          '<div class="pa-u"></div>' +
          '<div class="pa-did"><span class="shimmer">Working…</span><span class="t">' + S.did + ' ' + A.gt + '</span></div>' +
          '<div class="pa-a"><p>' + S.answer + '</p><ul>' + S.list.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
      '</div>' +
      '<div class="pa-sugg"><span><b>Explain a concept</b>simply, with an example</span><span><b>Draft a reply</b>short and friendly</span><span><b>Check my email</b>what needs a reply</span></div>' +
      '<div class="pa-comp">' + (S.chip ? '<div class="pa-ctx">' + S.chip + '</div>' : '') +
        '<div class="pa-in"><span class="pa-ph">' + S.ph + '</span><span class="pa-typed"></span><span class="pa-car"></span></div>' +
        '<div class="pa-row"><span class="pa-ib sm">' + A.plus + '</span><span class="pa-send">' + A.voice + '</span></div>' +
      '</div></div>';
  }
  document.querySelectorAll('.pv-wrap[data-pv="chat"], .pv-wrap[data-pv="cloud"]').forEach(function (w) {
    var kind = w.dataset.pv, S = SCRIPTS[kind];
    w.innerHTML = frame(app(kind), 'pa-dark');
    var root = w.querySelector('.pa'), typed = w.querySelector('.pa-typed'), u = w.querySelector('.pa-u'),
        did = w.querySelector('.pa-did'), ans = w.querySelector('.pa-a'), lis = ans.querySelectorAll('li');
    var steps = [[0, function () { root.className = 'pa'; typed.textContent = ''; u.textContent = ''; lis.forEach(function (l) { l.classList.remove('on'); }); }]];
    var t = 900;
    for (var i = 1; i <= S.ask.length; i++) (function (i) { steps.push([t + i * 38, function () { root.classList.add('typing'); typed.textContent = S.ask.slice(0, i); }]); })(i);
    t += S.ask.length * 38 + 450;
    steps.push([t, function () { root.classList.remove('typing'); root.classList.add('sent'); u.textContent = S.ask; typed.textContent = ''; }]);
    steps.push([t + 500, function () { root.classList.add('working'); }]);
    steps.push([t + 2200, function () { root.classList.remove('working'); root.classList.add('did'); }]);
    steps.push([t + 2700, function () { root.classList.add('answered'); }]);
    lis.forEach(function (l, k) { steps.push([t + 3300 + k * 550, function () { l.classList.add('on'); }]); });
    loop(w, steps, t + 3300 + lis.length * 550 + 5200);
  });

  // the phone: the menu, with your projects, cloud runs, calls and recent chats
  document.querySelectorAll('.pv-wrap[data-pv="menu"], .pv-wrap[data-pv="calls"]').forEach(function (w) {
    var recents = ['Fix checkout total', 'Dark mode on settings', 'Pricing page on phones', 'Launch post draft', 'Speed up image uploads', 'Weekly plan with Wisp', 'Sign in with Google'];
    w.innerHTML = frame('<div class="pa pa-menu"><div class="pm-h"><b>Codeply</b><span class="pa-ib">' + A.search + '</span></div>' +
      '<nav class="pm-nav"><span>' + A.folder + 'Projects</span><span>' + A.cloud + 'Cloud</span><span>' + A.call + 'Calls</span><span>' + A.design + 'Design</span></nav>' +
      '<div class="pm-list">' + recents.map(function (r) { return '<span>' + r + '</span>'; }).join('') + '<em>See all…</em></div>' +
      '<div class="pm-foot"><span class="pm-chat">' + A.chat + 'Chat</span><span class="pa-ib">' + A.gear + '</span></div></div>', 'pa-dark');
    var rows = w.querySelectorAll('.pm-list span'), steps = [];
    rows.forEach(function (r, k) { steps.push([600 + k * 900, function () { rows.forEach(function (x) { x.classList.toggle('on', x === r); }); }]); });
    loop(w, steps, 600 + rows.length * 900 + 600);
  });

  // the Codeply desktop app as it really looks: dark sidebar with projects and chats, the chat in the middle,
  // the composer at the bottom. It starts empty, the request gets typed and sent, then the answer comes in.
  var AP = {
    ham: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    side: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    atom: '<svg viewBox="560 560 3170 3170"><use href="#knot" width="4295" height="4295" fill="currentColor" stroke="none"/></svg>',
    // Crew: a scalloped badge with two eyes. Design: a thick brush with a solid tip.
    cog: '<svg viewBox="0 0 24 24"><path d="M12 4A2.3 2.3 0 0 1 16 5.07A2.3 2.3 0 0 1 18.93 8A2.3 2.3 0 0 1 20 12A2.3 2.3 0 0 1 18.93 16A2.3 2.3 0 0 1 16 18.93A2.3 2.3 0 0 1 12 20A2.3 2.3 0 0 1 8 18.93A2.3 2.3 0 0 1 5.07 16A2.3 2.3 0 0 1 4 12A2.3 2.3 0 0 1 5.07 8A2.3 2.3 0 0 1 8 5.07A2.3 2.3 0 0 1 12 4Z" stroke-width="2"/><path d="M10.4 10.6v2.8M13.6 10.6v2.8" stroke-width="2.2"/></svg>',
    brush: '<svg viewBox="0 0 24 24"><path d="M19.6 4.4 12.6 11.4" stroke-width="3.4"/><path d="M10.6 12.9c-2.2-.3-4.2 1-4.9 3.1-.4 1.2-1 2.2-2 2.9 2.4.8 5.3.3 6.9-1.5 1.2-1.3 1.3-3.1 0-4.5Z" fill="currentColor"/></svg>',
    min: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    max: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4Z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1"/><path d="M3 7v11a2 2 0 0 0 2 2h12.5a2 2 0 0 0 1.9-1.4L21.5 12a1.5 1.5 0 0 0-1.4-2H8.2a2 2 0 0 0-1.9 1.4L3 20"/></svg>',
    task: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    pc: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    term: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l3 2-3 2M12 15h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13"/></svg>',
    panel: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z"/><path d="M9 12l2 2 4-4"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    gt: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };
  function apSide() {
    function grp(icon, name, rows, open) {
      return '<div class="ap-grp"><div class="ap-gh">' + icon + '<span>' + name + '</span><i>' + AP.plus + '</i></div>' +
        (rows.length ? '<div class="ap-rows">' + rows.map(function (r) { return '<div class="ap-row' + (r[1] ? ' ' + r[1] : '') + '">' + r[0] + '</div>'; }).join('') + '</div>' : '<div class="ap-rows"><div class="ap-row none">No chats yet</div></div>') + '</div>';
    }
    return '<aside class="ap-side">' +
      '<div class="ap-nav"><span>' + AP.edit + 'New chat</span><span>' + AP.search + 'Search</span><span>' + AP.folder + 'Open project</span><span>' + AP.task + 'Tasks</span></div>' +
      '<div class="ap-groups">' +
        grp(AP.pc, 'This Computer', [['Morning plan with Wisp', 'dot']]) +
        grp(AP.cloud, 'Cloud', []) +
        grp(AP.folderOpen, 'lumen-site', [['Dark mode on settings', 'cur'], ['Fix failing npm test'], ['Landing page hero']]) +
        grp(AP.folderOpen, 'landing-page', [['Plan the pricing page'], ['Speed up image uploads']]) +
        grp(AP.folder, 'api-server', []).replace('<div class="ap-rows"><div class="ap-row none">No chats yet</div></div>', '') +
        grp(AP.folder, 'mobile-app', []).replace('<div class="ap-rows"><div class="ap-row none">No chats yet</div></div>', '') +
      '</div>' +
      '<div class="ap-acct"><span class="av">YO</span><b>you@yourmail.com</b>' + AP.down + '</div></aside>';
  }
  function apWindow() {
    return '<div class="ap-bar"><div class="ap-bl"><i>' + AP.ham + '</i><i>' + AP.side + '</i><i>' + AP.back + '</i><i class="dim">' + AP.fwd + '</i>' +
        '<span class="ap-seg"><i class="on">' + AP.atom + '</i><i>' + AP.cog + '</i><i>' + AP.brush + '</i></span></div>' +
        '<div class="ap-br"><i>' + AP.min + '</i><i>' + AP.max + '</i><i>' + AP.close + '</i></div></div>' +
      '<div class="ap-body">' + apSide() +
        '<main class="ap-main">' +
          '<div class="ap-head"><span class="ap-globe">' + AP.globe + '</span><b class="ap-title">Dark mode on settings</b><span class="ap-tools"><em>Publish</em><i>' + AP.globe + '</i><i>' + AP.list + '</i><i>' + AP.term + '</i><i>' + AP.trash + '</i><i>' + AP.panel + '</i></span></div>' +
          '<div class="ap-stage">' +
            '<div class="ap-empty"><span class="ap-mark">' + AP.atom + '</span><h4>What should we build in <u>lumen-site</u>?</h4></div>' +
            '<div class="ap-feed">' +
              '<div class="ap-u">Add dark mode to the settings page and make it remember my choice</div>' +
              '<div class="ap-did"><i data-wisp="sm" data-mood="thinking"></i><span class="shimmer">Working as Frontend…</span><span class="t">Read Settings.tsx, edited 3 files, ran 2 commands, checked 2 pages ' + AP.gt + '</span></div>' +
              '<div class="ap-a"><p>Done. <b>Settings</b> has a dark mode switch now, and it remembers your choice.</p><ul>' +
                '<li><b>Fix:</b> added a <code>theme</code> setting that saves to local storage, and the switch reads it on load (<code>Settings.tsx</code>).</li>' +
                '<li><b>Checked:</b> I opened the settings page in the browser, light and dark, with no console errors.</li>' +
                '<li><b>Tests:</b> all 24 pass.</li></ul>' +
                '<div class="ap-chg"><span>Changed 3 files ' + AP.gt + '</span><em>' + AP.undo + 'Undo</em></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="ap-comp"><div class="ap-ctx">' + AP.folder + 'lumen-site</div>' +
            '<div class="ap-box"><div class="ap-in"><span class="ap-ph">Ask Codeply anything, or type / for commands</span><span class="ap-typed"></span><span class="ap-car"></span></div>' +
            '<div class="ap-row2"><i>' + AP.plus + '</i><span class="ap-appr">' + AP.shield + 'Approve manually</span><span class="sp"></span><span class="ap-model">Haze 2 ' + AP.down + '</span><span class="ap-send">' + AP.up + '</span></div></div></div>' +
        '</main>' +
      '</div>';
  }
  document.querySelectorAll('[data-app]').forEach(function (box) {
    box.classList.add('ap');
    box.innerHTML = apWindow();
    box.querySelectorAll('[data-spec]').forEach(function (el) { el.innerHTML = window.specHTML ? specHTML(el.dataset.spec) : ''; });
    var ask = 'Add dark mode to the settings page and make it remember my choice';
    var typed = box.querySelector('.ap-typed'), lis = box.querySelectorAll('.ap-a li');
    var steps = [[0, function () { box.classList.remove('typing', 'sent', 'working', 'did', 'answered', 'changed'); typed.textContent = ''; lis.forEach(function (l) { l.classList.remove('on'); }); }]];
    var t = 1000;
    for (var i = 1; i <= ask.length; i++) (function (i) { steps.push([t + i * 34, function () { box.classList.add('typing'); typed.textContent = ask.slice(0, i); }]); })(i);
    t += ask.length * 34 + 450;
    steps.push([t, function () { box.classList.remove('typing'); box.classList.add('sent'); typed.textContent = ''; }]);
    steps.push([t + 500, function () { box.classList.add('working'); }]);
    steps.push([t + 2600, function () { box.classList.remove('working'); box.classList.add('did'); }]);
    steps.push([t + 3100, function () { box.classList.add('answered'); }]);
    lis.forEach(function (l, k) { steps.push([t + 3700 + k * 600, function () { l.classList.add('on'); }]); });
    steps.push([t + 3700 + lis.length * 600 + 300, function () { box.classList.add('changed'); }]);
    loop(box, steps, t + 3700 + lis.length * 600 + 6000);
  });


  // the self-check card: first just the one-line summary, like the app. A cursor glides in and clicks it,
  // and the steps open up underneath, one after another.
  var PI = {
    file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>',
    chev: '<svg class="cx-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    done: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
  };
  var CURSOR = '<svg class="pcur" viewBox="0 0 30 30" aria-hidden="true"><path d="M6 4.5 6.4 24.2c0 1.5 1.8 2.2 2.8 1.1l4.3-5c.5-.6 1.3-.9 2.1-.9h7.1c1.5 0 2.2-1.8 1.1-2.8L8.7 3.4C7.7 2.5 6 3.2 6 4.5Z" fill="#3a6ee8" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  function ptool(icon, verb, label, extra, cls) { return '<div class="cx-tool ' + (cls || '') + '">' + PI[icon] + '<span>' + verb + '</span><code>' + label + '</code>' + (extra || '') + PI.chev + '</div>'; }
  function pcheck(label, exit) { return '<div class="cx-check"><i>' + PI.tick + '</i><code>' + label + '</code>' + (exit != null ? '<small>exit ' + exit + '</small>' : '') + '</div>'; }
  document.querySelectorAll('[data-proof]').forEach(function (pf) {
    var card = pf.closest('.proof') || pf.parentNode;
    card.style.position = 'relative';
    var ROWS = [
      ptool('globe', 'Opened', 'localhost:5173/checkout', '', 'fail') + '<div class="cx-err">Console: TypeError: total is undefined<br>Network: GET /api/cart 404</div>',
      ptool('file', 'Read', 'src/cart.ts'),
      ptool('edit', 'Edited', 'src/cart.ts', ' <span class="cx-add">+2</span> <span class="cx-del">-1</span>'),
      ptool('edit', 'Edited', 'server/routes.ts', ' <span class="cx-add">+1</span>'),
      ptool('globe', 'Opened', 'localhost:5173/checkout'),
      '<div class="cx-sum"><div class="h">' + PI.done + 'What actually happened</div><div class="l">Files changed</div><div class="cx-files"><span>src/cart.ts</span><span>server/routes.ts</span></div><div class="l">Checks run</div>' +
        pcheck('Opened localhost:5173/checkout') + pcheck('npm test -- --run cart checkout totals', 0) + pcheck('Tests: 24 passed, 24 total') + pcheck('npm run lint', 0) + pcheck('npm run build', 0) + '</div>',
      '<div class="cx-cp">' + PI.undo + '<span>Changed 2 files</span><b>Undo</b></div>'
    ];
    pf.innerHTML = '<div class="pf-sum"><i data-wisp="sm" data-mood="thinking"></i><span class="shimmer">Working…</span><span class="t">Opened 2 pages, read 1 file, edited 2 files, ran 4 checks</span>' + PI.chev + '</div>' +
      '<div class="pf-rows">' + ROWS.map(function (r) { return '<div class="pf-row">' + r + '</div>'; }).join('') + '</div>';
    var sum = pf.querySelector('.pf-sum'), rows = pf.querySelectorAll('.pf-row');
    sum.insertAdjacentHTML('beforeend', CURSOR + '<span class="pring"></span>');
    var cur = sum.querySelector('.pcur'), ring = sum.querySelector('.pring');
    function park() { cur.style.transform = 'translate(' + (sum.offsetWidth - 40) + 'px, 230px)'; }
    function aim() {
      // the chevron at the end of the line; measured on screen, then undone for any zoom on the card
      var chev = sum.querySelector('.cx-chev'), sr = sum.getBoundingClientRect(), cr = chev.getBoundingClientRect(), k = sr.width / sum.offsetWidth || 1;
      var x = (cr.left - sr.left + cr.width / 2) / k - 6, y = (cr.top - sr.top + cr.height / 2) / k - 4;
      cur.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
      ring.style.left = (x + 6) + 'px'; ring.style.top = (y + 4) + 'px';
    }
    var steps = [[0, function () { pf.classList.remove('done', 'open'); sum.classList.remove('hit'); ring.classList.remove('ping'); cur.classList.remove('on', 'press'); rows.forEach(function (r) { r.classList.remove('on'); }); park(); }]];
    steps.push([1700, function () { pf.classList.add('done'); }]);
    steps.push([2500, function () { cur.classList.add('on'); }]);
    steps.push([2700, aim]);
    steps.push([3300, aim]);
    steps.push([3700, function () { ring.classList.remove('ping'); void ring.offsetWidth; ring.classList.add('ping'); sum.classList.add('hit'); }]);
    steps.push([3900, function () { pf.classList.add('open'); }]);
    steps.push([4400, function () { sum.classList.remove('hit'); }]);
    rows.forEach(function (r, k) { steps.push([4100 + k * 260, function () { r.classList.add('on'); }]); });
    steps.push([4600, function () { cur.classList.remove('on'); }]);
    loop(card, steps, 4100 + rows.length * 260 + 6500);
  });

  // the CLI as it really looks: the robot in the box, then a task, step by step
  document.querySelectorAll('[data-cli]').forEach(function (box) {
    box.innerHTML = '<div class="term-live' + (box.dataset.cli === 'short' ? ' short' : '') + '"><div class="tb"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>codeply · ~/code/lumen-site</span></div>' +
      '<div class="tty" role="img" aria-label="Codeply CLI fixing a failing test"><div class="cb"><div class="cb-top"><span class="tball" aria-hidden="true"></span><div><b class="t-text">Hey there, I&#39;m Codeply. What are we building?</b><div><span class="t-sec">Send </span>/help<span class="t-sec"> for help, </span>?<span class="t-sec"> for shortcuts</span></div><div><span class="t-acc">Build mode</span><span class="t-dim"> · tab to switch</span></div></div></div>' +
      '<div class="cb-info"><span class="t-dim">Directory: </span><span class="t-sec">~/code/lumen-site</span><br><span class="t-dim">Account:   </span><span class="t-sec">you@yourmail.com</span><br><span class="t-dim">Model:     </span><span class="t-sec">Haze 2 (auto)</span></div></div>' +
      '<div class="tl"></div><div class="cmp"><span class="t-acc">›</span> <span class="tin"></span><span class="tcur"></span><span class="ph">Ask for a change, a fix, or an explanation</span></div>' +
      '<div class="cft"><span><span class="t-acc">Build mode</span><span class="t-dim"> (tab to switch) · ? for shortcuts</span></span><span class="t-sec">Haze 2</span></div></div></div>';
    var PIX = ['...XXXX...', '.XXXXXXXX.', '.XXXXXXXX.', 'XXX.XX.XXX', 'XXX.XX.XXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XXXXXXXX.', '...XXXX...'];
    var A = [0x6f, 0xa3, 0xff], B = [0x1f, 0x56, 0xe0], html = '';
    PIX.forEach(function (r, y) {
      var t = y / (PIX.length - 1), c = 'rgb(' + A.map(function (v, k) { return Math.round(v + (B[k] - v) * t); }).join(',') + ')';
      r.split('').forEach(function (ch) { html += '<i' + (ch === 'X' ? ' style="background:' + c + '"' : '') + '></i>'; });
    });
    box.querySelector('.tball').innerHTML = html;
    var tty = box.querySelector('.tty'), log = box.querySelector('.tl'), input = box.querySelector('.tin'), cmp = box.querySelector('.cmp');
    function line(h) { var d = document.createElement('div'); d.innerHTML = h; log.appendChild(d); tty.scrollTop = tty.scrollHeight; return d; }
    var PROMPT = 'fix the failing test in math.js', k = 0, spin = null;
    var steps = [[0, function () { log.innerHTML = ''; input.textContent = ''; cmp.classList.remove('typing'); tty.scrollTop = 0; k = 0; }]];
    for (var i = 1; i <= PROMPT.length; i++) (function (i) { steps.push([700 + i * 55, function () { cmp.classList.add('typing'); input.textContent = PROMPT.slice(0, i); }]); })(i);
    var t0 = 700 + PROMPT.length * 55 + 500;
    steps.push([t0, function () { input.textContent = ''; cmp.classList.remove('typing'); line('<span class="t-dim">›</span> <span class="t-sec">' + PROMPT + '</span>'); spin = line('<span class="t-acc">✻</span> <span class="t-sec">Untangling…</span><span class="t-faint"> (2s · esc to interrupt)</span>'); }]);
    steps.push([t0 + 1400, function () { if (spin) spin.remove(); }]);
    [[1500, '<span class="t-ok">●</span> <span class="t-b">Read</span> <span class="t-sec">src/math.js</span>'],
     [2300, '<span class="t-ok">●</span> <span class="t-b">Update</span> <span class="t-sec">src/math.js</span><span class="br">⎿  1 line changed</span>'],
     [3300, '<span class="t-ok">●</span> <span class="t-b">Run</span> <span class="t-sec">npm test</span><span class="br">⎿  Tests: 12 passed, 12 total</span>'],
     [4300, '<span class="t-text" style="font-weight:400">●</span> Fixed. sum() rounded before adding, so totals were a cent off. All 12 tests pass.'],
     [4900, '<span class="t-faint">── Worked for 14s · 3 steps · changed src/math.js ─────────</span>']
    ].forEach(function (s) { steps.push([t0 + s[0], function () { line(s[1]); }]); });
    loop(box, steps, t0 + 9000);
  });
})();
