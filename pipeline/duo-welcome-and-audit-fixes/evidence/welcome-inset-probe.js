// Evidence-only probe (duo-welcome-and-audit-fixes). Loaded from a COPY of
// dist/index.html for one simulator build, never in source; dist is restored by
// hash and the library rebuilt clean afterwards. It leaves the Welcome screen up
// and prints, in an overlay so the screenshot carries its own numbers, the
// safe-area insets the app's webview reports and the Welcome root's padding and
// its content's rects. Readings at 8 s and again at 25 s (the first reading after
// launch is taken before the webview settles).
(function () {
  var box = null
  function show(lines) {
    if (!box) {
      box = document.createElement('div')
      box.setAttribute('aria-hidden', 'true')
      box.style.cssText = 'position:fixed;left:6px;top:6px;width:360px;z-index:2147483647;' +
        'background:rgba(255,255,200,0.94);color:#000;font:10px/1.3 ui-monospace,Menlo,monospace;' +
        'padding:5px 7px;border:1px solid #000;pointer-events:none;white-space:pre-wrap'
      document.body.appendChild(box)
    }
    box.textContent = lines.join('\n')
  }
  function rect(el) {
    if (!el) return 'missing'
    var b = el.getBoundingClientRect()
    return 'x ' + b.left.toFixed(1) + '..' + b.right.toFixed(1) + ' y ' + b.top.toFixed(1) + '..' + b.bottom.toFixed(1)
  }
  function insets() {
    var d = document.createElement('div')
    d.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);' +
      'padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);' +
      'padding-left:env(safe-area-inset-left,0px)'
    document.body.appendChild(d)
    var cs = getComputedStyle(d)
    var r = cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft
    d.remove()
    return r
  }
  function read(step) {
    var root = document.querySelector('.sr-welcome-panel')
    var lines = ['PROBE ' + step + '  html.sr-ios-app: ' + document.documentElement.classList.contains('sr-ios-app'),
      'inner ' + innerWidth + 'x' + innerHeight + '  dpr ' + devicePixelRatio,
      'env inset t/r/b/l: ' + insets()]
    if (!root) { lines.push('no .sr-welcome-panel'); show(lines); return }
    var cs = getComputedStyle(root)
    var col = root.firstElementChild
    var btns = root.querySelectorAll('button')
    lines.push('root pad t/r/b/l: ' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + '  pos ' + cs.position)
    lines.push('column ' + rect(col))
    lines.push('card   ' + rect(col && col.children[3]))
    lines.push('first button ' + rect(btns[0]))
    lines.push('last button  ' + rect(btns[btns.length - 1]))
    show(lines)
  }
  function start() {
    setTimeout(function () { read('8s') }, 8000)
    setTimeout(function () { read('25s') }, 25000)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
