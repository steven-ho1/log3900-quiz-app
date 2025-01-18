const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/client-web', 'index.html');
const iconPath = path.join(__dirname, '../dist/client-web', 'favicon.ico');
const preloadPath = path.join(__dirname, 'preload.js');

const isMainWindow = true;
let appWindow;
let chatWindow;

function initWindow() {
    appWindow = new BrowserWindow({
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: iconPath,
    });

    appWindow.setMenuBarVisibility(false);
    appWindow.maximize();
    appWindow.loadFile(indexPath);

    appWindow.webContents.on('did-finish-load', () => {
        appWindow.webContents.send('initializeWindow', isMainWindow);
    });

    appWindow.on('closed', function () {
        if (chatWindow) {
            chatWindow.close();
            chatWindow = null;
        }

        appWindow = null;
    });
}

function createChatWindow(arg) {
    if (chatWindow) {
        chatWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const chatWindowWidth = width / 3;
    const chatWindowHeight = height / 1.5;
    const bottomLeftYCoordinate = height - chatWindowHeight;
    chatWindow = new BrowserWindow({
        x: 0,
        y: bottomLeftYCoordinate,
        width: chatWindowWidth,
        height: chatWindowHeight,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: iconPath,
    });

    chatWindow.setMenuBarVisibility(false);
    chatWindow.loadFile(indexPath);

    chatWindow.webContents.on('did-finish-load', () => {
        chatWindow.webContents.send('initializeWindow', !isMainWindow, arg);
        chatWindow.setTitle('Chat');
    });

    chatWindow.on('closed', () => {
        if (chatWindow) {
            appWindow.webContents.send('reattach-chat');
            chatWindow = null;
        }
    });
}

app.on('ready', initWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (appWindow === null) {
        initWindow();
    }
});

ipcMain.on('detach-chat', (event, arg) => {
    createChatWindow(arg);
});

ipcMain.on('user-change', (event, arg) => {
    if (chatWindow) chatWindow.webContents.send('user-change', arg);
});
