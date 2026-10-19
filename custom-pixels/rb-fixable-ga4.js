// Rust Buster: "Is My Vehicle Fixable?" click events to GA4.
// Not part of the theme. Shopify's GitHub sync ignores this folder, so nothing here deploys.
//
// Setup (Shopify admin > Settings > Customer events > Add custom pixel):
//   1. Name it "RB Fixable GA4" and paste everything below this header block.
//   2. Customer privacy > Permission: "Required", purpose: Analytics.
//      Shopify then loads the pixel only for visitors who allow analytics where consent is required.
//   3. Data sale: "Data collected does not qualify as data sale".
//   4. Save, then Connect.
//
// Events are published by assets/rb-photo-review.js with Shopify.analytics.publish().
// page_view is off because the Google & YouTube app already sends page views to this property.
// Set DEBUG to true while checking GA4 DebugView, then back to false.

const GA4_ID = 'G-EM21KQT02Z';
const DEBUG = false;
const EVENTS = [
  'rb_fixable_email_click',
  'rb_fixable_gmail_click',
  'rb_fixable_copy_click',
  'rb_fixable_hero_click',
];
const LINK_LOCATIONS = ['send_it_card', 'hero'];

let analyticsAllowed = Boolean(init.customerPrivacy && init.customerPrivacy.analyticsProcessingAllowed);

window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}

gtag('consent', 'default', {
  analytics_storage: analyticsAllowed ? 'granted' : 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

const gtagScript = document.createElement('script');
gtagScript.async = true;
gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
document.head.appendChild(gtagScript);

const gaConfig = { send_page_view: false };
// GA4 treats any debug_mode value, even false, as debug traffic, so only add it when needed.
if (DEBUG) gaConfig.debug_mode = true;

gtag('js', new Date());
gtag('config', GA4_ID, gaConfig);

api.customerPrivacy.subscribe('visitorConsentCollected', (event) => {
  analyticsAllowed = Boolean(event.customerPrivacy && event.customerPrivacy.analyticsProcessingAllowed);
  gtag('consent', 'update', { analytics_storage: analyticsAllowed ? 'granted' : 'denied' });
});

EVENTS.forEach((name) => {
  analytics.subscribe(name, (event) => {
    if (!analyticsAllowed) return;

    // Anyone can publish custom events from the browser console, so only known values are forwarded.
    const location = event.customData && event.customData.link_location;
    const doc = event.context && event.context.document;

    // The pixel runs in a sandboxed iframe, so the page URL and title must be passed explicitly.
    gtag('event', name, {
      link_location: LINK_LOCATIONS.includes(location) ? location : 'unknown',
      page_location: doc && doc.location ? doc.location.href : undefined,
      page_title: doc ? doc.title : undefined,
      page_referrer: doc ? doc.referrer : undefined,
    });
  });
});
