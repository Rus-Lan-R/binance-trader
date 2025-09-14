# Stage 1 — build
FROM node:20-alpine AS builder

WORKDIR /app

ARG BINANCE_API_KEY
ARG BINANCE_API_SECRET
ARG TELEGRAM_BOT_KEY

ENV BINANCE_API_KEY=$BINANCE_API_KEY
ENV BINANCE_API_SECRET=$BINANCE_API_SECRET
ENV TELEGRAM_BOT_KEY=$TELEGRAM_BOT_KEY

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 — production image
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

CMD ["npm", "start"]