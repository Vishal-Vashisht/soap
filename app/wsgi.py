
import os
from urllib.parse import parse_qs

from soap_service.application import soap_app
from frontend_server.files import serve_file


FRONTEND_DIR = os.environ.get(
    "FRONTEND_DIR",
    "/home/soap/soap/frontend/dist",
)


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    query = parse_qs(environ.get("QUERY_STRING", ""))

    # SOAP routes
    if path == "/soap" or path.startswith("/soap/"):
        soap_environ = environ.copy()

        original_script_name = environ.get("SCRIPT_NAME", "")
        soap_environ["SCRIPT_NAME"] = (
            original_script_name.rstrip("/") + "/soap"
        )

        soap_environ["PATH_INFO"] = path[len("/soap"):] or "/"

        if method == "GET" and "download_wsdl" in query:
            soap_environ["QUERY_STRING"] = "wsdl"

            def download_start_response(
                status, headers, exc_info=None
            ):
                headers = [
                    (key, value)
                    for key, value in headers
                    if key.lower() not in (
                        "content-type",
                        "content-disposition",
                    )
                ]

                headers.extend([
                    (
                        "Content-Type",
                        "application/xml; charset=utf-8",
                    ),
                    (
                        "Content-Disposition",
                        'attachment; filename="service.wsdl"',
                    ),
                ])

                return start_response(status, headers, exc_info)

            return soap_app(
                soap_environ,
                download_start_response,
            )

        return soap_app(soap_environ, start_response)

    # React frontend
    if method in ("GET", "HEAD"):
        root_dir = os.path.realpath(FRONTEND_DIR)

        if path == "/":
            return serve_file(
                os.path.join(root_dir, "index.html"),
                start_response,
                method,
            )

        requested_file = os.path.realpath(
            os.path.join(root_dir, path.lstrip("/"))
        )

        # Prevent paths escaping the frontend build directory
        if os.path.commonpath(
            [root_dir, requested_file]
        ) != root_dir:
            body = b"Forbidden"
            start_response(
                "403 Forbidden",
                [
                    ("Content-Type", "text/plain; charset=utf-8"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        if os.path.isfile(requested_file):
            return serve_file(
                requested_file,
                start_response,
                method,
            )

        # React client-side routes
        return serve_file(
            os.path.join(root_dir, "index.html"),
            start_response,
            method,
        )

    body = b"Method not allowed"

    start_response(
        "405 Method Not Allowed",
        [
            ("Content-Type", "text/plain; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Allow", "GET, HEAD, POST"),
        ],
    )

    return [body]
