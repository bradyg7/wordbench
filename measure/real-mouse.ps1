# A real mouse, for the checks that Playwright's synthetic events cannot make: the operating system's own mouse input
# (SetCursorPos and mouse_event), so a drag goes through WebView2 and Tauri the way a hand's does (finding 64c7).
#   powershell -File measure\real-mouse.ps1 move X Y
#   powershell -File measure\real-mouse.ps1 drag X1 Y1 X2 Y2 [steps]
# Coordinates are screen pixels (this process is DPI aware, so they are device pixels).
param([string]$Action, [int]$X, [int]$Y, [int]$X2 = 0, [int]$Y2 = 0, [int]$Steps = 24)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RealMouse {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[void][RealMouse]::SetProcessDPIAware()
switch ($Action) {
  'move' { [void][RealMouse]::SetCursorPos($X, $Y) }
  'drag' {
    [void][RealMouse]::SetCursorPos($X, $Y); Start-Sleep -Milliseconds 120
    [RealMouse]::mouse_event(0x2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 120
    for ($i = 1; $i -le $Steps; $i++) {
      [void][RealMouse]::SetCursorPos([int]($X + ($X2 - $X) * $i / $Steps), [int]($Y + ($Y2 - $Y) * $i / $Steps))
      Start-Sleep -Milliseconds 25
    }
    Start-Sleep -Milliseconds 250
    [RealMouse]::mouse_event(0x4, 0, 0, 0, [UIntPtr]::Zero)
  }
  default { throw "move or drag" }
}
