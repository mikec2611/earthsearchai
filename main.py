#!/usr/bin/env python3
"""
EarthSearch.ai - Interactive Globe Explorer
Main application entry point
"""

import os
from livereload import Server
from app import create_app

def main():
    """Main application entry point."""
    app = create_app()
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 8000))
    
    # Use livereload server for development
    server = Server(app.wsgi_app)
    server.serve(port=port, host='0.0.0.0', debug=False)

if __name__ == '__main__':
    main() 