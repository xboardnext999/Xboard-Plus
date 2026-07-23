#!/bin/sh

set -eu

if [ ! -d ".git" ]; then
  echo "Please deploy using Git."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "Git is not installed! Please install git and try again."
    exit 1
fi

repo_root="$(pwd)"

add_safe_directory() {
  dir="$1"

  git config --global --get-all safe.directory | grep -Fx "$dir" > /dev/null ||     git config --global --add safe.directory "$dir"
}

add_safe_directory "$repo_root"

git fetch --all
git reset --hard origin/master
git pull --ff-only origin master

# Remove the retired Vue/admin-dist trees if they were left behind as
# untracked directories by an older deployment.
rm -rf "$repo_root/public/assets/admin" \
       "$repo_root/public/assets/admin-vue" \
       "$repo_root/public/theme/Xboard"

if [ ! -f "$repo_root/public/assets/admin-react/manifest.json" ] || \
   [ ! -f "$repo_root/theme/Xboard/assets/app/manifest.json" ]; then
  echo "React frontend manifests are missing. Refusing to continue with stale assets."
  exit 1
fi

if ! git ls-files --error-unmatch public/assets/admin-react/manifest.json >/dev/null 2>&1 || \
   ! git ls-files --error-unmatch theme/Xboard/assets/app/manifest.json >/dev/null 2>&1; then
  echo "React frontend manifests are not tracked by Git. Refusing to continue with stale assets."
  exit 1
fi

php <<'PHP'
<?php

$manifests = [
    'public/assets/admin-react/manifest.json',
    'theme/Xboard/assets/app/manifest.json',
];

foreach ($manifests as $manifestPath) {
    $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
    $root = dirname($manifestPath);

    foreach ($manifest as $entry) {
        $references = array_filter(array_merge(
            isset($entry['file']) ? [$entry['file']] : [],
            $entry['css'] ?? [],
            $entry['assets'] ?? [],
        ));

        foreach ($references as $reference) {
            $relativePath = $root . '/' . $reference;
            if (!is_file($relativePath)) {
                fwrite(STDERR, "Missing frontend asset referenced by manifest: {$relativePath}\n");
                exit(1);
            }

            exec('git ls-files --error-unmatch -- ' . escapeshellarg($relativePath) . ' >/dev/null 2>&1', $output, $status);
            if ($status !== 0) {
                fwrite(STDERR, "Frontend asset is not tracked by Git: {$relativePath}\n");
                exit(1);
            }
        }
    }
}
PHP

rm -rf composer.lock composer.phar
wget https://github.com/composer/composer/releases/latest/download/composer.phar -O composer.phar
php composer.phar update -vvv
php artisan xboard:update

if [ -f "/etc/init.d/bt" ] || [ -f "/.dockerenv" ]; then
  chown -R www:www $(pwd);
fi

if [ -d ".docker/.data" ]; then
  chmod -R 777 .docker/.data
fi
