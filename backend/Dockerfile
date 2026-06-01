FROM node:20-alpine

WORKDIR /app

# Install production deps first so changes to source don't bust the layer cache.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the source.
COPY . .

EXPOSE 4000

# index.js loads dotenv then requires src/index. In docker we set env via compose,
# so the optional .env load is a no-op.
CMD ["node", "index.js"]
