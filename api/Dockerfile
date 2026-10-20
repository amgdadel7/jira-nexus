FROM node:20-slim
WORKDIR /app

# Install build dependencies for native sqlite compilation if needed
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production=false

COPY . .

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256 --expose-gc"

CMD ["npm", "start"]
