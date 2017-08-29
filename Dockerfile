FROM cheeaun/puppeteer
RUN apt-get update && apt-get install -yq make g++
COPY . /app
RUN cd /app && yarn --production --pure-lockfile && \
  apt-get purge -y --auto-remove make g++
EXPOSE 3000
WORKDIR /app
CMD yarn start
