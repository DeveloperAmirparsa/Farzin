'use strict';
(function (root) {
  root.FarzinQuotePrices = function (value, settings = {}) {
    if (value === null || value === undefined || value === '') return null;
    const price = Number(value);
    if (!Number.isFinite(price)) return null;
    const buySpread = Math.max(-20, Math.min(20, Number(settings.buySpreadPercent) || 0));
    const sellSpread = Math.max(-20, Math.min(20, Number(settings.sellSpreadPercent) || 0));
    return {
      buy: price * (1 - buySpread / 100),
      sell: price * (1 + sellSpread / 100)
    };
  };
})(typeof window === 'undefined' ? globalThis : window);
