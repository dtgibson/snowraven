use keyring::Entry;

#[tauri::command]
fn get_api_key(service: &str) -> Result<Option<String>, String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_api_key(service: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_key(service: &str) -> Result<(), String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_api_key, set_api_key, delete_api_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
