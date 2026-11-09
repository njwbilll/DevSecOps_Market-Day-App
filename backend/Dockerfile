FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js && node src/server.js"]
