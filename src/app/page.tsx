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
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [scanMode, setScanMode] = useState<ScanMode>('col');
  const [targetWord, setTargetWord] = useState<string>('');
  const [typedWord, setTypedWord] = useState<string>('');
  
  const [highlightedCol, setHighlightedCol] = useState<number | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);

  const [scanSpeed, setScanSpeed] = useState<number>(INITIAL_SCAN_SPEED_MS);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const charStartTimeRef = useRef<number>(0);
  const wordIndexRef = useRef<number>(0);
  const blinkRegisteredRef = useRef(false);
  const selectedColRef = useRef<number | null>(null);
  const selectedRowRef = useRef<number | null>(null);

  const { toast } = useToast();

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setHighlightedCol(null);
    setHighlightedRow(null);
  }, []);

  const finishWord = useCallback(async () => {
    stopScan();
    setGameStatus('finished');

    let correctChars = 0;
    for (let i = 0; i < targetWord.length; i++) {
      if (typedWord.length > i && targetWord[i] === typedWord[i]) {
        correctChars++;
      }
    }
    const finalAccuracy = (correctChars / targetWord.length);
    setAccuracy(finalAccuracy * 100);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    try {
      const result = await getAdjustedScanningSpeed({
        previousAccuracy: finalAccuracy,
        previousResponseTime: avgResponseTime,
      });
      setScanSpeed(result.adjustedScanningSpeed);
      toast({
        title: 'Speed Adjusted!',
        description: `New scanning speed is ${result.adjustedScanningSpeed}ms.`,
      });
    } catch (error) {
      console.error('AI speed adjustment failed:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Could not adjust scanning speed.',
      });
    }
  }, [targetWord, typedWord, responseTimes, toast, stopScan]);
  
  const startNewWord = useCallback(() => {
    const newWord = TARGET_WORDS[wordIndexRef.current % TARGET_WORDS.length];
    wordIndexRef.current += 1;
    
    setTargetWord(newWord);
    setTypedWord('');
    setAccuracy(null);
    setResponseTimes([]);
    setGameStatus('running');
    setScanMode('col');
    blinkRegisteredRef.current = false;
    selectedColRef.current = null;
    selectedRowRef.current = null;
    charStartTimeRef.current = Date.now();
  }, []);

  const handleStart = () => {
    wordIndexRef.current = 0;
    startNewWord();
  };

  const handleNextWord = () => {
    startNewWord();
  };

  useEffect(() => {
    if (gameStatus === 'running' && typedWord.length > 0 && typedWord.length === targetWord.length) {
      finishWord();
    }
  }, [typedWord, targetWord, finishWord, gameStatus]);

  const handleBlink = useCallback(() => {
    if (gameStatus !== 'running' || blinkRegisteredRef.current) return;
    
    const responseTime = Date.now() - charStartTimeRef.current;
    setResponseTimes(prev => [...prev, responseTime]);
    blinkRegisteredRef.current = true;

    if (scanMode === 'col' && highlightedCol !== null) {
      selectedColRef.current = highlightedCol;
    } else if (scanMode === 'row' && highlightedRow !== null) {
      selectedRowRef.current = highlightedRow;
    }
  }, [gameStatus, scanMode, highlightedCol, highlightedRow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleBlink();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleBlink]);
  
  useEffect(() => {
    if (gameStatus !== 'running') {
      stopScan();
      return;
    }
    
    scanIntervalRef.current = setInterval(() => {
      if (scanMode === 'col') {
        setHighlightedRow(null);
        setHighlightedCol(prev => {
          const nextCol = prev === null || prev >= CHAR_GRID[0].length - 1 ? 0 : prev + 1;
          if (blinkRegisteredRef.current && nextCol === 0) {
            setScanMode('row');
            blinkRegisteredRef.current = false;
          }
          return nextCol;
        });
      } else if (scanMode === 'row') {
        setHighlightedCol(null);
        setHighlightedRow(prev => {
          const nextRow = prev === null || prev >= CHAR_GRID.length - 1 ? 0 : prev + 1;
          if (blinkRegisteredRef.current && nextRow === 0) {
             if (selectedColRef.current !== null && selectedRowRef.current !== null) {
               const char = CHAR_GRID[selectedRowRef.current][selectedColRef.current];
               setTypedWord(prev => prev + char);
             }
             setScanMode('col');
             blinkRegisteredRef.current = false;
             selectedColRef.current = null;
             selectedRowRef.current = null;
             charStartTimeRef.current = Date.now();
          }
          return nextRow;
        });
      }
    }, scanSpeed);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [gameStatus, scanMode, scanSpeed, stopScan]);


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
          onBlink={handleBlink}
        />
        <CharacterGrid
          highlightedCol={highlightedCol}
          highlightedRow={highlightedRow}
        />
      </div>
    </main>
  );
}
