import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'

/**
 * Build and install the native application menu. Kept minimal and useful:
 * standard edit/window roles plus Bearsome-specific shortcuts (open the mods
 * folder, jump to Modrinth) and an About entry.
 */
export function buildAppMenu(getModsDir: () => string): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open mods folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => shell.openPath(getModsDir())
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Browse Modrinth',
          click: () => shell.openExternal('https://modrinth.com')
        },
        {
          label: 'About Bearsome',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
            const detail = `Version ${app.getVersion()}\n\nA friendly desktop app for finding and installing Minecraft mods from Modrinth.\n\nUnofficial — not affiliated with Mojang or Modrinth.`
            void dialog.showMessageBox(win, {
              type: 'info',
              title: 'About Bearsome',
              message: 'Bearsome',
              detail
            })
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
