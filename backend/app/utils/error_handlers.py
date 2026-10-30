"""Safe JSON error handlers for unhandled Flask requests."""
from flask import jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app):
    """Register consistent responses without leaking server internals."""

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify({
            "error": error.name,
            "message": error.description,
        }), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled request exception")
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected error occurred.",
        }), 500
