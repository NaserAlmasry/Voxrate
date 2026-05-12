FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install

# Install Playwright Chromium browser
RUN npx playwright install chromium --with-deps

COPY server.js ./

EXPOSE 3001

CMD ["node", "server.js"]
