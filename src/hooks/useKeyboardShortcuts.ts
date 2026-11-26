import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  /** Require Cmd (macOS) or Ctrl (Windows/Linux) */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Whether the shortcut should fire when an input, textarea, or contentEditable is focused */
  allowInInput?: boolean;
  /** Whether this shortcut is currently active */
  enabled?: boolean;
  handler: (event: KeyboardEvent) => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export function formatModKey(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      const pressedKey = event.key.toLowerCase();
      const modPressed = event.metaKey || event.ctrlKey;
      const inEditable = isEditableElement(event.target);

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        const targetKey = shortcut.key.toLowerCase();
        if (pressedKey !== targetKey) continue;

        const needsMod = Boolean(shortcut.mod);
        if (needsMod !== modPressed) continue;

        if (shortcut.shift !== undefined && Boolean(shortcut.shift) !== event.shiftKey) {
          continue;
        }
        if (shortcut.alt !== undefined && Boolean(shortcut.alt) !== event.altKey) {
          continue;
        }
        if (!shortcut.allowInInput && inEditable) {
          continue;
        }

        event.preventDefault();
        event.stopPropagation();
        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
}
