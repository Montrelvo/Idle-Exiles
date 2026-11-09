const { app, BrowserWindow, net, protocol } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const files = new Set(require("./desktop-files.json"));

protocol.registerSchemesAsPrivileged([{
  scheme: "game",
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

function openCamp() {
  const window = new BrowserWindow({
    title: "Idle Exiles",
    width: 1200,
    height: 950,
    minWidth: 520,
    minHeight: 460,
    autoHideMenuBar: true,
    backgroundColor: "#121313",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.on("will-navigate", event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  return window.loadURL("game://idle-exiles/index.html");
}

app.whenReady().then(() => {
  protocol.handle("game", request => {
    const url = new URL(request.url);
    const file = url.pathname.slice(1);
    if (request.method !== "GET" || url.host !== "idle-exiles" || !files.has(file)) {
      return new Response(null, { status: 404 });
    }
    return net.fetch(pathToFileURL(path.join(__dirname, file)).href);
  });
  return openCamp();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

app.on("window-all-closed", () => app.quit());
