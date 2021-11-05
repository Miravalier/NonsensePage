const { app, BrowserWindow } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) {
    app.quit();
}

if (process.platform === 'win32') {
    require('update-electron-app')();
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        icon: path.join(__dirname, '../build/icon.png'),
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('renderer/app.html');
    return mainWindow;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
});
