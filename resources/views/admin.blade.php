<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ $title }}</title>
  <script>
    window.settings = {
      base_url: "/",
      title: "{{ $title }}",
      version: "{{ $version }}",
      logo: "{{ $logo }}",
      secure_path: "{{ $secure_path }}",
    };
  </script>
  @php
    $manifestPath = public_path('assets/admin-react/manifest.json');
    $manifest = file_exists($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
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
    abort_unless(is_array($entry) && !empty($entry['file']), 503, 'Admin React assets are missing. Run the admin frontend build.');

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
  @endphp

  @foreach($styles as $css)
    <link rel="stylesheet" crossorigin href="/assets/admin-react/{{ $css }}" />
  @endforeach
  @foreach($modulePreloads as $js)
    <link rel="modulepreload" crossorigin href="/assets/admin-react/{{ $js }}" />
  @endforeach
  <script type="module" crossorigin src="/assets/admin-react/{{ $entry['file'] }}"></script>
</head>

<body>
  <div id="root"></div>
</body>

</html>
