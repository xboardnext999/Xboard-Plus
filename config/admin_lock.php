<?php
return [
    'enabled' => (bool) env('ADMIN_LOCK_ENABLED', false),
    'simple_password' => (string) env('ADMIN_LOCK_SIMPLE_PASSWORD', ''),
    'full_password' => (string) env('ADMIN_LOCK_FULL_PASSWORD', ''),
    'ttl' => (int) env('ADMIN_LOCK_TTL', 28800),
];
