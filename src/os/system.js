// Shared handle to the running system. Populated by desktop.js at mount time
// so apps can reach the window manager, launcher, filesystem and content.
export const os = {
  content: null,
  wm: null,
  vfs: null,
  launch: null,
  openPath: null,
};
