FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY index.js ./
USER node
EXPOSE 4003
CMD ["node", "index.js"]
