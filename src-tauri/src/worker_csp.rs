//! The content security policy on every non-HTML file the app serves, so a
//! worker loaded by URL runs under the same policy as the page.
//!
//! Tauri sends `app.security.csp` only with a response whose path ends in
//! `.html` (tauri 2.11.2, `manager/mod.rs` `get_asset`), and a worker started
//! from a URL takes its policy from its own script response, never from the
//! page that started it (only a `blob:` worker inherits). So MapLibre's worker
//! and the app's three module workers ran with no policy at all. The header
//! goes on every non-HTML response because a browser applies a response's
//! policy only where that response becomes a document or a worker's global
//! scope: on an image, a stylesheet or one of the page's own module chunks it
//! does nothing.
//!
//! The policy is the directive map Tauri parsed from `tauri.conf.json`,
//! serialized by Tauri's own `Csp` type. Nothing here names a directive or a
//! host, so the worker's policy and the page's cannot drift apart, and
//! `frontend/src/lib/tauriCsp.test.ts` keeps holding the hosts to their call
//! sites for both. What the page's header has that a worker's does not is the
//! sha256 Tauri adds to `script-src` for `index.html`'s inline boot script,
//! which only the page runs.
//!
//! Tauri has no config key for a header on non-HTML responses, so the hook is
//! `WebviewWindowBuilder::on_web_resource_request`, which only a window built
//! in code can carry. That is why `src-tauri/src/lib.rs` builds the main window
//! itself and `tauri.conf.json` sets its `create` to false.
//!
//! Two responses are never touched. An HTML response keeps the policy Tauri
//! gave it, with the boot script's hash; replacing it would refuse that script
//! and the launch splash would never release. And a development build attaches
//! nothing: `tauri ios dev` serves Vite's files through this same hook with no
//! page policy, so a header there would govern a dev page the config never
//! described.

use std::borrow::Cow;
use tauri::http::header::{CONTENT_SECURITY_POLICY, CONTENT_TYPE};
use tauri::http::{HeaderValue, Response};
use tauri::utils::config::Csp;

/// The header value for the configured policy, or `None` when the config sets
/// no policy (then, as with Tauri's own page header, nothing is attached).
///
/// `None` also when the serialized policy is not a valid header value, which a
/// policy of single visible-ASCII sources cannot produce; `tauriCsp.test.ts`
/// holds the config to that shape, and a test below converts the real config.
pub fn policy_header(csp: Option<&Csp>) -> Option<HeaderValue> {
    csp.and_then(|policy| HeaderValue::from_str(&policy.to_string()).ok())
}

/// Whether a response with this `Content-Type` gets the policy.
///
/// A response with no `Content-Type`, or an empty one, gets nothing. Tauri sets
/// one on every file it serves, so the case does not arise from its protocol;
/// were it to arise, a response with no declared type is one a browser may
/// sniff as HTML, and the page's document is the one response this module must
/// never change, so the unknown case falls toward Tauri's own behavior.
pub fn should_attach(is_dev: bool, content_type: Option<&str>) -> bool {
    if is_dev {
        return false;
    }
    let Some(content_type) = content_type else {
        return false;
    };
    let essence = content_type
        .split_once(';')
        .map_or(content_type, |(essence, _)| essence)
        .trim();
    !essence.is_empty() && !essence.eq_ignore_ascii_case("text/html")
}

/// The body of the web-resource hook: attaches `policy` to `response` when
/// `should_attach` says so, and otherwise leaves the response exactly as Tauri
/// built it.
pub fn attach(
    is_dev: bool,
    response: &mut Response<Cow<'static, [u8]>>,
    policy: Option<&HeaderValue>,
) {
    let Some(policy) = policy else {
        return;
    };
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    if should_attach(is_dev, content_type) {
        response
            .headers_mut()
            .insert(CONTENT_SECURITY_POLICY, policy.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::{attach, policy_header, should_attach};
    use std::borrow::Cow;
    use std::collections::{BTreeMap, BTreeSet, HashMap};
    use tauri::http::header::{CONTENT_SECURITY_POLICY, CONTENT_TYPE};
    use tauri::http::{HeaderValue, Response};
    use tauri::utils::config::{Csp, CspDirectiveSources};

    fn response(content_type: Option<&str>) -> Response<Cow<'static, [u8]>> {
        let mut builder = Response::builder();
        if let Some(content_type) = content_type {
            builder = builder.header(CONTENT_TYPE, content_type);
        }
        builder.body(Cow::Borrowed(&b""[..])).expect("a valid test response")
    }

    #[test]
    fn an_html_response_is_never_touched() {
        for html in ["text/html", "text/html; charset=utf-8", "TEXT/HTML", " text/html ;q=1"] {
            assert!(!should_attach(false, Some(html)), "{html}");
        }
    }

    #[test]
    fn every_worker_and_asset_type_gets_the_policy() {
        // text/javascript is what Tauri serves `.js` and `.mjs` as; the others
        // are the same answer for any type a worker script could arrive as.
        for other in [
            "text/javascript",
            "application/javascript",
            "text/javascript; charset=utf-8",
            "application/wasm",
            "text/css",
            "image/png",
            "application/json",
            // A type that merely contains "html" is not HTML.
            "application/xhtml+xml",
        ] {
            assert!(should_attach(false, Some(other)), "{other}");
        }
    }

    #[test]
    fn a_dev_build_attaches_nothing() {
        assert!(!should_attach(true, Some("text/javascript")));
        assert!(!should_attach(true, Some("application/wasm")));
    }

    #[test]
    fn no_declared_type_gets_nothing() {
        assert!(!should_attach(false, None));
        assert!(!should_attach(false, Some("")));
        assert!(!should_attach(false, Some("  ; charset=utf-8")));
    }

    #[test]
    fn attach_sets_the_policy_on_a_script_and_leaves_the_page_alone() {
        let policy = HeaderValue::from_static("default-src 'self'");

        let mut script = response(Some("text/javascript"));
        attach(false, &mut script, Some(&policy));
        assert_eq!(script.headers().get(CONTENT_SECURITY_POLICY), Some(&policy));

        // The page keeps Tauri's own header, hash and all, byte for byte.
        let tauris = HeaderValue::from_static("script-src 'self' 'sha256-abc'");
        let mut page = response(Some("text/html"));
        page.headers_mut().insert(CONTENT_SECURITY_POLICY, tauris.clone());
        attach(false, &mut page, Some(&policy));
        assert_eq!(page.headers().get_all(CONTENT_SECURITY_POLICY).iter().count(), 1);
        assert_eq!(page.headers().get(CONTENT_SECURITY_POLICY), Some(&tauris));

        let mut dev = response(Some("text/javascript"));
        attach(true, &mut dev, Some(&policy));
        assert_eq!(dev.headers().get(CONTENT_SECURITY_POLICY), None);

        let mut untyped = response(None);
        attach(false, &mut untyped, Some(&policy));
        assert_eq!(untyped.headers().get(CONTENT_SECURITY_POLICY), None);

        let mut no_policy = response(Some("text/javascript"));
        attach(false, &mut no_policy, None);
        assert_eq!(no_policy.headers().get(CONTENT_SECURITY_POLICY), None);
    }

    #[test]
    fn no_configured_policy_means_no_header() {
        assert_eq!(policy_header(None), None);
    }

    /// The directive map a policy string names, sources compared as sets.
    fn directives(policy: &str) -> BTreeMap<String, BTreeSet<String>> {
        policy
            .split(';')
            .map(str::trim)
            .filter(|d| !d.is_empty())
            .map(|d| {
                let mut parts = d.split(' ').filter(|p| !p.is_empty());
                let name = parts.next().unwrap_or_default().to_string();
                (name, parts.map(str::to_string).collect())
            })
            .collect()
    }

    #[test]
    fn the_header_carries_exactly_the_configured_directive_map() {
        // The real config, so this is a claim about what ships: every directive
        // and every source in app.security.csp, and nothing else.
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json parses");
        let csp: Csp = serde_json::from_value(conf["app"]["security"]["csp"].clone())
            .expect("app.security.csp is a Tauri Csp");
        let header = policy_header(Some(&csp)).expect("the configured policy is a valid header value");

        let configured: HashMap<String, CspDirectiveSources> = csp.into();
        let expected: BTreeMap<String, BTreeSet<String>> = configured
            .into_iter()
            .map(|(name, sources)| (name, Vec::<String>::from(sources).into_iter().collect()))
            .collect();
        assert!(expected.len() > 5, "the scan read the wrong config value");
        assert_eq!(directives(header.to_str().expect("ASCII header")), expected);
    }
}
