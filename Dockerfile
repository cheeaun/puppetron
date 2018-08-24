FROM alpine:edge as base
RUN apk add --no-cache --update chromium tar zstd && \
    cd /usr/lib/chromium/locales/ && \
    find ./ -maxdepth 1 '!' -path './' '!' -path './en-US.pak' '!' -path './en-US.pak.info' -exec 'rm' '{}' ';' && \
    cd /usr/lib  && \
    tar cvf /chromium_lib.tar ./chromium && \
    zstd --train -r /usr/lib/chromium -o /chromium_lib.dict && \
    zstd -f -22 --ultra -D /chromium_lib.dict /chromium_lib.tar

FROM mhart/alpine-node:10 as build
WORKDIR /usr/src
COPY package.json package-lock.json /usr/src/
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm ci
COPY blocked.json index.html index.js start.sh ./

FROM mhart/alpine-node:base-10
WORKDIR /usr/src
ENV NODE_ENV="production"
COPY --from=base /chromium_lib.tar.zst /chromium_lib.dict /chrome/
#RUN apk add --no-cache --update tar zstd && \
RUN apk add --no-cache --update tar zstd alsa-lib at-spi2-atk atk cairo cups-libs dbus-libs eudev-libs expat flac fontconfig freetype gdk-pixbuf glib gtk+3.0 harfbuzz libatomic libevent libgcc libjpeg-turbo libpng libre2 libstdc++ libwebp libx11 libxcb libxcomposite libxcursor libxdamage libxext libxfixes libxi libxml2 libxrandr libxrender libxscrnsaver libxslt libxtst musl nspr nss opus pango snappy ttf-opensans minizip && \
    rm -rf /usr/share/gtk-doc
ENV CHROME_BIN=/usr/bin/chromium-browser \
   CHROME_PATH=/usr/lib/chromium/
COPY --from=build /usr/src/ .
EXPOSE 3000
CMD ["./start.sh"]
