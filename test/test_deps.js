window.__karma__.loaded = ((orig) => {
  // for some reason, tests sometimes run before the DOM is ready
  return function () {
    if (document.readyState === "complete") {
      orig();
    } else {
      window.onload = orig;
    }
  }
})(window.__karma__.loaded.bind(window.__karma__));

window.process = {
  env: {
    NODE_ENV: 'production'
  }
};

window.addEventListener('error', function (ev) {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', ev.error, ev.error?.stack);
})

window.addEventListener('unhandledrejection', function (ev) {
  // this message is used for counting intentional failures created in the tests 
  if (ev.reason === 'pending failure') return;
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', ev.reason);
})

require('test/helpers/global_hooks.js');
require('test/helpers/consentData.js');
require('test/helpers/prebidGlobal.js');
require('test/mocks/adloaderStub.js');
require('test/mocks/xhr.js');
require('test/mocks/analyticsStub.js');
require('test/mocks/ortbConverter.js')
require('modules/rtdModule/index.js');
require('modules/fpdModule/index.js');
