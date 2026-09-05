# Hetzner / Coolify — Playwright-ready Next.js
FROM mcr.microsoft.com/playwright:v1.62.0-jammy

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
