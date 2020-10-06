FROM node:14-alpine

RUN mkdir /dist
COPY dist ./dist

USER node

CMD ["node", "./dist/index.js"]
