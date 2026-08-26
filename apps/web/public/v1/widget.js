/**
 * Peptide MD booking widget.
 *
 * Drops an iframe into the host page and keeps it the right height. That is
 * the whole job, and it is deliberately small: this file runs inside another
 * company's website, so every line is a line that could break their page.
 *
 * An iframe rather than inline markup because the scope requires the widget be
 * "isolated so it cannot affect or be affected by the host website". Inline
 * markup shares their stylesheet, their globals and their CSS reset; an iframe
 * shares nothing.
 *
 *   <div id="peptide-booking"></div>
 *   <script src="https://peptidemd.co.uk/v1/widget.js"
 *           data-client-id="pmd_live_xxx" defer></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var clientId = script.getAttribute('data-client-id');
  if (!clientId) {
    // Console rather than throwing: an integration mistake on our side must
    // not take down the page it was pasted into.
    if (window.console) console.error('[peptide-md] data-client-id is missing on the widget script.');
    return;
  }

  // Derived from where this script was served, so a staging embed points at
  // staging without anyone editing the snippet.
  var origin = new URL(script.src, window.location.href).origin;
  var target =
    document.getElementById(script.getAttribute('data-target') || 'peptide-booking') ||
    (function () {
      // No container. Rather than failing silently, put it where the script is.
      var el = document.createElement('div');
      script.parentNode.insertBefore(el, script);
      return el;
    })();

  var frame = document.createElement('iframe');
  frame.src = origin + '/embed/' + encodeURIComponent(clientId);
  frame.title = 'Book a consultation';
  frame.loading = 'lazy';
  // Only what the widget actually needs. Notably no allow-top-navigation, so
  // nothing inside can redirect the host page away.
  frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
  frame.style.width = '100%';
  frame.style.border = '0';
  frame.style.display = 'block';
  frame.style.height = '620px';
  frame.style.colorScheme = 'normal';

  target.appendChild(frame);

  // The widget reports its own height as the flow gets taller. Without this an
  // iframe is either cut off or padded with dead space.
  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.type !== 'peptide-md:height' || data.clientId !== clientId) return;

    var height = Number(data.height);
    // Bounded: a bad number from anywhere should not be able to make the host
    // page scroll for a thousand pixels.
    if (!isFinite(height) || height < 200 || height > 4000) return;
    frame.style.height = Math.round(height) + 'px';
  });
})();
