let electron = require('electron');
let { app, BrowserWindow } = require('electron');
let { fork } = require('child_process');
let path = require('path');

const AdmZip = require('adm-zip');
const { readdir, rmdir } = require('fs');

const idle = () => Promise.resolve()

const serialConsume = (next, count = 0, task = next(count)) => {
  return task ? task().then(() => serialConsume(next, count + 1)) : idle()
}
const serial = tasks => {
  return serialConsume(index => tasks[index])
}
const parallel = tasks => {
  return Promise.all(tasks.map(task => task())).then(idle)
}
const batch = (tasks, batchSize) => {
  return parallel(Array.from({ length: batchSize }, () => () => serialConsume(() => tasks.shift())))
}
const isDev = require('electron-is-dev');

let findOpenSocket = require('./src/socket-helpers');

let FE_FROM_STATICS = isDev ? false : true;
let FE_ENABLE_DEV_TOOLS = isDev ? true : false;
let BE_AS_SEPARATE_PROCESS = isDev ? false : true;

let frontendWindow;
let backendWindow;
let backendProcess;

const FE_BUILD_DIR = `build-frontend`;
const BE_BUILD_DIR = `build-backend`;

function createFrontendWindow(socketName) {
  frontendWindow = new BrowserWindow({
    x: 900,
    y: 0,
    width: 1000,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      preload: `${__dirname}/src/client-preload.js`
    }
  });

  frontendWindow.loadURL(
    FE_FROM_STATICS
      ? `file://${path.join(__dirname, FE_BUILD_DIR, 'index.html')}`
      : 'http://localhost:3000'
  );

  frontendWindow.webContents.on('did-finish-load', () => {
    frontendWindow.webContents.send('set-socket', {
      name: socketName
    });
  });

  if (FE_ENABLE_DEV_TOOLS) {
    frontendWindow.webContents.openDevTools();
  } else {
    frontendWindow.removeMenu();
  }
}

function createBackendWindow(socketName) {
  const window = new BrowserWindow({
    x: 0,
    y: 0,
    width: 900,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false
    }
  });
  window.loadURL(`file://${__dirname}/${BE_BUILD_DIR}/server-dev.html`);

  window.webContents.openDevTools();

  window.webContents.on('did-finish-load', () => {
    window.webContents.send('set-socket', { name: socketName });
  });

  backendWindow = window;
}

function createBackendProcess(socketName) {
  backendProcess = fork(`${__dirname}/${BE_BUILD_DIR}/server.js`, [
    '--subprocess',
    app.getVersion(),
    socketName
  ]);

  backendProcess.on('message', (msg) => {
    console.log(msg);
  });
}

const initializeApp = async () => {
  let serverSocket = await findOpenSocket();

  createFrontendWindow(serverSocket);

  if (BE_AS_SEPARATE_PROCESS) {
    createBackendProcess(serverSocket);
  } else {
    createBackendWindow(serverSocket);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', initializeApp);

// App close handler
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    initializeApp();
  }
});

const handleProcessZipBatchMain = async () => {
  // The FE will udpate the redux store
    console.log(`[Main] Process zip extract`);
    
    const start = new Date().getTime();
    const base = path.resolve(__dirname, 'zips')
    const targetBase = path.resolve(__dirname, 'unzips')
    await new Promise((resolve, reject) => {
      rmdir(targetBase, { recursive: true }, err => {
        if (err) reject(err)
        else resolve()
      }
      )
    }
    )
    const entries = await new Promise((resolve, reject) => {
      readdir(base, (err, entries) => {
        if (err) reject(err)
        else resolve(entries)
      })
    })
    await serial(entries.map(entry => () => new Promise((resolve, reject) => {
      new AdmZip(path.resolve(base, entry)).extractAllTo(path.resolve(targetBase, entry), true)
      resolve()
    })))
    const end = new Date().getTime();
    return `Main Processed ${entries.length} zips in ${end - start}ms`;
};
// Add extensions: https://github.com/MarshallOfSound/electron-devtools-installer
app.whenReady().then(() => {
  if (FE_ENABLE_DEV_TOOLS) {
    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS,
      REDUX_DEVTOOLS
    } = require('electron-devtools-installer');

    installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS])
      .then((name) => console.log(`Added Extension:  ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  }

  const { ipcMain } = require('electron');
  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });
  ipcMain.handle('extract-zip', () => {
    return handleProcessZipBatchMain()
  })
});
