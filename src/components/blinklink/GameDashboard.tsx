"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Eye, Rabbit, Turtle, Trophy } from 'lucide-react';

type GameDashboardProps = {
  status: 'idle' | 'running' | 'finished' | 'paused';
  targetWord: string;
  typedWord: string;
  scanSpeed: number;
  accuracy: number | null;
  onStart: () => void;
  onNextWord: () => void;
  onBlink: () => void;
};

const StatCard: FC<{ icon: React.ReactNode; title: string; value: string | React.ReactNode; }> = ({ icon, title, value }) => (
  <div className="flex items-center gap-4 rounded-lg bg-background p-4">
    <div className="text-primary">{icon}</div>
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

export const GameDashboard: FC<GameDashboardProps> = ({
  status,
  targetWord,
  typedWord,
  scanSpeed,
  accuracy,
  onStart,
  onNextWord,
  onBlink,
}) => {
  const progress = targetWord ? (typedWord.length / targetWord.length) * 100 : 0;
  
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-center">Your Session</CardTitle>
        <CardDescription className="text-center">Time your blinks to type the word.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {status !== 'idle' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Target Word</p>
              <p className="font-mono text-4xl font-bold tracking-widest text-primary">{targetWord}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Word</p>
              <div className="flex h-14 items-center rounded-lg border bg-muted px-4">
                <p className="font-mono text-4xl font-bold tracking-widest text-foreground">
                  {typedWord}
                  <span className="animate-pulse">_</span>
                </p>
              </div>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <StatCard 
            icon={scanSpeed >= 1000 ? <Turtle className="h-6 w-6"/> : <Rabbit className="h-6 w-6"/>} 
            title="Scan Speed" 
            value={`${scanSpeed} ms`} 
          />
          <StatCard 
            icon={<Trophy className="h-6 w-6"/>} 
            title="Accuracy" 
            value={accuracy !== null ? `${accuracy.toFixed(0)}%` : 'N/A'}
          />
        </div>

        <div className="flex flex-col gap-3">
          {status === 'idle' && (
            <Button onClick={onStart} size="lg" className="w-full">
              Start Session
            </Button>
          )}

          {status === 'running' && (
            <Button onClick={onBlink} size="lg" className="w-full h-16 bg-primary hover:bg-primary/90">
              <Eye className="mr-2 h-6 w-6" />
              Blink (Spacebar)
            </Button>
          )}

          {status === 'finished' && (
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <h3 className="font-bold text-green-700 dark:text-green-400">Word Complete!</h3>
                <p className="text-sm text-green-600 dark:text-green-500">
                    Accuracy: {accuracy?.toFixed(0)}%. New speed adjusted.
                </p>
            </div>
          )}
          
          {status === 'finished' && (
            <Button onClick={onNextWord} size="lg" className="w-full">
              Next Word
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
