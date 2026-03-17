FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm install --omit=dev

COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend

EXPOSE 8080
CMD ["npm", "run", "start"]

