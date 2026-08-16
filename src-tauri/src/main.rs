// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Bajo gamescope (Steam HTPC mode), WAYLAND_DISPLAY suele quedar seteado
  // aunque gamescope no sirva Wayland real a clientes normales. GTK/WebKit
  // intentan EGL sobre Wayland y fallan con "Could not create default EGL
  // display: EGL_BAD_PARAMETER". Forzamos backend X11 (Xwayland, que
  // gamescope sí provee) antes de que GTK se inicialice.
  std::env::set_var("GDK_BACKEND", "x11");

  app_lib::run();
}
