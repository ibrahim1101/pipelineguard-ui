use std::{fs, path::Path};

fn ensure_placeholder_icon() -> std::io::Result<()> {
    // Tauri requires an ICO for Windows resources. Generate a minimal
    // 1x1 opaque grayscale placeholder until the final branding is added.
    // ICO header + directory entry + 40-byte DIB + pixel + AND mask.
    let icon = Path::new("icons/icon.ico");
    if icon.exists() {
        return Ok(());
    }
    fs::create_dir_all("icons")?;
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&[0, 0, 1, 0, 1, 0]); // ICO header
    bytes.extend_from_slice(&[1, 1, 0, 0]); // width, height, palette, reserved
    bytes.extend_from_slice(&1u16.to_le_bytes()); // planes
    bytes.extend_from_slice(&32u16.to_le_bytes()); // bpp
    bytes.extend_from_slice(&48u32.to_le_bytes()); // DIB + pixel + AND mask
    bytes.extend_from_slice(&22u32.to_le_bytes()); // image offset
    bytes.extend_from_slice(&40u32.to_le_bytes()); // BITMAPINFOHEADER
    bytes.extend_from_slice(&1i32.to_le_bytes()); // width
    bytes.extend_from_slice(&2i32.to_le_bytes()); // height includes AND mask
    bytes.extend_from_slice(&1u16.to_le_bytes()); // planes
    bytes.extend_from_slice(&32u16.to_le_bytes()); // bit count
    bytes.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    bytes.extend_from_slice(&4u32.to_le_bytes()); // pixel size
    bytes.extend_from_slice(&0i32.to_le_bytes()); // horizontal resolution
    bytes.extend_from_slice(&0i32.to_le_bytes()); // vertical resolution
    bytes.extend_from_slice(&0u32.to_le_bytes()); // palette
    bytes.extend_from_slice(&0u32.to_le_bytes()); // important colors
    bytes.extend_from_slice(&[128, 128, 128, 255]); // BGRA grayscale pixel
    bytes.extend_from_slice(&[0, 0, 0, 0]); // transparent-mask row
    fs::write(icon, bytes)
}

fn main() {
    ensure_placeholder_icon().expect("failed to create temporary Windows icon");
    tauri_build::build()
}
