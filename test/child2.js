const ipc = require('node-ipc');
const [,,,socketName] = process.argv
console.log('child2', process.argv)
console.log('child2 socketName', socketName)
const ipcConnect = (id, func) => {
  ipc.config.silent = true;
  ipc.connectTo(id, () => {
    func(ipc.of[id]);
  });
};
ipcConnect(socketName, (socket) => {
    socket.on('message', (data) => {
        console.log('child2 received', data);
    });
    socket.on('connect', () => {
        let i = 0
        setInterval(() => {
            socket.emit('message', 'hello from child2' + i++);
        }, 1500);
    });
})