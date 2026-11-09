# A real mouse, for the checks that Playwright's synthetic events cannot make: the operating system's own mouse input
# (SetCursorPos and mouse_event), so a drag goes through WebView2 and Tauri the way a hand's does (finding 64c7).
#   powershell -File measure\real-mouse.ps1 move X Y
#   powershell -File measure\real-mouse.ps1 click X Y
#   powershell -File measure\real-mouse.ps1 drag X1 Y1 X2 Y2 [steps]
#   powershell -File measure\real-mouse.ps1 pick PID "C:\path\file.pdf"
# Coordinates are screen pixels (this process is DPI aware, so they are device pixels).
# pick (debug round C1): waits for a file dialog (a #32770 window) whose owner is process PID's window, brings it to the
# front and types the path and Enter into it with the real keyboard. It types nothing if no such dialog shows, so the
# keys never go to another program.
param([string]$Action, [string]$X, [string]$Y, [int]$X2 = 0, [int]$Y2 = 0, [int]$Steps = 24)
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class RealMouse {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  // a visible file dialog owned (directly or further up) by a window of process `pid`
  public static IntPtr Dialog(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (c.ToString() != "#32770") return true;
      for (IntPtr o = GetWindow(h, 4); o != IntPtr.Zero; o = GetWindow(o, 4)) {
        uint op; GetWindowThreadProcessId(o, out op);
        if (op == pid) { found = h; return false; }
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
[void][RealMouse]::SetProcessDPIAware()
switch ($Action) {
  'move' { [void][RealMouse]::SetCursorPos([int]$X, [int]$Y) }
  'click' {
    [void][RealMouse]::SetCursorPos([int]$X, [int]$Y); Start-Sleep -Milliseconds 120
    [RealMouse]::mouse_event(0x2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60
    [RealMouse]::mouse_event(0x4, 0, 0, 0, [UIntPtr]::Zero)
  }
  'drag' {
    # the parameters are strings (pick takes a path), and a typed parameter stays a string when assigned to
    [int]$x1 = $X; [int]$y1 = $Y
    [void][RealMouse]::SetCursorPos($x1, $y1); Start-Sleep -Milliseconds 120
    [RealMouse]::mouse_event(0x2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 120
    for ($i = 1; $i -le $Steps; $i++) {
      [void][RealMouse]::SetCursorPos([int]($x1 + ($X2 - $x1) * $i / $Steps), [int]($y1 + ($Y2 - $y1) * $i / $Steps))
      Start-Sleep -Milliseconds 25
    }
    Start-Sleep -Milliseconds 250
    [RealMouse]::mouse_event(0x4, 0, 0, 0, [UIntPtr]::Zero)
  }
  'pick' {
    $dialog = [IntPtr]::Zero
    for ($i = 0; $i -lt 50 -and $dialog -eq [IntPtr]::Zero; $i++) { $dialog = [RealMouse]::Dialog([uint32]$X); if ($dialog -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 100 } }
    if ($dialog -eq [IntPtr]::Zero) { throw "no file dialog from process $X" }
    [void][RealMouse]::SetForegroundWindow($dialog); Start-Sleep -Milliseconds 300
    if ([RealMouse]::GetForegroundWindow() -ne $dialog) { throw "the file dialog is not in front; nothing typed" }
    Add-Type -AssemblyName System.Windows.Forms
    # SendKeys reads + ^ % ~ ( ) { } [ ] as keys: each is typed in braces
    $keys = ($Y.ToCharArray() | ForEach-Object { if ('+^%~(){}[]'.Contains([string]$_)) { "{$_}" } else { [string]$_ } }) -join ''
    [System.Windows.Forms.SendKeys]::SendWait($keys); Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  }
  default { throw "move, click, drag or pick" }
}
