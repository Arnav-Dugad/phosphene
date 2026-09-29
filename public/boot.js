/*
 * Runs before first paint: applies the visitor's saved preferences to <html>
 * so the page never flashes the wrong theme, contrast or motion level.
 * Kept as a tiny external file so the Content-Security-Policy needs no inline scripts.
 */
(function () {
  var root = document.documentElement;
  var settings = {};
  try {
    var raw = window.localStorage.getItem('phosphene:settings');
    if (raw) settings = (JSON.parse(raw) || {}).state || {};
  } catch (e) {
    settings = {};
  }
  var mq = function (q) {
    return window.matchMedia && window.matchMedia(q).matches;
  };
  var motion = settings.motion && settings.motion !== 'system'
    ? settings.motion
    : mq('(prefers-reduced-motion: reduce)') ? 'still' : 'full';
  var contrast = settings.contrast && settings.contrast !== 'system'
    ? settings.contrast
    : mq('(prefers-contrast: more)') ? 'high' : 'standard';
  root.dataset.theme = settings.theme === 'plate' ? 'plate' : 'nocturne';
  root.dataset.motion = motion;
  root.dataset.contrast = contrast;
})();
