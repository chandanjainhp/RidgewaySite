'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NavMobile() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Toggle navigation"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-text-primary hover:bg-surface-2 dark:hover:bg-surface-3"
      >
        <span className="text-lg leading-none">{open ? 'X' : '☰'}</span>
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          className="absolute left-4 right-4 top-16 rounded-xl border border-border bg-surface-2 p-4 shadow-deep dark:bg-surface-3"
        >
          <div className="flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Login
              </Button>
            </Link>
            <Link href="/register" onClick={() => setOpen(false)}>
              <Button variant="primary" className="w-full">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
