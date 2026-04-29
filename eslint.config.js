const { FlatCompat } = require("@eslint/eslintrc");
const path = require("node:path");

const compat = new FlatCompat({
  baseDirectory: path.resolve(".")
});

module.exports = [
  ...compat.extends("expo"),
  {
    ignores: [
      "dist/*",
      "supabase/functions/**",
      "components/external-link.tsx",
      "components/haptic-tab.tsx",
      "components/hello-wave.tsx",
      "components/parallax-scroll-view.tsx",
      "components/themed-text.tsx",
      "components/themed-view.tsx",
      "components/ui/collapsible.tsx",
      "components/ui/icon-symbol.tsx",
      "components/ui/icon-symbol.ios.tsx",
      "components/ui/tab-bar-background.tsx",
      "components/ui/tab-bar-background.ios.tsx"
    ]
  }
];
