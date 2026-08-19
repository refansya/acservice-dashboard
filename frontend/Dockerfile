# Build context = ROOT REPO (sama alasannya dengan backend/Dockerfile: npm workspaces).
# Di Coolify: Base Directory = "/", Dockerfile Location = "/frontend/Dockerfile".

# ---- Stage 1: build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci -w frontend

COPY frontend ./frontend

# URL backend publik, dipakai Vite saat build (di-bake ke bundle statis).
# Wajib diisi lewat Build Variable di Coolify, contoh: https://api-domain-kamu.com/api
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build -w frontend

# ---- Stage 2: serve ----
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80