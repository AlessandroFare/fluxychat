/**
 * Inline theme bootstrap: runs before paint to apply light/dark from
 * localStorage (theme is never system-derived). Shared by the root layout
 * and global-not-found, which bypasses the layout.
 */
export const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(t!=='dark')t='light';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('light');document.documentElement.style.colorScheme='light';}})();";
