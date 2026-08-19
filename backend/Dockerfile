# Dibuild dengan build context = ROOT REPO (bukan folder backend/ saja),
# karena project ini pakai npm workspaces dengan satu package-lock.json di root.
# Di Coolify: Base Directory = "/", Dockerfile Location = "/backend/Dockerfile".
FROM node:22-alpine
WORKDIR /app

# Copy manifest dulu (layer cache) - butuh package.json semua workspace supaya
# npm ci tahu struktur workspace-nya, walau isi frontend tidak akan diinstall.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci -w backend

# Prisma schema + generate client
COPY backend/prisma ./backend/prisma
RUN npm run prisma:generate -w backend

# Source code & asset (logo nota, dll)
COPY backend/src ./backend/src
COPY backend/assets ./backend/assets

WORKDIR /app/backend

# Folder yang butuh persistent volume di Coolify:
# - uploads/  -> foto sebelum/sesudah servis
# - data/     -> token OAuth Gmail untuk reminder maintenance
RUN mkdir -p uploads data

ENV NODE_ENV=production
EXPOSE 4000

# migrate deploy = aman dijalankan berkali-kali (idempotent), beda dari
# "migrate dev" yang bisa nanya interaktif dan tidak cocok untuk produksi.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]