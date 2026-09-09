import os
from flask import Flask, render_template, send_from_directory

# Define explicit paths for templates and static files to ensure reliability across environments (local & Vercel)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

# Serve static files reliably in both local and serverless deployments
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

@app.route('/api/static/<path:filename>')
def serve_api_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# Serve public files
@app.route('/public/<path:filename>')
def serve_public(filename):
    return send_from_directory(PUBLIC_DIR, filename)

@app.route('/api/public/<path:filename>')
def serve_api_public(filename):
    return send_from_directory(PUBLIC_DIR, filename)

# Catch-all route ensures root, /api, /api/index, /api/index.py, and any subpath all render the site
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=8080)
