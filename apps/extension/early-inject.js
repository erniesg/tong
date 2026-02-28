// Inject interceptor into MAIN world at document_start,
// BEFORE YouTube's JavaScript loads. This ensures our XHR/fetch
// patches capture the initial caption (timedtext) fetch.
var s = document.createElement('script');
s.src = chrome.runtime.getURL('interceptor.js');
s.onload = function () { s.remove(); };
(document.head || document.documentElement).prepend(s);
