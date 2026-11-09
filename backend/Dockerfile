FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN chown -R node:node /app

USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db execute --file prisma/hardening.sql --schema prisma/schema.prisma && node prisma/seed.js && node src/server.js"]
