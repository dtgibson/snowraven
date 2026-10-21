// QA evidence-only probe (ios27-iphone-duo). Loaded from a copy of dist/index.html
// for one simulator build; never in source. It dismisses Welcome, reads the safe-area
// insets the webview reports, measures the phone bar's end cells, then opens the More
// sheet and measures it, printing every reading in an overlay so each screenshot carries
// its own numbers. Steps advance on a timer; the overlay names the current step.
(function () {
  var lines = []
  var box = null
  function show(step) {
    if (!box) {
      box = document.createElement('div')
      box.setAttribute('aria-hidden', 'true')
      box.style.cssText = 'position:fixed;left:8px;right:110px;top:8px;z-index:2147483647;' +
        'background:rgba(255,255,200,0.94);color:#000;font:10px/1.3 ui-monospace,Menlo,monospace;' +
        'padding:6px 8px;border:1px solid #000;pointer-events:none;white-space:pre-wrap'
      document.body.appendChild(box)
    }
    box.textContent = 'QA PROBE  step: ' + step + '\n' + lines.join('\n')
  }
  function insets() {
    var d = document.createElement('div')
    d.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);' +
      'padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);' +
      'padding-left:env(safe-area-inset-left,0px)'
    document.body.appendChild(d)
    var cs = getComputedStyle(d)
    var r = 'env inset t/r/b/l: ' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft
    d.remove()
    return r
  }
  function rect(el) {
    var b = el.getBoundingClientRect()
    return 'x ' + b.left.toFixed(1) + '..' + b.right.toFixed(1) + ' y ' + b.top.toFixed(1) + '..' + b.bottom.toFixed(1)
  }
  function base() {
    var html = document.documentElement
    var vv = window.visualViewport
    return [
      'html.sr-ios-app: ' + html.classList.contains('sr-ios-app'),
      'inner ' + innerWidth + 'x' + innerHeight + '  screen ' + screen.width + 'x' + screen.height +
        '  dpr ' + devicePixelRatio + '  vv.scale ' + (vv ? vv.scale.toFixed(3) : 'n/a'),
      insets(),
      'phone tier (max-width:640px): ' + matchMedia('(max-width: 640px)').matches +
        '  iPhone block gate: ' + matchMedia('(min-width: 641px) and (max-device-width: 700px), (min-width: 641px) and (max-device-height: 700px)').matches,
    ]
  }
  function bar() {
    var nav = document.querySelector('.sr-navbar')
    if (!nav) return ['no .sr-navbar']
    var cs = getComputedStyle(nav)
    var cells = nav.querySelectorAll('.sr-navbar-cell')
    var out = [
      'navbar ' + rect(nav) + '  pad l/r/b ' + cs.paddingLeft + ' ' + cs.paddingRight + ' ' + cs.paddingBottom,
      'cells ' + cells.length + ' labels visible: ' + Array.prototype.filter.call(nav.querySelectorAll('.sr-navbar-label'),
        function (l) { return l.getClientRects().length > 0 && getComputedStyle(l).display !== 'none' }).length,
    ]
    if (cells.length) {
      out.push('first cell ' + rect(cells[0]))
      out.push('last cell  ' + rect(cells[cells.length - 1]))
    }
    return out
  }
  function sheet() {
    var s = document.querySelector('.sr-nav-sheet')
    if (!s) return ['no .sr-nav-sheet']
    var cs = getComputedStyle(s)
    var root = document.querySelector('.sr-nav-sheet-root')
    var out = [
      'sheet root open: ' + !!(root && root.classList.contains('sr-nav-sheet-root--open')),
      'sheet ' + rect(s) + '  pad l/r/b ' + cs.paddingLeft + ' ' + cs.paddingRight + ' ' + cs.paddingBottom,
    ]
    var foot = s.querySelector('.sr-nav-sheet-foot')
    if (foot) out.push('foot ' + rect(foot))
    return out
  }
  var t0 = Date.now()
  function step1() {
    var btn = Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
      return /Explore the app first/.test(b.textContent || '')
    })
    if (btn) btn.click()
    setTimeout(function () {
      lines = base().concat(bar())
      show('S2 bar, ' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
      setTimeout(step3, 20000)
    }, 2500)
  }
  function step3() {
    var more = document.querySelector('.sr-navbar [aria-label="More destinations"]')
    if (more) more.click()
    setTimeout(function () {
      lines = base().concat(bar()).concat(sheet())
      show('S3 More open (' + (more ? 'clicked' : 'NO More cell') + '), ' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
    }, 2500)
  }
  function start() {
    lines = base()
    show('S1 boot')
    setTimeout(step1, 8000)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
