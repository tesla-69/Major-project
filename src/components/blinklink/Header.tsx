import { Eye } from 'lucide-react';

export default function Header() {
  return (
    <header className="w-full">
      <div className="container mx-auto flex flex-col items-center justify-center gap-2 py-8 text-center">
        <div className="flex items-center gap-3">
          <Eye className="h-10 w-10 text-primary" />
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary md:text-5xl">
            BlinkLink
          </h1>
        </div>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Empowering interaction through sight and sense.
        </p>
      </div>
    </header>
  );
}
