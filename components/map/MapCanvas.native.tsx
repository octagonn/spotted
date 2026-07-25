import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { MapGym } from "@/hooks/queries/useMapGyms";
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
  onCluster
}: {
  gyms: MapGym[];
  coords: { latitude: number; longitude: number } | null;
  onGym: (gym: MapGym) => void;
  onCluster: (gyms: MapGym[]) => void;
}) {
  const [ready, setReady] = useState(false);
  const gymById = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);

  // Freeze the page at mount (same contract as before: parent waits for
  // location + gyms to settle before mounting).
  const html = useRef<string | null>(null);
  if (html.current === null) html.current = buildMapHtml(gyms, coords);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: { type?: string; ids?: string[] } | null = null;
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
      }
    },
    [gymById, onGym, onCluster]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <WebView
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
        style={{ flex: 1, backgroundColor: colors.black }}
      />
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
    minZoom: 8,
    maxZoom: 18,
    attributionControl: { compact: true },
    pitchWithRotate: false,
    dragRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.touchPitch.disable();

  map.on("load", function () {
    map.addSource("gyms", {
      type: "geojson",
      data: GYMS,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 46
    });

    // Cluster bubbles — dark fill, white ring, sized gently by count.
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "gyms",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#141416",
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 2,
        "circle-radius": ["step", ["get", "point_count"], 15, 8, 18, 25, 22]
      }
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "gyms",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Montserrat Medium"],
        "text-size": 13
      },
      paint: { "text-color": "#FFFFFF" }
    });

    // Individual gyms — small dark dot with white ring.
    map.addLayer({
      id: "gym",
      type: "circle",
      source: "gyms",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#141416",
        "circle-stroke-color": "#FFFFFF",
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
