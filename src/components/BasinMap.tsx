import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, geoContains, geoArea } from "d3-geo";
import {
  MapPin,
  Plus,
  Minus,
  Maximize,
  Layers,
  MousePointer2,
  PenTool,
} from "lucide-react";
import type { Example, Site } from "../lib/types";
export type Area = {
  name: string;
  type: string;
  feature: any;
  point?: [number, number];
  region?: string;
};
export function prepareGeometry(collection: any) {
  const c = structuredClone(collection);
  for (const f of c.features || []) {
    if (geoArea(f) > 2 * Math.PI) {
      if (f.geometry.type === "Polygon")
        f.geometry.coordinates = f.geometry.coordinates.map((r: any) =>
          r.reverse(),
        );
      else if (f.geometry.type === "MultiPolygon")
        f.geometry.coordinates = f.geometry.coordinates.map((p: any) =>
          p.map((r: any) => r.reverse()),
        );
    }
  }
  return c;
}
export const featureName = (f: any) =>
  f.properties.Region ||
  f.properties.BP_REGION ||
  f.properties.LGA_NAME_2025 ||
  f.properties.DDIV_NAME;
const color = (v: number) =>
  v < 0.16
    ? "#d5c18d"
    : v < 0.22
      ? "#a4bca2"
      : v < 0.28
        ? "#659a8b"
        : "#2d716d";
const initialView = { zoom: 1, x: 0, y: 0 };
const services = "https://services.arcgisonline.com/ArcGIS/rest/services";
type Basemap = "basin" | "street" | "satellite";
type Coordinate = [number, number];
export function validRing(points: Coordinate[]) {
  if (points.length < 3 || new Set(points.map(String)).size !== points.length)
    return false;
  const cross = (a: Coordinate, b: Coordinate, c: Coordinate) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const side = (value: number) =>
    Math.abs(value) < 1e-12 ? 0 : Math.sign(value);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      const overlaps = [0, 1].every(
        (k) =>
          Math.max(Math.min(a[k], b[k]), Math.min(c[k], d[k])) <=
          Math.min(Math.max(a[k], b[k]), Math.max(c[k], d[k])),
      );
      if (
        overlaps &&
        side(cross(a, b, c)) * side(cross(a, b, d)) <= 0 &&
        side(cross(c, d, a)) * side(cross(c, d, b)) <= 0
      )
        return false;
    }
  }
  return Math.abs(area) > 1e-12;
}
export default function BasinMap({
  geo,
  sites,
  site,
  area,
  onArea,
  onSite,
  grid,
  mode,
  layer,
  depth,
  threeD,
  setThreeD,
}: {
  geo: any;
  sites: Site[];
  site?: Site;
  area: Area | null;
  onArea: (a: Area | null) => void;
  onSite: (id: string) => void;
  grid: Example;
  mode: string;
  layer: string;
  depth: "surface" | "root";
  threeD: boolean;
  setThreeD: (v: boolean) => void;
}) {
  const [tool, setTool] = useState("select"),
    [vertices, setVertices] = useState<[number, number][]>([]),
    [cursor, setCursor] = useState<Coordinate | null>(null),
    [drawError, setDrawError] = useState(""),
    [view, setView] = useState(initialView),
    [basemap, setBasemap] = useState<Basemap>("basin"),
    [tileError, setTileError] = useState(false),
    [dragging, setDragging] = useState(false),
    [footprint, setFootprint] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    point: DOMPoint;
    id: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const movingVertex = useRef<number | null>(null);
  const key = area?.name || "basin";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setView(initialView);
    setFootprint(false);
    setVertices([]);
  }
  const target = useMemo(() => {
    if (footprint && site) {
      const span = layer === "flood" ? 0.003 : 0.3;
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [site.lon - span, site.lat - span],
              [site.lon - span, site.lat + span],
              [site.lon + span, site.lat + span],
              [site.lon + span, site.lat - span],
              [site.lon - span, site.lat - span],
            ],
          ],
        },
      };
    }
    if (area?.feature) return area.feature;
    if (area?.point) {
      const [x, y] = area.point;
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x - 0.3, y - 0.3],
              [x - 0.3, y + 0.3],
              [x + 0.3, y + 0.3],
              [x + 0.3, y - 0.3],
              [x - 0.3, y - 0.3],
            ],
          ],
        },
      };
    }
    return geo.basin;
  }, [area, geo, site, footprint, layer]);
  const projection = useMemo(
    () =>
      geoMercator().fitExtent(
        [
          [120, 35],
          [850, 465],
        ],
        target as any,
      ),
    [target],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const geometry = useMemo(
    () => ({
      context: path(geo.context),
      basin: path(geo.basin),
      regions: geo.regions.features.map((f: any) => path(f)),
      catchments: geo.catchments.features.map((f: any) => path(f)),
      localities: (geo.localities?.features || []).map((feature: any) => ({
        feature,
        shape: path(feature),
        center: path.centroid(feature),
      })),
    }),
    [geo, path],
  );
  const inset = geoPath(
    geoMercator().fitExtent(
      [
        [760, 360],
        [895, 470],
      ],
      geo.context,
    ),
  );
  const xy = (lon: number, lat: number) => projection([lon, lat])!;
  const screenPoint = (e: { clientX: number; clientY: number }) => {
    const p = svg.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  };
  const pitched = threeD && layer === "moisture";
  const unpitch = (y: number) => (pitched ? (y - 85) / 0.72 : y);
  const zoomAt = (factor: number, x = 480, y = 250) => {
    setView((previous) => {
      const zoom = Math.min(128, Math.max(0.65, previous.zoom * factor));
      const ratio = zoom / previous.zoom;
      return {
        zoom,
        x: x - 480 - (x - 480 - previous.x) * ratio,
        y: y - 250 - (y - 250 - previous.y) * ratio,
      };
    });
  };
  useEffect(() => {
    const map = svg.current;
    const wheel = (e: WheelEvent) => {
      if (document.activeElement !== map) return;
      e.preventDefault();
      const q = screenPoint(e);
      zoomAt(
        Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.004),
        q.x,
        unpitch(q.y),
      );
    };
    map?.addEventListener("wheel", wheel, { passive: false });
    return () => map?.removeEventListener("wheel", wheel);
  }, [pitched]);
  const pointAt = (e: { clientX: number; clientY: number }) => {
    const q = screenPoint(e);
    return projection.invert!([
      (q.x - 480 - view.x) / view.zoom + 480,
      (unpitch(q.y) - 250 - view.y) / view.zoom + 250,
    ]) as [number, number];
  };
  const tiles = useMemo(() => {
    if (basemap === "basin") return [];
    const world = projection.scale() * 2 * Math.PI;
    const level = Math.max(
      1,
      Math.min(19, Math.round(Math.log2((world * view.zoom) / 256))),
    );
    const count = 2 ** level;
    const size = world / count;
    const center = projection([0, 0])!;
    const originX = center[0] - world / 2;
    const originY = center[1] - world / 2;
    const left = (0 - 480 - view.x) / view.zoom + 480;
    const right = (960 - 480 - view.x) / view.zoom + 480;
    const top = ((pitched ? -85 / 0.72 : 0) - 250 - view.y) / view.zoom + 250;
    const bottom =
      ((pitched ? (520 - 85) / 0.72 : 520) - 250 - view.y) / view.zoom + 250;
    const result = [];
    for (
      let row = Math.max(0, Math.floor((top - originY) / size));
      row <= Math.min(count - 1, Math.floor((bottom - originY) / size));
      row++
    ) {
      for (
        let col = Math.max(0, Math.floor((left - originX) / size));
        col <= Math.min(count - 1, Math.floor((right - originX) / size));
        col++
      ) {
        result.push({
          x: originX + col * size,
          y: originY + row * size,
          size,
          key: `${level}/${row}/${col}`,
        });
      }
    }
    return result;
  }, [basemap, projection, view, pitched]);
  const inside = (p: [number, number]) =>
    geo.basin.features.some((f: any) => geoContains(f, p));
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === "select") return;
    const p = pointAt(e);
    if (!inside(p)) return;
    if (tool === "draw") {
      setDrawError("");
      if (e.detail > 1) return;
      const first = vertices[0];
      if (first && vertices.length >= 3) {
        const a = projection(first)!;
        const b = projection(p)!;
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) * view.zoom < 15) {
          finish();
          return;
        }
      }
      setVertices([...vertices, p]);
    } else {
      onArea({
        name: `Pin ${p[1].toFixed(3)}, ${p[0].toFixed(3)}`,
        type: "point",
        feature: null,
        point: p,
        region: geo.regions.features.find((f: any) => geoContains(f, p))
          ?.properties.Region,
      });
      setTool("select");
    }
  };
  const finish = () => {
    if (!validRing(vertices)) {
      setDrawError(
        "Use at least three distinct points and keep the boundary from crossing itself.",
      );
      return;
    }
    onArea({
      name: "Drawn planning area",
      type: "drawn area",
      feature: prepareGeometry({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[...vertices, vertices[0]]],
            },
          },
        ],
      }).features[0],
      point: vertices[0],
    });
    setVertices([]);
    setCursor(null);
    setTool("select");
  };
  return (
    <div className="map-shell">
      <div className="map-top">
        <span className="map-caption">
          <span className="live-dot" />{" "}
          {site ? site.catchment : "Murray–Darling Basin"}{" "}
          <span className="muted">/ Australia</span>
        </span>
        <div className="segmented" aria-label="Map view">
          <label className="basemap-picker">
            Map style
            <select
              value={basemap}
              onChange={(e) => {
                setBasemap(e.target.value as Basemap);
                setTileError(false);
              }}
            >
              <option value="basin">Territory boundaries</option>
              <option value="street">Street map</option>
              <option value="satellite">Satellite</option>
            </select>
          </label>
          <button
            className={!threeD ? "active" : ""}
            onClick={() => setThreeD(false)}
          >
            2D
          </button>
          <button
            className={threeD ? "active" : ""}
            onClick={() => setThreeD(true)}
          >
            3D value height
          </button>
        </div>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 960 520"
        role="img"
        aria-label={`Interactive map, ${area?.name || "full Murray–Darling Basin"}. Use the arrow keys to pan, or select a town from the list.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape" && tool !== "select") {
            setTool("select");
            setVertices([]);
            setCursor(null);
            setDrawError("");
            return;
          }
          const shift: Record<string, [number, number]> = {
            ArrowLeft: [60, 0],
            ArrowRight: [-60, 0],
            ArrowUp: [0, 60],
            ArrowDown: [0, -60],
          };
          if (shift[e.key]) {
            e.preventDefault();
            const [x, y] = shift[e.key];
            setView((v) => ({ ...v, x: v.x + x, y: v.y + y }));
          } else if (e.key === "+" || e.key === "-") {
            e.preventDefault();
            zoomAt(e.key === "+" ? 1.4 : 1 / 1.4);
          }
        }}
        onPointerDown={(e) => {
          suppressClick.current = false;
          if (e.button !== 0 || tool !== "select") return;
          e.currentTarget.focus({ preventScroll: true });
          gesture.current = {
            point: screenPoint(e),
            id: e.pointerId,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const index = movingVertex.current;
          if (index !== null) {
            const point = pointAt(e);
            if (inside(point))
              setVertices((current) =>
                current.map((vertex, i) => (i === index ? point : vertex)),
              );
            return;
          }
          if (tool === "draw" && vertices.length) setCursor(pointAt(e));
          const active = gesture.current;
          if (!active || active.id !== e.pointerId) return;
          const q = screenPoint(e);
          const x = q.x - active.point.x;
          const y = unpitch(q.y) - unpitch(active.point.y);
          if (!active.moved && Math.hypot(x, y) < 5) return;
          if (!active.moved) {
            e.currentTarget.setPointerCapture(e.pointerId);
            active.moved = true;
            suppressClick.current = true;
            setDragging(true);
          }
          active.point = q;
          setView((v) => ({ ...v, x: v.x + x, y: v.y + y }));
        }}
        onPointerUp={() => {
          movingVertex.current = null;
          gesture.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          movingVertex.current = null;
          gesture.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (!gesture.current?.moved) gesture.current = null;
        }}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          if (tool !== "select") return;
          const q = screenPoint(e);
          zoomAt(1.6, q.x, unpitch(q.y));
        }}
        onClick={click}
        className={
          tool !== "select" ? "map drawing" : dragging ? "map dragging" : "map"
        }
      >
        <defs>
          <pattern
            id="map-grid"
            width="38"
            height="38"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M38 0H0V38"
              fill="none"
              stroke="#c9d5c7"
              strokeWidth=".6"
            />
          </pattern>
          <pattern
            id="masked"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="6" fill="#d9d7d1" />
            <path d="M0 6L6 0" stroke="#868a82" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="960" height="520" fill="#e8eee1" />
        <rect width="960" height="520" fill="url(#map-grid)" />
        <g
          transform={`${pitched ? "translate(0 85) scale(1 .72) " : ""}translate(${480 + view.x} ${250 + view.y}) scale(${view.zoom}) translate(-480 -250)`}
        >
          <path
            d={geometry.context || ""}
            fill="#e0e5d5"
            stroke="#c3cdba"
            strokeWidth="1"
          />
          {tiles.map((tile) => (
            <image
              key={basemap + tile.key}
              href={`${services}/${basemap === "satellite" ? "World_Imagery" : "World_Street_Map"}/MapServer/tile/${tile.key}`}
              x={tile.x}
              y={tile.y}
              width={tile.size}
              height={tile.size}
              pointerEvents="none"
              onError={() => setTileError(true)}
            />
          ))}
          {[
            [138, -38, 138, -24],
            [141, -38, 141, -26],
            [141, -29, 153, -29],
            [141, -36, 150, -36],
          ].map(([x1, y1, x2, y2], i) => (
            <path
              key={i}
              d={`M${xy(x1, y1)}L${xy(x2, y2)}`}
              stroke="#b8c3b1"
              fill="none"
              strokeDasharray="5 5"
              strokeWidth="1"
            />
          ))}
          {geo.regions.features.map((f: any, i: number) => (
            <path
              key={i}
              d={geometry.regions[i] || ""}
              fill={i === 0 ? "#bdccad" : "#cdd6b5"}
              fillOpacity={basemap === "basin" ? 1 : 0.12}
              stroke="#718f70"
              strokeWidth="1.4"
              onClick={(e) => {
                if (tool === "select") {
                  e.stopPropagation();
                  onArea({ name: featureName(f), type: "region", feature: f });
                }
              }}
            >
              <title>{`${featureName(f)}: choose region`}</title>
            </path>
          ))}
          {geo.catchments.features.map((_: any, i: number) => (
            <path
              key={i}
              d={geometry.catchments[i] || ""}
              fill="none"
              stroke="#9bae8d"
              strokeWidth=".65"
            />
          ))}
          <path
            d={geometry.basin || ""}
            fill="none"
            stroke="#587458"
            strokeWidth="1.7"
          />
          {projection.scale() * view.zoom > 6000 &&
            geometry.localities.map(({ feature, shape, center }: any) => (
              <g key={feature.properties.SAL_CODE_2026}>
                <path
                  d={shape || ""}
                  fill="#f2c56625"
                  stroke="#e5a43b"
                  strokeWidth="2"
                  onClick={(event) => {
                    if (tool !== "select") return;
                    event.stopPropagation();
                    onArea({
                      name: feature.properties.SAL_NAME_2026,
                      type: "locality",
                      feature,
                    });
                  }}
                />
                <text
                  x={center[0]}
                  y={center[1]}
                  fontSize={12 / view.zoom}
                  textAnchor="middle"
                  fill="#163329"
                  stroke="#fff"
                  strokeWidth={2 / view.zoom}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {feature.properties.SAL_NAME_2026}
                </text>
              </g>
            ))}
          {area?.feature && (
            <path
              d={path(area.feature) || ""}
              fill="#588b6520"
              stroke="#234d3c"
              strokeWidth="2.5"
            />
          )}
          {site &&
            geo.lgas.features
              .filter((f: any) => f.properties.LGA_CODE_2025 === site.lgaCode)
              .map((f: any) => (
                <path
                  key="lga"
                  d={path(f) || ""}
                  fill="#305d4022"
                  stroke="#2b684d"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                >
                  <title>{`${site.lgaName} LGA boundary. Weather is a separate representative point.`}</title>
                </path>
              ))}
          {layer === "moisture" &&
            grid.grid.map((cell, i) => {
              const [x, y] = xy(cell.lon, cell.lat);
              const a = cell.bounds
                  ? xy(cell.bounds[2], cell.bounds[3])
                  : xy(cell.lon + 0.047, cell.lat + 0.0405),
                b = cell.bounds
                  ? xy(cell.bounds[0], cell.bounds[1])
                  : xy(cell.lon - 0.047, cell.lat - 0.0405);
              const w = Math.abs(a[0] - b[0]),
                h = Math.abs(a[1] - b[1]),
                v = cell[depth];
              const lift = threeD && v !== null ? v * 220 : 0;
              return (
                <g key={i}>
                  {lift > 0 && (
                    <path
                      d={`M${x - w / 2},${y}v${-lift}h${w}v${lift}Z`}
                      fill="#3c6c64"
                      opacity=".65"
                    />
                  )}
                  <rect
                    x={x - w / 2}
                    y={y - h / 2 - lift}
                    width={w}
                    height={h}
                    fill={v === null ? "url(#masked)" : color(v)}
                    stroke="#f6f8ed"
                    strokeWidth=".5"
                  >
                    <title>{`${depth}: ${v === null ? "masked" : v + " m³/m³"}; ${mode === "example" ? "synthetic 9 km support" : grid.meta?.grid?.resolution}; ${grid.meta?.grid?.end || "2025-10-15"}`}</title>
                  </rect>
                </g>
              );
            })}
          {layer === "flood" &&
            grid.flood.map((cell, i) => {
              if (!site) return null;
              const p = cell.bounds
                  ? xy(cell.bounds[0], cell.bounds[1])
                  : xy(
                      site.lon + ((i % 10) - 5) * 0.00032,
                      site.lat + (Math.floor(i / 10) - 5) * 0.00027,
                    ),
                q = cell.bounds
                  ? xy(cell.bounds[2], cell.bounds[3])
                  : xy(
                      site.lon + ((i % 10) - 4) * 0.00032,
                      site.lat + (Math.floor(i / 10) - 4) * 0.00027,
                    );
              const masked = cell.ref === "masked" || cell.event === "masked";
              return (
                <rect
                  key={i}
                  x={Math.min(p[0], q[0])}
                  y={Math.min(p[1], q[1])}
                  width={Math.abs(p[0] - q[0])}
                  height={Math.abs(p[1] - q[1])}
                  fill={
                    masked
                      ? "url(#masked)"
                      : cell.permanent
                        ? "#356e95"
                        : cell.event === "water"
                          ? "#4cb7b2"
                          : "#ccb98c"
                  }
                >
                  <title>{`Pixel ${i}: ${cell.ref} → ${cell.event}; ${masked ? "unknown shared support" : cell.permanent ? "permanent water" : cell.event === "water" ? "possible new inundation" : "land"}`}</title>
                </rect>
              );
            })}
          {sites.map((s) => {
            const [x, y] = xy(s.lon, s.lat);
            return (
              <g
                key={s.id}
                transform={`translate(${x} ${y}) scale(${1 / view.zoom}) translate(${-x} ${-y})`}
                onClick={(e) => {
                  if (tool === "select") {
                    e.stopPropagation();
                    onSite(s.id);
                  }
                }}
                className="map-place"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={site?.id === s.id ? 6 : 4}
                  fill={s.powerFile ? "#254f40" : "#f4f1e7"}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  x={x + 9}
                  y={y + 4}
                  fontSize="12"
                  fill="#344d3a"
                  paintOrder="stroke"
                  stroke="#e4ebda"
                  strokeWidth="3"
                >
                  {s.name}
                </text>
                <title>{`${s.name}: ${s.powerFile ? "POWER point available" : "real data unavailable"}`}</title>
              </g>
            );
          })}
          {!area && basemap === "basin" && view.zoom <= 1.4 && (
            <>
              <text
                x="480"
                y="175"
                className="region-label"
                textAnchor="middle"
              >
                NORTHERN BASIN
              </text>
              <text
                x="435"
                y="400"
                className="region-label"
                textAnchor="middle"
              >
                SOUTHERN BASIN
              </text>
              <text x="740" y="100" className="state-label">
                QUEENSLAND
              </text>
              <text x="760" y="280" className="state-label">
                NEW SOUTH WALES
              </text>
              <text x="630" y="485" className="state-label">
                VICTORIA
              </text>
              <text x="185" y="380" className="state-label">
                SOUTH AUSTRALIA
              </text>
            </>
          )}
          {area?.point && !site && (
            <g transform={`translate(${xy(...area.point)})`}>
              <circle r="7" fill="#c16b3c" />
              <circle r="12" fill="none" stroke="#c16b3c" />
            </g>
          )}
          {vertices.length > 0 && (
            <path
              d={
                "M" +
                (cursor ? [...vertices, cursor] : vertices)
                  .map((p) => xy(...p).join(","))
                  .join("L")
              }
              stroke="#b86e36"
              strokeWidth="2"
              fill="#c3955330"
            />
          )}
          {vertices.map((vertex, index) => {
            const [x, y] = xy(...vertex);
            return (
              <g
                key={index}
                transform={`translate(${x} ${y}) scale(${1 / view.zoom})`}
                className="boundary-vertex"
                onPointerDown={(event) => {
                  if (tool !== "draw" || event.button !== 0) return;
                  movingVertex.current = index;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={() => {
                  if (movingVertex.current !== null)
                    suppressClick.current = true;
                }}
              >
                <circle
                  r="9"
                  fill={index === 0 ? "#9b481f" : "#265945"}
                  stroke="white"
                />
                <text textAnchor="middle" y="4" fontSize="10" fill="white">
                  {index + 1}
                </text>
              </g>
            );
          })}
        </g>
        <rect
          x="744"
          y="345"
          width="168"
          height="142"
          rx="10"
          fill="#f9faef"
          opacity=".96"
        />
        <path d={inset(geo.context) || ""} fill="#c4ceba" />
        <path d={inset(geo.basin) || ""} fill="#3f7156" />
        <text x="758" y="366" className="inset-label">
          AUSTRALIA
        </text>
        <text x="910" y="44" textAnchor="middle" fill="#2e5140" fontSize="12">
          N ↑
        </text>
      </svg>
      <div className="map-tools" aria-label="Map tools">
        <button
          title="Select"
          aria-label="Select on map"
          className={tool === "select" ? "active" : ""}
          onClick={() => setTool("select")}
        >
          <MousePointer2 size={17} />
        </button>
        <button
          title="Drop a pin"
          aria-label="Drop a pin"
          className={tool === "pin" ? "active" : ""}
          onClick={() => setTool("pin")}
        >
          <MapPin size={17} />
        </button>
        <button
          title="Draw an area"
          aria-label="Draw an area"
          className={tool === "draw" ? "active" : ""}
          onClick={() => setTool("draw")}
        >
          <PenTool size={17} />
        </button>
        <hr />
        <button aria-label="Zoom in" onClick={() => zoomAt(1.4)}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)}>
          <Minus size={17} />
        </button>
        <button
          aria-label="Full basin extent"
          onClick={() => {
            onArea(null);
            setView(initialView);
            setFootprint(false);
          }}
        >
          <Maximize size={17} />
        </button>
      </div>
      {tool !== "select" && (
        <div className="map-instruction">
          {tool === "pin"
            ? "Click inside the basin to drop a pin. For keyboard input use coordinates below."
            : `Add at least 3 points. Click point 1 or choose Finish area to close (${vertices.length} added).`}{" "}
          {tool === "draw" && (
            <button disabled={vertices.length < 3} onClick={finish}>
              Finish area
            </button>
          )}
          {tool === "draw" && (
            <button
              disabled={!vertices.length}
              onClick={() => {
                setVertices((points) => points.slice(0, -1));
                setDrawError("");
              }}
            >
              Undo point
            </button>
          )}
          {drawError && <p role="alert">{drawError}</p>}
          <button
            onClick={() => {
              setTool("select");
              setVertices([]);
              setCursor(null);
              setDrawError("");
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {tool === "select" && area?.type === "drawn area" && (
        <div className="map-instruction">
          <button
            onClick={() => {
              setVertices(area.feature.geometry.coordinates[0].slice(0, -1));
              setDrawError("");
              setTool("draw");
            }}
          >
            Edit selected area
          </button>
        </div>
      )}
      {threeD && (layer !== "moisture" || grid.grid.length === 0) && (
        <div className="map-instruction">
          {layer === "weather"
            ? "POWER is point data: no area extrusion. Representative point shown."
            : "No numeric grid is available for this source. Select Soil Moisture in Example mode to exercise 3D."}
        </div>
      )}
      <div className="map-footer">
        <div className="map-legend">
          <Layers size={14} />
          {layer === "moisture" ? (
            <>
              <i style={{ background: "#d5c18d" }} /> &lt;0.16{" "}
              <i style={{ background: "#a4bca2" }} /> 0.16–0.22{" "}
              <i style={{ background: "#659a8b" }} /> 0.22–0.28{" "}
              <i style={{ background: "#2d716d" }} /> ≥0.28 m³/m³{" "}
              {threeD && "· pitched columns: 16 display px / 0.1 m³/m³"}
            </>
          ) : layer === "flood" ? (
            <>
              Blue: permanent · teal: possible new water · beige: land · hatch:
              unknown
            </>
          ) : (
            <>
              Basin / catchment boundaries <span className="point-key" />{" "}
              Weather sample point
            </>
          )}
        </div>
        {site && layer !== "weather" && (
          <button
            className="text-button"
            onClick={() => {
              setView(initialView);
              setFootprint(!footprint);
            }}
          >
            {footprint ? "Fit selected area" : "Fit data footprint"}
          </button>
        )}
      </div>
      <p className="layer-date source-line">
        {layer === "moisture"
          ? `${grid.meta?.grid?.source || "SMAP grid unavailable"} · ${grid.meta?.grid?.end || "No observation date"} · ${depth === "root" ? "0–100 cm modeled root zone" : "0–5 cm surface"} · ${grid.grid.filter((c) => c[depth] !== null).length}/${grid.grid.length} valid cells · ${grid.meta?.grid?.resolution || "no native grid"}`
          : layer === "flood"
            ? `${grid.meta?.flood?.source || "OPERA layer unavailable"} · reference ${grid.meta?.flood?.start || "unknown"} / comparison ${grid.meta?.flood?.end || "unknown"} · shared valid QA only`
            : "NASA POWER · representative points with bundled 2016–2025 availability; hollow markers have no real series. No area-wide average."}
      </p>
      <p className="attribution">
        {basemap !== "basin" && (
          <>
            <a
              href={`${services}/${basemap === "satellite" ? "World_Imagery" : "World_Street_Map"}/MapServer`}
              target="_blank"
              rel="noreferrer"
            >
              {basemap === "satellite"
                ? "Imagery © Esri, Vantor, Earthstar Geographics and the GIS User Community"
                : "Street map © Esri and its data providers"}
            </a>
            {" · "}
          </>
        )}
        Offline vectors © MDBA, ABS 2025 CC BY 4.0 · Natural Earth public
        domain. Boundaries select areas; point weather is not an LGA average.{" "}
        {mode === "example" && "Data overlays are synthetic."}
      </p>
      {tileError && (
        <p className="map-instruction" role="status">
          Some map tiles could not load. The basin boundary map is available
          offline.
        </p>
      )}
    </div>
  );
}
