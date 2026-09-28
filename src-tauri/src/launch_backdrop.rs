//! Keep the raven visible while WKWebView is still drawing its first document.
//! The iOS launch storyboard ends when Tauri exposes its window, about two
//! seconds before WebKit paints on a cold simulator launch. This image sits
//! behind the transparent webview; the HTML launch frame covers it as soon as
//! that frame paints, and the normal opaque app background covers it after boot.

use objc2::{msg_send, runtime::AnyObject, MainThreadMarker};
use objc2_foundation::NSString;
use objc2_ui_kit::{UIColor, UIImage, UIImageView, UIView};
use tauri::Manager;

pub fn install(app: &mut tauri::App) {
    let Some(webview) = app.get_webview_window("main") else {
        return;
    };
    let _ = webview.with_webview(|platform| unsafe {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let view = &*platform.inner().cast::<UIView>();
        let Some(parent) = view.superview() else {
            return;
        };
        let Some(image) = UIImage::imageNamed(&NSString::from_str("LaunchRaven")) else {
            return;
        };

        let raven = UIImageView::new(mtm);
        raven.setImage(Some(&image));
        raven.setTranslatesAutoresizingMaskIntoConstraints(false);
        raven.setUserInteractionEnabled(false);
        parent.insertSubview_belowSubview(&raven, view);
        raven
            .widthAnchor()
            .constraintEqualToConstant(88.0)
            .setActive(true);
        raven
            .heightAnchor()
            .constraintEqualToConstant(88.0)
            .setActive(true);
        raven
            .centerXAnchor()
            .constraintEqualToAnchor(&parent.centerXAnchor())
            .setActive(true);
        raven
            .centerYAnchor()
            .constraintEqualToAnchor(&parent.centerYAnchor())
            .setActive(true);

        let green =
            UIColor::colorWithRed_green_blue_alpha(45.0 / 255.0, 134.0 / 255.0, 83.0 / 255.0, 1.0);
        parent.setBackgroundColor(Some(&green));
        let clear = UIColor::clearColor();
        view.setOpaque(false);
        view.setBackgroundColor(Some(&clear));
        let scroll: *mut AnyObject = msg_send![view, scrollView];
        if !scroll.is_null() {
            (&*scroll.cast::<UIView>()).setBackgroundColor(Some(&clear));
        }
    });
}
