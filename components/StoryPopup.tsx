'use client'

import { useState } from 'react';

export default function StoryPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="About this page"
        style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 50 }}
        className="w-10 h-10 rounded-full bg-stone-700 text-white font-bold text-base
                   flex items-center justify-center shadow-lg
                   hover:bg-stone-600 transition-colors cursor-pointer"
      >
        ?
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 60, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-md w-full mx-6 p-8 rounded-2xl shadow-2xl"
            style={{ backgroundColor: '#F5F5DC' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-stone-800 mb-4">Istanbul</h2>
            <p className="text-base leading-relaxed text-stone-700 mb-3">
              This map is Istanbul — a city that has always stood at the edge of two worlds.
              For centuries, the Bosphorus has divided Europe and Asia, yet Istanbul
              holds both together, a living bridge between continents, cultures, and histories.
            </p>
            <p className="text-base leading-relaxed text-stone-700 mb-3">
              To me, Istanbul represents the moment I chose my own direction. Leaving a city
              that felt too small, crossing to the other side, and learning that independence
              is not a destination — it is the act of crossing.
            </p>
            <p className="text-base leading-relaxed text-stone-600 italic">
              The dots you see are the city's heartbeat. The gap in the center is the strait —
              and the place where I found my footing.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-6 text-sm text-stone-500 hover:text-stone-700 underline
                         cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
