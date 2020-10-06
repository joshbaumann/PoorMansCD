FROM node:14.10.0-alpine

COPY dist ./dist

USER node

CMD ["node", "./dist/index.js"]
