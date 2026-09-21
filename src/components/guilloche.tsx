import { bandPaths, borderPaths, rosettePaths } from "@/lib/guilloche";

export type GuillocheVariant = "rosette" | "band" | "border";

export interface GuillocheProps {
  /**
   * `rosette` is a square medallion (1000x1000) for sitting behind an object,
   * `band` is a wide divider strip (1200x90) that stretches to its box, and
   * `border` is a certificate frame (1200x600) that stretches to its box.
   */
  variant: GuillocheVariant;
  className?: string;
  /**
   * How many curve families are overlaid. Rosette 3..7 (default 6), band 4..12
   * (default 8), border 2..6 (default 4). Higher is denser and heavier.
   */
  density?: number;
  /**
   * Stroke width in CSS pixels. The stroke never scales with the box, so this
   * is the drawn width at every viewport.
   *
   * Prefer 1 with a lower `currentColor` alpha over a fraction at a higher one:
   * a sub-pixel stroke is resolved by the rasteriser differently at every
   * sub-pixel offset of the box, which is what makes a field of hairlines
   * shimmer while the page moves.
   */
  strokeWidth?: number;
  /**
   * `geometricPrecision` asks the rasteriser for the true geometry rather than
   * a pixel-snapped approximation, which is what keeps neighbouring curves from
   * swapping places as the box moves.
   */
  shapeRendering?:
    "auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision";
}

interface Drawing {
  viewBox: string;
  stretch: boolean;
  paths: { d: string; opacity: number }[];
}

function drawing(variant: GuillocheVariant, density?: number): Drawing {
  switch (variant) {
    case "band":
      return {
        viewBox: "0 0 1200 90",
        stretch: true,
        paths: bandPaths(density),
      };
    case "border":
      return {
        viewBox: "0 0 1200 600",
        stretch: true,
        paths: borderPaths(density),
      };
    default:
      return {
        viewBox: "0 0 1000 1000",
        stretch: false,
        paths: rosettePaths(density),
      };
  }
}

/**
 * Procedural banknote engraving. Decoration only: it is hidden from assistive
 * technology, takes no pointer events, and carries no information that is not
 * also written in text. Colour comes from `currentColor`, so set it with the
 * `.guilloche` class rather than on the element.
 */
export function Guilloche({
  variant,
  className,
  density,
  strokeWidth = 0.7,
  shapeRendering = "auto",
}: GuillocheProps) {
  const { viewBox, stretch, paths } = drawing(variant, density);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className ? `guilloche ${className}` : "guilloche"}
      viewBox={viewBox}
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering={shapeRendering}
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          strokeOpacity={path.opacity}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
