FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl \
 && mkdir -p /etc/nginx/certs \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/nginx/certs/selfsigned.key \
    -out /etc/nginx/certs/selfsigned.crt \
    -subj "/C=ID/ST=Jawa Barat/L=Bandung/O=Market Day/CN=marketday.local"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
