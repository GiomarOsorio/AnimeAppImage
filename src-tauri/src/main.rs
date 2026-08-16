// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Bajo gamescope (Steam HTPC mode) y también en desktop normal, WebKitGTK
  // falla con "Could not create default EGL display: EGL_BAD_PARAMETER" al
  // intentar inicializar el compositing acelerado por GPU (mismo patrón que
  // el bug de AMD/RADV que forzó --disable-gpu-compositing en la versión
  // Electron). GDK4 intenta EGL incluso con backend X11, así que forzamos
  // también software rendering para evitar el path de GPU por completo.
  std::env::set_var("GDK_BACKEND", "x11");
  std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
  std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");

  app_lib::run();
}
