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
  function open(img) {
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt;
    var fig = img.closest('figure');
    var cap = fig && fig.querySelector('figcaption');
    boxCaption.textContent = cap ? cap.textContent : '';
    box.hidden = false;
    document.body.classList.add('lightbox-open');
  }
  function close() {
    box.hidden = true;
    boxImg.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest('img');
    if (img && zoomable(img)) { e.preventDefault(); open(img); }
  });
  box.addEventListener('click', function (e) { if (e.target !== boxImg) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !box.hidden) { e.stopPropagation(); close(); }
  }, true);
})();
