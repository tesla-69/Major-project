import { useEffect } from "react";

interface Props {
  onBlink: () => void; // Called when a blink is detected
}

export default function ArduinoBlinkWebSocket({ onBlink }: Props) {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.blink) onBlink();
    };
    return () => ws.close();
  }, [onBlink]);

  return <div>Listening for blinks from Arduino...</div>;
}