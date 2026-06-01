# Stage 1 — build the Vite bundle.
# node:22-alpine satisfies Vite 7's engine requirement (>=20.19.0 || >=22.12.0).
FROM node:22-alpine AS build

WORKDIR /app

# Build-time config baked into the bundle. Empty VITE_BACKEND_URL means "use
# relative URLs" — nginx proxies /api/* to the backend container.
ARG VITE_BACKEND_URL=""
ARG VITE_AUTH_BLOCKCHAIN_ENABLED="true"

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_AUTH_BLOCKCHAIN_ENABLED=$VITE_AUTH_BLOCKCHAIN_ENABLED

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — serve via nginx, with /api/* reverse-proxied to the backend service.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
