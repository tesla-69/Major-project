// SerialProxy.js (improved)
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');

const portName = 'COM18';
const baudRate = 115200;

// proxy debounce (ms) - Arduino now does hysteresis; keep a short debounce
const BLINK_PROXY_DEBOUNCE_MS = 350;

const port = new SerialPort({ path: portName, baudRate: baudRate }, (err) => {
  if (err) console.error('Serial port open error:', err.message);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
const wss = new WebSocket.Server({ port: 8080 });

let seq = 0;
let lastBlinkMs = 0;

// Toggle raw sample forwarding (set env SEND_RAW=1 to enable)
const SEND_RAW = process.env.SEND_RAW === '1';

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (e) {
        // ignore per-client send errors
      }
    }
  });
}

parser.on('data', line => {
  if (!line) return;
  const clean = line.replace(/\r/g, '').trim();
  if (!clean) return;

  // Allowed formats:
  // "signal,1,arduino_ts"
  // "signal,1"
  const parts = clean.split(',');
  if (parts.length < 2) {
    if (Math.random() < 0.01) console.warn('Malformed serial line:', JSON.stringify(clean));
    return;
  }

  const signal = parseFloat(parts[0]);
  const peak = parseInt(parts[1]);
  let arduinoTs = null;
  if (parts.length >= 3) {
    const p = parseInt(parts[2]);
    if (!Number.isNaN(p)) arduinoTs = p;
  }

  if (Number.isNaN(signal) || Number.isNaN(peak)) return;

  if (peak === 1) {
    const now = Date.now();
    if (now - lastBlinkMs > BLINK_PROXY_DEBOUNCE_MS) {
      lastBlinkMs = now;
      seq++;
      const payload = {
        type: 'blink',
        seq,
        t_proxy: now,
        t_arduino: arduinoTs,
        value: signal,
      };
      broadcast(payload);
      console.log(`blink -> seq=${seq} proxysts=${new Date(now).toISOString()} arduinoTs=${arduinoTs} val=${signal}`);
    } else {
      // ignored duplicate
    }
  } else if (SEND_RAW) {
    // debug-only raw forwarding
    broadcast({ type: 'sample', t_proxy: Date.now(), value: signal, peak });
  }
});

wss.on('connection', ws => {
  console.log('Web client connected. totalClients=', wss.clients.size);
  ws.send(JSON.stringify({ type: 'hello', time: Date.now() }));
  ws.on('close', () => {
    console.log('Client disconnected. totalClients=', wss.clients.size);
  });
});

port.on('open', () => console.log(`Serial ${portName} opened at ${baudRate}`));
port.on('error', err => console.error('Serial error:', err));
