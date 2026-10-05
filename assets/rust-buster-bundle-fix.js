/* MageWorkx add-ons render in <mw-product-addons> shadow DOM, which document CSS can't reach. */
(function () {
  var STYLE_ATTR = 'data-rb-bundle-fix';
  var SHADOW_POLL_MS = 400;
  var SHADOW_POLL_MAX_TRIES = 20;

  var watchedHosts = new WeakSet();

  // The app's min-width:120px plus fixed flex-bases give each row a ~364px minimum, overflowing phones under ~474px.
  var OVERFLOW_CSS =
    '.ProductAddons__Content { min-width: 0 !important; }' +
    '.ProductAddons__Item { min-width: 0 !important; }' +
    '.ProductAddons__ContentBlock { flex: 1 1 auto !important; min-width: 0 !important; }';

  var DEFAULT_CSS =
    '.ProductAddons:not(:first-of-type) .ProductAddons__Heading { display: none !important; }' +
    '.ProductAddons__Description { display: none !important; }' +
    '.ProductAddons:not(:first-of-type) { padding-top: 0 !important; }' +
    '.ProductAddons:not(:first-of-type) > .ProductAddons__Content { margin-top: 0 !important; }' +
    '.ProductAddons { padding-bottom: 8px !important; }' +
    OVERFLOW_CSS;

  function redesignCss(priceSelector) {
    return (
      '.ProductAddons { padding: 0 !important; margin: 0 !important; }' +
      '.ProductAddons__Heading, .ProductAddons__Description { display: none !important; }' +
      '.ProductAddons__Item { display: flex !important; align-items: center !important; gap: 14px !important;' +
      '  padding: 14px 0 !important; border-top: 1px solid #ECECEC !important; margin: 0 !important; }' +
      '.ProductAddons__Qty { display: none !important; }' +
      '.ProductAddons__Image img { border-radius: 6px !important; }' +
      OVERFLOW_CSS +
      '.ProductAddons__Checkbox { flex: 0 0 22px !important; }' +
      '.ProductAddons__ImageBlock { flex: 0 0 58px !important; }' +
      '.ProductAddons__Pricing { flex: 0 0 auto !important; }' +
      '.ProductAddons__Title a { font-size: 14px !important; line-height: 1.35 !important;' +
      '  color: #1a1a1a !important; text-decoration: none !important; font-weight: 500 !important; }' +
      priceSelector + ' { font-weight: 800 !important; font-size: 15px !important;' +
      '  margin-left: auto !important; white-space: nowrap !important; }' +
      // On phones the title column shrinks to ~65px and breaks mid-word, so the price moves under the title.
      '@media screen and (max-width: 749px) {' +
      '  .ProductAddons__Item { display: grid !important; grid-template-columns: 22px 48px minmax(0, 1fr);' +
      '    grid-template-areas: "check image title" "check image price";' +
      '    column-gap: 12px !important; row-gap: 2px !important; align-items: center !important; }' +
      '  .ProductAddons__Checkbox { grid-area: check; }' +
      '  .ProductAddons__ImageBlock { grid-area: image; }' +
      '  .ProductAddons__Image { width: 48px !important; height: 48px !important; min-width: 0 !important; }' +
      '  .ProductAddons__ContentBlock { grid-area: title; align-self: end; }' +
      '  .ProductAddons__Pricing { grid-area: price; align-self: start; }' +
      '  ' + priceSelector + ' { margin-left: 0 !important; }' +
      '}'
    );
  }

  // The price element's class isn't stable across app versions, so locate it by its "$" text.
  function findPriceSelector(shadowRoot) {
    var nodes = shadowRoot.querySelectorAll('*');

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length !== 0 || !/^\$\d/.test(el.textContent.trim())) continue;

      var classes = String(el.className || '').trim().split(/\s+/).filter(Boolean);
      if (classes.length) return '.' + classes.map(CSS.escape).join('.');
    }

    return '.ProductAddons__Price';
  }

  function injectStyles(host, isRedesign) {
    var shadowRoot = host.shadowRoot;
    var css = isRedesign ? redesignCss(findPriceSelector(shadowRoot)) : DEFAULT_CSS;
    var style = shadowRoot.querySelector('style[' + STYLE_ATTR + ']');

    if (!style) {
      style = document.createElement('style');
      style.setAttribute(STYLE_ATTR, 'true');
      shadowRoot.appendChild(style);
    }

    // Writing is itself a mutation the shadowRoot observer sees, so an unconditional write would loop.
    if (style.textContent !== css) style.textContent = css;
  }

  // Only add the card once offers render, so products without add-ons get no empty card or orphan heading.
  function syncCard(host) {
    var appBlock = host.closest('.shopify-app-block');
    if (!appBlock) return;

    var hasItems = !!host.shadowRoot.querySelector('.ProductAddons__Item');
    var head = appBlock.querySelector(':scope > .rb-addons-head');

    appBlock.classList.toggle('rb-addons', hasItems);

    if (hasItems && !head) {
      head = document.createElement('div');
      head.className = 'rb-addons-head';
      head.innerHTML =
        '<h2 class="rb-addons-head__title">Finish the job</h2>' +
        '<p class="rb-addons-head__text">Optional. Most installers add these.</p>';
      appBlock.insertBefore(head, appBlock.firstChild);
    } else if (!hasItems && head) {
      head.remove();
    }
  }

  function apply(host) {
    var isRedesign = !!host.closest('.rb-pdp');

    injectStyles(host, isRedesign);
    if (isRedesign) syncCard(host);
  }

  function watchShadowRoot(host) {
    apply(host);

    var observer = new MutationObserver(function () {
      apply(host);
    });

    observer.observe(host.shadowRoot, { childList: true, subtree: true });
  }

  // MageWorkx attaches its shadow root asynchronously, so the host can exist before host.shadowRoot does.
  function watchHost(host) {
    if (watchedHosts.has(host)) return;
    watchedHosts.add(host);

    if (host.shadowRoot) {
      watchShadowRoot(host);
      return;
    }

    var tries = 0;
    var timer = setInterval(function () {
      if (host.shadowRoot) {
        clearInterval(timer);
        watchShadowRoot(host);
      } else if (++tries >= SHADOW_POLL_MAX_TRIES) {
        clearInterval(timer);
      }
    }, SHADOW_POLL_MS);
  }

  function watchAllHosts() {
    document.querySelectorAll('mw-product-addons').forEach(watchHost);
  }

  function init() {
    watchAllHosts();
    new MutationObserver(watchAllHosts).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
