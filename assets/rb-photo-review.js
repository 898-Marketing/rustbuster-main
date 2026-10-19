(function () {
  if (window.rbPhotoReviewLoaded) return;
  window.rbPhotoReviewLoaded = true;

  var COPY_RESET_MS = 2000;
  var STICKY_GAP_PX = 20;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var asideObserver = 'ResizeObserver' in window ? new ResizeObserver(fitStickyAsides) : null;

  // encodeURIComponent leaves !'()* alone; some mail clients mangle the apostrophe in "I'd".
  function encode(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  function track(name, params) {
    try {
      var shopifyAnalytics = window.Shopify && window.Shopify.analytics;
      if (shopifyAnalytics && typeof shopifyAnalytics.publish === 'function') {
        shopifyAnalytics.publish(name, params);
      } else if (typeof window.gtag === 'function') {
        window.gtag('event', name, params);
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(Object.assign({ event: name }, params));
      }
    } catch (e) {}
  }

  function buildEmailLinks(root) {
    root.querySelectorAll('[data-rb-email-config]').forEach(function (configEl) {
      var scope = configEl.closest('.shopify-section') || document;
      var config;
      try {
        config = JSON.parse(configEl.textContent);
      } catch (e) {
        return;
      }

      var to = (config.to || '').trim();
      var subject = encode(config.subject || '');
      var body = encode((config.body || '').replace(/\r?\n/g, '\r\n'));

      scope.querySelectorAll('[data-rb-mailto]').forEach(function (link) {
        link.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
      });
      scope.querySelectorAll('[data-rb-gmail]').forEach(function (link) {
        link.href =
          'https://mail.google.com/mail/?view=cm&fs=1&to=' + encode(to) + '&su=' + subject + '&body=' + body;
      });
    });
  }

  function fitStickyAsides() {
    var header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
    document.querySelectorAll('[data-rb-sticky-aside]').forEach(function (aside) {
      aside.classList.toggle('is-sticky', aside.offsetHeight + header + STICKY_GAP_PX * 2 <= window.innerHeight);
    });
  }

  function watchStickyAsides(root) {
    if (asideObserver) {
      root.querySelectorAll('[data-rb-sticky-aside]').forEach(function (aside) {
        asideObserver.observe(aside);
      });
    }
    fitStickyAsides();
  }

  function copyWithSelection(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.setAttribute('aria-hidden', 'true');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {}
    field.remove();
    return copied ? Promise.resolve() : Promise.reject();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyWithSelection(text);
      });
    }
    return copyWithSelection(text);
  }

  function handleCopy(button) {
    var label = button.dataset.rbCopyLabel || button.textContent.trim();
    var copiedLabel = button.dataset.rbCopiedLabel || label;
    var card = button.closest('[data-rb-send-card]');
    var status = card && card.querySelector('[data-rb-copy-status]');
    button.dataset.rbCopyLabel = label;

    copyText(button.dataset.rbCopyText || '').then(function () {
      clearTimeout(button.rbCopyTimer);
      button.textContent = copiedLabel;
      button.classList.add('is-copied');
      if (status) {
        status.textContent = '';
        window.setTimeout(function () {
          status.textContent = copiedLabel;
        }, 50);
      }
      button.rbCopyTimer = window.setTimeout(function () {
        button.textContent = label;
        button.classList.remove('is-copied');
        if (status) status.textContent = '';
      }, COPY_RESET_MS);
    }, function () {});
  }

  function findAnchorTarget(link) {
    if (!link.hash || link.origin !== window.location.origin) return null;
    var id;
    try {
      id = decodeURIComponent(link.hash.slice(1));
    } catch (e) {
      return null;
    }
    var target = id && document.getElementById(id);
    return target && target.hasAttribute('data-rb-scroll-target') ? target : null;
  }

  function scrollToTarget(target) {
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '#' + target.id);
    }
  }

  document.addEventListener('click', function (event) {
    var el = event.target.closest('a, button');
    if (!el) return;

    if (el.matches('[data-rb-mailto]')) {
      track('rb_fixable_email_click', { link_location: 'send_it_card' });
      return;
    }
    if (el.matches('[data-rb-gmail]')) {
      track('rb_fixable_gmail_click', { link_location: 'send_it_card' });
      return;
    }
    if (el.matches('[data-rb-copy]')) {
      handleCopy(el);
      track('rb_fixable_copy_click', { link_location: 'send_it_card' });
      return;
    }
    if (el.tagName !== 'A') return;

    // Also catches full-path links like /pages/is-my-vehicle-fixable#send-it, so they scroll in place on a demo page with another handle.
    var target = findAnchorTarget(el);
    if (!target) return;

    if (target.hasAttribute('data-rb-send-card') && !target.contains(el)) {
      track('rb_fixable_hero_click', { link_location: 'hero' });
    }
    event.preventDefault();
    scrollToTarget(target);
  });

  buildEmailLinks(document);
  watchStickyAsides(document);
  window.addEventListener('resize', fitStickyAsides);
  window.addEventListener('load', fitStickyAsides);

  document.addEventListener('shopify:section:load', function (event) {
    buildEmailLinks(event.target);
    watchStickyAsides(event.target);
  });
})();
