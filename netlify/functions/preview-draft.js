const { findOrderBySessionId } = require('./_lib/airtable');
const { ROUNDS_LIMIT, PALETTES, FONT_PAIRS } = require('./_lib/design-presets');

// Photo slots are marked by generate-draft-background.js as data-wc-photo="N".
// Uploads land in the "Self-Serve Photos" attachment field with filenames
// like "slot-2.jpg" (uploadAttachment appends rather than replaces, so on a
// repeat upload to the same slot we keep the last matching attachment).
function resolvePhotoSlotUrls(attachments) {
  const bySlot = {};
  for (const att of attachments || []) {
    const match = /^slot-(\d+)\./.exec(att.filename || '');
    if (match) bySlot[match[1]] = att.url;
  }
  return bySlot;
}

function injectPhotoUrls(html, slotUrls) {
  let out = html;
  for (const [slotId, url] of Object.entries(slotUrls)) {
    const re = new RegExp(
      `(<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*data-wc-photo="${slotId}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`
    );
    out = out.replace(
      re,
      `$1<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">$4`
    );
  }
  return out;
}

function assistantWidget(sessionId, roundsUsed, roundsRemaining) {
  const hasRounds = roundsRemaining > 0;
  return `
<style>
  #wc-rev-fab{position:fixed;bottom:22px;right:22px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:999px;border:none;cursor:pointer;background:#0B1220;color:#fff;font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);}
  #wc-rev-fab:hover{transform:translateY(-2px);}
  #wc-rev-panel{position:fixed;bottom:22px;right:22px;z-index:2147483000;width:min(380px,calc(100vw - 44px));max-height:min(620px,calc(100vh - 44px));overflow-y:auto;background:#fff;color:#0B1220;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  #wc-rev-panel.wc-open{display:block;}
  #wc-rev-panel .wc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;}
  #wc-rev-panel .wc-head strong{font-size:.95rem;}
  #wc-rev-panel .wc-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:#8891a3;line-height:1;padding:2px 4px;}
  #wc-rev-panel .wc-body{padding:16px 18px;}
  #wc-rev-panel .wc-greet{font-size:.86rem;color:#3a4256;background:#f3f6fb;border-radius:10px;padding:12px 14px;margin-bottom:16px;line-height:1.5;}
  #wc-rev-panel .wc-greet b{color:#0B1220;}
  #wc-rev-panel label{display:block;font-weight:600;font-size:.85rem;margin-bottom:8px;}
  #wc-rev-panel .wc-hint{font-size:.78rem;color:#6b7280;margin-bottom:8px;}
  #wc-rev-panel input,#wc-rev-panel textarea,#wc-rev-panel select{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:inherit;font-size:.88rem;color:#0B1220;background:#f9fafb;box-sizing:border-box;}
  #wc-rev-panel textarea{min-height:80px;resize:vertical;}
  #wc-rev-panel button.wc-submit{width:100%;margin-top:14px;padding:11px;border:none;border-radius:8px;background:#0B1220;color:#fff;font-weight:600;font-size:.88rem;cursor:pointer;}
  #wc-rev-panel button.wc-submit:disabled{opacity:.5;cursor:not-allowed;}
  #wc-rev-panel .wc-error{color:#c0392b;font-size:.8rem;margin-top:6px;min-height:1em;}
  #wc-rev-panel hr{border:none;border-top:1px solid #eee;margin:20px 0;}
  #wc-rev-panel .wc-done{display:none;text-align:center;padding:20px 4px;font-size:.9rem;}
  #wc-rev-panel .wc-swatches{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;}
  #wc-rev-panel .wc-swatch{width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;flex:1 1 100%;}
  #wc-rev-panel .wc-swatch.wc-selected{border-color:#0B1220;background:#f3f6fb;}
  #wc-rev-panel .wc-swatch .wc-dot{width:20px;height:20px;border-radius:50%;flex:0 0 auto;border:1px solid rgba(0,0,0,.1);}
  #wc-rev-panel .wc-swatch .wc-label{font-size:.85rem;}
  #wc-rev-panel .wc-section{margin-bottom:18px;}
  .wc-photo-fab{position:absolute;top:10px;right:10px;z-index:900;width:36px;height:36px;border-radius:50%;border:none;background:rgba(11,18,32,.82);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,.25);}
  .wc-photo-fab.wc-queued{background:#3DDC97;color:#0B1220;}
  #wc-visual-fab{position:fixed;bottom:78px;right:22px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:999px;border:none;cursor:pointer;background:#3DDC97;color:#0B1220;font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);text-decoration:none;}
  #wc-visual-fab:hover{transform:translateY(-2px);}
</style>

<a id="wc-visual-fab" href="/visual-edit.html?session_id=${sessionId}">✏️ Edit directly</a>
<button id="wc-rev-fab" type="button">💬 ${hasRounds ? 'Ask for a change' : 'Request a change'}</button>

<div id="wc-rev-panel">
  <div class="wc-head"><strong>${hasRounds ? 'Your WebCloud assistant' : 'Request a change'}</strong><button class="wc-close" id="wc-rev-close" type="button">&times;</button></div>
  <div class="wc-body" id="wc-rev-form">
    ${hasRounds ? `
    <div class="wc-greet">Hi! I'm your WebCloud assistant. You can update colors, fonts, photos, wording, or anything else yourself, no need to wait on us — just describe it below or pick from the shortcuts. You have <b>${roundsRemaining} of ${ROUNDS_LIMIT}</b> free changes left. Camera icons on the page let you drop in your own photos too.</div>

    <div class="wc-section">
      <label>Color palette (optional shortcut)</label>
      <div class="wc-swatches" id="wc-palettes">
        ${PALETTES.map((p) => `<div class="wc-swatch" data-palette="${p.id}"><span class="wc-dot" style="background:${p.colors.accent}"></span><span class="wc-label">${p.label}</span></div>`).join('')}
      </div>
    </div>

    <div class="wc-section">
      <label for="wc-font-select">Font pair (optional shortcut)</label>
      <select id="wc-font-select">
        <option value="">No change</option>
        ${FONT_PAIRS.map((f) => `<option value="${f.id}">${f.label}</option>`).join('')}
      </select>
    </div>

    <div class="wc-section">
      <label for="wc-change-text">Anything else? Describe it in your own words</label>
      <div class="wc-hint">e.g. "make the hero background darker" or "change the tagline to..."</div>
      <textarea id="wc-change-text"></textarea>
    </div>

    <div class="wc-hint" id="wc-photo-queue-note" style="display:none;color:#1F8F63;font-weight:600;"></div>
    <button class="wc-submit" id="wc-apply-btn" type="button">Apply my changes</button>
    <div class="wc-error" id="wc-apply-error"></div>
    <div class="wc-hint" id="wc-apply-wait" style="display:none;margin-top:10px;">Working on it — this can take up to a minute...</div>
    ` : `
    <label for="wc-change-text">Want something changed?</label>
    <div class="wc-hint">You've used all your free self-service changes. Describe what else you'd like, and the WebCloud team will review it and get back to you.</div>
    <textarea id="wc-change-text"></textarea>
    <button class="wc-submit" id="wc-change-btn" type="button">Send to the team</button>
    <div class="wc-error" id="wc-change-error"></div>
    `}
  </div>
  <div class="wc-done" id="wc-rev-done"></div>
</div>

<script>
(function(){
  var sessionId = ${JSON.stringify(sessionId)};
  var fab = document.getElementById('wc-rev-fab');
  var panel = document.getElementById('wc-rev-panel');
  var closeBtn = document.getElementById('wc-rev-close');
  var form = document.getElementById('wc-rev-form');
  var done = document.getElementById('wc-rev-done');
  var pendingPhotos = {};

  fab.addEventListener('click', function(){ panel.classList.toggle('wc-open'); });
  closeBtn.addEventListener('click', function(){ panel.classList.remove('wc-open'); });

  function showDone(message){
    form.style.display = 'none';
    done.textContent = message;
    done.style.display = 'block';
  }

  // --- Photo slot overlays (only meaningful while rounds remain) ---
  ${hasRounds ? `
  var queueNote = document.getElementById('wc-photo-queue-note');
  function updateQueueNote(){
    var n = Object.keys(pendingPhotos).length;
    if (n > 0) {
      queueNote.style.display = 'block';
      queueNote.textContent = n === 1
        ? '1 photo queued below \\u2014 click "Apply my changes" to save it.'
        : n + ' photos queued below \\u2014 click "Apply my changes" to save them.';
    } else {
      queueNote.style.display = 'none';
    }
  }

  document.querySelectorAll('[data-wc-photo]').forEach(function(el){
    var slotId = el.getAttribute('data-wc-photo');
    var computed = window.getComputedStyle(el);
    if (computed.position === 'static') el.style.position = 'relative';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wc-photo-fab';
    btn.textContent = '\\uD83D\\uDCF7';
    btn.title = 'Add your own photo here';
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    btn.addEventListener('click', function(){ input.click(); });
    input.addEventListener('change', function(){
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        var result = String(reader.result || '');
        var m = /^data:(.+);base64,(.*)$/.exec(result);
        if (!m) return;
        pendingPhotos[slotId] = { slotId: slotId, contentType: m[1], base64: m[2], filename: file.name || 'photo.jpg' };
        btn.classList.add('wc-queued');
        btn.textContent = '\\u2713';
        btn.title = 'Photo queued \\u2014 click "Apply my changes" below to save it';
        // Not yet saved - only the "Apply my changes" click actually uploads
        // it, so pop the panel open right away instead of leaving the
        // customer with a checkmark that looks done but silently isn't.
        panel.classList.add('wc-open');
        updateQueueNote();
      };
      reader.readAsDataURL(file);
    });
    el.appendChild(btn);
    el.appendChild(input);
  });

  var selectedPalette = null;
  document.querySelectorAll('#wc-palettes .wc-swatch').forEach(function(sw){
    sw.addEventListener('click', function(){
      var id = sw.getAttribute('data-palette');
      if (selectedPalette === id) {
        selectedPalette = null;
        sw.classList.remove('wc-selected');
        return;
      }
      document.querySelectorAll('#wc-palettes .wc-swatch').forEach(function(s){ s.classList.remove('wc-selected'); });
      selectedPalette = id;
      sw.classList.add('wc-selected');
    });
  });

  function pollUntilReady(btn, errorEl, waitEl){
    var attempts = 0;
    var timer = setInterval(function(){
      attempts++;
      fetch('/.netlify/functions/order?session_id=' + encodeURIComponent(sessionId))
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(function(order){
          if (order && order.draftStatus !== 'Self-Editing') {
            clearInterval(timer);
            showDone('Applied! Reloading your preview...');
            setTimeout(function(){ window.location.reload(); }, 1000);
          } else if (attempts > 40) {
            clearInterval(timer);
            waitEl.style.display = 'none';
            errorEl.textContent = "This is taking longer than expected — refresh the page in a bit to check.";
            btn.disabled = false;
            btn.textContent = 'Apply my changes';
          }
        })
        .catch(function(){});
    }, 3000);
  }

  document.getElementById('wc-apply-btn').addEventListener('click', function(){
    var btn = this;
    var errorEl = document.getElementById('wc-apply-error');
    var waitEl = document.getElementById('wc-apply-wait');
    errorEl.textContent = '';
    var fontId = document.getElementById('wc-font-select').value;
    var photos = Object.keys(pendingPhotos).map(function(k){ return pendingPhotos[k]; });
    var changeText = document.getElementById('wc-change-text').value.trim();
    if (!selectedPalette && !fontId && !photos.length && !changeText) {
      errorEl.textContent = 'Pick a color/font/photo, or describe a change, first.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Applying...';
    fetch('/.netlify/functions/self-serve-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, paletteId: selectedPalette, fontId: fontId || undefined, photos: photos, changeText: changeText || undefined }),
    }).then(function(res){
      if (res.status === 403) { throw new Error('limit'); }
      if (!res.ok) throw new Error('failed');
      return res.json();
    }).then(function(data){
      if (data && data.processing) {
        btn.textContent = 'Working on it...';
        waitEl.style.display = 'block';
        pollUntilReady(btn, errorEl, waitEl);
      } else {
        showDone('Applied! Reloading your preview...');
        setTimeout(function(){ window.location.reload(); }, 1200);
      }
    }).catch(function(err){
      if (err.message === 'limit') {
        errorEl.textContent = "You've used all your free changes - use the team request box below instead.";
      } else {
        errorEl.textContent = 'Something went wrong. Please try again.';
      }
      btn.disabled = false;
      btn.textContent = 'Apply my changes';
    });
  });
  ` : ''}

  document.getElementById('wc-change-btn').addEventListener('click', function(){
    var btn = this;
    var errorEl = document.getElementById('wc-change-error');
    var text = document.getElementById('wc-change-text').value.trim();
    errorEl.textContent = '';
    if (!text) { errorEl.textContent = "Please describe what you'd like changed."; return; }
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    fetch('/.netlify/functions/request-revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, revisionText: text }),
    }).then(function(res){
      if (!res.ok) throw new Error('Request failed');
      showDone("Got it - the WebCloud team is preparing an updated version. Check back on your questionnaire page shortly.");
    }).catch(function(){
      errorEl.textContent = 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Send to the team';
    });
  });
})();
</script>
`;
}

exports.resolvePhotoSlotUrls = resolvePhotoSlotUrls;
exports.injectPhotoUrls = injectPhotoUrls;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: 'Missing session_id' };
  }

  let record;
  try {
    record = await findOrderBySessionId(sessionId);
  } catch (err) {
    console.error('preview-draft lookup failed:', err.message);
    return { statusCode: 500, body: 'Failed to look up draft' };
  }

  let html = record?.fields?.['Draft HTML'];

  if (!html) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Draft not found or not ready yet.',
    };
  }

  const slotUrls = resolvePhotoSlotUrls(record.fields['Self-Serve Photos']);
  html = injectPhotoUrls(html, slotUrls);

  const roundsUsed = record.fields['Self-Serve Rounds Used'] || 0;
  const roundsRemaining = Math.max(0, ROUNDS_LIMIT - roundsUsed);
  const widget = assistantWidget(sessionId, roundsUsed, roundsRemaining);
  const htmlWithWidget = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${widget}</body>`)
    : `${html}${widget}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: htmlWithWidget,
  };
};
