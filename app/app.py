
import os
import mimetypes
from decimal import Decimal
from urllib.parse import parse_qs

from spyne import (
    Application,
    rpc,
    ServiceBase,
    Integer,
    Unicode,
    Decimal as SpyneDecimal,
    Array,
    ComplexModel,
)
from spyne.protocol.soap import Soap11
from spyne.server.wsgi import WsgiApplication


# ==========================================
# React frontend build directory
# ==========================================

FRONTEND_DIR = os.environ.get("FRONTEND_DIR")


# ==========================================
# SOAP service definitions
# ==========================================

class Employee(ComplexModel):
    employee_id = Integer
    name = Unicode
    salary = SpyneDecimal


class CalculatorService(ServiceBase):

    @rpc(Integer, Integer, _returns=Integer)
    def add(self, add_first, add_second):
        return add_first + add_second

    @rpc(Integer, Integer, _returns=Integer)
    def multiply(self, mul_first, mul_second):
        return mul_first * mul_second

    @rpc(_returns=Array(Employee))
    def get_employees(self):
        return [
            Employee(
                employee_id=1,
                name="Alice",
                salary=Decimal("50000.00"),
            ),
            Employee(
                employee_id=2,
                name="Bob",
                salary=Decimal("60000.00"),
            ),
            Employee(
                employee_id=3,
                name="Charlie",
                salary=Decimal("70000.00"),
            ),
        ]


# ==========================================
# Configure SOAP application
# ==========================================

soap_application = Application(
    [CalculatorService],
    tns="http://example.com/calculator",
    in_protocol=Soap11(),
    out_protocol=Soap11(),
)

soap_app = WsgiApplication(soap_application)


# ==========================================
# Serve React files
# ==========================================

def serve_file(file_path, start_response, method="GET"):
    if not os.path.isfile(file_path):
        body = b"File not found"
        start_response(
            "404 Not Found",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Content-Length", str(len(body))),
            ],
        )
        return [b"" if method == "HEAD" else body]

    content_type = (
        mimetypes.guess_type(file_path)[0]
        or "application/octet-stream"
    )

    file_size = os.path.getsize(file_path)

    start_response(
        "200 OK",
        [
            ("Content-Type", content_type),
            ("Content-Length", str(file_size)),
        ],
    )

    if method == "HEAD":
        return [b""]

    with open(file_path, "rb") as file:
        return [file.read()]


# ==========================================
# Main WSGI application: React + SOAP
# ==========================================

def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    query = parse_qs(environ.get("QUERY_STRING", ""))

    # --------------------------------------
    # SOAP routes: /soap and /soap?wsdl
    # --------------------------------------

    if path == "/soap" or path.startswith("/soap/"):
        soap_environ = environ.copy()

        original_script_name = environ.get("SCRIPT_NAME", "")
        soap_environ["SCRIPT_NAME"] = (
            original_script_name.rstrip("/") + "/soap"
        )

        soap_environ["PATH_INFO"] = path[len("/soap"):] or "/"

        # Download the WSDL as an attachment
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

    # --------------------------------------
    # React frontend routes
    # --------------------------------------

    if method in ("GET", "HEAD"):
        # Homepage
        if path == "/":
            index_file = os.path.join(FRONTEND_DIR, "index.html")
            return serve_file(index_file, start_response, method)

        # Resolve requested file inside the frontend build directory
        relative_path = path.lstrip("/")
        root_dir = os.path.realpath(FRONTEND_DIR)
        requested_file = os.path.realpath(
            os.path.join(root_dir, relative_path)
        )

        # Prevent paths from escaping the build directory
        if (
            os.path.commonpath([root_dir, requested_file])
            != root_dir
        ):
            body = b"Forbidden"
            start_response(
                "403 Forbidden",
                [
                    ("Content-Type", "text/plain; charset=utf-8"),
                    ("Content-Length", str(len(body))),
                ],
            )
            return [body]

        # Serve assets and other existing files
        if os.path.isfile(requested_file):
            return serve_file(
                requested_file,
                start_response,
                method,
            )

        # Fall back to index.html for React client-side routes
        index_file = os.path.join(FRONTEND_DIR, "index.html")
        return serve_file(index_file, start_response, method)

    # --------------------------------------
    # Unsupported methods
    # --------------------------------------

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
