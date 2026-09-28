// Preview helpers shared by the three layout proposals (not part of the live site).
window.PV = {
  sec: function (key) {
    var h = document.querySelector('h2[data-i18n="' + key + '"]');
    return h ? h.closest('section') : null;
  },
  banner: function (current) {
    var items = [
      ['project.html', '目前版本'],
      ['preview-a.html', 'A 分頁籤'],
      ['preview-b.html', 'B 合併重複'],
      ['preview-c.html', 'C 收合精簡']
    ];
    var bar = document.createElement('div');
    bar.className = 'pv-banner';
    bar.innerHTML = '<strong>版面預覽</strong>' + items.map(function (it) {
      return '<a href="' + it[0] + '"' + (it[0] === current ? ' class="on"' : '') + '>' + it[1] + '</a>';
    }).join('') + '<span class="pv-height"></span>';
    document.body.appendChild(bar);
    function measure() {
      bar.querySelector('.pv-height').textContent = '頁面長度 ' + document.documentElement.scrollHeight.toLocaleString() + 'px';
    }
    window.addEventListener('load', measure);
    document.addEventListener('click', function () { setTimeout(measure, 50); });
  },
  // Replace the original category buttons with fresh ones so old listeners are dropped.
  resetFilter: function () {
    document.querySelectorAll('.cat-btn').forEach(function (b) { b.replaceWith(b.cloneNode(true)); });
    return document.querySelectorAll('.cat-btn');
  }
};
