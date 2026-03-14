export default function RoadmapWaveVisual() {
  return (
    <div className="roadmap-wave-viz" aria-hidden="true">
      <div className="roadmap-wave-viz-aurora roadmap-wave-viz-aurora--ember" />
      <div className="roadmap-wave-viz-aurora roadmap-wave-viz-aurora--lagoon" />
      <div className="roadmap-wave-viz-aurora roadmap-wave-viz-aurora--cobalt" />

      <svg
        className="roadmap-wave-svg"
        viewBox="0 0 640 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="roadmapWaveGlow01" x1="0" y1="320" x2="640" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffb07d" />
            <stop offset="0.52" stopColor="#ff7a38" />
            <stop offset="1" stopColor="#ffd8bf" />
          </linearGradient>
          <linearGradient id="roadmapWaveGlow02" x1="32" y1="262" x2="640" y2="126" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#77f1e4" />
            <stop offset="0.5" stopColor="#0f766e" />
            <stop offset="1" stopColor="#b9fff6" />
          </linearGradient>
          <linearGradient id="roadmapWaveGlow03" x1="40" y1="180" x2="640" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d2e7ff" />
            <stop offset="0.45" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#d7efff" />
          </linearGradient>
          <filter id="roadmapWaveBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        <path
          className="roadmap-wave-halo roadmap-wave-halo--one"
          d="M -18 314 C 82 338 144 262 234 254 C 324 246 382 294 466 250 C 554 202 614 182 698 194"
        />
        <path
          className="roadmap-wave-halo roadmap-wave-halo--two"
          d="M -18 236 C 76 202 142 194 228 208 C 314 222 382 190 466 166 C 554 142 618 122 702 132"
        />
        <path
          className="roadmap-wave-halo roadmap-wave-halo--three"
          d="M -18 170 C 70 112 152 128 236 112 C 320 96 394 122 472 94 C 552 66 612 62 702 80"
        />

        <path
          className="roadmap-wave-line roadmap-wave-line--one"
          d="M -18 314 C 82 338 144 262 234 254 C 324 246 382 294 466 250 C 554 202 614 182 698 194"
          pathLength="100"
        />
        <path
          className="roadmap-wave-line roadmap-wave-line--two"
          d="M -18 236 C 76 202 142 194 228 208 C 314 222 382 190 466 166 C 554 142 618 122 702 132"
          pathLength="100"
        />
        <path
          className="roadmap-wave-line roadmap-wave-line--three"
          d="M -18 170 C 70 112 152 128 236 112 C 320 96 394 122 472 94 C 552 66 612 62 702 80"
          pathLength="100"
        />

        <circle className="roadmap-wave-node roadmap-wave-node--one" cx="168" cy="272" r="7" />
        <circle className="roadmap-wave-node-ring roadmap-wave-node-ring--one" cx="168" cy="272" r="14" />
        <circle className="roadmap-wave-node roadmap-wave-node--two" cx="328" cy="202" r="7" />
        <circle className="roadmap-wave-node-ring roadmap-wave-node-ring--two" cx="328" cy="202" r="14" />
        <circle className="roadmap-wave-node roadmap-wave-node--three" cx="514" cy="94" r="7" />
        <circle className="roadmap-wave-node-ring roadmap-wave-node-ring--three" cx="514" cy="94" r="14" />

        <g filter="url(#roadmapWaveBlur)">
          <ellipse className="roadmap-wave-blur roadmap-wave-blur--one" cx="122" cy="320" rx="92" ry="28" />
          <ellipse className="roadmap-wave-blur roadmap-wave-blur--two" cx="364" cy="182" rx="96" ry="28" />
          <ellipse className="roadmap-wave-blur roadmap-wave-blur--three" cx="538" cy="80" rx="88" ry="24" />
        </g>
      </svg>

      <div className="roadmap-wave-label roadmap-wave-label--one">
        <span className="roadmap-wave-label-index">01</span>
        <div>
          <strong>Remote-first</strong>
          <small>proof + assets</small>
        </div>
      </div>

      <div className="roadmap-wave-label roadmap-wave-label--two">
        <span className="roadmap-wave-label-index">02</span>
        <div>
          <strong>Resume</strong>
          <small>checkpoints + seeds</small>
        </div>
      </div>

      <div className="roadmap-wave-label roadmap-wave-label--three">
        <span className="roadmap-wave-label-index">03</span>
        <div>
          <strong>Expand</strong>
          <small>polish + KG + content</small>
        </div>
      </div>
    </div>
  );
}
