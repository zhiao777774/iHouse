const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
const fs = require('fs');
const firebase = require('./firebase.config');

const port = 8080;
const arduinoCOMPort = '/dev/ttyACM0';
const arduinoSerialPort = new SerialPort(arduinoCOMPort, {
    baudRate: 9600
});
const arduinoSerialParser = arduinoSerialPort.pipe(new Readline());

app.use('/js', express.static('js'));
app.use('/css', express.static('css'));
app.use('/fonts', express.static('fonts'));
app.use('/assets', express.static('assets'));

arduinoSerialPort.on('open', () => console.log('Serial Port ' + arduinoCOMPort + ' is opened.'));

arduinoSerialParser.on('data', (data) => {
    console.log('Serial Parser receive data: ' + data);

    if (data.startsWith('tempHumid:')) {
        const [temp, humid] = data.substring(data.indexOf('TempHumid:') + 1).split(',');

        firebase.update('house-sensor', 'tempHumid', {
            temp: parseFloat(temp),
            humid: parseFloat(humid)
        });
    } else if (data.startsWith('respondTempHumidData:')) {
        saveTempHumidData(data.substring(
            data.indexOf('respondTempHumidData:') + 1));
    } else if (data.startsWith('Body')) {
        const [, detected] = data.split(' ');
        detected = detected == 'Detected' ? true : false;
        io.emit('pirSensor', String(detected));
    } else if (data.startsWith('RFID Error:')) {
        const [, cardNumber] = data.split(':');
        const date = new Date();
        
        firebase.set('house-accessible-newCard', cardNumber, {
            date: date.getFullDate() + ' ' + date.getFullTime(),
            value: cardNumber
        });
    } else if (data.startsWith('led')) {
        const code = 'led' + (data.substring(3, 6) == 'One' ? 1 : 2);
        const status  = data.charAt(data.legth() - 1);
        firebase.update('house-sensor', led, { 
            [code]: Number(status)    
        });
    } else if (data.startsWith('red') || data.startsWith('green') || data.startsWith('blue')) {
        const colors = ['red', 'green', 'blue'];
        colors.forEach((color) => {
            if (data.startsWith(color)) {
                firebase.update('house-sensor', 'rgbLed', { 
                    [color]: Number(data.substring(color.length()))
                });
            }
        });
    } else if (data.startsWith('lightRing')) {
        const type = Number(data.charAt(data.legth() - 1));
        firebase.update('house-sensor', 'lightRing', { type });
    } else {
        const sensorOpenable = ['door', 'fan', 'airCon', 'tv', 'audio'];
        sensorOpenable.forEach((sensor) => {
            if (data.startsWith(sensor)) {
                const status = data.charAt(sensor.length());
                firebase.update('house-sensor', sensor, {
                    isOpen: status != 0 ? true : false
                });
            }
        });
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('a user go out');
    });

    socket.on('lightBarFlicker', () => {
        writeLineToArduino('lightBar');
    });
});

app.listen(port, () => console.log('http伺服器已在' + port + '埠口啟動'));

app.get('/', (req, res) => {
    fs.readFile(__dirname + '/index.html', (err, data) => {
        if (err) {
            res.writeHead(404, {
                'Content-Type': 'text/html'
            });
            return res.end('404 Not Found');
        }

        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.write(data);
        return res.end();
    });
});

process.on('SIGINT', () => {
    console.log('Process is terminated');
    process.exit();
});

initModuleStatus();

function initModuleStatus() {
    const modules = ['led', 'rgbLed', 'door', 'fan',
        'airCon', 'lightRing', 'tv', 'audio'
    ];
    const data = {};
    modules.forEach((module) => {
        data[module] = firebase.get('house-sensor', module);
    });

    data.led.then((led) => {
        writeToArduino('ledOne' + led.led1);
        writeToArduino('ledTwo' + led.led2);
    });

    data.rgbLed.then((rgbLed) => {
        writeLineToArduino(`red${rgbLed.red}`);
        writeLineToArduino(`green${rgbLed.green}`);
        writeLineToArduino(`blue${rgbLed.blue}`);
    });

    data.door.then((door) => {
        writeLineToArduino('door' + (door.isOpen ? '1' : '0'));
    });

    data.fan.then((fan) => {
        writeLineToArduino('fan' + (fan.isOpen ? '1' : '0'));
    });

    data.airCon.then((airCon) => {
        writeLineToArduino('airCon' + (airCon.isOpen ? '1' : '0'));
    });

    data.lightRing.then((lightRing) => {
        writeLineToArduino('lightRing' + lightRing.type);
    });

    data.tv.then((tv) => {
        writeLineToArduino('tv' + (tv.isOpen ? '1' : '0'));
    });

    data.audio.then((audio) => {
        writeLineToArduino('audio' + (audio.isOpen ? '1' : '0'));
    });
}

initModuleChangeEvent();
function initModuleChangeEvent() {
    const callbacks = {
        led: function (doc) {
            const data = doc.data();
            const led1 = data && data.led1,
                led2 = data && data.led2;
            writeToArduino('ledOne' + led1);
            writeToArduino('ledTwo' + led2);
        },
        rgbLed: function (doc) {
            const data = doc.data();
            const red = data && data.red,
                green = data && data.green,
                blue = data && data.blue;
            writeToArduino(`red${red}`);
            writeToArduino(`green${green}`);
            writeToArduino(`blue${blue}`);
        },
        door: function (doc) {
            const data = doc.data();
            const isOpen = data && data.isOpen;
            writeToArduino('door' + (isOpen ? '1' : '0'));
        },
        fan: function (doc) {
            const data = doc.data();
            const isOpen = data && data.isOpen;
            writeToArduino('fan' + (isOpen ? '1' : '0'));
        },
        airCon: function (doc) {
            const data = doc.data();
            const isOpen = data && data.isOpen;
            writeToArduino('airCon' + (isOpen ? '1' : '0'));
        },
        lightRing: function (doc) {
            const data = doc.data();
            const type = data && data.type;
            writeToArduino('lightRing' + type);
        },
        tv: function (doc) {
            const data = doc.data();
            const isOpen = data && data.isOpen;
            writeToArduino('tv' + (isOpen ? '1' : '0'));
        },
        audio: function (doc) {
            const data = doc.data();
            const isOpen = data && data.isOpen;
            writeToArduino('audio' + (isOpen ? '1' : '0'));
        }
    };

    Object.keys(callbacks).forEach((module) => {
        const callback = callbacks[module];
        firebase.onSnapshot('house-sensor', module, callback);
    });
}

function writeToArduino(data = '') {
    for (const ch of data) {
        arduinoSerialPort.write(Buffer.from(ch, 'ascii'));
    }
    arduinoSerialPort.write(Buffer.from('\n', 'ascii'));
}

//writeLineToArduino('requestTempHumidData');
//setInterval(writeLineToArduino('requestTempHumidData'), 60000);
function saveTempHumidData(data) {
    const [temp, humid] = data.split(','),
        date = new Date();

    data = firebase.get('historical-data', 'tempHumid');
    if (data.temps.length >= 120 && data.humids.length >= 120) {
        firebase.update('historical-data', 'tempHumid', {
            temps: firebase.arrayRemove(data.temps[0]),
            humids: firebase.arrayRemove(data.humids[0])
        });
    }

    firebase.update('historical-data', 'tempHumid', {
        temps: firebase.arrayUnion({
            date: date.getFullTime(),
            value: parseFloat(temp)
        }),
        humids: firebase.arrayUnion({
            date: date.getFullTime(),
            value: parseFloat(humid)
        })
    });
}

Date.prototype.getFullDate = function (separator) {
    separator = !$.isArray(separator) ?
        new Array(3) : separator;

    for (let i = 0; i < 3; i++) {
        separator[i] = separator[i] || '/';
    }

    return this.getFullYear() + separator[0] +
        (this.getMonth() + 1) + separator[1] +
        (this.getDate());
};

Date.prototype.getFullTime = function () {
    let o = {
        h: this.getHours().toString(),
        m: this.getMinutes().toString(),
        s: this.getSeconds().toString(),
    };
    let format = (ele) => (ele.length === 1 ? '0' : '') + ele;

    return format(o.h) + ':' + format(o.m) + ':' + format(o.s);
};