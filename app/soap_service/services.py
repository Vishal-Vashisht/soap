
from decimal import Decimal

from spyne import rpc, ServiceBase, Integer, Array

from .models import Employee


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
