"use client";

import { useEffect } from "react";

/**
 * Arms the motion system by putting `motion-ready` on `<html>`.
 *
 * Everything that hides itself before a reveal is written under that class, so
 * the page is complete and readable without it: no JavaScript, a failed
 * hydration, or `prefers-reduced-motion: reduce` all leave every element
 * visible and static.
 *
 * The class is set twice on purpose. The inline script runs while the document
 * is still parsing, which is the only moment early enough to avoid a flash of
 * content appearing and then hiding itself; the effect then keeps the class in
 * step if the reader changes their motion preference while the page is open.
 *
 * Render this once, as the first child of `<body>`, so the script is the first
 * thing the parser reaches.
 */
const BOOT = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("motion-ready")}}catch(e){}`;

export function MotionBoot() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () =>
      document.documentElement.classList.toggle("motion-ready", !query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <script
      // Static string, no interpolation: nothing from a request reaches it.
      dangerouslySetInnerHTML={{ __html: BOOT }}
    />
  );
}
