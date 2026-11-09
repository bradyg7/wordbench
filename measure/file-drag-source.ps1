# A drag source for a real file drop (debug round C1): a small window that, when the real mouse is pressed on it, starts
# the operating system's own file drag (OLE DoDragDrop with a file list), as Explorer does. measure/real-mouse.ps1 then
# moves the real cursor onto the app and lets go, so the drop goes through Windows and WebView2 the way a hand's does.
#   powershell -File measure\file-drag-source.ps1 X Y "C:\a.png|C:\b.pdf"
# X Y are screen pixels (this process is DPI aware). It prints "ready" once it is on screen, "dropped <effect>" after the
# drop, and closes itself after 30 seconds whatever happens.
param([int]$X, [int]$Y, [string]$Files)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class DragSourceDpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[void][DragSourceDpi]::SetProcessDPIAware()
$paths = $Files -split '\|' | Where-Object { $_ }
$form = New-Object Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.StartPosition = 'Manual'
$form.Location = New-Object Drawing.Point($X, $Y)
$form.Size = New-Object Drawing.Size(140, 90)
$form.BackColor = [Drawing.Color]::DarkOrange
$form.Add_MouseDown({
  $list = New-Object System.Collections.Specialized.StringCollection
  foreach ($p in $paths) { [void]$list.Add($p) }
  $data = New-Object Windows.Forms.DataObject
  $data.SetFileDropList($list)
  $effect = $form.DoDragDrop($data, [Windows.Forms.DragDropEffects]::Copy)
  [Console]::Out.WriteLine("dropped $effect"); [Console]::Out.Flush()
  $form.Close()
})
$form.Add_Shown({ $form.Activate(); [Console]::Out.WriteLine('ready'); [Console]::Out.Flush() })
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 30000
$timer.Add_Tick({ $form.Close() })
$timer.Start()
[Windows.Forms.Application]::Run($form)
