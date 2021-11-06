const { app, BrowserWindow } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) {
    app.quit();
}

function main() {
    const mainWindow = new BrowserWindow({
        icon: path.join(__dirname, './icon.png')
    });
    mainWindow.setMenuBarVisibility(false);
    if (app.isPackaged) {
        mainWindow.loadURL('https://canonfire.miramontes.dev/');
    }
    else {
        mainWindow.loadURL('http://canonfire.local/');
        mainWindow.webContents.openDevTools();
    }
    mainWindow.maximize();
    return mainWindow;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.whenReady().then(() => {
    main();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            main();
        }
    })
});
