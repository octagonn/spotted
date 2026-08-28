import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { Pressable } from "@/components/ui/Pressable";
import type { MapBounds, MapGym } from "@/hooks/queries/useMapGyms";
import { allowMapNavigation } from "@/lib/mapNavigation";
import { colors } from "@/theme/colors";

/** Orange County fallback center when device location is unavailable. */
const OC_CENTER = { latitude: 33.66, longitude: -117.78 };

/**
 * SNAP-MAP-STYLE GL MAP.
 *
 * react-native-maps (1.20.1, the Expo Go-pinned version) has known hard
 * crashes on zoom under the New Architecture (which Reanimated 4 forces on),
 * no matter how few native Marker views are mounted — three marker
 * architectures all died. So markers are no longer native views at all.
 *
 * This renders MapLibre GL JS in a WebView: the map, pins, and cluster
 * bubbles are all drawn by the GPU inside one view (the same architecture
 * Snap Map uses — vector tiles + GL + supercluster). Clustering happens in
 * screen pixels, so bubbles merge exactly the pins that would overlap at the
 * current zoom and nothing merges "from far away". Handles thousands of
 * points; zero per-marker native churn; fast zoom cannot crash the app.
 *
 * RN <-> map bridge: taps post {type:"gym"|"cluster", ids} back through
 * onMessage; gyms are embedded as id+coords only (names stay in RN).
 */
export function MapCanvas({
  gyms,
  coords,
  onGym,
  onCluster,
  onRegion
}: {
  gyms: MapGym[];
  coords: { latitude: number; longitude: number } | null;
  onGym: (gym: MapGym) => void;
  onCluster: (gyms: MapGym[]) => void;
  /** Fired after each pan/zoom settles — drives viewport gym fetching. */
  onRegion?: (bounds: MapBounds) => void;
}) {
  const [ready, setReady] = useState(false);
  const webRef = useRef<WebView>(null);
  const gymById = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);

  // The page mounts once with the initial gyms baked in; later gym-set changes
  // stream into the live GeoJSON source (no reload, no remount).
  const html = useRef<string | null>(null);
  if (html.current === null) html.current = buildMapHtml(gyms, coords);
  const firstData = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstData.current) {
      firstData.current = false;
      return; // initial set is already in the HTML
    }
    const features = gyms.map((g) => ({
      type: "Feature",
      properties: { id: g.id },
      geometry: { type: "Point", coordinates: [g.longitude, g.latitude] }
    }));
    webRef.current?.injectJavaScript(`window.__setGyms(${JSON.stringify(features)}); true;`);
  }, [gyms, ready]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg:
        | { type?: string; ids?: string[]; minLat?: number; minLng?: number; maxLat?: number; maxLng?: number }
        | null = null;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!msg) return;
      if (msg.type === "gym" && msg.ids?.length) {
        const gym = gymById.get(msg.ids[0]);
        if (gym) onGym(gym);
      } else if (msg.type === "cluster" && msg.ids?.length) {
        const list = msg.ids.map((id) => gymById.get(id)).filter((g): g is MapGym => Boolean(g));
        if (list.length) onCluster(list);
      } else if (
        msg.type === "region" &&
        typeof msg.minLat === "number" &&
        typeof msg.minLng === "number" &&
        typeof msg.maxLat === "number" &&
        typeof msg.maxLng === "number"
      ) {
        onRegion?.({ minLat: msg.minLat, minLng: msg.minLng, maxLat: msg.maxLat, maxLng: msg.maxLng });
      }
    },
    [gymById, onGym, onCluster, onRegion]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: html.current }}
        onMessage={handleMessage}
        onLoadEnd={() => setReady(true)}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        // This WebView holds a postMessage bridge into the app, so it must
        // never be able to BECOME a page we don't control. The map only ever
        // needs its own inline document plus the library/style/tile hosts;
        // anything else (a redirect, an attribution link tap, an injected
        // navigation) is refused instead of loading inside the bridge.
        onShouldStartLoadWithRequest={(request) => allowMapNavigation(request.url)}
        // Keep the sandbox shut: no file:// reach-around, no popups.
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        javaScriptCanOpenWindowsAutomatically={false}
        // The GL map canvas has no accessibility tree — hide it from screen
        // readers and give them the "Browse gyms" list below instead (WCAG
        // 1.1.1 / 2.1.1: the map pins are otherwise undiscoverable).
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flex: 1, backgroundColor: colors.black }}
      />
      {/* Accessible, non-visual alternative to the map: a labeled control that
          opens the gym list sheet. Sits top-center; sighted users can ignore it. */}
      {gyms.length > 0 ? (
        <Pressable
          onPress={() => onCluster(gyms)}
          accessibilityRole="button"
          accessibilityLabel={`Browse ${gyms.length} nearby gyms as a list`}
          style={{
            position: "absolute",
            top: 12,
            alignSelf: "center",
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderWidth: 1,
            borderColor: colors.iron
          }}
        >
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.6}
            style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}
          >
            Gym list
          </Text>
        </Pressable>
      ) : null}
      {!ready ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.black
          }}
        >
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

function buildMapHtml(gyms: MapGym[], coords: { latitude: number; longitude: number } | null): string {
  const center = coords ?? OC_CENTER;
  const zoom = coords ? 13 : 10.5;
  // ids are uuids and coords are numbers — safe to inline as JSON.
  const features = gyms.map((g) => ({
    type: "Feature",
    properties: { id: g.id },
    geometry: { type: "Point", coordinates: [g.longitude, g.latitude] }
  }));
  const geojson = JSON.stringify({ type: "FeatureCollection", features });
  const user = coords ? JSON.stringify([coords.longitude, coords.latitude]) : "null";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; background: #000; }
  .maplibregl-ctrl-attrib { background: rgba(0,0,0,0.5) !important; }
  .maplibregl-ctrl-attrib a { color: #888 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var GYMS = ${geojson};
  var USER = ${user};
  var post = function (obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  };

  var map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: [${center.longitude}, ${center.latitude}],
    zoom: ${zoom},
    // Zoom all the way out to country scale; gym layers hide below GYM_MIN_ZOOM
    // (see layer minzoom) so a continental view isn't thousands of bubbles.
    minZoom: 3,
    maxZoom: 18,
    attributionControl: { compact: true },
    pitchWithRotate: false,
    dragRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.touchPitch.disable();

  // Live gym updates from RN (viewport fetches). Buffered until the source
  // exists so an early inject can't race the style load.
  var pendingGyms = null;
  var gymsReady = false;
  window.__setGyms = function (features) {
    pendingGyms = features;
    if (gymsReady) {
      map.getSource("gyms").setData({ type: "FeatureCollection", features: pendingGyms });
    }
  };

  map.on("load", function () {
    map.addSource("gyms", {
      type: "geojson",
      data: GYMS,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 46
    });
    gymsReady = true;
    if (pendingGyms) {
      map.getSource("gyms").setData({ type: "FeatureCollection", features: pendingGyms });
    }

    // Below this zoom the gym layers hide (readability at country scale).
    // Declared BEFORE reportRegion, which reads it — it used to be declared
    // afterwards, so the first call compared against undefined and only
    // worked by accident.
    //
    // Lowered 7 -> 5: at 7 the map went completely empty between the minimum
    // zoom (3) and 7, so zooming out looked broken ("can't zoom out far
    // enough"). Clustering already keeps this cheap to draw.
    var GYM_MIN_ZOOM = 5;

    // Report the settled viewport after every pan/zoom (and once on load) so
    // RN can fetch gyms for wherever the user is looking. Skip while zoomed
    // out past the gym layers' cutoff — the bubbles are hidden there and a
    // country-sized bbox fetch is pure waste.
    var reportRegion = function () {
      if (map.getZoom() < GYM_MIN_ZOOM) return;
      var b = map.getBounds();
      post({
        type: "region",
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast()
      });
    };
    map.on("moveend", reportRegion);
    reportRegion();

    // Cluster bubbles — white fill with a dark keyline for the dark basemap.
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "gyms",
      minzoom: GYM_MIN_ZOOM,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#FFFFFF",
        "circle-stroke-color": "#141416",
        "circle-stroke-width": 2,
        "circle-radius": ["step", ["get", "point_count"], 15, 8, 18, 25, 22]
      }
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "gyms",
      minzoom: GYM_MIN_ZOOM,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Montserrat Medium"],
        "text-size": 13
      },
      paint: { "text-color": "#141416" }
    });

    // Individual gyms — small white dot with a dark keyline.
    map.addLayer({
      id: "gym",
      type: "circle",
      source: "gyms",
      minzoom: GYM_MIN_ZOOM,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#FFFFFF",
        "circle-stroke-color": "#141416",
        "circle-stroke-width": 2,
        "circle-radius": 9
      }
    });

    // Viewer location dot.
    if (USER) {
      map.addSource("me", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: USER } }
      });
      map.addLayer({
        id: "me",
        type: "circle",
        source: "me",
        paint: {
          "circle-color": "#4A90D9",
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-radius": 7
        }
      });
    }

    map.on("click", "gym", function (e) {
      var f = e.features && e.features[0];
      if (f) post({ type: "gym", ids: [f.properties.id] });
    });

    map.on("click", "clusters", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      var clusterId = f.properties.cluster_id;
      var src = map.getSource("gyms");
      if (map.getZoom() >= 15) {
        // Gyms stacked at the same address — list them instead of zooming.
        src.getClusterLeaves(clusterId, 50, 0).then(function (leaves) {
          post({ type: "cluster", ids: leaves.map(function (l) { return l.properties.id; }) });
        });
      } else {
        src.getClusterExpansionZoom(clusterId).then(function (z) {
          map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z + 0.3, 16), duration: 350 });
        });
      }
    });

    ["clusters", "gym"].forEach(function (layer) {
      map.on("mouseenter", layer, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, function () { map.getCanvas().style.cursor = ""; });
    });
  });
})();
</script>
</body>
</html>`;
}
