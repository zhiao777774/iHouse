const socket = io();

function emitToServer(event, data) {
    socket.emit(event, data);
}