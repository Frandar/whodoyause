import { ImageResponse } from 'next/og';

// Generated at build time (static export), so the share card ships as a real
// PNG with no runtime dependency. Brand fields only — no photography to source.
// Required under `output: 'export'` — without it the route is treated as
// dynamic and the build fails collecting page data.
export const dynamic = 'force-static';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'WhoDoYaUse — local pros your neighbors actually recommend';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#15493f',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 999, background: '#ffc23d' }} />
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#ffffff' }}>WhoDoYaUse</div>
        </div>
        <div
          style={{
            fontSize: 74,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: 940,
          }}
        >
          Good help, recommended by the people next door.
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: '#9fb6ab' }}>
          Recommended by your neighbors, not algorithms.
        </div>
      </div>
    ),
    size,
  );
}
