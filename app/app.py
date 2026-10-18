
from decimal import Decimal

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


# Define the structure of an employee object
class Employee(ComplexModel):
    employee_id = Integer
    name = Unicode
    salary = SpyneDecimal


class CalculatorService(ServiceBase):

    # Add two numbers
    @rpc(Integer, Integer, _returns=Integer)
    def add(self, add_first, add_second):
        return add_first + add_second

    # Multiply two numbers
    @rpc(Integer, Integer, _returns=Integer)
    def multiply(self, mul_first, mul_second):
        return mul_first * mul_second

    # Return an array of employee objects
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


# Configure the SOAP application
soap_application = Application(
    [CalculatorService],
    tns="http://example.com/calculator",
    in_protocol=Soap11(),
    out_protocol=Soap11(),
)

# WSGI entry point for PythonAnywhere
application = WsgiApplication(soap_application)
