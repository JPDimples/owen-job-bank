/* Owen's Job Bank — renders everything from ./data/*.json. No job/program data is hardcoded. */
(function () {
  'use strict';

  var DATA_FILES = {
    jobs: './data/jobs.json',
    programs: './data/programs.json',
    schooling: './data/schooling.json',
    initiatives: './data/initiatives.json',
    paths: './data/career-paths.json',
    internships: './data/internships.json',
    sites: './data/job-sites.json',
    wage: './data/minimum-wage.json',
    meta: './data/meta.json'
  };

  var state = {
    town: 'Bowmanville',
    search: '',
    noExpOnly: false,
    growthOnly: false,
    pay: 'all',
    category: 'all'
  };

  var data = { jobs: [], programs: [], schooling: [], initiatives: [], paths: [], internships: [], sites: [], wage: null, meta: null };
  var charts = { pay: null, category: null, programs: null };

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function link(url, label) {
    if (!url) return '';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || 'Source') + '</a>';
  }

  function fmtMoney(n) { return '$' + Number(n).toFixed(2); }

  /* ---------- derived judgements (from the record only) ---------- */

  // Category from employer/title keywords only.
  function categorize(job) {
    var text = ((job.employer || '') + ' ' + (job.title || '')).toLowerCase();
    if (/telus|rogers|bell|freedom|fido|koodo/.test(text)) return 'Telecom';
    if (/no frills|superstore|independent grocer|loblaw|grocery/.test(text)) return 'Grocery';
    if (/starbucks|subway|firehouse|dairy queen|\bdq\b|cobs|chartwell|barista|sandwich|baker|server/.test(text)) return 'Food Service';
    if (/library/.test(text)) return 'Library';
    if (/lifeguard|recreation|camp|pool/.test(text)) return 'Recreation';
    if (/walmart|home depot|giant tiger|best buy|browns|winners|homesense|dollar tree|sherwin|algoma|7-eleven|retail/.test(text)) return 'Retail';
    return 'Other';
  }

  // Growth-friendly only if the record itself mentions a supervisor/management
  // path, union scale, or commission (in notes, title or wage text).
  function isGrowthFriendly(job) {
    var text = ((job.notes || '') + ' ' + (job.title || '') + ' ' + (job.wage_text || '')).toLowerCase();
    return /supervisor|manager|management|team lead|union|commission/.test(text);
  }

  function payBucket(job) {
    if (job.wage_cad_hourly == null) return 'notlisted';
    if (job.wage_cad_hourly < 18) return 'under18';
    if (job.wage_cad_hourly < 20) return '18to20';
    return '20plus';
  }

  function statusBucket(program) {
    var s = (program.status || '').toLowerCase();
    if (s.indexOf('unknown') !== -1) return 'unknown';
    if (s.indexOf('closed') === 0 || s.indexOf('closed for') !== -1) return 'closed';
    if (s.indexOf('open') !== -1) return 'open';
    return 'active';
  }

  function statusLabel(bucket) {
    return { open: 'Open now', closed: 'Closed', active: 'Active', unknown: 'Status unknown' }[bucket] || 'Active';
  }

  /* ---------- trust bar ---------- */

  function renderTrustBar() {
    var w = data.wage, m = data.meta;
    // Wage data missing or incomplete: say so plainly instead of leaving the
    // static "Loading pay benchmark…" text in place. This only fires when the
    // data genuinely did not load — never hide it while data is missing.
    if (!w || w.general_rate_display == null || w.student_rate_display == null) {
      $('trust-bar').innerHTML =
        '<p class="trust-unavailable"><strong>Pay benchmark unavailable.</strong> ' +
        'The Ontario minimum-wage data didn&rsquo;t load &mdash; reload the page and try again. ' +
        'The job listings below are still the last checked data; always check the linked posting before applying.</p>' +
        '<div class="sync-row"><button type="button" id="sync-btn" class="btn">Sync listings</button>' +
        '<span id="sync-last" class="sync-last">Last synced &mdash; never</span></div>' +
        '<p id="sync-status" class="sync-status" aria-live="polite"></p>';
      wireSyncButton();
      return;
    }
    var checked = (m && m.generated_date) ? m.generated_date : (w.checked_date || '2026-11-17');
    $('trust-bar').innerHTML =
      '<div class="trust-item"><span class="trust-label">Ontario minimum wage (general)</span>' +
      '<span class="trust-value">' + esc(w.general_rate_display) + '</span></div>' +
      '<div class="trust-item"><span class="trust-label">Student rate (under 18, &le;28 hrs/week in term)</span>' +
      '<span class="trust-value">' + esc(w.student_rate_display) + '</span></div>' +
      '<div class="trust-item"><span class="trust-label">In effect since</span>' +
      '<span class="trust-value">Oct 1, 2026</span> &middot; ' + link(w.source_url, 'ontario.ca') + '</div>' +
      '<p class="trust-note">Data last checked <strong>' + esc(checked) +
      '</strong>. Listings change &mdash; always check the linked posting before applying. ' +
      'Any job paying below the minimum wage for your age and hours is a red flag.</p>' +
      '<div class="sync-row"><button type="button" id="sync-btn" class="btn">Sync listings</button>' +
      '<span id="sync-last" class="sync-last">Last synced &mdash; never (data checked ' + esc(checked) + ')</span></div>' +
      '<p id="sync-status" class="sync-status" aria-live="polite"></p>';
    wireSyncButton();
  }

  /* ---------- sync listings ---------- */

  var SYNC_POLL_INTERVAL_MS = 5000;
  // 10 minutes: the full cycle (cron pickup up to 5 min + check + deploy)
  // can run past 5 minutes, and a short window reports a false failure.
  var SYNC_POLL_TIMEOUT_MS = 10 * 60 * 1000;
  var SYNC_TERMINAL = ['ok', 'partial', 'failed'];

  // Fetches ./data/sync-status.json (cache-busted). Resolves to the record, or
  // null when it 404s / fails / is not valid JSON — a missing file just means
  // no sync has ever run, never a user-facing error.
  function fetchSyncStatus() {
    return fetch('./data/sync-status.json?ts=' + Date.now()).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; });
  }

  function setSyncLast(text) {
    var el = $('sync-last');
    if (el) el.textContent = text;
  }

  function setSyncStatus(text) {
    var el = $('sync-status');
    if (el) el.textContent = text;
  }

  // On page load: show the last sync time if a sync has ever run; otherwise
  // leave the "never (data checked …)" fallback set by renderTrustBar().
  function loadInitialSyncStatus() {
    fetchSyncStatus().then(function (rec) {
      if (rec && rec.last_synced) setSyncLast('Last synced ' + rec.last_synced);
    });
  }

  function syncResultText(rec) {
    var checked = (rec.checked == null ? 0 : rec.checked);
    var live = (rec.live == null ? 0 : rec.live);
    var flagged = (rec.flagged || []).length;
    var unverifiable = (rec.unverifiable || []).length;
    var text = 'Checked ' + checked + ' listings: ' + live + ' live, ' + flagged + ' flagged';
    if (unverifiable > 0) text += ', and ' + unverifiable + ' could not be checked automatically (those sites block automated checks, so they were left as they were)';
    return text + '.';
  }

  function finishSync(message) {
    var btn = $('sync-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Sync listings'; }
    setSyncStatus(message);
  }

  // Polls ./data/sync-status.json until a record for this run_id reaches a
  // terminal status, or the deadline passes. onDone receives the record, or
  // null on timeout.
  function pollSyncStatus(runId, deadline, onDone) {
    fetchSyncStatus().then(function (rec) {
      if (rec && rec.run_id === runId && SYNC_TERMINAL.indexOf(rec.status) !== -1) {
        onDone(rec);
        return;
      }
      if (Date.now() >= deadline) {
        onDone(null);
        return;
      }
      setTimeout(function () { pollSyncStatus(runId, deadline, onDone); }, SYNC_POLL_INTERVAL_MS);
    });
  }

  function runSync() {
    var btn = $('sync-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Syncing\u2026';
    setSyncStatus('Syncing\u2026 checking listings, this can take a couple of minutes.');
    fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) {
        if (r.status === 409) {
          finishSync('A sync is already running \u2014 try again in a few minutes.');
          return null;
        }
        if (!r.ok) throw new Error('Sync request failed (' + r.status + ')');
        return r.json();
      })
      .then(function (res) {
        if (!res) return;
        if (!res.ok || !res.run_id) throw new Error('Unexpected sync response');
        pollSyncStatus(res.run_id, Date.now() + SYNC_POLL_TIMEOUT_MS, function (rec) {
          if (!rec) {
            finishSync('Still syncing \u2014 taking longer than usual. The result will show here when it lands; check back in a few minutes.');
            return;
          }
          if (rec.status === 'failed') {
            finishSync('Sync didn\u2019t finish \u2014 try again in a few minutes.');
            return;
          }
          if (rec.last_synced) setSyncLast('Last synced ' + rec.last_synced);
          var text = syncResultText(rec);
          if (rec.status === 'partial') {
            text = 'Sync finished, but not every listing could be checked \u2014 ' +
              text.charAt(0).toLowerCase() + text.slice(1);
          }
          finishSync(text);
        });
      })
      .catch(function () {
        finishSync('Sync didn\u2019t finish \u2014 try again in a few minutes.');
      });
  }

  function wireSyncButton() {
    var btn = $('sync-btn');
    if (btn) btn.addEventListener('click', runSync);
  }

  /* ---------- town selector ---------- */

  function renderTowns() {
    var towns = (data.meta && data.meta.towns) || [];
    var counts = (data.meta && data.meta.counts && data.meta.counts.jobs_by_town) || {};
    $('town-buttons').innerHTML = towns.map(function (t) {
      var n = counts[t] == null ? 0 : counts[t];
      return '<button type="button" class="town-btn" data-town="' + esc(t) + '" aria-pressed="' +
        (t === state.town ? 'true' : 'false') + '">' + esc(t) +
        ' <span class="count">(' + n + ' job' + (n === 1 ? '' : 's') + ')</span></button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.town-btn'), function (btn) {
      btn.addEventListener('click', function () { setTown(btn.getAttribute('data-town')); });
    });
  }

  function setTown(town) {
    state.town = town;
    $('jobs-town-name').textContent = town;
    $('initiatives-town-name').textContent = town;
    renderTowns();
    renderJobs();
    renderInitiatives();
    renderJobSites();
    renderCharts();
  }

  /* ---------- jobs ---------- */

  function townJobs() {
    return data.jobs.filter(function (j) { return j.town === state.town; });
  }

  function filteredJobs() {
    var q = state.search.trim().toLowerCase();
    return townJobs().filter(function (j) {
      if (q) {
        var hay = ((j.title || '') + ' ' + (j.employer || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.noExpOnly && j.experience !== 'none') return false;
      if (state.growthOnly && !isGrowthFriendly(j)) return false;
      if (state.pay !== 'all' && payBucket(j) !== state.pay) return false;
      if (state.category !== 'all' && categorize(j) !== state.category) return false;
      return true;
    });
  }

  function jobCard(j) {
    var verified = j.verified === true;
    var wage = j.wage_cad_hourly != null
      ? fmtMoney(j.wage_cad_hourly) + '/hr'
      : 'Wage not listed';
    var minAge = j.min_age != null ? j.min_age + '+' : 'Not stated';
    var exp = { none: 'No experience needed', preferred: 'Experience preferred, not required', unknown: 'Not stated' }[j.experience] || 'Not stated';
    var schoolBadge;
    if (j.after_school_friendly === true) {
      schoolBadge = '<span class="badge school">After-school friendly</span>';
    } else if (j.after_school_friendly === false) {
      schoolBadge = '<span class="badge not-school">Not after-school friendly</span>';
    } else {
      schoolBadge = '';
    }
    var growthBadge = isGrowthFriendly(j) ? '<span class="badge growth">Career-growth friendly</span>' : '';
    var warning = /NOT conducive|NOT for teens|night shift|not recommended|warning/i.test(j.notes || '')
      ? '<p class="warn-note"><strong>Heads up:</strong> ' + esc(j.notes) + '</p>' : '';
    // Pay check: starting rate vs the Ontario minimum-wage rates in data.wage.
    // A floor below the general rate is legal for a student under 18 working
    // 28 hrs/week or less while school is in session, as long as it is at or
    // above the student rate — say so plainly instead of leaving it unexplained.
    var payNote = '';
    var mw = data.wage;
    if (j.wage_cad_hourly != null && mw && mw.general_rate != null && mw.student_rate != null) {
      if (j.wage_cad_hourly < mw.student_rate) {
        payNote = '<p class="pay-note below-student"><strong>Pay check:</strong> this starting rate is below even the ' +
          esc(fmtMoney(mw.student_rate)) + '/hr student rate &mdash; double-check the posting before applying.</p>';
      } else if (j.wage_cad_hourly < mw.general_rate) {
        payNote = '<p class="pay-note below-general"><strong>Pay check:</strong> this starting rate is below the ' +
          esc(fmtMoney(mw.general_rate)) + '/hr general minimum, but at or above the ' +
          esc(fmtMoney(mw.student_rate)) + '/hr student rate &mdash; legal for students under 18 working 28 hrs/week or less while school is in session (or during a break).</p>';
      }
    }

    return '<article class="job-card ' + (verified ? 'verified' : 'unverified') + '">' +
      '<h3>' + esc(j.title) + '</h3>' +
      '<p class="employer">' + esc(j.employer) + ' &middot; ' + esc(j.town) + '</p>' +
      '<div class="badges">' +
        (verified
          ? '<span class="badge verified">Verified &mdash; read from the posting</span>'
          : '<span class="badge unverified">Unverified &mdash; check the listing</span>') +
        schoolBadge + growthBadge +
      '</div>' +
      '<dl class="job-meta">' +
        '<div><dt>Pay:</dt><dd>' + esc(wage) + '</dd></div>' +
        '<div><dt>Min age:</dt><dd>' + esc(minAge) + '</dd></div>' +
        '<div><dt>Experience:</dt><dd>' + esc(exp) + '</dd></div>' +
      '</dl>' +
      '<p class="job-meta"><strong>Wage as listed:</strong> ' + esc(j.wage_text || 'Not stated') + '</p>' +
      payNote +
      '<p class="hours">' + esc(j.hours_note || '') + '</p>' +
      (j.location_detail ? '<p class="hours">' + esc(j.location_detail) + '</p>' : '') +
      (warning || (j.notes ? '<p class="notes">' + esc(j.notes) + '</p>' : '')) +
      '<a class="job-link" href="' + esc(j.source_url) + '" target="_blank" rel="noopener">' + esc(j.link_label || 'View posting') + '</a>' +
      ' <span class="meta-line">&middot; checked ' + esc(j.checked_date || '2026-11-17') + '</span>' +
    '</article>';
  }

  function renderJobs() {
    var all = townJobs();
    var shown = filteredJobs();
    $('result-count').textContent = 'Showing ' + shown.length + ' of ' + all.length +
      ' job' + (all.length === 1 ? '' : 's') + ' in ' + state.town +
      ' (' + data.jobs.length + ' across Durham Region)';
    var empty = $('jobs-empty');
    if (all.length === 0) {
      $('job-list').innerHTML = '';
      empty.hidden = false;
      empty.innerHTML = '<p><strong>No jobs found in ' + esc(state.town) + ' yet.</strong></p>' +
        '<p>Nothing verified was found for this town on November 17, 2026 &mdash; not a mistake, and not a reason to invent one. ' +
        'Try Bowmanville, Courtice or Oshawa, which are a bus ride away.</p>';
      $('result-count').textContent = 'Showing 0 of 0 jobs in ' + state.town;
    } else if (shown.length === 0) {
      $('job-list').innerHTML = '';
      empty.hidden = false;
      empty.innerHTML = '<p><strong>No jobs match those filters in ' + esc(state.town) + '.</strong></p>' +
        '<p>Try clearing a filter, or switch to a nearby town &mdash; Courtice and Oshawa are a bus ride away.</p>' +
        '<button type="button" id="clear-filters" class="btn">Clear all filters</button>';
      wireClearFilters();
    } else {
      empty.hidden = true;
      $('job-list').innerHTML = shown.map(jobCard).join('');
    }
  }

  function wireClearFilters() {
    var btn = $('clear-filters');
    if (btn) btn.addEventListener('click', clearFilters);
  }

  function clearFilters() {
    state.search = ''; state.noExpOnly = false; state.growthOnly = false;
    state.pay = 'all'; state.category = 'all';
    $('search-input').value = '';
    $('filter-noexp').checked = false;
    $('filter-growth').checked = false;
    $('filter-pay').value = 'all';
    $('filter-category').value = 'all';
    renderJobs();
  }

  function populateCategoryFilter() {
    var cats = [];
    data.jobs.forEach(function (j) {
      var c = categorize(j);
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    cats.sort();
    $('filter-category').innerHTML = '<option value="all">All categories</option>' +
      cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  }

  /* ---------- charts ---------- */

  function payBins(jobs) {
    var bins = [
      { label: 'Under $17', test: function (w) { return w < 17; } },
      { label: '$17\u2013$17.99', test: function (w) { return w >= 17 && w < 18; } },
      { label: '$18\u2013$18.99', test: function (w) { return w >= 18 && w < 19; } },
      { label: '$19\u2013$19.99', test: function (w) { return w >= 19 && w < 20; } },
      { label: '$20+', test: function (w) { return w >= 20; } }
    ];
    var counts = bins.map(function () { return 0; });
    var listed = 0;
    jobs.forEach(function (j) {
      if (j.wage_cad_hourly == null) return;
      listed++;
      bins.forEach(function (b, i) { if (b.test(j.wage_cad_hourly)) counts[i]++; });
    });
    return { labels: bins.map(function (b) { return b.label; }), counts: counts, listed: listed };
  }

  function categoryCounts(jobs) {
    var map = {};
    jobs.forEach(function (j) {
      var c = categorize(j);
      map[c] = (map[c] || 0) + 1;
    });
    var labels = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    return { labels: labels, counts: labels.map(function (l) { return map[l]; }) };
  }

  function programStatusCounts() {
    var buckets = ['open', 'active', 'closed', 'unknown'];
    var counts = { open: 0, active: 0, closed: 0, unknown: 0 };
    data.programs.forEach(function (p) { counts[statusBucket(p)]++; });
    var labels = buckets.filter(function (b) { return counts[b] > 0; });
    return { labels: labels.map(statusLabel), counts: labels.map(function (b) { return counts[b]; }) };
  }

  function makeBar(ctx, labels, counts, label) {
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: counts,
          backgroundColor: ['#1e3a5f', '#3d5a80', '#6b7f99', '#98a8bc', '#c0c9d4', '#f2b705'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  function makeDoughnut(ctx, labels, counts) {
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: ['#2f7d4f', '#1e3a5f', '#a33b2e', '#f2b705'],
          borderWidth: 2, borderColor: '#e8eaed'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') {
      document.querySelectorAll('.takeaway').forEach(function (el) {
        el.textContent = 'Charts could not load (Chart.js did not load). The numbers below are still in the job list above.';
      });
      return;
    }
    var jobs = townJobs();
    var pay = payBins(jobs);
    var cat = categoryCounts(jobs);
    var prog = programStatusCounts();

    if (charts.pay) charts.pay.destroy();
    if (charts.category) charts.category.destroy();
    if (charts.programs) charts.programs.destroy();

    charts.pay = makeBar($('chart-pay'), pay.labels, pay.counts, 'Jobs');
    charts.category = makeBar($('chart-category'), cat.labels, cat.counts, 'Jobs');
    charts.programs = makeDoughnut($('chart-programs'), prog.labels, prog.counts);

    /* Plain-language takeaways, derived only from the numbers shown. */
    var listed = pay.listed;
    var unlisted = jobs.length - listed;
    var topBin = 0, topCount = 0;
    pay.counts.forEach(function (c, i) { if (c > topCount) { topCount = c; topBin = i; } });
    $('takeaway-pay').innerHTML = listed === 0
      ? '<strong>No jobs in ' + esc(state.town) + ' list a wage.</strong> That is why this chart is empty &mdash; check the postings directly.'
      : '<strong>Most listed wages in ' + esc(state.town) + ' sit in the ' + esc(pay.labels[topBin]) +
        ' band (' + topCount + ' of ' + listed + ' jobs with a wage shown).</strong> ' +
        unlisted + ' job' + (unlisted === 1 ? '' : 's') + ' here don&rsquo;t list a wage at all &mdash; ask in store or in the interview.';
    $('takeaway-category').innerHTML = cat.labels.length === 0
      ? '<strong>No jobs listed for ' + esc(state.town) + ' yet.</strong>'
      : '<strong>' + esc(cat.labels[0]) + ' has the most jobs in ' + esc(state.town) + ' (' + cat.counts[0] +
        ' of ' + jobs.length + ').</strong> Grocery and retail are the usual first-job hunting grounds.';
    var unknownN = data.programs.filter(function (p) { return statusBucket(p) === 'unknown'; }).length;
    var openN = data.programs.filter(function (p) { return statusBucket(p) === 'open'; }).length;
    $('takeaway-programs').innerHTML = '<strong>' + data.programs.length + ' programs tracked region-wide: ' +
      openN + ' open now, ' + unknownN + ' with an unknown status.</strong> ' +
      (unknownN > 0 ? 'The unknown one is Youth Job Link &mdash; it is not on the current ontario.ca youth-jobs page, so don&rsquo;t count on it.' : '');
  }

  /* ---------- career paths ---------- */

  function renderPaths() {
    $('path-list').innerHTML = data.paths.map(function (p) {
      var steps = (p.steps || []).map(function (s) {
        return '<li><span class="step-title">' + esc(s.title) + '</span> ' +
          '<span class="step-time">' + esc(s.timeframe || '') + '</span>' +
          '<p>' + esc(s.description || '') + '</p>' +
          (s.source_url ? '<p class="path-source">' + link(s.source_url, 'Step source') + '</p>' : '') +
        '</li>';
      }).join('');
      var verifiedNote = p.verified === false
        ? '<p class="warn-note"><strong>General guidance only:</strong> no employer was found publishing this progression with timelines &mdash; treat it as a plausible direction, not a sourced ladder.</p>'
        : '';
      return '<article class="path-card">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="entry"><strong>Start here:</strong> ' + esc(p.entry_point || '') + '</p>' +
        '<p>' + esc(p.summary || '') + '</p>' +
        '<ol class="steps">' + steps + '</ol>' +
        verifiedNote +
        (p.notes ? '<p class="path-notes">' + esc(p.notes) + '</p>' : '') +
        '<p class="path-source">' + link(p.source_url, 'Path source') + ' &middot; checked ' + esc(p.checked_date || '2026-11-17') + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- schooling ---------- */

  function renderSchooling() {
    $('schooling-list').innerHTML = data.schooling.map(function (s) {
      return '<article class="info-card">' +
        '<span class="type-badge">' + esc(s.type || 'training') + '</span>' +
        '<h3>' + esc(s.name) + '</h3>' +
        '<p>' + esc(s.description || '') + '</p>' +
        '<dl>' +
          '<dt>Who it&rsquo;s for</dt><dd>' + esc(s.who_for || 'Not stated') + '</dd>' +
          '<dt>Cost</dt><dd>' + esc(s.cost || 'Not stated') + '</dd>' +
          '<dt>How to access</dt><dd>' + esc(s.how_to_access || 'Not stated') + '</dd>' +
        '</dl>' +
        (s.notes ? '<p class="notes">' + esc(s.notes) + '</p>' : '') +
        '<p>' + link(s.source_url, 'Source') + ' &middot; checked ' + esc(s.checked_date || '2026-11-17') + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- programs ---------- */

  function renderPrograms() {
    $('program-list').innerHTML = data.programs.map(function (p) {
      var bucket = statusBucket(p);
      var verified = p.verified === true;
      var keys = Object.keys(p.key_dates || {}).map(function (k) {
        return '<dt>' + esc(k.replace(/_/g, ' ')) + '</dt><dd>' + esc(p.key_dates[k]) + '</dd>';
      }).join('');
      var warn = !verified
        ? '<p class="warn-note"><strong>Status unknown &mdash; likely defunct:</strong> ' + esc(p.notes || 'This program could not be confirmed on a current official source.') + '</p>'
        : (p.notes ? '<p class="notes">' + esc(p.notes) + '</p>' : '');
      return '<article class="info-card' + (verified ? '' : ' unknown-status') + '">' +
        '<span class="status-badge status-' + bucket + '">' + esc(statusLabel(bucket)) + '</span>' +
        (verified ? '' : '<span class="status-badge status-unknown">Unverified</span>') +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p>' + esc(p.description || '') + '</p>' +
        '<dl>' +
          '<dt>Who can apply</dt><dd>' + esc(p.eligibility || 'Not stated') + '</dd>' +
          (keys ? '<dt>Key dates</dt>' + keys : '') +
        '</dl>' +
        warn +
        '<p>' + link(p.source_url, 'Source') + ' &middot; checked ' + esc(p.checked_date || '2026-11-17') + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- other job sites (town-filtered) ---------- */

  function renderJobSites() {
    $('job-sites-town-name').textContent = state.town;
    $('job-site-list').innerHTML = data.sites.map(function (s) {
      var url = (s.url_template || '').split('{town}').join(encodeURIComponent(state.town));
      var desc = (s.description || '').split('{town}').join(state.town);
      return '<article class="info-card">' +
        '<h3>' + esc(s.name) + '</h3>' +
        '<p>' + esc(desc) + '</p>' +
        '<dl><dt>Account</dt><dd>' + esc(s.account || 'Not stated') + '</dd></dl>' +
        '<p><a class="job-link" href="' + esc(url) + '" target="_blank" rel="noopener">Search ' + esc(state.town) +
          ' jobs on ' + esc(s.name) + '</a></p>' +
        '<p class="meta-line">Link checked ' + esc(s.checked_date || '2026-11-17') +
          (s.verified === true ? ' &middot; verified' : ' &middot; unverified') + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- initiatives ---------- */

  function isNotForTeens(item) {
    return /not for teens/i.test(item.name || '') || /not a teen/i.test(item.notes || '');
  }

  function renderInitiatives() {
    var list = data.initiatives.filter(function (i) {
      return (i.towns || []).indexOf(state.town) !== -1;
    });
    var empty = $('initiatives-empty');
    if (list.length === 0) {
      $('initiative-list').innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      $('initiative-list').innerHTML = list.map(function (i) {
        var notTeens = isNotForTeens(i);
        return '<article class="info-card' + (notTeens ? ' not-for-teens' : '') + '">' +
          (notTeens
            ? '<p class="not-teens-banner">Not for teens &mdash; this is before/after-school care for younger children (Kindergarten&ndash;Grade 6). It is listed here so nobody mistakes it for a teen program.</p>'
            : '') +
          '<h3>' + esc(i.name) + '</h3>' +
          '<p class="meta-line"><strong>Where:</strong> ' + esc(i.town || '') + (i.location_detail ? ' &middot; ' + esc(i.location_detail) : '') + '</p>' +
          '<p class="meta-line"><strong>Ages:</strong> ' + esc(i.ages || 'Not stated') + ' &middot; <strong>Cost:</strong> ' + esc(i.cost || 'Not stated') + '</p>' +
          '<p>' + esc(i.description || '') + '</p>' +
          (i.notes ? '<p class="notes">' + esc(i.notes) + '</p>' : '') +
          '<p>' + link(i.source_url, 'Source') + ' &middot; checked ' + esc(i.checked_date || '2026-11-17') + '</p>' +
        '</article>';
      }).join('');
    }
  }

  /* ---------- internships & student placements (region-wide) ---------- */

  function renderInternships() {
    $('internship-list').innerHTML = data.internships.map(function (item) {
      var verified = item.verified === true;
      var urgent = item.urgent === true;
      var statusBadge = (item.status || '').toLowerCase() === 'open'
        ? '<span class="status-badge status-open">Open now</span>'
        : '<span class="status-badge status-active">Plan ahead</span>';
      return '<article class="info-card' + (verified ? '' : ' unknown-status') + '">' +
        statusBadge +
        (verified ? '' : '<span class="status-badge status-unknown">Unverified</span>') +
        (urgent
          ? '<p class="urgent-banner">Deadline soon &mdash; applications close ' + esc(item.deadline || 'soon') + '.</p>'
          : '') +
        '<h3>' + esc(item.title) + '</h3>' +
        '<p class="meta-line"><strong>Who:</strong> ' + esc(item.provider || '') + ' &middot; ' + esc(item.town || '') + '</p>' +
        '<p class="meta-line"><strong>Pay:</strong> ' + esc(item.pay || 'Not stated') +
          ' &middot; <strong>Ages:</strong> ' + esc(item.age_range || 'Not stated') + '</p>' +
        '<p>' + esc(item.description || '') + '</p>' +
        (item.deadline && !urgent
          ? '<p class="meta-line"><strong>Deadline:</strong> ' + esc(item.deadline) + '</p>'
          : '') +
        (item.notes ? '<p class="notes">' + esc(item.notes) + '</p>' : '') +
        '<p>' + link(item.source_url, 'Source') + ' &middot; checked ' + esc(item.checked_date || '2026-11-17') + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- footer sources ---------- */

  function renderSources() {
    var seen = {};
    var items = [];
    [data.jobs, data.programs, data.schooling, data.initiatives, data.paths, data.internships, data.sites].forEach(function (arr) {
      arr.forEach(function (rec) {
        (rec.source_url ? [rec.source_url] : []).forEach(function (u) {
          try {
            var host = new URL(u).hostname.replace(/^www\./, '');
            if (!seen[host]) { seen[host] = true; items.push(host); }
          } catch (e) { /* ignore malformed urls */ }
        });
      });
    });
    items.sort();
    $('source-list').innerHTML = items.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
      '<li>ontario.ca &amp; canada.ca (minimum wage &amp; programs)</li>' +
      '<li>jobbank.gc.ca (Job Bank)</li>';
  }

  /* ---------- back to top ---------- */

  function wireBackToTop() {
    var btn = $('back-to-top');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- load ---------- */

  // Loads a subset of the data files. The trust-bar files (wage + meta) load
  // on their own first, so the pay benchmark renders even if one of the
  // other files fails — previously a single failed fetch left the trust bar
  // stuck on "Loading pay benchmark…" with nothing rendered at all.
  function loadFiles(keys) {
    return Promise.all(keys.map(function (k) {
      return fetch(DATA_FILES[k]).then(function (r) {
        if (!r.ok) throw new Error('Failed to load ' + DATA_FILES[k] + ' (' + r.status + ')');
        return r.json();
      }).then(function (json) { data[k] = json; });
    }));
  }

  function loadTrustData() { return loadFiles(['wage', 'meta']); }

  function loadRest() {
    var keys = Object.keys(DATA_FILES).filter(function (k) { return k !== 'wage' && k !== 'meta'; });
    return loadFiles(keys);
  }

  function init() {
    wireBackToTop();
    $('search-input').addEventListener('input', function (e) { state.search = e.target.value; renderJobs(); });
    $('filter-noexp').addEventListener('change', function (e) { state.noExpOnly = e.target.checked; renderJobs(); });
    $('filter-growth').addEventListener('change', function (e) { state.growthOnly = e.target.checked; renderJobs(); });
    $('filter-pay').addEventListener('change', function (e) { state.pay = e.target.value; renderJobs(); });
    $('filter-category').addEventListener('change', function (e) { state.category = e.target.value; renderJobs(); });

    // Trust bar first and on its own: the benchmark must never sit on
    // "Loading…" because an unrelated data file failed.
    loadTrustData().then(function () {
      renderTrustBar();
      loadInitialSyncStatus();
    }, function () {
      renderTrustBar(); // wage/meta missing -> honest "unavailable" message
      loadInitialSyncStatus();
    });

    loadRest().then(function () {
      renderTowns();
      populateCategoryFilter();
      renderJobs();
      renderInitiatives();
      renderJobSites();
      renderPaths();
      renderSchooling();
      renderPrograms();
      renderInternships();
      renderCharts();
      renderSources();
    }).catch(function (err) {
      document.querySelector('main').insertAdjacentHTML('afterbegin',
        '<p class="empty-state" style="color:#a33b2e"><strong>Couldn&rsquo;t load the job data.</strong> ' +
        esc(err.message) + ' Check that the data files are in ./data/ and reload.</p>');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
