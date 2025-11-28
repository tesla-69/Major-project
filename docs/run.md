# Running the project (development environment)

This guide explains how to run the project locally, and how to make sure the serial hardware (Arduino / MCU) is connected and available on Windows.

## Quick Start (Windows)

1. Connect your hardware (Arduino/board) to your PC using USB.
2. Verify the COM port that the board uses (COM18 in this project example). See "Find the COM port" below.
3. Install dependencies:

```powershell
npm ci
```

4. Start the Next.js development server (the UI):

```powershell
npm run dev
```

5. In a second terminal, start the serial proxy (bridges hardware to WebSocket):

```powershell
node serial-proxy.js
```

6. Open the app in a browser at http://localhost:9002 (default dev port in this repo). The serial proxy listens for WebSocket connections on port 8080.

---

## What each step does

- `npm run dev` — starts the Next.js development server (port 9002 by default for this project).
- `node serial-proxy.js` — opens the hardware serial port (by default COM18) at 115200 baud and forwards blink events and optionally raw samples to connected WebSocket clients on port 8080.

The serial proxy responds to message types:

- `blink`: A detected blink (the app uses this to update the UI).
- `sample` (when `SEND_RAW` env var set to `1`) — raw samples for debugging.

---

## Find the COM port (Windows)

Use Device Manager or PowerShell to find the COM port number:

- Device Manager -> Ports (COM & LPT)
- PowerShell:

```powershell
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Caption
```

If you see `COM18`, you’re good. If your board is on another port — note the number and replace `COM18` (see "Change the PORT" below).

---

## Checking serial port availability

PowerShell — check if COM port is accessible:

```powershell
Test-Path -Path "\\.\COM18"
# returns True when port exists
```

Or use the `mode` command:

```powershell
mode COM18
```

---

## Changing the COM port name

By default, the code in `serial-proxy.js` uses `const portName = 'COM18';`.

If your board is on a different COM number, either:

- Edit `serial-proxy.js` and update `portName`.
- Or start the script with an environment variable (recommended). Add this small modification to the top of `serial-proxy.js` to read from `SERIAL_PORT`:

```javascript
const portName = process.env.SERIAL_PORT || "COM18";
```

Then start the proxy with an env var:

In PowerShell:

```powershell
$Env:SERIAL_PORT='COM5'
node serial-proxy.js
```

Windows `cmd` (legacy):

```cmd
set SERIAL_PORT=COM5 && node serial-proxy.js
```

---

## Enable raw sample debugging

If you want `serial-proxy.js` to forward raw sample data to the browser (helpful for debugging), enable `SEND_RAW`:

PowerShell:

```powershell
$Env:SEND_RAW='1'
node serial-proxy.js
```

`cmd.exe`:

```cmd
set SEND_RAW=1 && node serial-proxy.js
```

---

## Troubleshooting

- "Serial port open error: Access denied": Another program has the COM port open (Arduino IDE serial monitor, another script). Close other programs and try again.
- "Serial port open error: File not found": Ensure the board is connected and the correct COM number is configured in `serial-proxy.js`.
- `serialport` install/build problems on Windows: Some versions of `serialport` may require native build tools. Install Visual Studio Build Tools (C++ workload) or enable prebuilt binaries. Install `windows-build-tools` is sometimes used but is deprecated — it's recommended to install the Visual Studio build tools from Microsoft.
- If the dev server or proxy fails: check ports 9002 and 8080 are free. If needed, change ports in package.json dev script or in `serial-proxy.js`.

---

## Helpful commands (Windows PowerShell)

Install dependencies:

```powershell
npm ci
```

Start UI (dev server):

```powershell
npm run dev
```

Start serial proxy (set port and debug flags):

```powershell
$Env:SERIAL_PORT='COM18'; $Env:SEND_RAW='1'; node serial-proxy.js
```

Check serial port availability:

```powershell
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Caption
Test-Path -Path "\\.\COM18"
```

---

## Differences for Linux / macOS

On macOS and Linux, your serial port will be like `/dev/cu.usbmodem...` or `/dev/ttyUSB0`. Edit `serial-proxy.js` accordingly or set `SERIAL_PORT` before running.

Examples:

```bash
export SERIAL_PORT=/dev/ttyUSB0
node serial-proxy.js
```

and to enable raw debugging

```bash
export SEND_RAW=1; node serial-proxy.js
```

---

## Future tips

- Make `serial-proxy.js` read `SERIAL_PORT` and `BAUD_RATE` from environment to avoid editing code each time.
- Add `concurrently` or `npm-run-all` to `package.json` to start both server and proxy with a single script.

---

If you want, I can add the `SERIAL_PORT` & `BAUD_RATE` env var support to `serial-proxy.js` and add an npm script like `npm run dev:all` (which would start the next dev server and the serial proxy in parallel) — tell me if you'd like this and I'll add it.

---

Verified: File created and documented by the workspace owner; check `serial-proxy.js` for defaults and make changes if needed.

---

Happy hacking! ⚡️
