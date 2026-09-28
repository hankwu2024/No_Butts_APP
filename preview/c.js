// C 收合精簡：區塊順序不變，長清單先顯示一部分，按「顯示全部」展開；照片牆改成可左右滑的一列。
(function () {
  PV.banner('preview-c.html');
  var LBL = {
    more: { zh: '顯示全部 {n} 項 ▾', en: 'Show all {n} ▾', ja: 'すべて表示（{n}件）▾' },
    less: { zh: '收合 ▴', en: 'Collapse ▴', ja: '閉じる ▴' }
  };
  function t(k, n) { var s = LBL[k][window.currentLang || 'zh'] || LBL[k].zh; return s.replace('{n}', n); }

  // generic: keep the first `keep` visible children, toggle the rest
  function clamp(container, items, keep) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pv-more';
    container.insertAdjacentElement('afterend', btn);
    var open = false;
    function apply() {
      var list = items();
      var shown = 0;
      list.forEach(function (el) {
        if (el.dataset.pvFiltered === '1') { el.hidden = true; return; }
        shown++;
        el.hidden = !open && shown > keep;
      });
      btn.hidden = shown <= keep;
      btn.textContent = open ? t('less') : t('more', shown);
    }
    btn.addEventListener('click', function () {
      open = !open; apply();
      if (!open) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.addEventListener('langchange', apply);
    apply();
    return apply;
  }

  // ---- action map: 6 cards per category, rest behind "show all"
  var grid = document.querySelector('.action-grid');
  var cards = function () { return [].slice.call(grid.querySelectorAll('.card')); };
  var reapply = clamp(grid, cards, 6);
  var btns = PV.resetFilter();
  btns.forEach(function (btn) {
    var c = btn.dataset.cat;
    var n = c === 'all' ? cards().length : cards().filter(function (k) { return (k.dataset.cat || '').split(' ').indexOf(c) > -1; }).length;
    btn.dataset.count = n;
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      cards().forEach(function (k) { k.dataset.pvFiltered = c !== 'all' && (k.dataset.cat || '').split(' ').indexOf(c) === -1 ? '1' : ''; });
      reapply();
    });
  });

  // ---- youth network: one collapsible block per country
  document.querySelectorAll('.country-block').forEach(function (b) {
    var h = b.querySelector('h3');
    var d = document.createElement('details');
    d.className = 'pv-country';
    var s = document.createElement('summary');
    var n = b.querySelectorAll('.tl-item').length;
    s.innerHTML = h.innerHTML + ' <span class="pv-count">' + n + '</span>';
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
  var story = PV.sec('project.story.title').querySelector('.timeline');
  clamp(story, function () { return [].slice.call(story.children); }, 3);

  // ---- awards chips: first 8
  var chips = PV.sec('project.awards.title').querySelector('.chip-row');
  clamp(chips, function () { return [].slice.call(chips.children); }, 8);

  // ---- photo walls → one horizontal strip
  document.querySelectorAll('.photo-grid').forEach(function (g) { g.classList.add('pv-strip'); });
})();
