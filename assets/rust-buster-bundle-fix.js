/**
 * Rust Buster - MageWorkx bundle offer heading fix
 *
 * MageWorkx renders each bundle offer as its own ".ProductAddons" block
 * inside the shadow DOM of <mw-product-addons>, each with its own
 * "Recommended for you" heading and a redundant product description line
 * (the item's title already appears on the item card itself).
 *
 * This keeps only the first offer's heading, hides all description lines,
 * and re-applies itself if MageWorkx re-renders the widget (e.g. on
 * variant change) since that can wipe out injected styles.
 */
(function () {
  function injectBundleStyles(shadowRoot) {
    if (shadowRoot.querySelector('style[data-rb-bundle-fix]')) return;

    var style = document.createElement('style');
    style.setAttribute('data-rb-bundle-fix', 'true');
    style.textContent =
      '.ProductAddons:not(:first-of-type) .ProductAddons__Heading {' +
      '  display: none !important;' +
      '}' +
      '.ProductAddons__Description {' +
      '  display: none !important;' +
      '}' +
      /* The theme reserves space above each offer for its (now-hidden)
         heading. Without this, offers after the first show a large gap
         above their content. */
      '.ProductAddons:not(:first-of-type) {' +
      '  padding-top: 0 !important;' +
      '}' +
      '.ProductAddons:not(:first-of-type) > .ProductAddons__Content {' +
      '  margin-top: 0 !important;' +
      '}' +
      /* Tightens the gap between stacked offer items so the list reads
         as one group rather than separate blocks. */
      '.ProductAddons {' +
      '  padding-bottom: 8px !important;' +
      '}';

    shadowRoot.appendChild(style);
  }

  function watchAddons(host) {
    if (!host.shadowRoot) return;

    injectBundleStyles(host.shadowRoot);

    var observer = new MutationObserver(function () {
      injectBundleStyles(host.shadowRoot);
    });

    observer.observe(host.shadowRoot, { childList: true, subtree: true });
  }

  function init() {
    var host = document.querySelector('mw-product-addons');

    if (host) {
      watchAddons(host);
      return;
    }

    // Widget element isn't in the DOM yet, watch for it to appear
    var bodyObserver = new MutationObserver(function (mutations, obs) {
      var el = document.querySelector('mw-product-addons');
      if (el) {
        watchAddons(el);
        obs.disconnect();
      }
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();