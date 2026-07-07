const { findOrderBySessionId } = require('./_lib/airtable');

function revisionWidget(sessionId) {
  return `
<style>
  #wc-rev-fab{position:fixed;bottom:22px;right:22px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:14px 20px;border-radius:999px;border:none;cursor:pointer;background:#0B1220;color:#fff;font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);}
  #wc-rev-fab:hover{transform:translateY(-2px);}
  #wc-rev-panel{position:fixed;bottom:22px;right:22px;z-index:2147483000;width:min(360px,calc(100vw - 44px));max-height:min(560px,calc(100vh - 44px));overflow-y:auto;background:#fff;color:#0B1220;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  #wc-rev-panel.wc-open{display:block;}
  #wc-rev-panel .wc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;}
  #wc-rev-panel .wc-head strong{font-size:.95rem;}
  #wc-rev-panel .wc-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:#8891a3;line-height:1;padding:2px 4px;}
  #wc-rev-panel .wc-body{padding:16px 18px;}
  #wc-rev-panel label{display:block;font-weight:600;font-size:.88rem;margin-bottom:4px;}
  #wc-rev-panel .wc-hint{font-size:.78rem;color:#6b7280;margin-bottom:8px;}
  #wc-rev-panel input,#wc-rev-panel textarea{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:inherit;font-size:.88rem;color:#0B1220;background:#f9fafb;box-sizing:border-box;}
  #wc-rev-panel textarea{min-height:80px;resize:vertical;}
  #wc-rev-panel button.wc-submit{width:100%;margin-top:10px;padding:11px;border:none;border-radius:8px;background:#0B1220;color:#fff;font-weight:600;font-size:.88rem;cursor:pointer;}
  #wc-rev-panel button.wc-submit:disabled{opacity:.5;cursor:not-allowed;}
  #wc-rev-panel .wc-error{color:#c0392b;font-size:.8rem;margin-top:6px;min-height:1em;}
  #wc-rev-panel hr{border:none;border-top:1px solid #eee;margin:20px 0;}
  #wc-rev-panel .wc-done{display:none;text-align:center;padding:20px 4px;font-size:.9rem;}
</style>

<button id="wc-rev-fab" type="button">✏️ Request a change</button>

<div id="wc-rev-panel">
  <div class="wc-head"><strong>Request a change</strong><button class="wc-close" id="wc-rev-close" type="button">&times;</button></div>
  <div class="wc-body" id="wc-rev-form">
    <label for="wc-photo-link">Add or update your photos</label>
    <div class="wc-hint">Paste a Google Drive/Dropbox link with photos to add or replace.</div>
    <input type="text" id="wc-photo-link" placeholder="https://drive.google.com/...">
    <button class="wc-submit" id="wc-photo-btn" type="button">Update photos</button>
    <div class="wc-error" id="wc-photo-error"></div>

    <hr>

    <label for="wc-change-text">Want something changed?</label>
    <div class="wc-hint">Describe what you'd like different — we'll prepare an updated version for you.</div>
    <textarea id="wc-change-text"></textarea>
    <button class="wc-submit" id="wc-change-btn" type="button">Request changes</button>
    <div class="wc-error" id="wc-change-error"></div>
  </div>
  <div class="wc-done" id="wc-rev-done">Got it — we're preparing an updated version. Check back on your questionnaire page shortly.</div>
</div>

<script>
(function(){
  var sessionId = ${JSON.stringify(sessionId)};
  var fab = document.getElementById('wc-rev-fab');
  var panel = document.getElementById('wc-rev-panel');
  var closeBtn = document.getElementById('wc-rev-close');
  var form = document.getElementById('wc-rev-form');
  var done = document.getElementById('wc-rev-done');

  fab.addEventListener('click', function(){ panel.classList.toggle('wc-open'); });
  closeBtn.addEventListener('click', function(){ panel.classList.remove('wc-open'); });

  function submitRevision(text, btn, errorEl){
    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = 'Submitting...';
    fetch('/.netlify/functions/request-revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, revisionText: text }),
    }).then(function(res){
      if (!res.ok) throw new Error('Request failed');
      form.style.display = 'none';
      done.style.display = 'block';
    }).catch(function(){
      errorEl.textContent = 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.textContent = originalText;
    });
  }

  document.getElementById('wc-photo-btn').addEventListener('click', function(){
    var btn = this;
    var errorEl = document.getElementById('wc-photo-error');
    var link = document.getElementById('wc-photo-link').value.trim();
    errorEl.textContent = '';
    if (!link) { errorEl.textContent = 'Please paste a link to your photos.'; return; }
    submitRevision('Updated photo link — please use these photos: ' + link, btn, errorEl);
  });

  document.getElementById('wc-change-btn').addEventListener('click', function(){
    var btn = this;
    var errorEl = document.getElementById('wc-change-error');
    var text = document.getElementById('wc-change-text').value.trim();
    errorEl.textContent = '';
    if (!text) { errorEl.textContent = "Please describe what you'd like changed."; return; }
    submitRevision(text, btn, errorEl);
  });
})();
</script>
`;
}

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

  const html = record?.fields?.['Draft HTML'];

  if (!html) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Draft not found or not ready yet.',
    };
  }

  const widget = revisionWidget(sessionId);
  const htmlWithWidget = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${widget}</body>`)
    : `${html}${widget}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: htmlWithWidget,
  };
};
