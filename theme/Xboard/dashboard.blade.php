<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" />
  <title>{{$title}}</title>
  @php
    $themePath = app(\App\Services\ThemeService::class)->getThemePath((string) $theme);
    $manifestPath = $themePath ? $themePath . '/assets/app/manifest.json' : null;
    $manifest = $manifestPath && file_exists($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
    $entryKey = null;

    if (is_array($manifest)) {
      foreach ($manifest as $chunkName => $chunk) {
        if (is_array($chunk) && !empty($chunk['isEntry'])) {
          $entryKey = $chunkName;
          break;
        }
      }
    }

    $entry = $entryKey !== null ? ($manifest[$entryKey] ?? null) : null;
    abort_unless(is_array($entry) && !empty($entry['file']), 503, 'User React assets are missing. Run the user frontend build.');

    $styles = [];
    $modulePreloads = [];
    $visited = [];

    $collectAssets = function ($chunkName) use (&$collectAssets, &$manifest, &$visited, &$styles, &$modulePreloads, $entryKey) {
      if (isset($visited[$chunkName]) || !isset($manifest[$chunkName]) || !is_array($manifest[$chunkName])) {
        return;
      }

      $visited[$chunkName] = true;
      $chunk = $manifest[$chunkName];

      if (!empty($chunk['css']) && is_array($chunk['css'])) {
        foreach ($chunk['css'] as $cssFile) {
          $styles[$cssFile] = $cssFile;
        }
      }

      if (!empty($chunk['imports']) && is_array($chunk['imports'])) {
        foreach ($chunk['imports'] as $import) {
          $collectAssets($import);
        }
      }

      if ($chunkName !== $entryKey && !empty($chunk['file']) && str_ends_with($chunk['file'], '.js')) {
        $modulePreloads[$chunk['file']] = $chunk['file'];
      }
    };

    $collectAssets($entryKey);

    foreach ($manifest as $chunk) {
      if (is_array($chunk) && !empty($chunk['file']) && str_ends_with($chunk['file'], '.css')) {
        $styles[$chunk['file']] = $chunk['file'];
      }
    }

    $assetBase = '/theme-runtime/' . rawurlencode((string) $theme) . '/assets/app/';
    $assetVersion = rawurlencode((string) $version);
  @endphp
  @foreach($styles as $css)
    <link rel="stylesheet" href="{{ $assetBase }}{{ $css }}?v={{ $assetVersion }}">
  @endforeach
  @foreach($modulePreloads as $js)
    <link rel="modulepreload" crossorigin href="{{ $assetBase }}{{ $js }}">
  @endforeach
</head>

<body>

  <script>
    window.routerBase = "/";
    window.settings = {!! $frontend_settings_json ?? '{}' !!};
  </script>
  <div id="app"></div>
  <script type="module" src="{{ $assetBase }}{{ $entry['file'] }}"></script>
  {!! $theme_config['custom_html'] ?? '' !!}
</body>

</html>
