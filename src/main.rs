use std::env;
use std::fs;
use anyhow::{Context, Result};

const EMBEDDED_ASAR: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/app.asar"));

fn main() {

    #[cfg(windows)]
    {
        unsafe {
            windows_sys::Win32::System::Console::SetConsoleOutputCP(65001);
        }
    }
    
    match run() {
        Ok(_) => {
            println!("汉化完成");
            pause();
        }
        Err(e) => {
            eprintln!("汉化失败，请重试");
            eprintln!("错误详情: {}", e);
            pause();
            std::process::exit(1);
        }
    }
}

fn run() -> Result<()> {
    let exe_path = env::current_exe()
        .context("无法获取程序路径")?;
    let exe_dir = exe_path.parent()
        .context("无法获取程序目录")?;
    
    let resources_dir = exe_dir.join("resources");
    let target_path = resources_dir.join("app.asar");

    if target_path.exists() {
        let backup_path = resources_dir.join("app.asar.backup");
        fs::copy(&target_path, &backup_path)
            .context("无法备份原app.asar文件")?;
        println!("已备份原文件: {}", backup_path.display());
    }
    
    println!("写入汉化文件... ({} 字节)", EMBEDDED_ASAR.len());
    fs::write(&target_path, EMBEDDED_ASAR)
        .context("无法写入app.asar文件")?;
    
    println!("成功写入: {}", target_path.display());
    
    Ok(())
}

fn pause() {
    use std::io::{self, Write};
    print!("Press any key to continue...");
    io::stdout().flush().unwrap();
    let _ = io::stdin().read_line(&mut String::new());
}
