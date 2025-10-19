# Video Improvements Summary

## Highlights
- Native HLS playback now preferred on iOS while preserving HLS.js fallback elsewhere.
- Feed videos gain inline attributes for mobile Safari and retain lazy-loading safeguards.
- Recorder modal rebuilt with timer, clearer status messaging, and touch-friendly controls.
- Creator modal now surfaces upload/record entry points with labels plus live attachment status.

## Testing
- Verified HLS playback on iOS Safari and desktop Chrome with fallback scenarios.
- Exercised recording flow on mobile Safari simulator and Chrome, confirming timer and retake behaviors.
- Confirmed creator modal buttons operate with and without selected events, including queue counter updates.
