# Dockerfile for Site Monitor
FROM node:18-slim
WORKDIR /app
COPY server/package.json ./server/package.json
COPY server/index.js ./server/index.js
COPY . .
RUN cd server && npm install --production
EXPOSE 3000
CMD ["node", "server/index.js"]
