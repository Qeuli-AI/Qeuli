use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::Duration;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::menu::{IsMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// The Node daemon we started. Dropped (killed) when the app exits.
struct Daemon(Mutex<Option<Child>>);

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Bundled single file first, then the unbundled source, then the repo checkout (dev).
fn daemon_script(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join("daemon").join("qeuli.mjs"));
        candidates.push(res.join("daemon").join("src").join("cli.js"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..").join("src").join("cli.js"));
    candidates.into_iter().find(|p| p.exists()).map(strip_verbatim)
}

/// Tauri returns Windows paths as `\\?\C:\...`, which Node cannot load as a script path.
fn strip_verbatim(p: PathBuf) -> PathBuf {
    match p.to_str().and_then(|s| s.strip_prefix(r"\\?\")) {
        Some(plain) => PathBuf::from(plain),
        None => p,
    }
}

/// A Node binary shipped next to the app, otherwise whatever is on PATH.
fn node_binary() -> PathBuf {
    let bundled = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|d| d.join(if cfg!(windows) { "node.exe" } else { "node" })))
        .filter(|p| p.exists());
    bundled.unwrap_or_else(|| PathBuf::from("node"))
}

/// A tray entry a feature declared in its feature.json: it calls /features/<feature>/<route>.
#[derive(Clone)]
struct TrayAction {
    label: String,
    feature: String,
    method: String,
    route: String,
}

/// Read the tray entries the build collected from every feature's feature.json.
/// The shell knows nothing about any particular feature.
fn tray_actions(app: &AppHandle) -> Vec<TrayAction> {
    let mut candidates = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join("daemon").join("tray.json"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("daemon").join("tray.json"));
    let Some(text) = candidates.into_iter().find(|p| p.exists()).and_then(|p| std::fs::read_to_string(p).ok()) else {
        return Vec::new();
    };
    let Ok(serde_json::Value::Array(items)) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let field = |v: &serde_json::Value, k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_owned);
    items
        .iter()
        .filter_map(|v| {
            Some(TrayAction {
                label: field(v, "label")?,
                feature: field(v, "feature")?,
                method: field(v, "method")?,
                route: field(v, "route")?,
            })
        })
        .collect()
}

/// Ask the daemon to save and exit by itself, so quitting never loses a pending write.
fn request_daemon_shutdown() {
    if let Ok(addr) = "127.0.0.1:47821".parse() {
        if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
            let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
            let _ = stream.write_all(b"POST /shutdown HTTP/1.1
Host: 127.0.0.1:47821
Content-Length: 0
Connection: close

");
        }
    }
}

/// Send a feature action to the local daemon off the UI thread (a tiny hand-written HTTP request).
fn run_tray_action(action: TrayAction) {
    std::thread::spawn(move || {
        let Ok(addr) = "127.0.0.1:47821".parse() else { return };
        if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
            let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
            let request = format!(
                "{} /features/{}/{} HTTP/1.1\r\nHost: 127.0.0.1:47821\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}",
                action.method, action.feature, action.route
            );
            let _ = stream.write_all(request.as_bytes());
        }
    });
}

fn spawn_daemon(app: &AppHandle) -> Option<Child> {
    let script = daemon_script(app)?;
    let mut cmd = Command::new(node_binary());
    cmd.arg(&script).arg("daemon");
    // The bundled daemon cannot locate these on its own, so hand over the paths.
    if let Some(dir) = script.parent() {
        let toast = dir.join("snoretoast-x64.exe");
        if toast.exists() {
            cmd.env("QEULI_SNORETOAST", toast);
        }
        let icon = dir.join("icon.png");
        if icon.exists() {
            cmd.env("QEULI_ICON", icon);
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.spawn().ok()
}

#[tauri::command]
fn autostart_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![autostart_enabled, set_autostart])
        .setup(|app| {
            app.manage(Daemon(Mutex::new(spawn_daemon(app.handle()))));

            let open = MenuItem::with_id(app, "open", "Open Qeuli", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            // One entry per tray action that features declared, between "Open" and "Quit".
            let actions = tray_actions(app.handle());
            let action_items = actions
                .iter()
                .enumerate()
                .map(|(i, a)| MenuItem::with_id(app, format!("tray:{i}"), &a.label, true, None::<&str>))
                .collect::<Result<Vec<_>, _>>()?;
            let mut entries: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![&open];
            entries.extend(action_items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>));
            entries.push(&quit);
            let menu = Menu::with_items(app, &entries)?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Qeuli")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    id => {
                        let picked = id.strip_prefix("tray:").and_then(|n| n.parse::<usize>().ok());
                        if let Some(action) = picked.and_then(|i| actions.get(i)) {
                            run_tray_action(action.clone());
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Launched at login: stay in the tray.
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps Qeuli running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Qeuli")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<Daemon>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        // Our own daemon already gone (another one held the port)? Then there is nothing to stop.
                        if !matches!(child.try_wait(), Ok(None)) {
                            return;
                        }
                        // Graceful first: let it flush its data, then force-kill only if it is still running.
                        request_daemon_shutdown();
                        for _ in 0..10 {
                            if matches!(child.try_wait(), Ok(Some(_))) {
                                return;
                            }
                            std::thread::sleep(Duration::from_millis(100));
                        }
                        let _ = child.kill();
                    }
                }
            }
        });
}
