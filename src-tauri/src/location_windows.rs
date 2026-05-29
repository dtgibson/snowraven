// Native Windows geolocation, parallel to the macOS module in location.rs.
// Uses the Windows.Devices.Geolocation API via the `windows` crate. Returns the
// same Coords shape and "permission-denied" error convention as macOS so the
// frontend treats both desktop platforms identically.

use windows::Devices::Geolocation::{GeolocationAccessStatus, Geolocator};

#[derive(serde::Serialize)]
pub struct Coords {
    pub lat: f64,
    pub lng: f64,
}

#[tauri::command]
pub async fn get_location() -> Result<Coords, String> {
    // The WinRT IAsyncOperation calls block (via .get()), so run them off the
    // async executor.
    tauri::async_runtime::spawn_blocking(|| -> Result<Coords, String> {
        // Reflects the global "Location services" + "Let desktop apps access
        // location" settings. For an unpackaged .exe there is no per-app prompt.
        let access = Geolocator::RequestAccessAsync()
            .map_err(|e| format!("unavailable: {e}"))?
            .get()
            .map_err(|e| format!("unavailable: {e}"))?;

        if access != GeolocationAccessStatus::Allowed {
            return Err("permission-denied".to_string());
        }

        let locator = Geolocator::new().map_err(|e| format!("unavailable: {e}"))?;
        let position = locator
            .GetGeopositionAsync()
            .map_err(|e| format!("unavailable: {e}"))?
            .get()
            .map_err(|e| format!("unavailable: {e}"))?;

        let point = position
            .Coordinate()
            .map_err(|e| format!("unavailable: {e}"))?
            .Point()
            .map_err(|e| format!("unavailable: {e}"))?
            .Position()
            .map_err(|e| format!("unavailable: {e}"))?;

        Ok(Coords {
            lat: point.Latitude,
            lng: point.Longitude,
        })
    })
    .await
    .map_err(|e| format!("unavailable: {e}"))?
}
