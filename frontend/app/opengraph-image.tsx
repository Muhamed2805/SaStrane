import { ImageResponse } from 'next/og';

// The picture a shared link shows, for every page without a photo of its
// own. A job with photos shows its cover photo instead.
export const alt = 'SaStrane – lokalni poslovi u tvojoj blizini';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#0f9f91',
        color: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 84,
            height: 84,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            background: '#ffffff',
          }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0f9f91"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700 }}>SaStrane</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.08 }}>
          Lokalni poslovi u tvojoj blizini
        </div>
        <div style={{ fontSize: 36, opacity: 0.9 }}>
          Objavi posao ili zaradi sa strane, po cijeloj Bosni i Hercegovini
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 28 }}>
        {['Selidbe', 'Montaža', 'Dostava', 'IT pomoć', 'Pranje auta'].map(
          (label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '10px 24px',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.18)',
              }}
            >
              {label}
            </div>
          ),
        )}
      </div>
    </div>,
    size,
  );
}
