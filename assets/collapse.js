// project.html: category filter + collapsible long lists. Nothing is removed — hidden items are one click away.
(function () {
  var LBL = {
    more: { zh: '顯示全部 {n} 項 ▾', en: 'Show all {n} ▾', ja: 'すべて表示（{n}件）▾' },
    less: { zh: '收合 ▴', en: 'Collapse ▴', ja: '閉じる ▴' }
  };
  function t(k, n) { var s = LBL[k][window.currentLang || 'zh'] || LBL[k].zh; return s.replace('{n}', n); }
  function sec(key) {
    var h = document.querySelector('h2[data-i18n="' + key + '"]');
    return h ? h.closest('section') : null;
  }

  // keep the first `keep` items visible, the rest behind a "show all" button
  function clamp(container, items, keep) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more-btn';
    container.insertAdjacentElement('afterend', btn);
    var open = false;
    function apply() {
      var shown = 0;
      items().forEach(function (el) {
        if (el.dataset.filtered === '1') { el.hidden = true; return; }
        shown++;
        el.hidden = !open && shown > keep;
      });
      btn.hidden = shown <= keep;
      btn.textContent = open ? t('less') : t('more', shown);
    }
    btn.addEventListener('click', function () {
      open = !open;
      apply();
      if (!open) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.addEventListener('langchange', apply);
    apply();
    return apply;
  }

  // ---- action map: category filter, 6 cards per category, rest behind "show all"
  var grid = document.querySelector('.action-grid');
  var cards = function () { return [].slice.call(grid.querySelectorAll('.card')); };
  var inCat = function (card, cat) { return cat === 'all' || (card.dataset.cat || '').split(' ').indexOf(cat) > -1; };
  var reapply = clamp(grid, cards, 6);
  var btns = document.querySelectorAll('.cat-btn');
  function select(cat) {
    btns.forEach(function (b) { b.classList.toggle('active', b.dataset.cat === cat); });
    cards().forEach(function (k) { k.dataset.filtered = inCat(k, cat) ? '' : '1'; });
    reapply();
  }
  btns.forEach(function (btn) {
    btn.dataset.count = cards().filter(function (k) { return inCat(k, btn.dataset.cat); }).length;
    btn.addEventListener('click', function () { select(btn.dataset.cat); });
  });
  // project.html#competitions → open the Competitions category (linked from the About page)
  if (location.hash === '#competitions') {
    select('award');
    var toMap = function () { document.getElementById('action-map').scrollIntoView(); };
    toMap();
    window.addEventListener('load', toMap); // again once photos have loaded and the layout has settled
  }

  // ---- youth network: one collapsible block per country
  document.querySelectorAll('.country-block').forEach(function (b) {
    var h = b.querySelector('h3');
    var d = document.createElement('details');
    d.className = 'country-details';
    var s = document.createElement('summary');
    s.innerHTML = h.innerHTML + ' <span class="count">' + b.querySelectorAll('.tl-item').length + '</span>';
    d.appendChild(s);
    h.remove();
    while (b.firstChild) d.appendChild(b.firstChild);
    b.appendChild(d);
  });
  document.querySelectorAll('.country-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      var d = document.querySelector(a.getAttribute('href') + ' details');
      if (d) d.open = true;
    });
  });

  // ---- story timeline: first 3 milestones
  var story = sec('project.story.title').querySelector('.timeline');
  clamp(story, function () { return [].slice.call(story.children); }, 3);

  // ---- awards chips: first 8
  var chips = sec('project.awards.title').querySelector('.chip-row');
  clamp(chips, function () { return [].slice.call(chips.children); }, 8);

  // ---- photo walls → one horizontally scrolling strip
  document.querySelectorAll('.photo-grid').forEach(function (g) { g.classList.add('photo-strip'); });
})();
