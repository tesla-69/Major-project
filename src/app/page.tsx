"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAdjustedScanningSpeed } from '@/ai/flows/adaptive-scanning-speed';

import Header from '@/components/blinklink/Header';
import { CharacterGrid } from '@/components/blinklink/CharacterGrid';
import { GameDashboard } from '@/components/blinklink/GameDashboard';
import { CHAR_GRID, TARGET_WORDS, INITIAL_SCAN_SPEED_MS } from '@/lib/constants';

type GameStatus = 'idle' | 'running' | 'paused' | 'finished';
type ScanMode = 'col' | 'row';

export default function Home() {
  // game state
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const gameStatusRef = useRef<GameStatus>('idle');
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);

  // scan state (atomic: mode + index)
  const [scanMode, setScanMode] = useState<ScanMode>('col');
  const scanModeRef = useRef<ScanMode>('col');
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  const indexRef = useRef<number | null>(null); // current highlighted index
  const [, setTick] = useState(0); // force re-render when highlight changes

  // visual state for CharacterGrid
  const [highlightedCol, setHighlightedCol] = useState<number | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  // selection flash states
  const [flashCol, setFlashCol] = useState<number | null>(null);
  const [flashRow, setFlashRow] = useState<number | null>(null);

  // word state
  const [targetWord, setTargetWord] = useState('');
  const [typedWord, setTypedWord] = useState('');
  const wordIndexRef = useRef(0);

  // metrics
  const [scanSpeed, setScanSpeed] = useState<number>(INITIAL_SCAN_SPEED_MS);
  const charStartRef = useRef<number>(Date.now());
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const wakeTimeoutRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // debounce and latch
  const lastBlinkMsRef = useRef<number>(0);
  const FRONTEND_DEBOUNCE_MS = 300; // tuned small because Arduino+proxy already debounced

  // selection pending refs
  const selectedColRef = useRef<number | null>(null); // holds first blink col in a column-cycling
  const selectedRowRef = useRef<number | null>(null); // holds first blink row in a row-cycling
  const blinkPendingRef = useRef<boolean>(false);     // true if a blink recorded and waiting to be handled at last index

  const { toast } = useToast();

  // helpers to reflect index to highlight states & force render
  function updateHighlightForIndex() {
    const idx = indexRef.current;
    if (scanModeRef.current === 'col') {
      setHighlightedCol(idx);
      setHighlightedRow(null);
    } else {
      setHighlightedRow(idx);
      setHighlightedCol(null);
    }
    charStartRef.current = Date.now();
    setTick(t => t + 1);
  }

  // scanner tick (advance index; called via setTimeout to avoid interval drift)
  const scheduleNextTick = useCallback((delayMs?: number) => {
    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
    const d = typeof delayMs === 'number' ? delayMs : scanSpeed;
    wakeTimeoutRef.current = window.setTimeout(() => {
      const mode = scanModeRef.current;

      if (mode === 'col') {
        const cols = CHAR_GRID[0].length;
        // advance index circularly
        if (indexRef.current === null) indexRef.current = 0;
        else indexRef.current = (indexRef.current + 1) % cols;

        const arrivedIdx = indexRef.current;

        // If we arrived at last column AND a blink was recorded earlier in this column-cycling,
        // switch to row mode immediately WITHOUT highlighting or flashing the last column.
        if (arrivedIdx === cols - 1 && blinkPendingRef.current && selectedColRef.current !== null) {
          // Do NOT set highlightedCol to the last column (ensure column is not highlighted)
          setHighlightedCol(null);
          // consume pending blink and switch to row mode
          blinkPendingRef.current = false;
          setScanMode('row');
          scanModeRef.current = 'row';
          // start row scanning at row 0 (highlight first row)
          indexRef.current = 0;
          setHighlightedRow(0);
          setHighlightedCol(null);
          charStartRef.current = Date.now();
          setTick(t => t + 1);
          // continue schedule
          scheduleNextTick();
          return; // exit this tick handler (we already scheduled next)
        }

        // Normal case: update highlight to the new column
        updateHighlightForIndex();

      } else {
        // row mode
        const rows = CHAR_GRID.length;
        if (indexRef.current === null) indexRef.current = 0;
        else indexRef.current = (indexRef.current + 1) % rows;

        const arrivedIdx = indexRef.current;

        // If we arrived at last row AND a blink was recorded earlier in this row-cycling,
        // switch to column mode immediately WITHOUT highlighting or flashing the last row.
        if (arrivedIdx === rows - 1 && blinkPendingRef.current && selectedRowRef.current !== null) {
          // Do NOT set highlightedRow to the last row (ensure row is not highlighted)
          setHighlightedRow(null);

          // flash selected row (visual feedback that the char will be typed)
          const latchedRow = selectedRowRef.current;
          setFlashRow(latchedRow);
          setTimeout(() => setFlashRow(null), 500);

          // type the latched character
          const latchedCol = selectedColRef.current;
          if (latchedCol !== null) {
            const ch = CHAR_GRID[latchedRow][latchedCol];
            setTypedWord(prev => prev + ch);
            console.debug('Typed char', ch, 'row', latchedRow, 'col', latchedCol);
          } else {
            console.warn('Attempted to type but no latched column present.');
          }

          // consume pending selection and reset latched state
          blinkPendingRef.current = false;
          selectedRowRef.current = null;
          selectedColRef.current = null;

          // switch back to column scanning for next letter, start at index 0
          setScanMode('col');
          scanModeRef.current = 'col';
          indexRef.current = 0;
          // highlight first column (do not highlight the last row)
          setHighlightedCol(0);
          setHighlightedRow(null);
          charStartRef.current = Date.now();
          setTick(t => t + 1);

          // schedule next tick and exit
          scheduleNextTick();
          return;
        }

        // Normal case: update highlight to the new row
        updateHighlightForIndex();
      }

      // schedule next tick (circular continuous behavior)
      scheduleNextTick();
    }, d);
  }, [scanSpeed]);

  // start scanning: initialize mode/index and schedule (no immediate tick)
  const startScanning = useCallback(() => {
    indexRef.current = 0;
    setScanMode('col');
    scanModeRef.current = 'col';
    selectedColRef.current = null;
    selectedRowRef.current = null;
    blinkPendingRef.current = false;
    updateHighlightForIndex();
    scheduleNextTick(); // default delay = scanSpeed
  }, [scheduleNextTick]);

  // stop scanning
  const stopScanning = useCallback(() => {
    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
    indexRef.current = null;
    setHighlightedCol(null);
    setHighlightedRow(null);
    selectedColRef.current = null;
    selectedRowRef.current = null;
    blinkPendingRef.current = false;
  }, []);

  // start new word
  const startNewWord = useCallback(() => {
    const newWord = TARGET_WORDS[wordIndexRef.current % TARGET_WORDS.length];
    wordIndexRef.current += 1;
    setTargetWord(newWord);
    setTypedWord('');
    setAccuracy(null);
    setResponseTimes([]);
    setGameStatus('running');
    charStartRef.current = Date.now();
    startScanning();
  }, [startScanning]);

  // finish word
  const finishWord = useCallback(async () => {
    stopScanning();
    setGameStatus('finished');
    const tgt = targetWord;
    let correct = 0;
    for (let i = 0; i < tgt.length; i++) {
      if (typedWord[i] && typedWord[i] === tgt[i]) correct++;
    }
    const finalAcc = tgt.length ? (correct / tgt.length) : 0;
    setAccuracy(finalAcc * 100);

    const avgResponse = responseTimes.length ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

    try {
      const result = await getAdjustedScanningSpeed({
        previousAccuracy: finalAcc,
        previousResponseTime: avgResponse,
      });
      setScanSpeed(result.adjustedScanningSpeed);
      toast({ title: 'Speed Adjusted!', description: `New scanning speed ${result.adjustedScanningSpeed}ms` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI Error', description: 'Speed adjustment failed' });
    }
  }, [targetWord, typedWord, responseTimes, toast, stopScanning]);

  useEffect(() => {
    if (gameStatus === 'running' && targetWord && typedWord.length === targetWord.length) {
      finishWord();
    }
  }, [typedWord, targetWord, finishWord, gameStatus]);

  // blink handler (records only first blink per cycle; does not stop animation)
  const handleBlink = useCallback((meta?: { seq?: number; t_proxy?: number; t_arduino?: number }) => {
    const now = Date.now();
    if (gameStatusRef.current !== 'running') return;
    if (now - lastBlinkMsRef.current < FRONTEND_DEBOUNCE_MS) return;
    lastBlinkMsRef.current = now;

    // If already have a pending blink recorded for this cycle, ignore subsequent blinks until handled
    if (blinkPendingRef.current) {
      console.debug('Blink ignored: pending selection already recorded for this cycle.');
      return;
    }

    const mode = scanModeRef.current;
    const idx = indexRef.current;
    if (idx === null) {
      console.warn('Blink while no highlight');
      return;
    }

    // record responseTime relative to highlight start for metrics
    const respTime = now - charStartRef.current;
    setResponseTimes(prev => [...prev, respTime]);

    // record first blink for the current cycle, but DO NOT switch modes now
    if (mode === 'col') {
      selectedColRef.current = idx;
      blinkPendingRef.current = true;
      console.debug('Recorded column blink', idx, 'responseTime(ms)=', respTime, meta);
    } else {
      selectedRowRef.current = idx;
      blinkPendingRef.current = true;
      console.debug('Recorded row blink', idx, 'responseTime(ms)=', respTime, meta);
    }
  }, []);

  // keyboard fallback (space)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleBlink({ t_proxy: Date.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBlink]);

  // connect websocket to proxy
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;
    ws.onopen = () => console.log('Connected to blink proxy');
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data && data.type === 'blink') {
          handleBlink({ seq: data.seq, t_proxy: data.t_proxy, t_arduino: data.t_arduino });
        }
      } catch (e) {
        // ignore
      }
    };
    ws.onerror = (err) => console.error('WS err', err);
    ws.onclose = () => { console.log('WS closed'); wsRef.current = null; };
    return () => { try { ws.close(); } catch (e) {} };
  }, [handleBlink]);

  // UI start/next handlers
  const handleStart = () => {
    wordIndexRef.current = 0;
    startNewWord();
  };
  const handleNextWord = () => startNewWord();

  // ensure scanning stops on unmount
  useEffect(() => {
    return () => { stopScanning(); };
  }, [stopScanning]);

  // render
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-4 md:p-8">
      <Header />
      <div className="container mx-auto flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-start">
        <GameDashboard
          status={gameStatus}
          targetWord={targetWord}
          typedWord={typedWord}
          scanSpeed={scanSpeed}
          accuracy={accuracy}
          onStart={handleStart}
          onNextWord={handleNextWord}
          onBlink={() => handleBlink({ t_proxy: Date.now() })}
        />
        <CharacterGrid
          highlightedCol={flashCol !== null ? flashCol : highlightedCol}
          highlightedRow={flashRow !== null ? flashRow : highlightedRow}
        />
      </div>
    </main>
  );
}
