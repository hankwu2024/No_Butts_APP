// Click any content photo to view the full, uncropped original.
(function () {
  var box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">✕</button><img alt=""><p class="lightbox-caption"></p>';
  document.body.appendChild(box);
  var boxImg = box.querySelector('img');
  var boxCaption = box.querySelector('.lightbox-caption');

  function zoomable(img) {
    return !img.closest('.brand, .action-card, .lightbox, a, button');
  }
  function open(src, alt, caption) {
    boxImg.src = src;
    boxImg.alt = alt || '';
    boxCaption.textContent = caption || '';
    box.hidden = false;
    document.body.classList.add('lightbox-open');
  }
  function close() {
    box.hidden = true;
    boxImg.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
  }

  document.addEventListener('click', function (e) {
    // buttons/links can open a photo that isn't shown on the page: data-lightbox="path"
    var trigger = e.target.closest('[data-lightbox]');
    if (trigger) {
      e.preventDefault();
      var li = trigger.closest('li');
      var label = li && li.querySelector('[data-i18n]');
      open(trigger.dataset.lightbox, '', label ? label.textContent : '');
      return;
    }
    var img = e.target.closest('img');
    if (img && zoomable(img)) {
      e.preventDefault();
      var fig = img.closest('figure');
      var cap = fig && fig.querySelector('figcaption');
      open(img.currentSrc || img.src, img.alt, cap ? cap.textContent : '');
    }
  });
  box.addEventListener('click', function (e) { if (e.target !== boxImg) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !box.hidden) { e.stopPropagation(); close(); }
  }, true);
})();
