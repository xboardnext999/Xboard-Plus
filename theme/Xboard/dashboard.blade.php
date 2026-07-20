<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" />
  <title>{{$title}}</title>
  <link rel="stylesheet" href="/theme-runtime/{{$theme}}/assets/app/styles.css?v={{$version}}">
  <link rel="stylesheet" href="/theme-runtime/{{$theme}}/assets/app/store-service.css?v={{$version}}">
</head>

<body>

  <script>
    window.routerBase = "/";
    window.settings = {!! $frontend_settings_json ?? '{}' !!};
  </script>
  <div id="app"></div>
  <script type="module" src="/theme-runtime/{{$theme}}/assets/app/main.js?v={{$version}}"></script>
  {!! $theme_config['custom_html'] ?? '' !!}
</body>

</html>
