FROM node:20-alpine
RUN apk add --no-cache su-exec
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 FARZIN_DATA_DIR=/data
WORKDIR /app
COPY package.json ./
COPY server.js ./server.js
COPY public ./public
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN mkdir -p /data && chown -R node:node /app /data && chmod +x /docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/docker-entrypoint.sh"]
