// electron.js
console.log("[Electron] Script start");
const { app, BrowserWindow } = require("electron");
const path = require("path");
// const isDev = require('electron-is-dev'); // Você removeu, mas app.isPackaged é melhor

const isDev = !app.isPackaged; // Correto para determinar modo de desenvolvimento

let mainWindow;

function createWindow() {
  console.log("[Electron] createWindow() called");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // __dirname é definido automaticamente em CommonJS
      preload: path.join(__dirname, "preload.js"), // preload.js deve usar CommonJS também
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  console.log("[Electron] BrowserWindow created");

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(`[Electron] Failed to load URL: ${validatedURL}`);
      console.error(
        `[Electron] Error Code: ${errorCode} - Description: ${errorDescription}`
      );
    }
  );

  if (isDev) {
    console.log(
      "[Electron] Loading from Vite dev server: http://localhost:5173"
    );
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Para produção, o React app precisa ser construído primeiro (npm run build)
    // e o caminho deve apontar para o index.html dentro da pasta 'dist'
    // que o Vite cria DENTRO da pasta 'frontend-electron'.
    console.log("[Electron] Loading from file: dist/index.html");
    mainWindow.loadFile(path.join(__dirname, "dist/index.html")); // Ajuste o caminho se necessário
  }

  mainWindow.on("closed", () => {
    console.log('[Electron] mainWindow "closed" event fired.');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log("[Electron] app.whenReady() callback executed");
  console.log("[Electron] Calling createWindow()");
  createWindow();
  console.log("[Electron] createWindow() called");
  app.on("activate", () => {
    console.log('[Electron] "activate" event fired.');
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log(
        "[Electron] No windows open, calling createWindow() on activate."
      );
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  console.log('[Electron] "window-all-closed" event fired.');
  console.log(`[Electron] process.platform is ${process.platform}`);
  if (process.platform !== "darwin") {
    console.log("[Electron] Quitting app (not macOS).");
    app.quit();
  } else {
    console.log("[Electron] Not quitting app (macOS).");
  }
});

app.on("before-quit", () => {
  console.log('[Electron] "before-quit" event fired.');
});

console.log("[Electron] Main script fully parsed and running (CommonJS).");
