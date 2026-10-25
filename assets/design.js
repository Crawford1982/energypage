/* Geographic selectors describe reporting zones; they do not model network flows. */
(function () {
  var descriptions = {
    north: ['North of B4', 'The northern transmission area. A useful first distinction when investigating where flexible demand could help.'],
    south: ['Between B4 and B6', 'Central and southern Scotland. Being in the same reporting zone does not establish that a site can relieve a particular constraint.']
  };
  document.querySelectorAll('[data-zone]').forEach(function (button) {
    button.addEventListener('click', function () {
      var zone = button.dataset.zone;
      document.querySelectorAll('[data-zone]').forEach(function (other) {
        other.classList.toggle('selected', other === button);
        other.setAttribute('aria-pressed', String(other === button));
      });
      document.querySelector('.atlas').dataset.active = zone;
      document.getElementById('zone-title').textContent = descriptions[zone][0];
      document.getElementById('zone-description').textContent = descriptions[zone][1];
    });
  });
  document.getElementById('zone-description').setAttribute('aria-live', 'polite');
  document.querySelector('.atlas').dataset.active = 'north';
})();
