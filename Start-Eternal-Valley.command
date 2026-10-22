#!/bin/bash
# ------------------------------------------------------------------
# Start-Eternal-Valley.command
# Double-click on macOS to open Eternal Valley in your browser.
#
# Browsers will not run the site's 3D/map scripts from a double-clicked
# index.html (file://), so this starts a small web server on this
# computer only (127.0.0.1), opens index.html, and keeps running.
# Close this window, or press Ctrl-C, to stop it.
# Works with the bash 3.2 that ships with macOS. Needs no install:
# uses python3, then python 2, ruby, node or php, whichever exists.
# ------------------------------------------------------------------

# Always serve the folder this script lives in (Finder starts it in $HOME).
cd "$(dirname "$0")" || { echo "Could not open the Eternal Valley folder."; exit 1; }
SITE_DIR="$(pwd)"

if [ ! -f "$SITE_DIR/index.html" ]; then
  echo "index.html was not found next to this script ($SITE_DIR)."
  echo "Keep Start-Eternal-Valley.command inside the Eternal Valley folder."
  read -r -p "Press Return to close." _ 2>/dev/null
  exit 1
fi

# --- pick a free port (8000-8099) ---
port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    return 1
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$1" >/dev/null 2>&1 && return 0
    return 1
  fi
  (echo >/dev/tcp/127.0.0.1/"$1") >/dev/null 2>&1 && return 0
  return 1
}
PORT=8000
while [ "$PORT" -lt 8100 ] && port_in_use "$PORT"; do
  PORT=$((PORT + 1))
done
if [ "$PORT" -ge 8100 ]; then
  echo "No free port between 8000 and 8099. Close other local servers and try again."
  read -r -p "Press Return to close." _ 2>/dev/null
  exit 1
fi

# --- start a static server, best available first ---
# (macOS has a /usr/bin/python3 stub that only offers to install developer
#  tools, so each candidate is checked by actually running it.)
SERVER_PID=""
SERVER_NAME=""
start_server() {
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import http.server' >/dev/null 2>&1; then
    python3 "$SITE_DIR/tools/serve-site.py" "$PORT" >/dev/null 2>&1 &
    SERVER_PID=$!; SERVER_NAME="Eternal Valley media server"; return 0
  fi
  if command -v python >/dev/null 2>&1 && python -c 'import SimpleHTTPServer' >/dev/null 2>&1; then
    python -m SimpleHTTPServer "$PORT" >/dev/null 2>&1 &
    SERVER_PID=$!; SERVER_NAME="python SimpleHTTPServer"; return 0
  fi
  if command -v ruby >/dev/null 2>&1 && ruby -e 'require "webrick"' >/dev/null 2>&1; then
    ruby -run -e httpd . -p "$PORT" -b 127.0.0.1 >/dev/null 2>&1 &
    SERVER_PID=$!; SERVER_NAME="ruby httpd"; return 0
  fi
  if command -v node >/dev/null 2>&1; then
    EV_PORT="$PORT" node -e '
      var h=require("http"),f=require("fs"),p=require("path"),r=process.cwd();
      var T={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".wasm":"application/wasm",".mp4":"video/mp4",".webm":"video/webm",".ktx2":"image/ktx2",".glb":"model/gltf-binary",".ico":"image/x-icon",".txt":"text/plain"};
      h.createServer(function(q,s){var u=decodeURIComponent(q.url.split("?")[0]);if(u.slice(-1)=="/")u+="index.html";var x=p.join(r,u);
        if(x.indexOf(r)!==0){s.writeHead(403);return s.end();}
        f.readFile(x,function(e,b){if(e){s.writeHead(404);return s.end("Not found");}s.writeHead(200,{"Content-Type":T[p.extname(x).toLowerCase()]||"application/octet-stream"});s.end(b);});
      }).listen(+process.env.EV_PORT,"127.0.0.1");' >/dev/null 2>&1 &
    SERVER_PID=$!; SERVER_NAME="node"; return 0
  fi
  if command -v php >/dev/null 2>&1; then
    php -S 127.0.0.1:"$PORT" -t . >/dev/null 2>&1 &
    SERVER_PID=$!; SERVER_NAME="php -S"; return 0
  fi
  return 1
}

if ! start_server; then
  echo "Could not find a way to start a local web server on this Mac."
  echo "Install Python 3 (https://www.python.org/downloads/), then double-click this file again."
  read -r -p "Press Return to close." _ 2>/dev/null
  exit 1
fi

stop_server() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" >/dev/null 2>&1; fi
}
trap 'stop_server; exit 0' INT TERM HUP
trap 'stop_server' EXIT

URL="http://127.0.0.1:$PORT/index.html"

# --- wait (up to ~10 s) until the server answers ---
i=0
while [ $i -lt 40 ]; do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "The local server ($SERVER_NAME) stopped unexpectedly."
    read -r -p "Press Return to close." _ 2>/dev/null
    exit 1
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -s -o /dev/null "$URL" && break
  elif port_in_use "$PORT"; then
    break
  fi
  sleep 0.25
  i=$((i + 1))
done

echo "========================================================"
echo "  Eternal Valley is running at:"
echo "    $URL"
echo "  (server: $SERVER_NAME, folder: $SITE_DIR)"
echo ""
echo "  Leave this window open while you browse."
echo "  Close it, or press Ctrl-C, to stop."
echo "========================================================"

# --- open the default browser ---
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1
else
  echo "Open $URL in your browser."
fi

wait "$SERVER_PID"
