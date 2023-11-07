const ipc = require('node-ipc');
const childProcess = require('child_process');

ipc.config.silent = true;

function isSocketTaken(name, fn) {
  return new Promise((resolve, reject) => {
    ipc.connectTo(name, () => {
      ipc.of[name].on('error', () => {
        ipc.disconnect(name);
        resolve(false);
      });

      ipc.of[name].on('connect', () => {
        ipc.disconnect(name);
        resolve(true);
      });
    });
  });
}
async function findOpenSocket() {
    let currentSocket = 1;
    console.log('checking', currentSocket);
    while (await isSocketTaken('myapp' + currentSocket)) {
        currentSocket++;
        console.log('checking', currentSocket);
    }
    console.log('found socket', currentSocket);
    return 'myapp' + currentSocket;
}

async function main() {
    let socket = await findOpenSocket();
    ipc.config.id = socket;
    ipc.serve(() => {
        ipc.server.on('message', (data, socket) => {
            console.log('parent received', data);
        });
    })
    ipc.server.start()
    childProcess.fork(`./child1.js`, [
        '--subprocess',
        socket
    ], {
        stdio: 'inherit'
    });
    childProcess.fork(`./child2.js`, [
        '--subprocess',
        socket
    ], {
        stdio: 'inherit'
    }); 
}

main()