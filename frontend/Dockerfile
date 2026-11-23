FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk upgrade --no-cache \
 && apk add --no-cache openssl libcap \
 && mkdir -p /etc/nginx/certs /var/cache/nginx /var/log/nginx /var/run \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/nginx/certs/selfsigned.key \
    -out /etc/nginx/certs/selfsigned.crt \
    -subj "/C=ID/ST=Jawa Barat/L=Bandung/O=Market Day/CN=marketday.local" \
 && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
 && sed -i '/^user /d' /etc/nginx/nginx.conf \
 && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf \
 && chown -R nginx:nginx /etc/nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost/ || exit 1
