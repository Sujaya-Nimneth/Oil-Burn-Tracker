'use client';

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang='en'>
      <body className='flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-zinc-100'>
        <div className='max-w-md space-y-4 text-center'>
          <h1 className='text-2xl font-bold'>Something went wrong</h1>
          <p className='text-sm text-zinc-400'>
            An unexpected error interrupted rendering. You can try reloading
            this view or return to the live dashboard.
          </p>
          <div className='flex justify-center gap-3'>
            <button
              type='button'
              onClick={() => reset()}
              className='cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200'
            >
              Try again
            </button>
            <a
              href='/dashboard/overview'
              className='rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900'
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
