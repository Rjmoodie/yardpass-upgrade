// components/SimpleResponsiveButtons.tsx
import React from 'react';

/**
 * Ultra-simple responsive button component
 * This is how easy it should be!
 */
export function SimpleResponsiveButtons() {
  return (
    <div className="simple-responsive-buttons">
      <button className="btn">Like</button>
      <button className="btn">Comment</button>
      <button className="btn">Share</button>
      <button className="btn btn-primary">Add</button>
      <button className="btn">Flag</button>
      <button className="btn">Mute</button>
    </div>
  );
}

// Add this to your CSS - that's it!
const css = `
.simple-responsive-buttons {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 1vw, 8px);
  position: fixed;
  right: 16px;
  bottom: 100px;
  z-index: 50;
}

.simple-responsive-buttons .btn {
  width: clamp(40px, 5vw, 60px);
  height: clamp(40px, 5vw, 60px);
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.4);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: transform 0.2s;
}

.simple-responsive-buttons .btn:active {
  transform: scale(0.95);
}

.simple-responsive-buttons .btn-primary {
  background: orange;
}

/* Small screens */
@media (max-width: 375px) {
  .simple-responsive-buttons .btn {
    width: clamp(32px, 4vw, 48px);
    height: clamp(32px, 4vw, 48px);
  }
}

/* Wide screens */
@media (min-width: 768px) {
  .simple-responsive-buttons .btn {
    width: clamp(48px, 6vw, 72px);
    height: clamp(48px, 6vw, 72px);
  }
}
`;

export default SimpleResponsiveButtons;
