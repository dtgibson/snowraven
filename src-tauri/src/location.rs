use objc2::{define_class, msg_send, rc::Retained, runtime::ProtocolObject, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_core_location::{
    CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate,
};
use objc2_foundation::{NSArray, NSError, NSObject, NSObjectProtocol};
use std::cell::RefCell;
use tokio::sync::oneshot;

type LocationResult = Result<(f64, f64), String>;

thread_local! {
    // Keeps the manager and delegate alive between the initial request and the callback.
    // CLLocationManager uses a weak delegate reference, so we must hold a strong ref here.
    // Cleared at the start of each new request and after stopUpdatingLocation in each callback.
    static LOCATION_SESSION: RefCell<Option<LocationSession>> = const { RefCell::new(None) };
}

struct LocationSession {
    _manager: Retained<CLLocationManager>,
    _delegate: Retained<LocationDelegate>,
}

struct LocationDelegateIvars {
    sender: RefCell<Option<oneshot::Sender<LocationResult>>>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = LocationDelegateIvars]
    struct LocationDelegate;

    unsafe impl NSObjectProtocol for LocationDelegate {}

    unsafe impl CLLocationManagerDelegate for LocationDelegate {
        #[unsafe(method(locationManager:didUpdateLocations:))]
        unsafe fn did_update_locations(
            &self,
            manager: &CLLocationManager,
            locations: &NSArray<CLLocation>,
        ) {
            manager.stopUpdatingLocation();
            let result = locations
                .lastObject()
                .map(|loc| {
                    let coord = loc.coordinate();
                    Ok((coord.latitude, coord.longitude))
                })
                .unwrap_or_else(|| Err("unavailable".to_string()));
            self.complete(result);
        }

        #[unsafe(method(locationManager:didFailWithError:))]
        unsafe fn did_fail_with_error(
            &self,
            manager: &CLLocationManager,
            error: &NSError,
        ) {
            manager.stopUpdatingLocation();
            let code = if error.code() == 1 {
                "permission-denied"
            } else {
                "unavailable"
            };
            self.complete(Err(code.to_string()));
        }

        #[unsafe(method(locationManagerDidChangeAuthorization:))]
        unsafe fn did_change_authorization(&self, manager: &CLLocationManager) {
            match manager.authorizationStatus() {
                CLAuthorizationStatus::AuthorizedWhenInUse
                | CLAuthorizationStatus::AuthorizedAlways => {
                    manager.requestLocation();
                }
                CLAuthorizationStatus::Denied | CLAuthorizationStatus::Restricted => {
                    manager.stopUpdatingLocation();
                    self.complete(Err("permission-denied".to_string()));
                }
                _ => {} // Still notDetermined — waiting for user to respond to dialog
            }
        }
    }
);

impl LocationDelegate {
    fn new(mtm: MainThreadMarker, sender: oneshot::Sender<LocationResult>) -> Retained<Self> {
        let delegate = mtm
            .alloc::<LocationDelegate>()
            .set_ivars(LocationDelegateIvars {
                sender: RefCell::new(Some(sender)),
            });
        unsafe { msg_send![super(delegate), init] }
    }

    fn complete(&self, result: LocationResult) {
        if let Some(tx) = self.ivars().sender.borrow_mut().take() {
            let _ = tx.send(result);
        }
        // stopUpdatingLocation was already called — the manager won't fire more callbacks.
        // Clear the session on the next request rather than here to avoid dropping self
        // while we're still executing inside a delegate method.
    }
}

#[derive(serde::Serialize)]
pub struct Coords {
    pub lat: f64,
    pub lng: f64,
}

#[tauri::command]
pub async fn get_location(app: tauri::AppHandle) -> Result<Coords, String> {
    let (tx, rx) = oneshot::channel::<LocationResult>();

    app.run_on_main_thread(move || {
        // Drop any previous (completed) session before starting a new one.
        LOCATION_SESSION.with(|s| s.borrow_mut().take());

        let mtm = MainThreadMarker::new().expect("must be on main thread");
        let manager = unsafe { CLLocationManager::new() };
        let delegate = LocationDelegate::new(mtm, tx);

        // setDelegate stores a weak reference — we keep a strong ref in LOCATION_SESSION.
        unsafe { manager.setDelegate(Some(ProtocolObject::from_ref(&*delegate))) };

        LOCATION_SESSION.with(|session| {
            *session.borrow_mut() = Some(LocationSession {
                _manager: manager.clone(),
                _delegate: delegate,
            });
        });

        let status = unsafe { manager.authorizationStatus() };
        match status {
            CLAuthorizationStatus::AuthorizedWhenInUse
            | CLAuthorizationStatus::AuthorizedAlways => {
                unsafe { manager.requestLocation() };
            }
            CLAuthorizationStatus::Denied | CLAuthorizationStatus::Restricted => {
                // requestLocation() will immediately call didFailWithError.
                unsafe { manager.requestLocation() };
            }
            _ => {
                // NotDetermined — show the system permission dialog.
                unsafe { manager.requestWhenInUseAuthorization() };
            }
        }
    })
    .map_err(|e| e.to_string())?;

    let (lat, lng) = rx
        .await
        .map_err(|_| "Location request cancelled".to_string())?
        .map_err(|e| e)?;

    Ok(Coords { lat, lng })
}
