FROM node:22-alpine AS frontend-builder

WORKDIR /src

# Keep dependency installation cacheable while ensuring both React frontends
# are built from their checked-in source during every image build.
COPY admin-src/package.json admin-src/package-lock.json ./admin-src/
COPY user-src/package.json user-src/package-lock.json ./user-src/
RUN npm --prefix admin-src ci && npm --prefix user-src ci

COPY admin-src ./admin-src
COPY user-src ./user-src
COPY theme/Xboard/assets/app ./theme/Xboard/assets/app
RUN npm --prefix admin-src run build && npm --prefix user-src run build

FROM phpswoole/swoole:php8.2-alpine

COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install PHP extensions one by one with lower optimization level for ARM64 compatibility
RUN CFLAGS="-O0" install-php-extensions pcntl && \
    CFLAGS="-O0 -g0" install-php-extensions bcmath && \
    install-php-extensions zip && \
    install-php-extensions redis && \
    apk --no-cache add shadow sqlite mysql-client mysql-dev mariadb-connector-c git patch supervisor redis caddy && \
    addgroup -S -g 1000 www && adduser -S -G www -u 1000 www && \
    (getent group redis || addgroup -S redis) && \
    (getent passwd redis || adduser -S -G redis -H -h /data redis)

WORKDIR /www

COPY .docker /
COPY . /www

# Production assets come from the React source above. This intentionally has
# no legacy Vue/admin-dist fallback.
COPY --from=frontend-builder /src/public/assets/admin-react /www/public/assets/admin-react
COPY --from=frontend-builder /src/theme/Xboard/assets/app /www/theme/Xboard/assets/app

# Cache-busting remains available for compose/backward compatibility.
ARG CACHEBUST=1

RUN echo "Building local source with CACHEBUST: ${CACHEBUST}" && \
    git config --global --add safe.directory /www && \
    test -f public/assets/admin-react/manifest.json && \
    test -f theme/Xboard/assets/app/manifest.json

COPY .docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY .docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY .docker/php/zz-xboard.ini /usr/local/etc/php/conf.d/zz-xboard.ini

RUN composer install --no-cache --no-dev --no-security-blocking \
    && php artisan storage:link \
    && chown -R www:www /www \
    && find /www -type d -exec chmod 755 {} + \
    && find /www/storage /www/bootstrap/cache -type d -exec chmod 775 {} + \
    && find /www -type f -exec chmod 644 {} + \
    && find /www/storage /www/bootstrap/cache -type f -exec chmod 664 {} + \
    && (chmod 640 /www/.env 2>/dev/null || true) \
    && mkdir -p /data \
    && chown redis:redis /data
    
ENV ENABLE_WEB=true \
    ENABLE_HORIZON=true \
    ENABLE_QUEUE_WORKER=false \
    ENABLE_REDIS=true \
    ENABLE_WS_SERVER=true \
    ENABLE_CADDY=true

EXPOSE 8002
COPY .docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 
