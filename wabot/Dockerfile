FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for Baileys on Alpine if any
RUN apk add --no-cache tzdata

ENV TZ=Asia/Jakarta

COPY package*.json ./

RUN npm install --omit=dev --legacy-peer-deps

COPY . .

# Directory for Baileys authentication persistence
RUN mkdir -p /app/auth_info_baileys

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
