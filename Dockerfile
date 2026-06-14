FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DATA_DIR=/data
ENV DISABLE_BROWSER_AUTOFILL=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./

EXPOSE 4757

CMD ["npm", "start"]
