"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Badge } from "@/components/ui";
import { dollars } from "@/lib/format";
import type { OutcomePreview } from "@/lib/types";

/**
 * Cumulative cash for one allocation, as a step chart.
 *
 * Every number is read off the props: the line starts at minus the funded
 * amount on day one, stays there while the case runs, steps once when the case
 * resolves, and runs flat afterwards. Nothing is smoothed and nothing is
 * interpolated, because a case does not pay out a little each month.
 *
 * Gain is drawn filled and loss is drawn hollow and dashed. There is no colour
 * in the chart at all, so nobody reads an outcome off a hue.
 *
 * The viewBox is the measured pixel box of the plot, so one user unit is one
 * CSS pixel and every label is the size it says it is at any width. That is the
 * only reason a resize observer is here.
 */

const TICK_STEP = 12;
const AXIS_MONTHS = 60;
const SSR_WIDTH = 900;
const SSR_HEIGHT = 300;
/** Clearance between a marker and its label. */
const LABEL_GAP = 12;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

interface Geometry {
  width: number;
  height: number;
  compact: boolean;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  zeroY: number;
  plotWidth: number;
}

function geometry(width: number, height: number): Geometry {
  const w = Math.max(240, Math.round(width));
  const h = Math.max(170, Math.round(height));
  // Below this the end labels have nowhere to live, so they are dropped and the
  // legend under the chart carries the same figures instead.
  const compact = w < 500;
  const padLeft = compact ? 54 : 74;
  // An end label that runs out of room turns and reads back along its own line
  // instead, so the plot keeps the width rather than reserving a label gutter.
  const padRight = compact ? 18 : 48;
  const padTop = 20;
  const padBottom = 40;
  const x0 = padLeft;
  const x1 = Math.max(padLeft + 40, w - padRight);
  const y0 = padTop;
  const y1 = Math.max(padTop + 40, h - padBottom);
  return {
    width: w,
    height: h,
    compact,
    x0,
    x1,
    y0,
    y1,
    zeroY: (y0 + y1) / 2,
    plotWidth: x1 - x0,
  };
}

function signed(cents: number): string {
  if (cents === 0) return "$0";
  return `${cents > 0 ? "+" : "-"}${dollars(Math.abs(cents))}`;
}

function compactDollars(cents: number): string {
  const amount = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : cents > 0 ? "+" : "";
  if (amount >= 1000) return `${sign}$${Math.round(amount / 1000)}k`;
  return `${sign}${dollars(amount * 100)}`;
}

/** Whites, not hues: the eye separates the lines by weight of light alone. */
const LINE_OPACITY = [0.92, 0.74, 0.58, 0.46];

function opacityFor(index: number): number {
  return LINE_OPACITY[index % LINE_OPACITY.length];
}

export interface CashflowChartProps {
  outcomes: OutcomePreview;
  /** 0..1 along the month axis. Governs which endings have been reached. */
  progress?: number;
  className?: string;
}

export function CashflowChart({
  outcomes,
  progress = 1,
  className,
}: CashflowChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: SSR_WIDTH, height: SSR_HEIGHT });
  const rawId = useId();
  const clipId = `tl-clip-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      // Rounded to 8px so a slow drag is a handful of renders, not hundreds.
      const width = Math.round(rect.width / 8) * 8;
      const height = Math.round(rect.height / 8) * 8;
      setBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const funded = outcomes.fundedCents;
  const scenarios = outcomes.scenarios;

  const model = useMemo(() => {
    const maxMonth = Math.max(
      AXIS_MONTHS,
      ...scenarios.map((scenario) => scenario.monthsToCash),
    );
    // The axis is symmetric around zero, so the loss side and the gain side are
    // drawn at the same scale and a reader cannot be flattered by the geometry.
    const extent = Math.max(
      funded,
      ...scenarios.map((scenario) => Math.abs(scenario.receiptsCents - funded)),
    );
    const ticks: number[] = [];
    for (let month = 0; month <= maxMonth; month += TICK_STEP)
      ticks.push(month);
    return { maxMonth, extent, ticks };
  }, [funded, scenarios]);

  const g = geometry(box.width, box.height);
  const scaleX = (month: number) =>
    g.x0 + (month / model.maxMonth) * g.plotWidth;
  const scaleY = (cents: number) =>
    g.zeroY - (cents / model.extent) * ((g.y1 - g.y0) / 2);

  const reachedMonth = progress * model.maxMonth;

  const lines = scenarios.map((scenario, index) => {
    const value = scenario.receiptsCents - funded;
    const stepX = scaleX(scenario.monthsToCash);
    const startY = scaleY(-funded);
    const endY = scaleY(value);
    const endLabel = `month ${scenario.monthsToCash}`;
    // A mono label is near enough monospaced to size by character count, which
    // is all this needs: it only decides which side of the marker to sit on.
    const labelWidth =
      6.7 * (endLabel.length + signed(value).length) + LABEL_GAP * 2;
    const flip = stepX + LABEL_GAP + labelWidth > g.x1;
    return {
      key: scenario.label,
      label: scenario.label,
      months: scenario.monthsToCash,
      value,
      negative: value < 0,
      opacity: opacityFor(index),
      points: `${scaleX(0)},${startY} ${stepX},${startY} ${stepX},${endY} ${scaleX(model.maxMonth)},${endY}`,
      markerX: stepX,
      markerY: endY,
      labelX: flip ? stepX - LABEL_GAP : stepX + LABEL_GAP,
      labelAnchor: (flip ? "end" : "start") as "end" | "start",
      reached: reachedMonth >= scenario.monthsToCash - 0.25,
    };
  });

  const title = `Cumulative cash, one ${dollars(funded)} allocation`;
  const description = `${title}. Each line starts at ${signed(-funded)} at month 0 and steps once when that ending lands. ${lines
    .map(
      (line) => `${line.label}: ${signed(line.value)} at month ${line.months}.`,
    )
    .join(" ")}`;

  const svgVars: Vars = { "--tl-x0": g.x0, "--tl-plotw": g.plotWidth };

  return (
    <figure className={className ? `tl-chart ${className}` : "tl-chart"}>
      <figcaption className="tl-chart-head">
        <span className="tl-chart-title">{title}</span>
        <Badge>Illustrative</Badge>
      </figcaption>

      <div className="tl-chart-plot" ref={plotRef}>
        <svg
          className="tl-chart-svg"
          viewBox={`0 0 ${g.width} ${g.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={description}
          style={svgVars}
        >
          <title>{title}</title>

          <defs>
            <clipPath id={clipId}>
              {/* The width is taken over by CSS from --tl-p while the section is
                  pinned, so the fork unfolds under the reader's own scrolling.
                  The attribute is the full plot, which is what a reader without
                  that stylesheet or without scroll driving correctly gets. */}
              <rect
                className="tl-clip-rect"
                x={0}
                y={0}
                width={g.x1}
                height={g.height}
              />
            </clipPath>
          </defs>

          <g className="tl-chart-rules">
            <line x1={g.x0} y1={g.y0} x2={g.x1} y2={g.y0} />
            <line x1={g.x0} y1={g.y1} x2={g.x1} y2={g.y1} />
          </g>
          <line
            className="tl-chart-zero"
            x1={g.x0}
            y1={g.zeroY}
            x2={g.x1}
            y2={g.zeroY}
          />

          <g className="tl-chart-y">
            <text x={g.x0 - 10} y={g.y0 + 4} textAnchor="end">
              {compactDollars(model.extent)}
            </text>
            <text x={g.x0 - 10} y={g.zeroY + 4} textAnchor="end">
              $0
            </text>
            <text x={g.x0 - 10} y={g.y1 + 4} textAnchor="end">
              {compactDollars(-model.extent)}
            </text>
          </g>

          <g className="tl-chart-x">
            {model.ticks.map((month) => (
              <g key={month}>
                <line
                  x1={scaleX(month)}
                  y1={g.y1}
                  x2={scaleX(month)}
                  y2={g.y1 + 6}
                />
                <text
                  x={scaleX(month)}
                  y={g.y1 + 22}
                  textAnchor={
                    month === 0
                      ? "start"
                      : month === model.maxMonth
                        ? "end"
                        : "middle"
                  }
                >
                  {month}
                </text>
              </g>
            ))}
            <text
              className="tl-chart-axis-name"
              x={(g.x0 + g.x1) / 2}
              y={g.height - 6}
              textAnchor="middle"
            >
              Months from funding
            </text>
          </g>

          <g clipPath={`url(#${clipId})`}>
            {lines.map((line) => (
              <polyline
                key={line.key}
                className={
                  line.negative
                    ? "tl-line tl-line-loss"
                    : "tl-line ix-draw-line"
                }
                points={line.points}
                pathLength={1}
                strokeOpacity={line.opacity}
                strokeDasharray={line.negative ? "5 6" : undefined}
              />
            ))}
          </g>

          <g className="tl-chart-marks">
            {lines.map((line) => {
              const below = line.markerY < g.y0 + 26;
              return (
                <g
                  key={line.key}
                  className="tl-mark"
                  data-reached={line.reached ? "" : undefined}
                >
                  <rect
                    className={
                      line.negative
                        ? "tl-mark-dot tl-mark-hollow"
                        : "tl-mark-dot"
                    }
                    x={line.markerX - 3.5}
                    y={line.markerY - 3.5}
                    width={7}
                    height={7}
                  />
                  {g.compact ? null : (
                    <text
                      className="tl-mark-label"
                      x={line.labelX}
                      y={below ? line.markerY + 17 : line.markerY - 11}
                      textAnchor={line.labelAnchor}
                    >
                      month {line.months}
                      <tspan className="tl-mark-amount" dx="10">
                        {signed(line.value)}
                      </tspan>
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <ol className="tl-legend">
        {lines.map((line) => (
          <li key={line.key}>
            <span
              className="tl-legend-rule"
              data-hollow={line.negative ? "" : undefined}
              style={{ "--o": line.opacity } as Vars}
              aria-hidden="true"
            />
            <span className="tl-legend-name">{line.label}</span>
            <span className="tl-legend-value mono">
              month {line.months}{" "}
              <span className="tl-legend-amount">{signed(line.value)}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
