package com.dtgibson.snowraven

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.util.Locale

// SnowRaven's one hand-edited Kotlin file (android-release, design-spec
// sections 2 and 4). Everything here is plumbing for the shipped frontend, not
// a feature: it tells the page where the system bars are and keeps the
// keyboard off a focused field, and it lets the page say which theme it has
// painted so the bar glyphs contrast with it. A regeneration of the Android
// project overwrites this file; restore it by content (the release skill's
// Android section, "Regenerating the Android project").
class MainActivity : TauriActivity() {
  // The last inset script, re-sent when the page announces it is live (its
  // first theme report), because a script evaluated before the document exists
  // is lost.
  private var lastInsetsScript: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // wry calls this from setWebView, before the first page load, so both
  // registrations exist when the document starts.
  override fun onWebViewCreate(webView: WebView) {
    installInsets(webView)
    installThemeChannel(webView)
  }

  // System bars and display cutout reach the page as four CSS custom
  // properties in CSS px (--sr-inset-top/right/bottom/left), read only by the
  // `.sr-android-app` rules in globals.css; the Android WebView reports 0 for
  // env(safe-area-inset-*) below Chromium 140. The keyboard is different: it
  // is an occluder, so it pads the webview's host natively, the viewport
  // shrinks, and Chromium scrolls the focused field into view on its own.
  // `sr-ime-open` on <html> lets the phone bar slide out while it is up.
  // Returning CONSUMED keeps the WebView from applying the insets itself.
  private fun installInsets(webView: WebView) {
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      val imeOpen = insets.isVisible(WindowInsetsCompat.Type.ime()) && imeBottom > 0

      (view.parent as? View)?.let { host ->
        val pad = if (imeOpen) imeBottom else 0
        if (host.paddingBottom != pad) {
          host.setPadding(host.paddingLeft, host.paddingTop, host.paddingRight, pad)
        }
      }

      // With the keyboard up the webview ends at the keyboard's top edge, so
      // nothing of the navigation bar lies under it.
      val bottom = if (imeOpen) 0 else bars.bottom
      val density = resources.displayMetrics.density
      fun px(v: Int) = String.format(Locale.US, "%.2fpx", v / density)
      val script = "(function(){var r=document.documentElement;if(!r)return;var s=r.style;" +
        "s.setProperty('--sr-inset-top','${px(bars.top)}');" +
        "s.setProperty('--sr-inset-right','${px(bars.right)}');" +
        "s.setProperty('--sr-inset-bottom','${px(bottom)}');" +
        "s.setProperty('--sr-inset-left','${px(bars.left)}');" +
        "r.classList.toggle('sr-ime-open',$imeOpen);})();"
      lastInsetsScript = script
      webView.evaluateJavascript(script, null)
      WindowInsetsCompat.CONSUMED
    }
  }

  // The status and navigation bar glyphs follow the theme the page PAINTED
  // (decisions.md, decided at the Stage 4 review): dark glyphs over the light
  // in-app theme, light over dark. The page sends exactly "light" or "dark"
  // from applyTheme() (lib/theme.ts, reportPaintedTheme). The origin allowlist
  // is the whole trust argument: only the app's own document can post here,
  // and anything but those two strings from the main frame is ignored.
  // Navigation bar glyph appearance needs API 26; below it the compat setter
  // is a no-op and enableEdgeToEdge()'s dark scrim keeps light glyphs.
  private fun installThemeChannel(webView: WebView) {
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
    WebViewCompat.addWebMessageListener(
      webView,
      "srAndroid",
      setOf("http://tauri.localhost"),
      object : WebViewCompat.WebMessageListener {
        override fun onPostMessage(
          view: WebView,
          message: WebMessageCompat,
          sourceOrigin: Uri,
          isMainFrame: Boolean,
          replyProxy: JavaScriptReplyProxy,
        ) {
          if (!isMainFrame) return
          val theme = message.data
          if (theme != "light" && theme != "dark") return
          val controller = WindowCompat.getInsetsController(window, window.decorView)
          controller.isAppearanceLightStatusBars = theme == "light"
          controller.isAppearanceLightNavigationBars = theme == "light"
          lastInsetsScript?.let { view.evaluateJavascript(it, null) }
        }
      },
    )
  }
}
