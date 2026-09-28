// A 分頁籤：專案頁的 9 個區塊變成頁籤，一次只顯示一個；行動地圖預設一次看一個分類。
(function () {
  PV.banner('preview-a.html');
  var tabs = [
    ['project.map.title', '🗺️ 行動地圖', 'Action map', '行動マップ'],
    ['project.net.title', '🌏 七國網絡', 'Youth network', '青年ネットワーク'],
    ['project.log.title', '📜 完整紀錄', 'Full record', '全記録'],
    ['project.story.title', '📖 我們的故事', 'Story', 'ストーリー'],
    ['project.snap.title', '📷 行動剪影', 'Snapshots', 'スナップ'],
    ['project.goals.title', '🎯 我的目標', 'Goals', '目標'],
    ['project.tech.title', '📱 APP 與發明', 'App & inventions', 'アプリと発明'],
    ['project.awards.title', '🏆 得獎', 'Awards', '受賞'],
    ['project.media.title', '📰 媒體報導', 'Media', 'メディア']
  ];
  var sections = tabs.map(function (t) { return PV.sec(t[0]); });
  var nav = document.createElement('nav');
  nav.className = 'pv-tabs';
  nav.innerHTML = '<div class="wrap">' + tabs.map(function (t, i) {
    return '<button type="button" data-i="' + i + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  sections[0].parentNode.insertBefore(nav, sections[0]);
  // stick right under the site nav, whose height differs between desktop and mobile
  function stickTop() { var sn = document.querySelector('.site-nav'); nav.style.top = (sn ? sn.offsetHeight : 0) + 'px'; }
  window.addEventListener('resize', stickTop);
  stickTop();

  function labels() {
    var li = { zh: 1, en: 2, ja: 3 }[window.currentLang || 'zh'] || 1;
    nav.querySelectorAll('button').forEach(function (b, i) {
      b.textContent = (li === 1 ? '' : tabs[i][1].split(' ')[0] + ' ') + (li === 1 ? tabs[i][1] : tabs[i][li]);
    });
  }
  function show(i, scroll) {
    sections.forEach(function (s, j) { s.hidden = j !== i; });
    nav.querySelectorAll('button').forEach(function (b, j) {
      b.classList.toggle('on', j === i);
      if (j === i) b.parentNode.scrollLeft = b.offsetLeft - (b.parentNode.clientWidth - b.offsetWidth) / 2;
    });
    if (scroll) window.scrollTo({ top: nav.offsetTop - parseInt(nav.style.top, 10), behavior: 'smooth' });
  }
  nav.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) show(+b.dataset.i, true);
  });
  // hero "看我們怎麼開始" button → story tab
  document.querySelectorAll('a[href="#story"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(3, true); });
  });
  document.addEventListener('langchange', labels);
  labels();
  show(0, false);

  // action map: add counts, default to the first category instead of "all"
  var cards = document.querySelectorAll('.action-grid .card');
  document.querySelectorAll('.cat-btn').forEach(function (b) {
    var c = b.dataset.cat;
    var n = c === 'all' ? cards.length : [].filter.call(cards, function (k) { return (k.dataset.cat || '').split(' ').indexOf(c) > -1; }).length;
    b.dataset.count = n;
  });
  document.addEventListener('DOMContentLoaded', function () {
    var first = document.querySelector('.cat-btn[data-cat="advocacy"]');
    if (first) first.click();
  });
})();
