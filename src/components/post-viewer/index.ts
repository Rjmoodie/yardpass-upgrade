// src/components/post-viewer/index.ts
// Clean exports for the post viewer module

// Types
export type { ViewerPost, PostRef, Post, Comment } from "./types";

// Shell component (for custom containers)
export { FullscreenPostViewerShell } from "./FullscreenPostViewerShell";
export type { FullscreenPostViewerShellProps } from "./FullscreenPostViewerShell";

// Ready-to-use containers
export { EventFullscreenPostContainer } from "./EventFullscreenPostContainer";
export type { EventFullscreenPostContainerProps } from "./EventFullscreenPostContainer";

export { ProfileFullscreenPostContainer } from "./ProfileFullscreenPostContainer";
export type { ProfileFullscreenPostContainerProps } from "./ProfileFullscreenPostContainer";

// Hooks
export { useEventPostsBatch } from "./useEventPostsBatch";
export { usePostSequenceNavigation } from "./usePostSequenceNavigation";

// Legacy - keep for backwards compatibility during migration
export { FullscreenPostViewer } from "./FullscreenPostViewer";


