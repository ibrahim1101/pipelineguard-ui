use std::path::Path;

fn main() {
    // The approved Cerberus icon is required for every desktop build.
    // Do not silently generate a generic placeholder if assets are missing.
    let icon = Path::new("icons/icon.ico");
    assert!(
        icon.is_file(),
        "Missing approved Cerberus Windows icon: desktop/src-tauri/icons/icon.ico"
    );
    let bytes = std::fs::read(icon).expect("Unable to read Cerberus icon");
    assert!(
        bytes.len() > 1024 && bytes.starts_with(&[0, 0, 1, 0]),
        "Cerberus icon must be a valid, non-placeholder ICO file"
    );
    tauri_build::build()
}
