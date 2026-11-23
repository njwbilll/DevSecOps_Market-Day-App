FROM node:26-alpine
RUN apk upgrade --no-cache && apk add --no-cache openssl && npm install -g npm@11.21.2
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db execute --file prisma/hardening.sql --schema prisma/schema.prisma && node prisma/seed.js && node src/server.js"]
