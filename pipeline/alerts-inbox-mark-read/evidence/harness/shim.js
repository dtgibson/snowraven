// ios-alerts PREVIEW SHIM: a faked iOS native layer for reviewing the Settings
// -> Alerts section in an ordinary browser (the user reviews over the tailnet
// and cannot see a simulator). Injected into the built `frontend/dist`
// index.html BEFORE the app's own module script by alerts-preview.py; never
// shipped, never imported by the app.
//
// It makes the REAL app believe it is the iPhone/iPad build:
//   * window.__TAURI_OS_PLUGIN_INTERNALS__ reports platform "ios", so the
//     platform gate (isTauri() && isIOS()) opens and the lazy section loads;
//   * window.__TAURI_INTERNALS__.invoke answers the storage seam's
//     `plugin:fs|*` calls from an in-memory file map (so Settings works and
//     opens on the Settings tab), the event bus, the geolocation plugin (a
//     fixed Davis, CA fix), and the five `alerts_*` commands from an in-memory
//     model of the native actor, selected by ?scenario=<name>.
// The REAL controller and section run against it, so every switch, choice,
// field, the inbox rows and the Clear dialog can be pressed. The model mirrors
// the native rules the user can see (off by default; enable asks nothing here
// because the system prompt is iOS's own; a check after enable; blocked
// sentences; the six outcomes) but it is a preview model, not the engine: the
// engine is Swift and is tested by the XCTests and the simulator evidence.
//
// THE INBOX REVISION (design-spec 7.1 to 7.5). The inbox is its own sheet, so
// the shim adds what reaching it needs, all through the REAL app:
//   ?viewed=<hours ago>|none  seeds `alertsInboxViewedAt` in settings.json
//                             (default 24: the two newest rows are new; `none`
//                             leaves it absent, so every row is new);
//   ?open=sheet               presses the card's Inbox row once the app is up;
//   ?open=bell                presses the header bell (phone width);
//   ?open=sidebar             presses the sidebar's Alerts inbox item (iPad width);
//   ?open=palette             presses Cmd-K (the palette's first row is the inbox);
//   ?bar=0                    hides the scenario bar (it would cover the sheet's footer);
//   ?rows=<n>                 n inbox rows (up to 30): with ?viewed=none, ?rows=12 shows "9+";
//   ?scenario=offrows         alerts OFF with rows (the entry points stay);
//   ?scenario=fresh           alerts off and empty (no bell, no row, no palette row).
(function () {
  'use strict'
  var params = new URLSearchParams(location.search)
  var scenario = params.get('scenario') || 'fresh'
  var device = params.get('device') || 'iphone'

  window.__TAURI_OS_PLUGIN_INTERNALS__ = {
    platform: 'ios', version: '27.0', family: 'unix', os_type: 'ios', arch: 'aarch64', eol: '\n', exe_extension: '',
  }

  // ── callbacks and the event bus ──────────────────────────────────────────
  var nextId = 1
  var callbacks = new Map()
  var listeners = [] // { event, handler, eventId }
  function emit(event, payload) {
    listeners.filter(function (l) { return l.event === event }).forEach(function (l) {
      var cb = callbacks.get(l.handler)
      if (cb) cb({ event: event, id: l.eventId, payload: payload })
    })
  }

  // ── an in-memory filesystem for the storage seam ─────────────────────────
  var TABS = ['weather', 'birding-stats', 'map-explorer', 'species-detail', 'calendar', 'targets', 'life-list',
    'breeding-codes', 'checklists', 'comparer', 'named-birds']
  var enc = new TextEncoder()
  var files = new Map()
  function put(path, obj) { files.set(path, enc.encode(JSON.stringify(obj))) }
  var viewedParam = params.get('viewed') || '24'
  var settingsDoc = {
    welcomeSeen: true,
    tabLayout: { order: TABS, hidden: TABS }, // every tab hidden: the app opens on Settings
    'map-defaults': { lat: 38.5446, lng: -121.7405, dist: 5 },
  }
  if (viewedParam !== 'none') {
    settingsDoc.alertsInboxViewedAt = new Date(Date.now() - Number(viewedParam) * 3600000).toISOString().slice(0, 19) + 'Z'
  }
  put('data/settings.json', settingsDoc)
  if (scenario !== 'nokey') put('data/api-keys.json', { ebird: 'PreviewKey0000' })
  function fsPath(args, options) {
    if (args && typeof args.path === 'string') return args.path
    var h = options && options.headers
    if (h && h.path) return decodeURIComponent(h.path)
    return ''
  }
  function fs(cmd, args, options) {
    var p = fsPath(args, options)
    switch (cmd) {
      case 'plugin:fs|exists': return files.has(p)
      case 'plugin:fs|mkdir': return null
      case 'plugin:fs|read_text_file':
      case 'plugin:fs|read_file':
        if (!files.has(p)) throw new Error('No such file or directory (preview): ' + p)
        return files.get(p)
      case 'plugin:fs|write_text_file':
      case 'plugin:fs|write_file':
        files.set(p, args instanceof Uint8Array ? args : enc.encode(String(args)))
        if (p === 'data/settings.json') { try { fsWrites.push({ t: Date.now(), viewed: JSON.parse(new TextDecoder().decode(files.get(p))).alertsInboxViewedAt }) } catch (e) {} }
        return null
      case 'plugin:fs|remove': files.delete(p); return null
      default: throw new Error('unavailable (preview): ' + cmd)
    }
  }

  // ── the alert model (what native would return) ───────────────────────────
  var HOUR = 3600000, DAY = 86400000
  function iso(ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z' }
  var now = Date.now()
  function ymd(ms) { var d = new Date(ms); function p(n) { return String(n).padStart(2, '0') } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) }
  var POINT = { lat: 38.5449, lng: -121.7405 }
  function row(i, code, name, loc, locName, dist, obsDaysAgo, alertedHoursAgo) {
    var at = iso(now - alertedHoursAgo * HOUR)
    return {
      id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), checkId: '11111111-1111-4111-8111-111111111111',
      speciesCode: code, comName: name, locId: loc, locName: locName, lat: 38.6, lng: -121.6,
      obsDt: ymd(now - obsDaysAgo * DAY) + ' 07:45', distanceMi: dist, point: POINT, radiusMi: 25,
      place: { kind: 'name', name: 'Davis, CA' }, alertedAt: at, updatedAt: at,
    }
  }
  var INBOX = [
    row(1, 'ruff', 'Ruff', 'L1000001', 'Yolo Bypass Wildlife Area', 6.3, 0, 0.3),
    row(2, 'sabgul', "Sabine's Gull", 'L1000004', 'Lake Solano County Park', 16.1, 0, 0.3),
    row(3, 'bawsan', "Baird's Sandpiper", 'L1000002', 'Davis Wetlands', 4.4, 1, 27),
    row(4, 'pecsan', 'Pectoral Sandpiper', 'L1000005', 'Putah Creek Riparian Reserve', 7.8, 2, 50),
    row(5, 'brwhaw', 'Broad-winged Hawk', 'L1000006', 'Yolo County Central Landfill', 5.2, 3, 76),
    row(6, 'lbbgul', 'Lesser Black-backed Gull', 'L1000003', 'Yolo County Central Landfill', 5.2, 4, 101),
  ]
  // ?rows=<n> (up to 30): more rows, repeating the six above with fresh ids, so
  // a count past nine ("9+") can be reached with ?viewed=none.
  var wantRows = Math.min(30, Math.max(0, Number(params.get('rows')) || 0))
  for (var k = INBOX.length; k < wantRows; k++) {
    var base = INBOX[k % 6]
    var copy = JSON.parse(JSON.stringify(base))
    copy.id = '00000000-0000-4000-8000-' + String(k + 1).padStart(12, '0')
    INBOX.push(copy)
  }
  var OUTCOME = { hits: 'hits', nothing: 'nothing-new', offline: 'unreachable', noanswer: 'no-answer', busy: 'busy', badkey: 'key-rejected', fallback: 'hits' }
  var on = scenario !== 'fresh' && scenario !== 'offrows'
  // Scenarios whose point cannot resolve: no fixed place and no Default Location.
  var noPlace = ['noplace', 'locoff', 'noposition'].indexOf(scenario) >= 0
  var model = {
    settings: {
      version: 1, enabled: on, cadence: 'hourly', quietHours: { on: scenario === 'quiet', startMin: 1320, endMin: 420 },
      model: (scenario === 'locoff' || scenario === 'noposition' || scenario === 'fallback') ? 'my-location' : 'fixed',
      fixedPlace: (noPlace || scenario === 'follow') ? null : { lat: POINT.lat, lng: POINT.lng, name: 'Davis, CA' },
      radiusMi: 25, updatedAt: iso(now),
    },
    state: {
      version: 1,
      lastCheck: (on && scenario !== 'notyet' && !noPlace)
        ? { completedAt: iso(now - 20 * 60000), outcome: OUTCOME[scenario] || 'hits', hits: (OUTCOME[scenario] || 'hits') === 'hits' ? 3 : 0,
            from: scenario === 'fallback' ? 'fixed-fallback' : 'fixed', checkId: '11111111-1111-4111-8111-111111111111' }
        : null,
      holdUntil: null, position: null, pending: null, scheduledEarliest: null,
      backgroundRefresh: scenario === 'bgoff' ? 'denied' : 'available',
    },
    inbox: (scenario === 'fresh' || scenario === 'empty' || scenario === 'notyet') ? [] : INBOX.slice(),
    permissions: { notifications: scenario === 'notifdenied' ? 'denied' : (on ? 'granted' : 'not-determined'),
      location: scenario === 'locoff' ? 'denied' : (scenario === 'fallback' ? 'denied' : 'granted') },
  }
  function blocked() {
    if (scenario === 'nokey') return 'no-key'
    if (scenario === 'nobackup') return 'no-backup'
    var s = model.settings
    var fixed = s.fixedPlace || (noPlace ? null : { lat: 38.5446, lng: -121.7405 })
    if (s.model === 'fixed') return fixed ? null : 'no-place'
    if (scenario === 'noposition' && !fixed) return 'no-position'
    if (model.permissions.location === 'denied' && !fixed) return 'location-off'
    if (scenario === 'noposition') return 'no-position'
    return null
  }
  function snapshot() {
    return JSON.stringify({
      settings: model.settings, state: model.state,
      inbox: model.inbox.slice().sort(function (a, b) { return a.alertedAt < b.alertedAt ? 1 : a.alertedAt > b.alertedAt ? -1 : 0 }),
      blocked: blocked(), permissions: model.permissions,
      defaultLocation: noPlace ? null : { lat: 38.5446, lng: -121.7405 },
      now: (window.__previewLastNow = iso(Date.now())),
    })
  }
  function laterCheck() {
    setTimeout(function () {
      if (!model.settings.enabled || blocked()) return
      model.state.lastCheck = { completedAt: iso(Date.now()), outcome: 'nothing-new', hits: 0, from: 'fixed', checkId: '22222222-2222-4222-8222-222222222222' }
      emit('snowraven-alerts', null)
    }, 1200)
  }
  function alerts(cmd, args) {
    switch (cmd) {
      case 'alerts_snapshot': return snapshot()
      case 'alerts_set_enabled':
        model.settings.enabled = !!args.enabled
        if (args.enabled) {
          if (model.permissions.notifications === 'not-determined') model.permissions.notifications = 'granted'
          laterCheck()
        } else { model.state.pending = null }
        return snapshot()
      case 'alerts_update_settings': {
        var patch = JSON.parse(args.patch)
        var keys = ['cadence', 'quietHours', 'model', 'fixedPlace', 'radiusMi', 'position']
        for (var k in patch) if (keys.indexOf(k) < 0) throw 'invalid'
        if ('radiusMi' in patch && !(Number.isInteger(patch.radiusMi) && patch.radiusMi >= 1 && patch.radiusMi <= 25)) throw 'invalid'
        for (var k2 in patch) if (k2 !== 'position') model.settings[k2] = patch[k2]
        if (patch.position) model.state.position = { lat: patch.position.lat, lng: patch.position.lng, at: iso(Date.now()), source: 'seed' }
        model.settings.updatedAt = iso(Date.now())
        return snapshot()
      }
      case 'alerts_clear_inbox': model.inbox = []; return snapshot()
      case 'alerts_purge_inbox': model.inbox = []; model.state.pending = null; return null
      default: throw 'unknown-op'
    }
  }

  // ── invoke ───────────────────────────────────────────────────────────────
  function invoke(cmd, args, options) {
    try {
      if (cmd.indexOf('plugin:fs|') === 0) return Promise.resolve(fs(cmd, args, options))
      if (cmd.indexOf('alerts_') === 0) return Promise.resolve(alerts(cmd, args || {}))
      if (cmd === 'plugin:event|listen') {
        var eventId = nextId++
        listeners.push({ event: args.event, handler: args.handler, eventId: eventId })
        return Promise.resolve(eventId)
      }
      if (cmd === 'plugin:event|unlisten') {
        listeners = listeners.filter(function (l) { return l.eventId !== args.eventId })
        return Promise.resolve(null)
      }
      if (cmd === 'plugin:event|emit' || cmd === 'plugin:event|emit_to') return Promise.resolve(null)
      if (cmd === 'plugin:app|version') return Promise.resolve('1.0.40')
      if (cmd.indexOf('plugin:geolocation|') === 0) {
        if (/permission/i.test(cmd)) return Promise.resolve({ location: 'granted', coarseLocation: 'granted' })
        return Promise.resolve({ timestamp: Date.now(), coords: { latitude: 38.5449, longitude: -121.7405, accuracy: 20, altitude: null, altitudeAccuracy: null, speed: null, heading: null } })
      }
      if (cmd === 'widgets_take_pending_link') return Promise.resolve(null)
      if (cmd === 'widgets_write_handover' || cmd === 'widgets_remove_handover') return Promise.resolve(null)
      return Promise.reject('unavailable (preview): ' + cmd)
    } catch (e) {
      return Promise.reject(typeof e === 'string' ? e : String(e && e.message || e))
    }
  }


  // ── QA hooks (alerts-inbox-mark-read Tester, scratch copy only) ─────────
  var fsWrites = []
  window.__preview = {
    // A check lands: a newer row alerted NOW, then the native poke.
    addAlert: function (name) {
      var r = row(90 + model.inbox.length, 'litsti', name || 'Little Stint', 'L1000009', 'Davis Wetlands', 4.1, 0, 0)
      r.alertedAt = iso(Date.now()); r.updatedAt = r.alertedAt
      model.inbox.push(r)
      emit('snowraven-alerts', null)
      return r.alertedAt
    },
    settings: function () {
      var b = files.get('data/settings.json')
      return b ? JSON.parse(new TextDecoder().decode(b)) : null
    },
    fsWrites: fsWrites,
  }

  window.__TAURI_INTERNALS__ = {
    invoke: invoke,
    transformCallback: function (cb, once) {
      var id = nextId++
      callbacks.set(id, function (m) { if (once) callbacks.delete(id); return cb(m) })
      return id
    },
    unregisterCallback: function (id) { callbacks.delete(id) },
    convertFileSrc: function (p) { return p },
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    plugins: {},
  }
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: function () {} }

  // ── a scenario bar, and the iPad width ───────────────────────────────────
  if (device === 'ipad') document.documentElement.style.setProperty('--preview-width', '1024px')
  // Press an entry point once the real app has rendered it.
  var openParam = params.get('open')
  if (openParam) {
    var tries = 0
    var timer = setInterval(function () {
      tries += 1
      var target = null
      if (openParam === 'sheet') target = document.querySelector('.sr-inbox-link')
      if (openParam === 'bell') target = document.querySelector('.sr-hdr-inbox')
      if (openParam === 'sidebar') target = document.querySelector('.sr-nav-inbox')
      if (openParam === 'palette' && document.querySelector('.sr-hdr-inbox, .sr-nav-inbox, .sr-inbox-link')) {
        clearInterval(timer)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
        return
      }
      if (target) { clearInterval(timer); target.click() }
      if (tries > 100) clearInterval(timer)
    }, 100)
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (params.get('bar') === '0') return
    var names = ['fresh', 'offrows', 'configured', 'quiet', 'follow', 'empty', 'notyet', 'nothing', 'offline', 'noanswer', 'busy', 'badkey',
      'fallback', 'nokey', 'nobackup', 'noplace', 'locoff', 'noposition', 'notifdenied', 'bgoff']
    var bar = document.createElement('div')
    bar.setAttribute('aria-hidden', 'true')
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;background:#111;color:#eee;font:12px system-ui'
    bar.innerHTML = '<b style="margin-right:6px">ios-alerts preview:</b>' + names.map(function (n) {
      var q = new URLSearchParams(location.search); q.set('scenario', n)
      return '<a href="?' + q.toString() + '" tabindex="-1" style="color:' + (n === scenario ? '#6f6' : '#9cf') + '">' + n + '</a>'
    }).join(' ')
    document.body.appendChild(bar)
  })
})()
