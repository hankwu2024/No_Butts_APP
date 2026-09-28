// B 合併重複：每一筆內容只出現一次。
// - 行動地圖的 22 張「參加比賽」卡片搬到「得獎」區，取代原本重複的文字標籤 + 照片牆（照片併進卡片，點開看得到）
// - 行動地圖的「媒體報導」卡片搬到「媒體」區
// - 卡片改成「左圖右文」的橫條，兩欄排列
(function () {
  PV.banner('preview-b.html');
  var grid = document.querySelector('.action-grid');

  // ---- awards: cards become the single list, grouped by year
  var awardSec = PV.sec('project.awards.title');
  var awardWrap = awardSec.querySelector('.wrap');
  var awardCards = [].slice.call(grid.querySelectorAll('.card[data-cat="award"]'));
  var byKey = {};
  awardCards.forEach(function (c) { var h = c.querySelector('[data-i18n]'); if (h) byKey[h.dataset.i18n] = c; });
  // every photo in the old photo wall must survive: merge it into the card with the same award
  awardSec.querySelectorAll('.photo-grid figure').forEach(function (f) {
    var key = f.querySelector('figcaption').dataset.i18n;
    var src = f.querySelector('img').getAttribute('src');
    var card = byKey[key];
    if (!card) { console.warn('photo without card', key); return; }
    var list = card.dataset.photo ? card.dataset.photo.split('|') : [];
    if (list.indexOf(src) === -1) list.push(src);
    card.dataset.photo = list.join('|');
  });
  // every chip must also exist as a card
  awardSec.querySelectorAll('.chip-row .chip').forEach(function (ch) {
    if (!byKey[ch.dataset.i18n]) console.warn('chip without card', ch.dataset.i18n);
  });
  awardSec.querySelector('.chip-row').remove();
  awardSec.querySelector('.photo-grid').remove();
  var years = {};
  awardCards.forEach(function (c) {
    var y = (c.querySelector('h3').textContent.match(/^\d{4}/) || ['其他'])[0];
    (years[y] = years[y] || []).push(c);
  });
  Object.keys(years).sort().forEach(function (y) {
    var h = document.createElement('h3');
    h.className = 'pv-year';
    h.textContent = y;
    var g = document.createElement('div');
    g.className = 'card-grid pv-rows';
    years[y].forEach(function (c) { g.appendChild(c); });
    awardWrap.appendChild(h);
    awardWrap.appendChild(g);
  });

  // ---- media: map media cards join the media section
  var mediaWrap = PV.sec('project.media.title').querySelector('.wrap');
  var mg = document.createElement('div');
  mg.className = 'card-grid pv-rows';
  mg.style.marginTop = '28px';
  grid.querySelectorAll('.card[data-cat="media"]').forEach(function (c) { mg.appendChild(c); });
  mediaWrap.appendChild(mg);

  // ---- map: compact rows; award/media buttons jump to their sections
  grid.classList.add('pv-rows');
  var btns = PV.resetFilter();
  var cards = function () { return grid.querySelectorAll('.card'); };
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.dataset.cat;
      if (cat === 'award' || cat === 'media') {
        PV.sec(cat === 'award' ? 'project.awards.title' : 'project.media.title').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      cards().forEach(function (c) { c.hidden = cat !== 'all' && (c.dataset.cat || '').split(' ').indexOf(cat) === -1; });
    });
  });
  var jump = { award: awardCards.length, media: mg.children.length };
  btns.forEach(function (b) {
    var c = b.dataset.cat;
    var n = jump[c] != null ? jump[c] : c === 'all' ? cards().length : [].filter.call(cards(), function (k) { return (k.dataset.cat || '').split(' ').indexOf(c) > -1; }).length;
    b.dataset.count = n + (jump[c] != null ? ' ↓' : '');
  });
})();
