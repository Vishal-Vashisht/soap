
from spyne import Application
from spyne.protocol.soap import Soap11
from spyne.server.wsgi import WsgiApplication

from .services import CalculatorService


soap_application = Application(
    [CalculatorService],
    tns="http://example.com/calculator",
    in_protocol=Soap11(),
    out_protocol=Soap11(),
)

soap_app = WsgiApplication(soap_application)
