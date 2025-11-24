use std::env;
use std::fs;
use std::path::Path;

fn main() -> anyhow::Result<()> {

    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let asar_path = Path::new(&manifest_dir).join("app.asar");
    
    if !asar_path.exists() {
        anyhow::bail!("找不到app.asar文件");
    }
    
    let out_dir = env::var("OUT_DIR")?;
    let dest_path = Path::new(&out_dir).join("app.asar");
    
    fs::copy(&asar_path, &dest_path)?;
    
    println!("cargo:rerun-if-changed=app.asar");
    
    Ok(())
}
