'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, Theme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chiudi cliccando fuori o premendo Esc
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const options: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Chiaro', icon: Sun },
    { value: 'dark', label: 'Scuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Laptop },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 sm:h-9 px-2 sm:px-2.5 gap-1.5 text-xs font-normal"
        title={`Tema: ${theme === 'system' ? `Sistema (${resolvedTheme === 'dark' ? 'Scuro' : 'Chiaro'})` : theme === 'dark' ? 'Scuro' : 'Chiaro'}`}
        aria-label="Seleziona tema"
        aria-expanded={isOpen}
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        )}
        <span className="hidden xl:inline text-muted-foreground capitalize">
          {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Scuro' : 'Chiaro'}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 select-none">
            Tema interfaccia
          </div>
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
