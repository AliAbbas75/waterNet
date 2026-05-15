# Stage 1 — build the Vite bundle.
FROM node:20-alpine AS build

WORKDIR /app

# Thirdweb pulls in native deps (bufferutil, utf-8-validate) that need node-gyp,
# which needs python3 + a C++ toolchain. Install once for the build stage only;
# none of this ends up in the final nginx image.
RUN apk add --no-cache python3 make g++

# Build-time config baked into the bundle. Empty VITE_BACKEND_URL means "use
# relative URLs" — nginx proxies /api/* to the backend container.
ARG VITE_BACKEND_URL=""
ARG VITE_ALLOW_DEV_LOGIN="true"
ARG VITE_THIRDWEB_CLIENT_ID=""

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_ALLOW_DEV_LOGIN=$VITE_ALLOW_DEV_LOGIN \
    VITE_THIRDWEB_CLIENT_ID=$VITE_THIRDWEB_CLIENT_ID

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
