/*
 * The footer's "Check for Updates" button.
 *
 * It asks the live updater (js/live-update.js) to fetch the newest copy of the app and restart
 * it in this same page, even when the version hasn't changed, so the tab never reloads. A
 * "Checking for updates…" notice shows meanwhile, and the updater's notice replaces it. Without the updater there's nothing to ask, and the
 * button stays hidden.
 */
(function () {
  'use strict';

  const button = document.getElementById('checkUpdates');
  const label = document.getElementById('checkUpdatesLabel');
  const updater = window.ToptextLiveUpdate;
  if (!button || !label || !updater || typeof updater.refresh !== 'function') return;

  function busy(on) {
    button.disabled = on;
    button.classList.toggle('is-checking', on);
    button.setAttribute('aria-busy', String(on));
    label.textContent = on ? 'Checking for updates…' : 'Check for Updates';
  }

  button.hidden = false;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    busy(true);
    if (window.ToptextToasts) {
      // The same key as the updater's notices, so its answer takes this one's place.
      window.ToptextToasts.show({ text: 'Checking for updates…', icon: 'checking', wrap: true, duration: 30000, key: 'live-update' });
    }
    try {
      // When the app restarts, this button goes away with the rest of the old page.
      await updater.refresh();
    } catch (error) {
      console.warn('Toptext: Check for Updates failed.', error);
      if (window.ToptextToasts) {
        window.ToptextToasts.show({
          text: "Couldn't check for updates. Try again in a moment.",
          icon: 'warning',
          wrap: true,
          key: 'live-update',
        });
      }
    } finally {
      if (button.isConnected) busy(false);
    }
  });

  if (window.ToptextSplash) window.ToptextSplash.partLoaded();
})();
