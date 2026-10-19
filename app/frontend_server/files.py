
import mimetypes
import os


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
