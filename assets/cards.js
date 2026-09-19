// Card thumbnails + photo modal, shared by project.html and squads.html.
(function () {
  document.querySelectorAll('.action-card[data-photo]').forEach(function (card) {
    var photos = card.dataset.photo.split('|');
    var wrap = document.createElement('span');
    wrap.className = 'card-thumb';
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = photos[0].replace('assets/images/', 'assets/images/thumbs/').replace(/\.\w+$/, '.jpg');
    wrap.appendChild(img);
    if (photos.length > 1) {
      var badge = document.createElement('span');
      badge.className = 'card-thumb-count';
      badge.textContent = '+' + (photos.length - 1);
      wrap.appendChild(badge);
    }
    card.insertBefore(wrap, card.firstChild);
  });

  var actionModal = document.getElementById('action-modal');
  var actionModalMedia = document.getElementById('action-modal-media');
  var actionModalTitle = document.getElementById('action-modal-title');
  var actionModalDesc = document.getElementById('action-modal-desc');

  function openActionModal(card) {
    var titleEl = card.querySelector('h3, h4');
    var descEl = card.querySelector('p');
    var title = titleEl ? titleEl.innerHTML : '';
    var desc = descEl ? descEl.innerHTML : '';
    var icon = card.querySelector('.icon') ? card.querySelector('.icon').textContent : '📌';
    var photo = card.dataset.photo;
    actionModalTitle.innerHTML = title;
    actionModalDesc.innerHTML = desc;
    var photos = photo ? photo.split('|') : [];
    actionModalMedia.classList.toggle('multi', photos.length > 1);
    actionModalMedia.innerHTML = photos.length
      ? photos.map(function (src) { return '<img src="' + src + '" alt="">'; }).join('')
      : '<span class="action-modal-icon">' + icon + '</span>';
    actionModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeActionModal() {
    actionModal.hidden = true;
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.action-card').forEach(function (card) {
    card.addEventListener('click', function () { openActionModal(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openActionModal(card); }
    });
  });
  actionModal.querySelector('.action-modal-backdrop').addEventListener('click', closeActionModal);
  actionModal.querySelector('.action-modal-close').addEventListener('click', closeActionModal);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !actionModal.hidden) closeActionModal(); });
})();
